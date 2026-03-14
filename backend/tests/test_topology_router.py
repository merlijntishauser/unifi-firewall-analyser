"""Tests for topology router endpoints."""

from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.config import set_runtime_credentials
from app.models import TopologyDevicesResponse

STUB_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><text>stub</text></svg>'
STUB_DEVICES = TopologyDevicesResponse(devices=[], edges=[])


def _login() -> None:
    set_runtime_credentials(
        url="https://unifi.example.com",
        username="admin",
        password="secret",
    )


@pytest.mark.anyio
async def test_svg_requires_credentials(client: AsyncClient) -> None:
    resp = await client.get("/api/topology/svg")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_svg_returns_response(client: AsyncClient) -> None:
    _login()
    with patch("app.routers.topology.get_topology_svg", return_value=STUB_SVG):
        resp = await client.get("/api/topology/svg")
    assert resp.status_code == 200
    data = resp.json()
    assert data["svg"] == STUB_SVG
    assert data["projection"] == "isometric"


@pytest.mark.anyio
async def test_svg_with_orthogonal(client: AsyncClient) -> None:
    _login()
    with patch("app.routers.topology.get_topology_svg", return_value=STUB_SVG):
        resp = await client.get("/api/topology/svg", params={"projection": "orthogonal"})
    assert resp.status_code == 200
    assert resp.json()["projection"] == "orthogonal"


@pytest.mark.anyio
async def test_svg_with_color_mode(client: AsyncClient) -> None:
    _login()
    with patch("app.routers.topology.get_topology_svg", return_value=STUB_SVG) as mock:
        resp = await client.get("/api/topology/svg", params={"color_mode": "light"})
    assert resp.status_code == 200
    mock.assert_called_once()
    assert mock.call_args.kwargs.get("color_mode") == "light"


@pytest.mark.anyio
async def test_svg_invalid_projection_returns_400(client: AsyncClient) -> None:
    _login()
    resp = await client.get("/api/topology/svg", params={"projection": "3d"})
    assert resp.status_code == 400
    assert "Invalid projection" in resp.json()["detail"]


@pytest.mark.anyio
async def test_devices_requires_credentials(client: AsyncClient) -> None:
    resp = await client.get("/api/topology/devices")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_devices_returns_response(client: AsyncClient) -> None:
    _login()
    with patch("app.routers.topology.get_topology_devices", return_value=STUB_DEVICES):
        resp = await client.get("/api/topology/devices")
    assert resp.status_code == 200
    data = resp.json()
    assert "devices" in data
    assert "edges" in data
