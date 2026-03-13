"""AI-powered firewall rule analyzer with caching."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import UTC, datetime
from pathlib import Path

import httpx

from app.database import DEFAULT_DB_PATH, get_connection
from app.models import AiAnalysisResult, FindingModel, Rule
from app.services.ai_settings import get_ai_analysis_settings, get_full_ai_config
from app.services.analyzer import Finding

logger = logging.getLogger(__name__)

AI_PROMPT_VERSION = "2026-03-13-v1"

_SITE_PROFILE_CONTEXT = {
    "homelab": (
        "This is a homelab environment. Convenience-driven broad rules are common and "
        "acceptable for internal traffic, but external-facing risks remain critical. "
        "Prioritize external exposure and egress risks over internal segmentation."
    ),
    "smb": (
        "This is a small/medium business environment. Simple segmentation and auditability "
        "matter. Flag convenience-driven exceptions but keep remediation practical."
    ),
    "enterprise": (
        "This is an enterprise environment. Prioritize least privilege, blast radius "
        "minimization, logging coverage, and change control. Flag any broad allow rules, "
        "missing logging, and overly permissive address groups."
    ),
}


def _build_system_prompt(src_zone: str, dst_zone: str, site_profile: str) -> str:
    """Build the system prompt with site context."""
    profile_context = _SITE_PROFILE_CONTEXT.get(site_profile, _SITE_PROFILE_CONTEXT["homelab"])
    return (
        f"You are a network security reviewer analyzing firewall rules between "
        f"zone '{src_zone}' and zone '{dst_zone}'.\n\n"
        f"Context:\n"
        f"- Static analysis has already been performed and its findings are included below.\n"
        f"- Focus on risks and rule interactions that static analysis might miss.\n"
        f"- Do not invent facts not present in the rule data.\n"
        f"- {profile_context}\n\n"
        f"Return a JSON array of findings. Each finding must have:\n"
        f"- severity: \"high\", \"medium\", or \"low\"\n"
        f"- title: short summary\n"
        f"- description: detailed explanation\n"
        f"- rule_ids: array of rule IDs this finding relates to (empty if pair-level)\n"
        f"- confidence: \"low\", \"medium\", or \"high\"\n"
        f"- rationale: why this is a concern\n"
        f"- recommended_action: what to do about it\n\n"
        f"Return ONLY the JSON array, no other text."
    )


def _build_cache_key(
    rules: list[Rule],
    src_zone_name: str = "",
    dst_zone_name: str = "",
    model: str = "",
    site_profile: str = "",
    prompt_version: str = "",
    static_summary: str = "",
) -> str:
    """Build a deterministic cache key from all inputs that affect output."""
    normalized = sorted(
        [r.model_dump(exclude={"description"}) for r in rules],
        key=lambda d: d["id"],
    )
    content = json.dumps({
        "rules": normalized,
        "src_zone": src_zone_name,
        "dst_zone": dst_zone_name,
        "model": model,
        "site_profile": site_profile,
        "prompt_version": prompt_version,
        "static_summary": static_summary,
    }, sort_keys=True)
    return hashlib.sha256(content.encode()).hexdigest()


def _get_cached(db_path: Path, cache_key: str) -> list[dict] | None:  # type: ignore[type-arg]
    """Check cache for existing analysis."""
    conn = get_connection(db_path)
    row = conn.execute(
        "SELECT findings FROM ai_analysis_cache WHERE cache_key = ?",
        (cache_key,),
    ).fetchone()
    conn.close()
    if row is None:
        return None
    return json.loads(row[0])  # type: ignore[no-any-return]


def _save_cache(
    db_path: Path, cache_key: str, zone_pair_key: str, findings: list[dict]  # type: ignore[type-arg]
) -> None:
    """Save analysis results to cache."""
    conn = get_connection(db_path)
    conn.execute(
        """INSERT OR REPLACE INTO ai_analysis_cache (cache_key, zone_pair_key, findings, created_at)
           VALUES (?, ?, ?, ?)""",
        (cache_key, zone_pair_key, json.dumps(findings), datetime.now(UTC).isoformat()),
    )
    conn.commit()
    conn.close()


def _summarize_static_findings(findings: list[Finding]) -> str:
    """Produce a compact text summary of static findings for the AI prompt."""
    if not findings:
        return "No static analysis findings."
    lines = [f"- [{f.severity}] {f.title}" for f in findings]
    return "Static analysis findings:\n" + "\n".join(lines)


def _build_prompt(
    rules: list[Rule],
    src_zone_name: str,
    dst_zone_name: str,
    site_profile: str,
    static_summary: str,
) -> str:
    """Build the user prompt with rules data and context."""
    rules_text = json.dumps([r.model_dump() for r in rules], indent=2)
    return (
        f"Firewall rules from '{src_zone_name}' to '{dst_zone_name}':\n\n"
        f"{rules_text}\n\n"
        f"Site profile: {site_profile}\n"
        f"Prompt version: {AI_PROMPT_VERSION}\n\n"
        f"{static_summary}"
    )


def _call_openai(
    base_url: str, api_key: str, model: str, system_prompt: str, user_prompt: str
) -> str:
    """Call an OpenAI-compatible API."""
    url = f"{base_url}/chat/completions"
    resp = httpx.post(
        url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
        },
        timeout=60.0,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]  # type: ignore[no-any-return]


def _call_anthropic(
    base_url: str, api_key: str, model: str, system_prompt: str, user_prompt: str
) -> str:
    """Call the Anthropic API."""
    url = f"{base_url}/messages"
    resp = httpx.post(
        url,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "max_tokens": 4096,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        },
        timeout=60.0,
    )
    resp.raise_for_status()
    return resp.json()["content"][0]["text"]  # type: ignore[no-any-return]


def _parse_findings(response_text: str) -> list[dict]:  # type: ignore[type-arg]
    """Parse LLM response into findings list."""
    text = response_text.strip()
    # Handle markdown code blocks
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
        if text.endswith("```"):
            text = text[:-3].strip()

    findings = json.loads(text)
    if not isinstance(findings, list):
        return []

    valid: list[dict] = []  # type: ignore[type-arg]
    for f in findings:
        if isinstance(f, dict) and "severity" in f and "title" in f and "description" in f:
            valid.append({
                "severity": f["severity"],
                "title": f["title"],
                "description": f["description"],
                "rule_ids": f.get("rule_ids", []),
                "confidence": f.get("confidence", ""),
                "rationale": f.get("rationale", ""),
                "recommended_action": f.get("recommended_action", ""),
            })
    return valid


def _findings_from_raw(raw: list[dict]) -> list[FindingModel]:  # type: ignore[type-arg]
    """Convert raw finding dicts to FindingModel instances."""
    return [
        FindingModel(
            id=f"ai-{i}",
            severity=f["severity"],
            title=f["title"],
            description=f["description"],
            rule_ids=f.get("rule_ids", []),
            confidence=f.get("confidence", ""),
            rationale=f.get("rationale", ""),
            recommended_action=f.get("recommended_action", ""),
            source="ai",
        )
        for i, f in enumerate(raw)
    ]


async def analyze_with_ai(
    rules: list[Rule],
    src_zone_name: str,
    dst_zone_name: str,
    db_path: Path = DEFAULT_DB_PATH,
    static_findings: list[Finding] | None = None,
) -> AiAnalysisResult:
    """Analyze rules with AI. Returns explicit status instead of empty list on error."""
    config = get_full_ai_config(db_path)
    if config is None:
        logger.debug("No AI config found, skipping analysis")
        return AiAnalysisResult(status="error", message="No AI provider configured")

    analysis_settings = get_ai_analysis_settings(db_path)
    site_profile = analysis_settings["site_profile"]
    model = config["model"]
    static_summary = _summarize_static_findings(static_findings or [])

    cache_key = _build_cache_key(
        rules, src_zone_name, dst_zone_name, model, site_profile, AI_PROMPT_VERSION, static_summary,
    )
    zone_pair_key = f"{src_zone_name}->{dst_zone_name}"
    logger.debug("AI analysis for %s (cache_key=%s, profile=%s)", zone_pair_key, cache_key[:12], site_profile)

    # Check cache
    cached = _get_cached(db_path, cache_key)
    if cached is not None:
        logger.debug("Cache hit for %s (%d findings)", zone_pair_key, len(cached))
        return AiAnalysisResult(status="ok", findings=_findings_from_raw(cached), cached=True)

    # Build prompts
    system_prompt = _build_system_prompt(src_zone_name, dst_zone_name, site_profile)
    user_prompt = _build_prompt(rules, src_zone_name, dst_zone_name, site_profile, static_summary)

    try:
        provider_type = config.get("provider_type", "openai")
        logger.debug("Calling %s API (model=%s)", provider_type, model)
        if provider_type == "anthropic":
            response_text = _call_anthropic(
                config["base_url"], config["api_key"], model, system_prompt, user_prompt,
            )
        else:
            response_text = _call_openai(
                config["base_url"], config["api_key"], model, system_prompt, user_prompt,
            )
    except httpx.HTTPStatusError as exc:
        logger.warning("AI provider returned HTTP %s for %s", exc.response.status_code, zone_pair_key)
        return AiAnalysisResult(status="error", message=f"Provider returned HTTP {exc.response.status_code}")
    except httpx.TimeoutException:
        logger.warning("AI provider timed out for %s", zone_pair_key)
        return AiAnalysisResult(status="error", message="Provider request timed out")
    except httpx.ConnectError as exc:
        logger.warning("AI provider connection failed for %s: %s", zone_pair_key, exc)
        return AiAnalysisResult(status="error", message="Connection to AI provider failed")
    except Exception:
        logger.exception("AI analysis failed for %s", zone_pair_key)
        return AiAnalysisResult(status="error", message="Unexpected error during AI analysis")

    try:
        raw_findings = _parse_findings(response_text)
    except (json.JSONDecodeError, ValueError):
        logger.warning("Failed to parse AI response for %s", zone_pair_key)
        return AiAnalysisResult(status="error", message="Failed to parse AI response")

    logger.debug("AI returned %d findings for %s", len(raw_findings), zone_pair_key)
    _save_cache(db_path, cache_key, zone_pair_key, raw_findings)
    return AiAnalysisResult(status="ok", findings=_findings_from_raw(raw_findings), cached=False)
