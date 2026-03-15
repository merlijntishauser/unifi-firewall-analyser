"""Site health service: summary aggregation and AI-powered cross-domain analysis."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from datetime import UTC, datetime

import httpx
import structlog

from app.config import UnifiCredentials
from app.database import get_session
from app.models import (
    FirewallSummary,
    HealthAnalysisResult,
    HealthFinding,
    HealthSummaryResponse,
    MetricsSummary,
    TopologySummary,
)
from app.models_db import SiteHealthCacheRow
from app.services._ai_provider import call_anthropic, call_openai
from app.services.ai_settings import get_ai_analysis_settings, get_full_ai_config
from app.services.firewall import get_zone_pairs
from app.services.metrics import get_latest_snapshots, get_notifications
from app.services.topology import get_topology_devices

log = structlog.get_logger()

HEALTH_PROMPT_VERSION = "2026-03-15-v1"

_SITE_PROFILE_CONTEXT = {
    "homelab": (
        "This is a homelab environment. Focus on cross-domain issues that could indicate "
        "compromise or misconfiguration. Convenience-driven broad rules are acceptable "
        "internally, but flag external exposure combined with device anomalies."
    ),
    "smb": (
        "This is a small/medium business environment. Focus on compliance gaps, "
        "single points of failure, and security issues that span modules."
    ),
    "enterprise": (
        "This is an enterprise environment. Prioritize blast radius, lateral movement "
        "potential, single points of failure with high load, and compliance gaps."
    ),
}


def _compute_firewall_summary(credentials: UnifiCredentials) -> FirewallSummary:
    """Compute firewall summary from zone pairs."""
    zone_pairs = get_zone_pairs(credentials)
    grade_dist: Counter[str] = Counter()
    severity_dist: Counter[str] = Counter()
    uncovered = 0

    for zp in zone_pairs:
        if zp.analysis:
            grade_dist[zp.analysis.grade] += 1
            for f in zp.analysis.findings:
                severity_dist[f.severity] += 1
        user_rules = [r for r in zp.rules if not r.predefined]
        if not user_rules:
            uncovered += 1

    return FirewallSummary(
        zone_pair_count=len(zone_pairs),
        grade_distribution=dict(grade_dist),
        finding_count_by_severity=dict(severity_dist),
        uncovered_pairs=uncovered,
    )


def _compute_topology_summary(credentials: UnifiCredentials) -> TopologySummary:
    """Compute topology summary from devices."""
    topo = get_topology_devices(credentials)
    type_dist: Counter[str] = Counter()
    offline = 0
    versions_by_model: dict[str, set[str]] = {}

    for d in topo.devices:
        type_dist[d.type] += 1
        if d.status != "online":
            offline += 1
        versions_by_model.setdefault(d.model, set()).add(d.version)

    mismatches = sum(1 for versions in versions_by_model.values() if len(versions) > 1)

    return TopologySummary(
        device_count_by_type=dict(type_dist),
        offline_count=offline,
        firmware_mismatches=mismatches,
    )


def _compute_metrics_summary() -> MetricsSummary:
    """Compute metrics summary from DB data."""
    snapshots = get_latest_snapshots()
    notifications = get_notifications(include_resolved=False)

    severity_dist: Counter[str] = Counter()
    for n in notifications:
        severity_dist[n.severity] += 1

    high_resource = sum(1 for s in snapshots if s.cpu > 80 or s.mem > 85)
    recent_reboots = sum(1 for s in snapshots if s.uptime < 86400)

    return MetricsSummary(
        active_notifications_by_severity=dict(severity_dist),
        high_resource_devices=high_resource,
        recent_reboots=recent_reboots,
    )


def get_health_summary(credentials: UnifiCredentials) -> HealthSummaryResponse:
    """Gather health summary data from all modules."""
    firewall = _compute_firewall_summary(credentials)
    topology = _compute_topology_summary(credentials)
    metrics = _compute_metrics_summary()

    log.info("health_summary_computed")
    return HealthSummaryResponse(firewall=firewall, topology=topology, metrics=metrics)


def _build_health_system_prompt(site_profile: str) -> str:
    """Build system prompt for cross-domain health analysis."""
    profile_context = _SITE_PROFILE_CONTEXT.get(site_profile, _SITE_PROFILE_CONTEXT["homelab"])
    return (
        "You are a network infrastructure health analyst performing cross-domain analysis "
        "across firewall rules, network topology, and device metrics.\n\n"
        f"Context:\n"
        f"- {profile_context}\n"
        f"- Focus on issues that span multiple domains or that single-domain analysis cannot detect.\n"
        f"- Correlate firewall posture with topology risks and metric anomalies.\n"
        f"- Do not repeat findings that are obvious from a single domain alone.\n\n"
        f"Return a JSON array of findings. Each finding must have:\n"
        f'- severity: "critical", "high", "medium", or "low"\n'
        f"- title: short summary\n"
        f"- description: detailed explanation of the cross-domain concern\n"
        f'- affected_module: primary module ("firewall", "topology", or "metrics")\n'
        f'- affected_entity_id: zone pair key (e.g. "Internal->External") or device MAC\n'
        f"- recommended_action: what to do about it\n"
        f'- confidence: "low", "medium", or "high"\n\n'
        f"Return ONLY the JSON array, no other text."
    )


def _build_health_prompt(summary: HealthSummaryResponse) -> str:
    """Build user prompt from summary data."""
    fw = summary.firewall
    topo = summary.topology
    met = summary.metrics

    grades = ", ".join(f"{g}: {c}" for g, c in sorted(fw.grade_distribution.items()))
    severities = ", ".join(f"{s}: {c}" for s, c in sorted(fw.finding_count_by_severity.items()))
    types = ", ".join(f"{t}: {c}" for t, c in sorted(topo.device_count_by_type.items()))
    notif_sev = ", ".join(f"{s}: {c}" for s, c in sorted(met.active_notifications_by_severity.items()))

    return (
        f"Site health summary:\n\n"
        f"FIREWALL:\n"
        f"- Zone pairs: {fw.zone_pair_count}\n"
        f"- Grade distribution: {grades or 'none'}\n"
        f"- Finding count by severity: {severities or 'none'}\n"
        f"- Uncovered zone pairs (no user rules): {fw.uncovered_pairs}\n\n"
        f"TOPOLOGY:\n"
        f"- Devices by type: {types or 'none'}\n"
        f"- Offline devices: {topo.offline_count}\n"
        f"- Firmware mismatches (same model, different version): {topo.firmware_mismatches}\n\n"
        f"METRICS:\n"
        f"- Active notifications by severity: {notif_sev or 'none'}\n"
        f"- Devices with high resource usage (CPU >80% or memory >85%): {met.high_resource_devices}\n"
        f"- Devices rebooted in last 24h: {met.recent_reboots}\n\n"
        f"Prompt version: {HEALTH_PROMPT_VERSION}"
    )


def _build_cache_key(summary: HealthSummaryResponse, model: str, site_profile: str) -> str:
    """Build deterministic cache key from summary data, model, and site profile."""
    content = json.dumps({
        "firewall": summary.firewall.model_dump(),
        "topology": summary.topology.model_dump(),
        "metrics": summary.metrics.model_dump(),
        "model": model,
        "site_profile": site_profile,
        "prompt_version": HEALTH_PROMPT_VERSION,
    }, sort_keys=True)
    return hashlib.sha256(content.encode()).hexdigest()


def _get_cached(cache_key: str) -> tuple[list[dict], str] | None:  # type: ignore[type-arg]
    """Check cache for existing analysis. Returns (findings, created_at) or None."""
    session = get_session()
    try:
        row = session.get(SiteHealthCacheRow, cache_key)
    finally:
        session.close()
    if row is None:
        return None
    return json.loads(row.findings), row.created_at


def _save_cache(cache_key: str, findings: list[dict], created_at: str) -> None:  # type: ignore[type-arg]
    """Save analysis results to cache."""
    session = get_session()
    try:
        row = session.get(SiteHealthCacheRow, cache_key)
        if row is None:
            row = SiteHealthCacheRow(
                cache_key=cache_key,
                findings=json.dumps(findings),
                created_at=created_at,
            )
            session.add(row)
        else:
            row.findings = json.dumps(findings)
            row.created_at = created_at
        session.commit()
    finally:
        session.close()


def _parse_health_findings(response_text: str) -> list[dict]:  # type: ignore[type-arg]
    """Parse LLM response into health findings list."""
    text = response_text.strip()
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
                "affected_module": f.get("affected_module", ""),
                "affected_entity_id": f.get("affected_entity_id", ""),
                "recommended_action": f.get("recommended_action", ""),
                "confidence": f.get("confidence", ""),
            })
    return valid


def _findings_from_raw(raw: list[dict]) -> list[HealthFinding]:  # type: ignore[type-arg]
    """Convert raw finding dicts to HealthFinding instances."""
    return [
        HealthFinding(
            severity=f["severity"],
            title=f["title"],
            description=f["description"],
            affected_module=f.get("affected_module", ""),
            affected_entity_id=f.get("affected_entity_id", ""),
            recommended_action=f.get("recommended_action", ""),
            confidence=f.get("confidence", ""),
        )
        for f in raw
    ]


async def analyze_site_health(credentials: UnifiCredentials) -> HealthAnalysisResult:
    """Perform AI-powered cross-domain health analysis."""
    config = get_full_ai_config()
    if config is None:
        log.debug("health_analysis_no_config")
        return HealthAnalysisResult(status="error", message="No AI provider configured")

    analysis_settings = get_ai_analysis_settings()
    site_profile = analysis_settings["site_profile"]
    model = config["model"]

    summary = get_health_summary(credentials)
    cache_key = _build_cache_key(summary, model, site_profile)
    log.debug("health_analysis_start", cache_key=cache_key[:12], site_profile=site_profile)

    cached = _get_cached(cache_key)
    if cached is not None:
        raw_findings, analyzed_at = cached
        log.debug("health_analysis_cache_hit", finding_count=len(raw_findings))
        return HealthAnalysisResult(
            status="ok",
            findings=_findings_from_raw(raw_findings),
            cached=True,
            analyzed_at=analyzed_at,
        )

    system_prompt = _build_health_system_prompt(site_profile)
    user_prompt = _build_health_prompt(summary)

    try:
        provider_type = config.get("provider_type", "openai")
        log.debug("health_ai_call", provider=provider_type, model=model)
        if provider_type == "anthropic":
            response_text = call_anthropic(
                config["base_url"], config["api_key"], model, system_prompt, user_prompt,
            )
        else:
            response_text = call_openai(
                config["base_url"], config["api_key"], model, system_prompt, user_prompt,
            )
    except httpx.HTTPStatusError as exc:
        log.warning("health_provider_http_error", status_code=exc.response.status_code)
        return HealthAnalysisResult(status="error", message=f"Provider returned HTTP {exc.response.status_code}")
    except httpx.TimeoutException:
        log.warning("health_provider_timeout")
        return HealthAnalysisResult(status="error", message="Provider request timed out")
    except httpx.ConnectError as exc:
        log.warning("health_provider_connect_error", error=str(exc))
        return HealthAnalysisResult(status="error", message="Connection to AI provider failed")
    except Exception:
        log.exception("health_analysis_failed")
        return HealthAnalysisResult(status="error", message="Unexpected error during AI analysis")

    try:
        raw_findings = _parse_health_findings(response_text)
    except (json.JSONDecodeError, ValueError):
        log.warning("health_response_parse_error")
        return HealthAnalysisResult(status="error", message="Failed to parse AI response")

    analyzed_at = datetime.now(UTC).isoformat()
    log.debug("health_analysis_complete", finding_count=len(raw_findings))
    _save_cache(cache_key, raw_findings, analyzed_at)
    return HealthAnalysisResult(
        status="ok",
        findings=_findings_from_raw(raw_findings),
        cached=False,
        analyzed_at=analyzed_at,
    )
