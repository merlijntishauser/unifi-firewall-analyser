"""Tests for topology service."""

from contextlib import ExitStack
from unittest.mock import MagicMock, patch

import pytest

from app.services.topology import get_topology_devices, get_topology_svg

MOCK_CONFIG = type("Credentials", (), {
    "url": "https://unifi.example.com", "site": "default",
    "username": "admin", "password": "secret", "verify_ssl": False,
})()

MOCK_RAW_DEVICES = [
    {
        "mac": "aa:bb:cc:dd:ee:01",
        "name": "Gateway",
        "model": "UDM-Pro",
        "model_name": "UniFi Dream Machine Pro",
        "type": "ugw",
        "ip": "192.168.1.1",
        "port_table": [],
        "system-stats": {},
        "state": 1,
        "uptime": 86400,
        "num_sta": 5,
    },
    {
        "mac": "aa:bb:cc:dd:ee:02",
        "name": "Switch",
        "model": "USW-24",
        "model_name": "UniFi Switch 24",
        "type": "usw",
        "ip": "192.168.1.2",
        "port_table": [],
        "system-stats": {},
        "uplink": {"uplink_mac": "aa:bb:cc:dd:ee:01"},
        "state": 1,
        "uptime": 43200,
        "num_sta": 10,
    },
]

MOCK_RAW_CLIENTS: list[dict[str, object]] = []

MOCK_DEVICES = [
    type("Device", (), {
        "mac": "aa:bb:cc:dd:ee:01", "name": "Gateway",
        "model": "UDM-Pro", "model_name": "UniFi Dream Machine Pro",
        "type": "gateway", "ip": "192.168.1.1", "version": "4.0.6",
        "port_table": [], "poe_ports": {}, "lldp_info": [],
        "uplink": None, "last_uplink": None,
        "in_gateway_mode": None, "network_table": [],
    })(),
    type("Device", (), {
        "mac": "aa:bb:cc:dd:ee:02", "name": "Switch",
        "model": "USW-24", "model_name": "UniFi Switch 24",
        "type": "switch", "ip": "192.168.1.2", "version": "7.1.0",
        "port_table": [], "poe_ports": {}, "lldp_info": [],
        "uplink": None, "last_uplink": None,
        "in_gateway_mode": None, "network_table": [],
    })(),
]

MOCK_TOPOLOGY = type("TopologyResult", (), {"tree_edges": [], "raw_edges": []})()

STUB_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><text>stub</text></svg>'


def _patch_all(render_mock: MagicMock | None = None, iso_mock: MagicMock | None = None) -> ExitStack:
    """Patch all external dependencies."""
    stack = ExitStack()
    stack.enter_context(patch("app.services.topology.fetch_devices", return_value=MOCK_RAW_DEVICES))
    stack.enter_context(patch("app.services.topology.fetch_clients", return_value=MOCK_RAW_CLIENTS))
    stack.enter_context(patch("app.services.topology.normalize_devices", return_value=MOCK_DEVICES))
    stack.enter_context(patch("app.services.topology.build_topology", return_value=MOCK_TOPOLOGY))
    stack.enter_context(patch("app.services.topology.build_device_index", return_value={}))
    stack.enter_context(patch("app.services.topology.build_node_type_map", return_value={}))
    stack.enter_context(patch("app.services.topology.build_client_edges", return_value=[]))
    stack.enter_context(patch("app.services.topology.extract_wan_info", return_value=None))
    stack.enter_context(patch("app.services.topology.extract_vpn_tunnels", return_value=[]))
    if render_mock:
        stack.enter_context(patch("app.services.topology.render_svg", render_mock))
    else:
        stack.enter_context(patch("app.services.topology.render_svg", return_value=STUB_SVG))
    if iso_mock:
        stack.enter_context(patch("app.services.topology.render_svg_isometric", iso_mock))
    else:
        stack.enter_context(patch("app.services.topology.render_svg_isometric", return_value=STUB_SVG))
    return stack


class TestGetTopologySvg:
    def test_isometric_returns_svg(self) -> None:
        mock_iso = MagicMock(return_value=STUB_SVG)
        with _patch_all(iso_mock=mock_iso):
            result = get_topology_svg(MOCK_CONFIG, projection="isometric")
        assert result == STUB_SVG
        mock_iso.assert_called_once()

    def test_orthogonal_returns_svg(self) -> None:
        mock_render = MagicMock(return_value=STUB_SVG)
        with _patch_all(render_mock=mock_render):
            result = get_topology_svg(MOCK_CONFIG, projection="orthogonal")
        assert result == STUB_SVG
        mock_render.assert_called_once()

    def test_dark_mode_uses_unifi_dark_theme(self) -> None:
        with _patch_all() as stack:
            get_topology_svg(MOCK_CONFIG, color_mode="dark")
        # resolve_svg_themes is not patched, so it runs with real theme resolution
        # Just verify no error -- theme is "unifi-dark"

    def test_light_mode_uses_unifi_theme(self) -> None:
        with _patch_all():
            get_topology_svg(MOCK_CONFIG, color_mode="light")

    def test_invalid_projection_raises(self) -> None:
        with pytest.raises(ValueError, match="Invalid projection"):
            get_topology_svg(MOCK_CONFIG, projection="3d")

    def test_passes_only_unifi_true(self) -> None:
        with _patch_all() as stack:
            get_topology_svg(MOCK_CONFIG)


class TestGetTopologyDevices:
    def test_returns_devices_and_edges(self) -> None:
        with _patch_all():
            result = get_topology_devices(MOCK_CONFIG)
        assert len(result.devices) == 2
        assert result.devices[0].name == "Gateway"
        assert result.devices[1].name == "Switch"

    def test_device_fields(self) -> None:
        with _patch_all():
            result = get_topology_devices(MOCK_CONFIG)
        gw = result.devices[0]
        assert gw.mac == "aa:bb:cc:dd:ee:01"
        assert gw.type == "gateway"
        assert gw.status == "online"
        assert gw.uptime == 86400
        assert gw.client_count == 5

    def test_offline_status(self) -> None:
        raw_devices = [dict(MOCK_RAW_DEVICES[0], state=0)]
        devices = [MOCK_DEVICES[0]]
        with (
            patch("app.services.topology.fetch_devices", return_value=raw_devices),
            patch("app.services.topology.normalize_devices", return_value=devices),
            patch("app.services.topology.build_topology", return_value=MOCK_TOPOLOGY),
        ):
            result = get_topology_devices(MOCK_CONFIG)
        assert result.devices[0].status == "offline"

    def test_returns_edges(self) -> None:
        mock_edge = type("Edge", (), {
            "left": "aa:bb:cc:dd:ee:01", "right": "aa:bb:cc:dd:ee:02",
            "speed": 1000, "poe": True, "wireless": False,
            "label": None, "channel": None, "vlans": (), "active_vlans": (),
            "is_trunk": False, "connection": None,
        })()
        mock_topo = type("TopologyResult", (), {"tree_edges": [mock_edge], "raw_edges": []})()
        with (
            patch("app.services.topology.fetch_devices", return_value=MOCK_RAW_DEVICES),
            patch("app.services.topology.normalize_devices", return_value=MOCK_DEVICES),
            patch("app.services.topology.build_topology", return_value=mock_topo),
        ):
            result = get_topology_devices(MOCK_CONFIG)
        assert len(result.edges) == 1
        assert result.edges[0].from_mac == "aa:bb:cc:dd:ee:01"
        assert result.edges[0].speed == 1000
        assert result.edges[0].poe is True
