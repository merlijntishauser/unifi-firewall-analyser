"""Topology service.

Fetches device and client data from the UniFi controller. Provides
structured device/edge data for the interactive map and renders
network topology diagrams as SVG via the unifi-topology library.
"""

from __future__ import annotations

from typing import Any

import structlog
from unifi_topology import (
    fetch_clients,
    fetch_devices,
    normalize_devices,
)
from unifi_topology.model import (
    build_client_edges,
    build_device_index,
    build_node_type_map,
    build_topology,
    extract_vpn_tunnels,
    extract_wan_info,
)
from unifi_topology.render import render_svg, render_svg_isometric, resolve_svg_themes

from app.config import UnifiCredentials
from app.models import TopologyDevice, TopologyDevicesResponse, TopologyEdge, TopologyPort
from app.services.firewall import to_topology_config

log = structlog.get_logger()

VALID_PROJECTIONS = ("orthogonal", "isometric")


def _raw_device_lookup(raw_devices: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Build a MAC -> raw device dict lookup."""
    return {str(d.get("mac", "")).lower(): d for d in raw_devices if "mac" in d}


def _build_device_model(
    device: Any,
    raw: dict[str, Any],
    lldp_connected: dict[str, str],
) -> TopologyDevice:
    """Convert a normalized Device + raw dict into a TopologyDevice model."""
    ports = []
    for port in device.port_table:
        if port.port_idx is None:
            continue
        connected_mac = None
        connected_name = None
        for lldp in device.lldp_info:
            if lldp.local_port_idx == port.port_idx:
                connected_mac = lldp.chassis_id
                connected_name = lldp_connected.get(lldp.chassis_id)
                break
        ports.append(TopologyPort(
            idx=port.port_idx,
            name=port.name or port.ifname or f"Port {port.port_idx}",
            speed=port.speed,
            up=port.up or False,
            poe=port.port_poe,
            poe_power=port.poe_power if port.poe_good else None,
            connected_device=connected_name,
            connected_mac=connected_mac,
            native_vlan=port.native_vlan,
        ))
    ports.sort(key=lambda p: p.idx)

    state = raw.get("state", 0)
    status = "online" if state == 1 else "offline" if state == 0 else "unknown"

    return TopologyDevice(
        mac=device.mac,
        name=device.name,
        model=device.model,
        model_name=device.model_name,
        type=device.type,
        ip=device.ip,
        version=device.version,
        uptime=int(raw.get("uptime", 0)),
        status=status,
        client_count=int(raw.get("num_sta", 0)),
        ports=ports,
    )


def get_topology_devices(credentials: UnifiCredentials) -> TopologyDevicesResponse:
    """Fetch devices and edges for the interactive topology map."""
    config = to_topology_config(credentials)

    raw_devices: list[dict[str, Any]] = list(fetch_devices(config, site=credentials.site))  # type: ignore[arg-type]
    devices = normalize_devices(raw_devices)
    raw_lookup = _raw_device_lookup(raw_devices)

    gateway_types = {"gateway", "udm", "ugw"}
    gateway_macs = [d.mac for d in devices if d.type in gateway_types]
    topology = build_topology(
        devices, include_ports=True, only_unifi=False, gateways=gateway_macs,
    )

    # Use raw_edges if tree_edges is empty (tree requires gateway identification)
    topo_edges = topology.tree_edges if topology.tree_edges else topology.raw_edges

    lldp_connected = {d.mac.lower(): d.name for d in devices}
    name_to_mac = {d.name: d.mac for d in devices}

    device_models = []
    for device in devices:
        raw = raw_lookup.get(device.mac.lower(), {})
        device_models.append(_build_device_model(device, raw, lldp_connected))

    edge_models = []
    for edge in topo_edges:
        from_mac = name_to_mac.get(edge.left)
        to_mac = name_to_mac.get(edge.right)
        if from_mac is None or to_mac is None:
            continue
        edge_models.append(TopologyEdge(
            from_mac=from_mac,
            to_mac=to_mac,
            speed=edge.speed,
            poe=edge.poe,
            wireless=edge.wireless,
        ))

    log.info("topology_devices", device_count=len(device_models), edge_count=len(edge_models))
    return TopologyDevicesResponse(devices=device_models, edges=edge_models)


def get_topology_svg(
    credentials: UnifiCredentials,
    color_mode: str = "dark",
    projection: str = "isometric",
) -> str:
    """Render the network topology as an SVG string."""
    if projection not in VALID_PROJECTIONS:
        msg = f"Invalid projection: {projection}. Valid: {', '.join(VALID_PROJECTIONS)}"
        raise ValueError(msg)

    theme_name = "unifi-dark" if color_mode == "dark" else "unifi"
    config = to_topology_config(credentials)

    raw_devices = fetch_devices(config, site=credentials.site)
    raw_clients = fetch_clients(config, site=credentials.site)
    devices = normalize_devices(raw_devices)

    gw_types = {"gateway", "udm", "ugw"}
    gateway_macs = [d.mac for d in devices if d.type in gw_types]
    topology = build_topology(
        devices, include_ports=True, only_unifi=True, gateways=gateway_macs,
    )
    device_index = build_device_index(devices)
    node_types = build_node_type_map(devices, raw_clients, only_unifi=True)
    client_edges = build_client_edges(
        raw_clients, device_index, only_unifi=True,
    )
    topo_edges = topology.tree_edges if topology.tree_edges else topology.raw_edges
    edges = topo_edges + client_edges

    gateway = next((d for d in devices if d.type in gw_types), None)
    wan_info = extract_wan_info(gateway) if gateway else None
    vpn_tunnels = extract_vpn_tunnels(gateway) if gateway else []

    theme = resolve_svg_themes(theme_name=theme_name)

    log.info(
        "topology_render",
        theme=theme_name, projection=projection,
        device_count=len(devices), edge_count=len(edges),
    )

    if projection == "isometric":
        return render_svg_isometric(
            edges=edges, node_types=node_types, theme=theme,
            wan_info=wan_info, vpn_tunnels=vpn_tunnels,
        )
    return render_svg(
        edges=edges, node_types=node_types, theme=theme,
        wan_info=wan_info, vpn_tunnels=vpn_tunnels,
    )
