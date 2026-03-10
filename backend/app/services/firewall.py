"""Firewall data service.

Fetches zone, rule, and zone-pair data from the UniFi controller
via the unifi-topology library.
"""

from __future__ import annotations

import contextlib
import logging

from unifi_topology import (
    Config,
    FirewallPolicy,
    FirewallZone,
    fetch_firewall_policies,
    fetch_firewall_zones,
    fetch_networks,
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


def _policy_to_rule(policy: FirewallPolicy) -> Rule:
    """Convert a FirewallPolicy to our Rule model."""
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
    return [_policy_to_rule(p) for p in policies]


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
