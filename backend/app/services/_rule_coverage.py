"""Rule coverage and overlap comparison helpers.

Provides functions to determine whether one firewall rule's constraints
cover, shadow, or partially overlap another rule's constraints.
"""

from __future__ import annotations

from app.models import Rule


def _normalize_text(value: str) -> str:
    """Strip and lowercase a string for comparison."""
    return value.strip().lower()


def _normalize_values(values: list[str]) -> tuple[str, ...]:
    """Return a sorted tuple of normalized non-empty values."""
    return tuple(sorted(_normalize_text(v) for v in values if v.strip()))


def destination_port_constraints(rule: Rule) -> list[str]:
    """Combine port_ranges and destination_port_group_members into one list."""
    return [*rule.port_ranges, *rule.destination_port_group_members]


def source_port_constraints(rule: Rule) -> list[str]:
    """Combine source_port_ranges and source_port_group_members into one list."""
    return [*rule.source_port_ranges, *rule.source_port_group_members]


def has_port_restrictions(rule: Rule) -> bool:
    """Return True if the rule has any destination or source port constraints."""
    return bool(destination_port_constraints(rule) or source_port_constraints(rule))


def _parse_port_constraint(port_range: str) -> tuple[int, int] | None:
    """Parse a port constraint string into a (low, high) tuple, or None if invalid."""
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
    """Return True if every port in later is covered by at least one range in earlier."""
    if not earlier:
        return True
    if not later:
        return False
    parsed_earlier = [_parse_port_constraint(p) for p in earlier]
    parsed_later = [_parse_port_constraint(p) for p in later]
    if any(p is None for p in parsed_earlier + parsed_later):
        return False
    earlier_ranges = [p for p in parsed_earlier if p is not None]
    later_ranges = [p for p in parsed_later if p is not None]
    return all(
        any(e_lo <= l_lo and l_hi <= e_hi for e_lo, e_hi in earlier_ranges)
        for l_lo, l_hi in later_ranges
    )


def _constraint_list_covers(earlier: list[str], later: list[str]) -> bool:
    """Return True if earlier's list constraint covers later's (empty = unconstrained)."""
    earlier_vals = _normalize_values(earlier)
    later_vals = _normalize_values(later)
    if not earlier_vals:
        return True
    if not later_vals:
        return False
    return earlier_vals == later_vals


def _constraint_value_covers(earlier: str, later: str) -> bool:
    """Return True if earlier's scalar constraint covers later's (empty = unconstrained)."""
    e = _normalize_text(earlier)
    l_val = _normalize_text(later)
    if not e:
        return True
    if not l_val:
        return False
    return e == l_val


def protocol_covers(earlier: Rule, later: Rule) -> bool:
    """Return True if earlier's protocol covers later's ('all' covers any)."""
    ep = earlier.protocol.lower()
    lp = later.protocol.lower()
    return ep == "all" or ep == lp


def rule_shadows(earlier: Rule, later: Rule) -> bool:
    """Return True if earlier rule fully shadows later across all constraint dimensions."""
    return (
        protocol_covers(earlier, later)
        and _ports_cover(destination_port_constraints(earlier), destination_port_constraints(later))
        and _ports_cover(source_port_constraints(earlier), source_port_constraints(later))
        and _constraint_list_covers(earlier.ip_ranges, later.ip_ranges)
        and _constraint_list_covers(earlier.source_ip_ranges, later.source_ip_ranges)
        and _constraint_list_covers(earlier.source_mac_addresses, later.source_mac_addresses)
        and _constraint_list_covers(earlier.destination_mac_addresses, later.destination_mac_addresses)
        and _constraint_list_covers(earlier.source_address_group_members, later.source_address_group_members)
        and _constraint_list_covers(
            earlier.destination_address_group_members, later.destination_address_group_members
        )
        and _constraint_value_covers(earlier.source_network_id, later.source_network_id)
        and _constraint_value_covers(earlier.destination_network_id, later.destination_network_id)
        and _constraint_value_covers(earlier.connection_state_type, later.connection_state_type)
        and _constraint_value_covers(earlier.schedule, later.schedule)
        and _constraint_value_covers(earlier.match_ip_sec, later.match_ip_sec)
    )


def port_ranges_overlap(earlier_ports: list[str], later_ports: list[str]) -> bool:
    """Check if two sets of port constraints have any overlap."""
    if not earlier_ports or not later_ports:
        return True  # No port constraint = matches all
    earlier_parsed = [_parse_port_constraint(p) for p in earlier_ports]
    later_parsed = [_parse_port_constraint(p) for p in later_ports]
    earlier_ranges = [r for r in earlier_parsed if r is not None]
    later_ranges = [r for r in later_parsed if r is not None]
    if not earlier_ranges or not later_ranges:
        return False
    return any(
        e_lo <= l_hi and l_lo <= e_hi
        for e_lo, e_hi in earlier_ranges
        for l_lo, l_hi in later_ranges
    )
