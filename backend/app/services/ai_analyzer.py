"""AI-powered firewall rule analyzer with caching."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import UTC, datetime
from pathlib import Path

import httpx

from app.database import DEFAULT_DB_PATH, get_connection
from app.models import FindingModel, Rule
from app.services.ai_settings import get_full_ai_config

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are a network security analyst. Analyze these firewall rules between "
    "zone '{src}' and zone '{dst}'. Return a JSON array of findings, each with: "
    "severity (high/medium/low), title, and description. Focus on security risks, "
    "misconfigurations, and rule interactions that static analysis might miss. "
    "Return ONLY the JSON array, no other text."
)


def _build_cache_key(rules: list[Rule]) -> str:
    """Build a deterministic cache key from rules content."""
    normalized = sorted(
        [r.model_dump(exclude={"description"}) for r in rules],
        key=lambda d: d["id"],
    )
    content = json.dumps(normalized, sort_keys=True)
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


def _build_prompt(rules: list[Rule], src_zone_name: str, dst_zone_name: str) -> str:
    """Build the user prompt with rules data."""
    rules_text = json.dumps([r.model_dump() for r in rules], indent=2)
    return f"Firewall rules from '{src_zone_name}' to '{dst_zone_name}':\n\n{rules_text}"


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
            })
    return valid


async def analyze_with_ai(
    rules: list[Rule],
    src_zone_name: str,
    dst_zone_name: str,
    db_path: Path = DEFAULT_DB_PATH,
) -> list[FindingModel]:
    """Analyze rules with AI. Returns findings or empty list on error."""
    config = get_full_ai_config(db_path)
    if config is None:
        return []

    cache_key = _build_cache_key(rules)
    zone_pair_key = f"{src_zone_name}->{dst_zone_name}"

    # Check cache
    cached = _get_cached(db_path, cache_key)
    if cached is not None:
        return [
            FindingModel(
                id=f"ai-{i}",
                severity=f["severity"],
                title=f["title"],
                description=f["description"],
                source="ai",
            )
            for i, f in enumerate(cached)
        ]

    # Build prompts
    system_prompt = _SYSTEM_PROMPT.format(src=src_zone_name, dst=dst_zone_name)
    user_prompt = _build_prompt(rules, src_zone_name, dst_zone_name)

    try:
        provider_type = config.get("provider_type", "openai")
        if provider_type == "anthropic":
            response_text = _call_anthropic(
                config["base_url"],
                config["api_key"],
                config["model"],
                system_prompt,
                user_prompt,
            )
        else:
            response_text = _call_openai(
                config["base_url"],
                config["api_key"],
                config["model"],
                system_prompt,
                user_prompt,
            )

        raw_findings = _parse_findings(response_text)
        _save_cache(db_path, cache_key, zone_pair_key, raw_findings)

        return [
            FindingModel(
                id=f"ai-{i}",
                severity=f["severity"],
                title=f["title"],
                description=f["description"],
                source="ai",
            )
            for i, f in enumerate(raw_findings)
        ]

    except Exception:
        logger.exception("AI analysis failed for %s", zone_pair_key)
        return []
