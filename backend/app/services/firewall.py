"""Firewall data service.

Fetches zone, rule, and zone-pair data from the UniFi controller
via the unifi-topology library.
"""

from __future__ import annotations

import contextlib
import logging

from unifi_topology import (
    Config,
    FirewallGroup,
    FirewallPolicy,
    FirewallZone,
    fetch_firewall_groups,
    fetch_firewall_policies,
    fetch_firewall_zones,
    fetch_networks,
    normalize_firewall_groups,
    normalize_firewall_policies,
    normalize_firewall_zones,
)

from app.config import UnifiCredentials
from app.models import FindingModel, Network, Rule, Zone, ZonePair, ZonePairAnalysis
from app.services.analyzer import analyze_zone_pair as run_analysis

logger = logging.getLogger(__name__)


def _to_topology_config(credentials: UnifiCredentials) -> Config:
    """Convert our credentials to a unifi-topology Config."""
    return Config(
        url=credentials.url,
        site=credentials.site,
        user=credentials.username,
        password=credentials.password,
        verify_ssl=credentials.verify_ssl,
    )


def _build_network_lookup(config: Config) -> dict[str, Network]:
    """Fetch networks and build a lookup by network ID."""
    raw_networks = fetch_networks(config)
    lookup: dict[str, Network] = {}
    for net in raw_networks:
        net_id = None
        net_name = "Unknown"
        vlan_id = None
        subnet = None

        if isinstance(net, dict):
            net_id = net.get("_id") or net.get("id")
            net_name = net.get("name", "Unknown")
            vlan_raw = net.get("vlan")
            vlan_enabled = net.get("vlan_enabled")
            if vlan_raw is not None and vlan_enabled is not False:
                with contextlib.suppress(ValueError, TypeError):
                    vlan_id = int(vlan_raw)
            subnet_raw = net.get("ip_subnet") or net.get("subnet")
            subnet = subnet_raw.strip() or None if isinstance(subnet_raw, str) else None

        if net_id is not None:
            lookup[str(net_id)] = Network(
                id=str(net_id),
                name=str(net_name),
                vlan_id=vlan_id,
                subnet=str(subnet) if subnet else None,
            )
    return lookup


def _zone_to_model(zone: FirewallZone, network_lookup: dict[str, Network]) -> Zone:
    """Convert a FirewallZone to our Zone model."""
    networks = [network_lookup[nid] for nid in zone.network_ids if nid in network_lookup]
    return Zone(id=zone.id, name=zone.name, networks=networks)


def _resolve_group(group_id: str, group_lookup: dict[str, FirewallGroup]) -> tuple[str, list[str]]:
    """Resolve a group ID to its name and members."""
    if not group_id or group_id not in group_lookup:
        return "", []
    group = group_lookup[group_id]
    return group.name, list(group.members)


def _build_group_lookup(config: Config) -> dict[str, FirewallGroup]:
    """Fetch firewall groups and build a lookup by ID."""
    raw_groups = fetch_firewall_groups(config)
    return {g.id: g for g in normalize_firewall_groups(raw_groups)}


def _policy_to_rule(policy: FirewallPolicy, group_lookup: dict[str, FirewallGroup]) -> Rule:
    """Convert a FirewallPolicy to our Rule model."""
    src_port_name, src_port_members = _resolve_group(policy.source_port_group_id, group_lookup)
    dst_port_name, dst_port_members = _resolve_group(policy.destination_port_group_id, group_lookup)
    src_addr_name, src_addr_members = _resolve_group(policy.source_address_group_id, group_lookup)
    dst_addr_name, dst_addr_members = _resolve_group(policy.destination_address_group_id, group_lookup)
    return Rule(
        id=policy.id,
        name=policy.name,
        description=policy.description,
        enabled=policy.enabled,
        action=policy.action,
        source_zone_id=policy.source_zone_id,
        destination_zone_id=policy.destination_zone_id,
        protocol=policy.protocol,
        port_ranges=list(policy.port_ranges),
        ip_ranges=list(policy.ip_ranges),
        index=policy.index,
        predefined=policy.predefined,
        source_ip_ranges=list(policy.source_ip_ranges),
        source_mac_addresses=list(policy.source_mac_addresses),
        source_port_ranges=list(policy.source_port_ranges),
        source_network_id=policy.source_network_id,
        destination_mac_addresses=list(policy.destination_mac_addresses),
        destination_network_id=policy.destination_network_id,
        source_port_group=src_port_name,
        source_port_group_members=src_port_members,
        destination_port_group=dst_port_name,
        destination_port_group_members=dst_port_members,
        source_address_group=src_addr_name,
        source_address_group_members=src_addr_members,
        destination_address_group=dst_addr_name,
        destination_address_group_members=dst_addr_members,
        connection_state_type=policy.connection_state_type,
        connection_logging=policy.connection_logging,
        schedule=policy.schedule,
        match_ip_sec=policy.match_ip_sec,
    )


def get_zones(credentials: UnifiCredentials) -> list[Zone]:
    """Fetch zones from the UniFi controller."""
    config = _to_topology_config(credentials)
    raw_zones = fetch_firewall_zones(config, site=credentials.site)
    zones = normalize_firewall_zones(raw_zones)
    network_lookup = _build_network_lookup(config)
    return [_zone_to_model(z, network_lookup) for z in zones]


def get_rules(credentials: UnifiCredentials) -> list[Rule]:
    """Fetch firewall rules from the UniFi controller."""
    config = _to_topology_config(credentials)
    raw_policies = fetch_firewall_policies(config, site=credentials.site)
    policies = normalize_firewall_policies(raw_policies)
    group_lookup = _build_group_lookup(config)
    return [_policy_to_rule(p, group_lookup) for p in policies]


def get_zone_pairs(credentials: UnifiCredentials) -> list[ZonePair]:
    """Build zone pairs with their associated rules."""
    rules = get_rules(credentials)

    pairs: dict[tuple[str, str], list[Rule]] = {}
    for rule in rules:
        key = (rule.source_zone_id, rule.destination_zone_id)
        pairs.setdefault(key, []).append(rule)

    zones = get_zones(credentials)
    zone_name_lookup: dict[str, str] = {z.id: z.name for z in zones}

    result: list[ZonePair] = []
    for (src, dst), pair_rules in pairs.items():
        sorted_rules = sorted(pair_rules, key=lambda r: r.index)
        analysis_result = run_analysis(
            sorted_rules,
            zone_name_lookup.get(src, src),
            zone_name_lookup.get(dst, dst),
        )
        analysis = ZonePairAnalysis(
            score=analysis_result.score,
            grade=analysis_result.grade,
            findings=[FindingModel(**vars(f)) for f in analysis_result.findings],
        )
        result.append(
            ZonePair(
                source_zone_id=src,
                destination_zone_id=dst,
                rules=sorted_rules,
                allow_count=sum(1 for r in pair_rules if r.action == "ALLOW" and r.enabled),
                block_count=sum(1 for r in pair_rules if r.action in ("BLOCK", "REJECT") and r.enabled),
                analysis=analysis,
            )
        )
    return result
