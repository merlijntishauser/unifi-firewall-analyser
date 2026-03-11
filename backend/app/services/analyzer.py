"""Static firewall rule analyzer.

Analyzes zone pair rules for security risks and computes a posture score.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.models import Rule

DEDUCTIONS = {"high": 15, "medium": 8, "low": 2}

_EXTERNAL_NAMES = {"external", "wan", "internet"}
_INTERNAL_NAMES = {"internal", "lan", "default"}
_RETURN_TRAFFIC_KEYWORDS = {"return", "established", "related", "state"}


@dataclass
class Finding:
    id: str
    severity: str  # "high", "medium", "low"
    title: str
    description: str
    rule_id: str | None = None
    source: str = "static"


@dataclass
class AnalysisResult:
    score: int
    grade: str
    findings: list[Finding] = field(default_factory=list)


def compute_grade(score: int) -> str:
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 65:
        return "C"
    if score >= 50:
        return "D"
    return "F"


def _is_external(zone_name: str) -> bool:
    return zone_name.lower() in _EXTERNAL_NAMES


def _is_internal(zone_name: str) -> bool:
    return zone_name.lower() in _INTERNAL_NAMES


def _is_return_traffic(rule: Rule) -> bool:
    """Detect stateful firewall return/established traffic rules."""
    name_lower = rule.name.lower()
    return any(kw in name_lower for kw in _RETURN_TRAFFIC_KEYWORDS)


def _port_range_width(port_range: str) -> int:
    if "-" in port_range:
        parts = port_range.split("-", 1)
        try:
            return int(parts[1]) - int(parts[0]) + 1
        except (ValueError, IndexError):
            return 0
    return 1


def _check_allow_all_external(rule: Rule, src_name: str) -> Finding | None:
    if (
        rule.enabled
        and rule.action == "ALLOW"
        and _is_external(src_name)
        and rule.protocol.lower() == "all"
        and not rule.port_ranges
        and not _is_return_traffic(rule)
    ):
        return Finding(
            id="allow-all-external",
            severity="high",
            title="Unrestricted allow from external zone",
            description=f"Rule '{rule.name}' allows all traffic from {src_name} with no port or protocol restriction.",
            rule_id=rule.id,
        )
    return None


def _check_allow_all_protocols_ports(rule: Rule) -> Finding | None:
    if (
        rule.enabled
        and rule.action == "ALLOW"
        and rule.protocol.lower() == "all"
        and not rule.port_ranges
        and not _is_return_traffic(rule)
    ):
        return Finding(
            id="allow-all-protocols-ports",
            severity="high",
            title="Allow rule with no port or protocol restriction",
            description=f"Rule '{rule.name}' allows all protocols and ports.",
            rule_id=rule.id,
        )
    return None


def _check_allow_external_to_internal(
    rule: Rule, src_name: str, dst_name: str
) -> Finding | None:
    if (
        rule.enabled
        and rule.action == "ALLOW"
        and _is_external(src_name)
        and _is_internal(dst_name)
        and not rule.ip_ranges
        and not _is_return_traffic(rule)
    ):
        return Finding(
            id="allow-external-to-internal",
            severity="high",
            title="Allow from external to internal zone",
            description=f"Rule '{rule.name}' allows traffic from {src_name} to {dst_name} with no IP restriction.",
            rule_id=rule.id,
        )
    return None


def _check_disabled_block(rule: Rule) -> Finding | None:
    if not rule.enabled and rule.action in ("BLOCK", "REJECT"):
        return Finding(
            id="disabled-block-rule",
            severity="medium",
            title="Disabled block rule",
            description=f"Rule '{rule.name}' blocks traffic but is disabled. Enable it or remove it.",
            rule_id=rule.id,
        )
    return None


def _check_wide_port_range(rule: Rule) -> Finding | None:
    if rule.enabled and rule.action == "ALLOW":
        for pr in rule.port_ranges:
            if _port_range_width(pr) >= 1000:
                return Finding(
                    id="wide-port-range",
                    severity="medium",
                    title="Allow rule with wide port range",
                    description=f"Rule '{rule.name}' allows a wide port range ({pr}).",
                    rule_id=rule.id,
                )
    return None


def _check_predefined(rule: Rule) -> Finding | None:
    if rule.predefined:
        return Finding(
            id="predefined-unreviewed",
            severity="low",
            title="Predefined rule",
            description=f"Rule '{rule.name}' is a built-in predefined rule.",
            rule_id=rule.id,
        )
    return None


def _check_shadowed(rules: list[Rule]) -> list[Finding]:
    findings: list[Finding] = []
    enabled_rules = [r for r in rules if r.enabled]
    sorted_rules = sorted(enabled_rules, key=lambda r: r.index)

    for i, later in enumerate(sorted_rules):
        for earlier in sorted_rules[:i]:
            if earlier.action != later.action:
                continue
            if (
                earlier.protocol.lower() != "all"
                and earlier.protocol.lower() != later.protocol.lower()
            ):
                continue
            if (
                earlier.port_ranges
                and later.port_ranges
                and set(earlier.port_ranges) != set(later.port_ranges)
            ):
                continue
            if not earlier.port_ranges and not earlier.ip_ranges:
                findings.append(
                    Finding(
                        id="shadowed-rule",
                        severity="medium",
                        title="Shadowed rule",
                        description=f"Rule '{later.name}' is shadowed by '{earlier.name}' and will never match.",
                        rule_id=later.id,
                    )
                )
                break
    return findings


def analyze_zone_pair(
    rules: list[Rule], src_zone_name: str, dst_zone_name: str
) -> AnalysisResult:
    """Analyze a zone pair's rules and return findings with a score."""
    findings: list[Finding] = []

    if not rules:
        findings.append(
            Finding(
                id="no-explicit-rules",
                severity="low",
                title="No explicit rules",
                description="This zone pair has no explicit firewall rules.",
            )
        )
    else:
        for rule in rules:
            for check in (
                lambda r: _check_allow_all_external(r, src_zone_name),
                _check_allow_all_protocols_ports,
                lambda r: _check_allow_external_to_internal(
                    r, src_zone_name, dst_zone_name
                ),
                _check_disabled_block,
                _check_wide_port_range,
                _check_predefined,
            ):
                finding = check(rule)
                if finding is not None:
                    findings.append(finding)

        findings.extend(_check_shadowed(rules))

    score = 100
    for f in findings:
        score -= DEDUCTIONS.get(f.severity, 0)
    score = max(score, 0)

    return AnalysisResult(score=score, grade=compute_grade(score), findings=findings)
