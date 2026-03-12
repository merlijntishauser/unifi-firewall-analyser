"""Static firewall rule analyzer.

Analyzes zone pair rules for security risks and computes a posture score.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.models import Rule

DEDUCTIONS = {"high": 15, "medium": 8, "low": 2}

_EXTERNAL_NAMES = {"external", "wan", "internet"}
_INTERNAL_NAMES = {"internal", "lan", "default"}
_BLOCK_ACTIONS = {"BLOCK", "REJECT", "DROP"}
_RETURN_TRAFFIC_KEYWORDS = {"return", "established", "related"}
_RETURN_TRAFFIC_STATES = {"return", "established", "related"}


@dataclass
class Finding:
    id: str
    severity: str  # "high", "medium", "low"
    title: str
    description: str
    rationale: str = ""
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


def _normalize_text(value: str) -> str:
    return value.strip().lower()


def _normalize_values(values: list[str]) -> tuple[str, ...]:
    return tuple(sorted(_normalize_text(value) for value in values if value.strip()))


def _tokenize(value: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", value.lower()))


def _has_identity_restrictions(rule: Rule) -> bool:
    return any(
        (
            rule.ip_ranges,
            rule.source_ip_ranges,
            rule.source_mac_addresses,
            rule.destination_mac_addresses,
            rule.source_network_id,
            rule.destination_network_id,
            rule.source_address_group_members,
            rule.destination_address_group_members,
        )
    )


def _destination_port_constraints(rule: Rule) -> list[str]:
    return [*rule.port_ranges, *rule.destination_port_group_members]


def _source_port_constraints(rule: Rule) -> list[str]:
    return [*rule.source_port_ranges, *rule.source_port_group_members]


def _has_port_restrictions(rule: Rule) -> bool:
    return bool(_destination_port_constraints(rule) or _source_port_constraints(rule))


def _is_allow_all_service(rule: Rule) -> bool:
    return rule.protocol.lower() == "all" and not _has_port_restrictions(rule)


def _is_return_traffic(rule: Rule) -> bool:
    """Detect established/related return traffic rules."""
    state_tokens = _tokenize(rule.connection_state_type)
    if state_tokens & _RETURN_TRAFFIC_STATES:
        return True
    return bool(_tokenize(rule.name) & _RETURN_TRAFFIC_KEYWORDS)


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
        and _is_allow_all_service(rule)
        and not _has_identity_restrictions(rule)
        and not _is_return_traffic(rule)
    ):
        return Finding(
            id="allow-all-external",
            severity="high",
            title="Unrestricted allow from external zone",
            description=f"Rule '{rule.name}' allows all traffic from {src_name} with no port or protocol restriction.",
            rationale=(
                f"This rule has no port, protocol, or IP restriction and the source zone '{src_name}' "
                "is internet-facing. Any service on the destination network is reachable."
            ),
            rule_id=rule.id,
        )
    return None


def _check_allow_all_protocols_ports(rule: Rule) -> Finding | None:
    if (
        rule.enabled
        and rule.action == "ALLOW"
        and _is_allow_all_service(rule)
        and not _is_return_traffic(rule)
    ):
        return Finding(
            id="allow-all-protocols-ports",
            severity="high",
            title="Allow rule with no port or protocol restriction",
            description=f"Rule '{rule.name}' allows all protocols and ports.",
            rationale=(
                "This rule allows all protocols and ports without restriction. "
                "Traffic matching this rule is not constrained to specific services."
            ),
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
        and not _has_identity_restrictions(rule)
        and not _is_return_traffic(rule)
    ):
        return Finding(
            id="allow-external-to-internal",
            severity="high",
            title="Allow from external to internal zone",
            description=f"Rule '{rule.name}' allows traffic from {src_name} to {dst_name} with no IP restriction.",
            rationale=(
                f"Traffic from '{src_name}' (internet-facing) can reach '{dst_name}' (internal) "
                "without IP-based access control. Any external host can initiate connections."
            ),
            rule_id=rule.id,
        )
    return None


def _check_disabled_block(rule: Rule) -> Finding | None:
    if not rule.enabled and rule.action in _BLOCK_ACTIONS:
        return Finding(
            id="disabled-block-rule",
            severity="medium",
            title="Disabled block rule",
            description=f"Rule '{rule.name}' blocks traffic but is disabled. Enable it or remove it.",
            rationale=(
                "A disabled block rule has no effect on traffic. If the block was intentional, "
                "leaving it disabled weakens the security posture."
            ),
            rule_id=rule.id,
        )
    return None


def _check_wide_port_range(rule: Rule) -> Finding | None:
    if rule.enabled and rule.action == "ALLOW":
        for pr in _destination_port_constraints(rule):
            if _port_range_width(pr) >= 1000:
                return Finding(
                    id="wide-port-range",
                    severity="medium",
                    title="Allow rule with wide port range",
                    description=f"Rule '{rule.name}' allows a wide port range ({pr}).",
                    rationale=(
                        f"A port range of {_port_range_width(pr)} ports exposes a large attack surface. "
                        "Consider restricting to the specific ports required."
                    ),
                    rule_id=rule.id,
                )
    return None


def _parse_port_constraint(port_range: str) -> tuple[int, int] | None:
    normalized = port_range.strip()
    if not normalized:
        return None
    if "-" not in normalized:
        try:
            port = int(normalized)
        except ValueError:
            return None
        return (port, port)
    low_raw, high_raw = normalized.split("-", 1)
    try:
        low = int(low_raw)
        high = int(high_raw)
    except ValueError:
        return None
    if low > high:
        return None
    return (low, high)


def _ports_cover(earlier: list[str], later: list[str]) -> bool:
    if not earlier:
        return True
    if not later:
        return False

    parsed_earlier = [_parse_port_constraint(port) for port in earlier]
    parsed_later = [_parse_port_constraint(port) for port in later]
    if any(port is None for port in parsed_earlier + parsed_later):
        return False

    earlier_ranges = [port for port in parsed_earlier if port is not None]
    later_ranges = [port for port in parsed_later if port is not None]
    return all(
        any(
            earlier_low <= later_low and later_high <= earlier_high
            for earlier_low, earlier_high in earlier_ranges
        )
        for later_low, later_high in later_ranges
    )


def _constraint_list_covers(earlier: list[str], later: list[str]) -> bool:
    earlier_values = _normalize_values(earlier)
    later_values = _normalize_values(later)
    if not earlier_values:
        return True
    if not later_values:
        return False
    return earlier_values == later_values


def _constraint_value_covers(earlier: str, later: str) -> bool:
    earlier_value = _normalize_text(earlier)
    later_value = _normalize_text(later)
    if not earlier_value:
        return True
    if not later_value:
        return False
    return earlier_value == later_value


def _protocol_covers(earlier: Rule, later: Rule) -> bool:
    earlier_protocol = earlier.protocol.lower()
    later_protocol = later.protocol.lower()
    return earlier_protocol == "all" or earlier_protocol == later_protocol


def _rule_shadows(earlier: Rule, later: Rule) -> bool:
    return (
        _protocol_covers(earlier, later)
        and _ports_cover(_destination_port_constraints(earlier), _destination_port_constraints(later))
        and _ports_cover(_source_port_constraints(earlier), _source_port_constraints(later))
        and _constraint_list_covers(earlier.ip_ranges, later.ip_ranges)
        and _constraint_list_covers(earlier.source_ip_ranges, later.source_ip_ranges)
        and _constraint_list_covers(earlier.source_mac_addresses, later.source_mac_addresses)
        and _constraint_list_covers(earlier.destination_mac_addresses, later.destination_mac_addresses)
        and _constraint_list_covers(earlier.source_address_group_members, later.source_address_group_members)
        and _constraint_list_covers(earlier.destination_address_group_members, later.destination_address_group_members)
        and _constraint_value_covers(earlier.source_network_id, later.source_network_id)
        and _constraint_value_covers(earlier.destination_network_id, later.destination_network_id)
        and _constraint_value_covers(earlier.connection_state_type, later.connection_state_type)
        and _constraint_value_covers(earlier.schedule, later.schedule)
        and _constraint_value_covers(earlier.match_ip_sec, later.match_ip_sec)
    )


def _check_predefined_rules(rules: list[Rule]) -> list[Finding]:
    predefined_rules = [rule for rule in rules if rule.predefined]
    if not predefined_rules:
        return []

    if len(predefined_rules) == 1:
        rule = predefined_rules[0]
        return [
            Finding(
                id="predefined-unreviewed",
                severity="low",
                title="Predefined UniFi rule present",
                description=f"UniFi predefined rule '{rule.name}' affects this zone pair. Review built-in behavior.",
                rationale=(
                    "Predefined rules are managed by UniFi and may change with firmware updates. "
                    "Review their behavior periodically."
                ),
                rule_id=rule.id,
            )
        ]

    return [
        Finding(
            id="predefined-unreviewed",
            severity="low",
            title="Predefined UniFi rules present",
            description=(
                f"{len(predefined_rules)} UniFi predefined rules affect this zone pair. "
                "Review built-in behavior."
            ),
            rationale=(
                "Predefined rules are managed by UniFi and may change with firmware updates. "
                "Review their behavior periodically."
            ),
        )
    ]



def _check_shadowed(rules: list[Rule]) -> list[Finding]:
    findings: list[Finding] = []
    enabled_rules = [r for r in rules if r.enabled]
    sorted_rules = sorted(enabled_rules, key=lambda r: r.index)

    for i, later in enumerate(sorted_rules):
        if later.predefined:
            continue
        for earlier in sorted_rules[:i]:
            if _rule_shadows(earlier, later):
                findings.append(
                    Finding(
                        id="shadowed-rule",
                        severity="medium",
                        title="Shadowed rule",
                        description=(
                            f"Rule '{later.name}' is shadowed by earlier rule '{earlier.name}' "
                            f"({earlier.action}) and will never match."
                        ),
                        rationale=(
                            f"Rule '{earlier.name}' at index {earlier.index} matches all traffic that "
                            f"'{later.name}' at index {later.index} would match. "
                            "The later rule will never execute."
                        ),
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
                rationale=(
                    "Without explicit rules, traffic between these zones relies entirely "
                    "on the default policy."
                ),
            )
        )
    else:
        findings.extend(_check_predefined_rules(rules))
        for rule in rules:
            if rule.predefined:
                continue
            broad_allow_finding = _check_allow_external_to_internal(rule, src_zone_name, dst_zone_name)
            if broad_allow_finding is None:
                broad_allow_finding = _check_allow_all_external(rule, src_zone_name)
            if broad_allow_finding is None:
                broad_allow_finding = _check_allow_all_protocols_ports(rule)
            if broad_allow_finding is not None:
                findings.append(broad_allow_finding)

            for check in (_check_disabled_block, _check_wide_port_range):
                finding = check(rule)
                if finding is not None:
                    findings.append(finding)

        findings.extend(_check_shadowed(rules))

    score = 100
    for f in findings:
        score -= DEDUCTIONS.get(f.severity, 0)
    score = max(score, 0)

    return AnalysisResult(score=score, grade=compute_grade(score), findings=findings)
