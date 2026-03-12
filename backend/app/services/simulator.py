"""Packet simulation engine.

Resolves source/destination IPs to zones and evaluates firewall rules
to determine the verdict for a simulated packet.
"""

import ipaddress
from dataclasses import dataclass, field

from app.models import Rule, Zone


@dataclass
class RuleEvaluation:
    rule_id: str
    rule_name: str
    matched: bool
    reason: str
    skipped_disabled: bool = False
    unresolvable_constraints: list[str] = field(default_factory=list)


@dataclass
class SimulationResult:
    source_zone_id: str
    source_zone_name: str
    destination_zone_id: str
    destination_zone_name: str
    verdict: str  # "ALLOW", "BLOCK", "REJECT", "NO_MATCH"
    matched_rule_id: str | None
    matched_rule_name: str | None
    default_policy_used: bool
    evaluations: list[RuleEvaluation] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)


def resolve_zone(ip: str, zones: list[Zone]) -> str | None:
    """Match an IP address against zone network subnets.

    Returns the zone ID if the IP falls within a zone's network subnet,
    or None if no match is found.
    """
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return None

    for zone in zones:
        for network in zone.networks:
            if network.subnet is None:
                continue
            try:
                net = ipaddress.ip_network(network.subnet, strict=False)
            except ValueError:
                continue
            if addr in net:
                return zone.id

    return None


def _protocol_matches(rule_protocol: str, packet_protocol: str | None) -> bool:
    """Check if a rule's protocol matches the packet's protocol."""
    if rule_protocol == "all":
        return True
    if packet_protocol is None:
        return True
    return rule_protocol.lower() == packet_protocol.lower()


def _port_matches(rule_port_ranges: list[str], packet_port: int | None) -> bool:
    """Check if a packet's port matches any of the rule's port ranges."""
    if not rule_port_ranges:
        # No port restriction means match all ports
        return True
    if packet_port is None:
        # Rule has port restrictions but packet has no port -- no match
        return False

    for port_range in rule_port_ranges:
        if "-" in port_range:
            parts = port_range.split("-", 1)
            try:
                low, high = int(parts[0]), int(parts[1])
            except ValueError:
                continue
            if low <= packet_port <= high:
                return True
        else:
            try:
                if packet_port == int(port_range):
                    return True
            except ValueError:
                continue

    return False


def _ip_matches(rule_ip_ranges: list[str], packet_ip: str | None) -> bool:
    """Check if a packet's IP matches any of the rule's IP ranges/CIDRs."""
    if not rule_ip_ranges:
        return True
    if packet_ip is None:
        return True  # No packet IP = treat as "any"
    try:
        addr = ipaddress.ip_address(packet_ip)
    except ValueError:
        return False
    for ip_range in rule_ip_ranges:
        try:
            net = ipaddress.ip_network(ip_range, strict=False)
            if addr in net:
                return True
        except ValueError:
            continue
    return False


@dataclass
class _MatchResult:
    """Result of matching a single rule against packet constraints."""

    all_match: bool
    reasons: list[str]


def _match_rule(
    rule: Rule,
    protocol: str | None,
    port: int | None,
    source_ip: str | None,
    destination_ip: str | None,
    source_port: int | None,
) -> _MatchResult:
    """Check all constraints for a single rule against packet parameters."""
    checks: list[tuple[bool, str]] = []

    checks.append(
        (
            _protocol_matches(rule.protocol, protocol),
            f"protocol mismatch (rule={rule.protocol}, packet={protocol})",
        )
    )
    dst_ports = [*rule.port_ranges, *rule.destination_port_group_members]
    checks.append(
        (
            _port_matches(dst_ports, port),
            f"port mismatch (rule ports={dst_ports or 'any'}, packet={port})",
        )
    )
    src_port_ranges = [*rule.source_port_ranges, *rule.source_port_group_members]
    checks.append(
        (
            True if source_port is None else _port_matches(src_port_ranges, source_port),
            f"source port mismatch (packet={source_port})",
        )
    )
    checks.append(
        (
            _ip_matches([*rule.ip_ranges, *rule.source_ip_ranges, *rule.source_address_group_members], source_ip),
            f"source IP mismatch (packet={source_ip})",
        )
    )
    checks.append(
        (
            _ip_matches(rule.destination_address_group_members, destination_ip),
            f"destination IP mismatch (packet={destination_ip})",
        )
    )

    reasons = [msg for ok, msg in checks if not ok]
    return _MatchResult(all_match=not reasons, reasons=reasons)


def _collect_unresolvable(rule: Rule) -> list[str]:
    """Collect constraints the simulator cannot evaluate."""
    constraints: list[str] = []
    for mac in rule.source_mac_addresses:
        constraints.append(f"Rule requires source MAC {mac}")
    for mac in rule.destination_mac_addresses:
        constraints.append(f"Rule requires destination MAC {mac}")
    if rule.schedule:
        constraints.append(f"Rule has schedule '{rule.schedule}'")
    if rule.match_ip_sec and rule.match_ip_sec not in ("False", "false", "MATCH_NONE"):
        constraints.append(f"Rule requires IPSec match '{rule.match_ip_sec}'")
    if rule.connection_state_type:
        constraints.append(f"Rule requires connection state '{rule.connection_state_type}'")
    return constraints


def _gather_assumptions(evaluations: list[RuleEvaluation]) -> list[str]:
    """Collect all unique unresolvable constraints from evaluations."""
    all_unresolvable: list[str] = []
    for ev in evaluations:
        all_unresolvable.extend(ev.unresolvable_constraints)
    return sorted(set(all_unresolvable)) if all_unresolvable else []


def evaluate_rules(
    rules: list[Rule],
    source_zone_id: str,
    destination_zone_id: str,
    protocol: str | None = None,
    port: int | None = None,
    source_ip: str | None = None,
    destination_ip: str | None = None,
    source_port: int | None = None,
) -> SimulationResult:
    """Evaluate firewall rules for a simulated packet.

    Rules are sorted by index and evaluated in order. Disabled rules are
    skipped. The first matching rule determines the verdict.

    If no rule matches, the default policy is "BLOCK" (deny by default).
    """
    evaluations: list[RuleEvaluation] = []
    sorted_rules = sorted(rules, key=lambda r: r.index)

    for rule in sorted_rules:
        # Only consider rules for this zone pair
        if rule.source_zone_id != source_zone_id or rule.destination_zone_id != destination_zone_id:
            continue

        if not rule.enabled:
            evaluations.append(
                RuleEvaluation(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    matched=False,
                    reason="Rule is disabled",
                    skipped_disabled=True,
                )
            )
            continue

        result = _match_rule(rule, protocol, port, source_ip, destination_ip, source_port)

        if result.all_match:
            unresolvable = _collect_unresolvable(rule)
            evaluations.append(
                RuleEvaluation(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    matched=True,
                    reason=f"Matched: protocol={rule.protocol}, ports={rule.port_ranges or 'any'}",
                    unresolvable_constraints=unresolvable,
                )
            )
            assumptions = _gather_assumptions(evaluations)
            return SimulationResult(
                source_zone_id=source_zone_id,
                source_zone_name="",  # filled by caller
                destination_zone_id=destination_zone_id,
                destination_zone_name="",  # filled by caller
                verdict=rule.action,
                matched_rule_id=rule.id,
                matched_rule_name=rule.name,
                default_policy_used=False,
                evaluations=evaluations,
                assumptions=assumptions,
            )
        else:
            evaluations.append(
                RuleEvaluation(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    matched=False,
                    reason="No match: " + ", ".join(result.reasons),
                )
            )

    # No rule matched -- default deny
    assumptions = _gather_assumptions(evaluations)
    return SimulationResult(
        source_zone_id=source_zone_id,
        source_zone_name="",
        destination_zone_id=destination_zone_id,
        destination_zone_name="",
        verdict="BLOCK",
        matched_rule_id=None,
        matched_rule_name=None,
        default_policy_used=True,
        evaluations=evaluations,
        assumptions=assumptions,
    )
