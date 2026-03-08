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


def evaluate_rules(
    rules: list[Rule],
    source_zone_id: str,
    destination_zone_id: str,
    protocol: str | None = None,
    port: int | None = None,
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

        proto_match = _protocol_matches(rule.protocol, protocol)
        port_match = _port_matches(rule.port_ranges, port)

        if proto_match and port_match:
            evaluations.append(
                RuleEvaluation(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    matched=True,
                    reason=f"Matched: protocol={rule.protocol}, ports={rule.port_ranges or 'any'}",
                )
            )
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
            )
        else:
            reasons: list[str] = []
            if not proto_match:
                reasons.append(f"protocol mismatch (rule={rule.protocol}, packet={protocol})")
            if not port_match:
                reasons.append(f"port mismatch (rule={rule.port_ranges}, packet={port})")
            evaluations.append(
                RuleEvaluation(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    matched=False,
                    reason="No match: " + ", ".join(reasons),
                )
            )

    # No rule matched -- default deny
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
    )
