"""Tests for topology rendering service."""

from contextlib import ExitStack
from unittest.mock import MagicMock, patch

import pytest

from app.services.topology import VALID_THEMES, get_available_themes, get_topology_svg

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
    },
]

MOCK_RAW_CLIENTS: list[dict[str, object]] = []

STUB_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><text>stub</text></svg>'


MOCK_DEVICES = [
    type("Device", (), {"mac": "aa:bb:cc:dd:ee:01", "name": "Gateway", "type": "gateway", "ip": "192.168.1.1"})(),
    type("Device", (), {"mac": "aa:bb:cc:dd:ee:02", "name": "Switch", "type": "switch", "ip": "192.168.1.2"})(),
]

MOCK_TOPOLOGY = type("TopologyResult", (), {"tree_edges": [], "raw_edges": []})()


def _patch_topology_deps(render_mock: MagicMock | None = None, iso_mock: MagicMock | None = None) -> ExitStack:
    """Patch all external dependencies and return the ExitStack."""
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
    def test_orthogonal_returns_svg(self) -> None:
        mock_render = MagicMock(return_value=STUB_SVG)
        with _patch_topology_deps(render_mock=mock_render):
            result = get_topology_svg(MOCK_CONFIG, theme_name="unifi", projection="orthogonal")
        assert result == STUB_SVG
        mock_render.assert_called_once()

    def test_isometric_returns_svg(self) -> None:
        mock_iso = MagicMock(return_value=STUB_SVG)
        with _patch_topology_deps(iso_mock=mock_iso):
            result = get_topology_svg(MOCK_CONFIG, theme_name="unifi", projection="isometric")
        assert result == STUB_SVG
        mock_iso.assert_called_once()

    def test_invalid_projection_raises(self) -> None:
        with pytest.raises(ValueError, match="Invalid projection"):
            get_topology_svg(MOCK_CONFIG, projection="3d")

    def test_invalid_theme_raises(self) -> None:
        with _patch_topology_deps():
            with pytest.raises(ValueError, match="Unknown theme"):
                get_topology_svg(MOCK_CONFIG, theme_name="nonexistent")

    def test_all_valid_themes_resolve(self) -> None:
        for theme in VALID_THEMES:
            with _patch_topology_deps():
                result = get_topology_svg(MOCK_CONFIG, theme_name=theme)
            assert isinstance(result, str)


class TestGetAvailableThemes:
    def test_returns_all_themes(self) -> None:
        themes = get_available_themes()
        assert len(themes) == 6
        ids = {t["id"] for t in themes}
        assert ids == set(VALID_THEMES)

    def test_themes_have_id_and_name(self) -> None:
        for theme in get_available_themes():
            assert "id" in theme
            assert "name" in theme
            assert isinstance(theme["name"], str)
            assert len(theme["name"]) > 0
