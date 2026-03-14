"""Topology rendering service.

Fetches device and client data from the UniFi controller and renders
network topology diagrams as SVG via the unifi-topology library.
"""

from __future__ import annotations

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
from app.services.firewall import to_topology_config

log = structlog.get_logger()

VALID_THEMES = ("classic", "classic-dark", "minimal", "minimal-dark", "unifi", "unifi-dark")
VALID_PROJECTIONS = ("orthogonal", "isometric")

THEME_LABELS: dict[str, str] = {
    "classic": "Classic",
    "classic-dark": "Classic Dark",
    "minimal": "Minimal",
    "minimal-dark": "Minimal Dark",
    "unifi": "UniFi",
    "unifi-dark": "UniFi Dark",
}


def get_topology_svg(credentials: UnifiCredentials, theme_name: str = "unifi", projection: str = "orthogonal") -> str:
    """Render the network topology as an SVG string."""
    if projection not in VALID_PROJECTIONS:
        msg = f"Invalid projection: {projection}. Valid: {', '.join(VALID_PROJECTIONS)}"
        raise ValueError(msg)

    config = to_topology_config(credentials)

    raw_devices = fetch_devices(config, site=credentials.site)
    raw_clients = fetch_clients(config, site=credentials.site)
    devices = normalize_devices(raw_devices)

    gateway_macs = [d.mac for d in devices if d.type == "gateway"]
    topology = build_topology(devices, include_ports=True, only_unifi=False, gateways=gateway_macs)
    device_index = build_device_index(devices)
    node_types = build_node_type_map(devices, raw_clients)
    client_edges = build_client_edges(raw_clients, device_index)
    edges = topology.tree_edges + client_edges

    gateway = next((d for d in devices if d.type == "gateway"), None)
    wan_info = extract_wan_info(gateway) if gateway else None
    vpn_tunnels = extract_vpn_tunnels(gateway) if gateway else []

    theme = resolve_svg_themes(theme_name=theme_name)

    log.info(
        "topology_render",
        theme=theme_name, projection=projection,
        device_count=len(devices), client_count=len(raw_clients), edge_count=len(edges),
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


def get_available_themes() -> list[dict[str, str]]:
    """Return the list of available SVG theme IDs and display names."""
    return [{"id": tid, "name": THEME_LABELS[tid]} for tid in VALID_THEMES]
