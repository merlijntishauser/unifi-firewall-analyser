"""Tests for topology router endpoints."""

from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.config import set_runtime_credentials

STUB_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><text>stub</text></svg>'


def _login() -> None:
    set_runtime_credentials(
        url="https://unifi.example.com",
        username="admin",
        password="secret",
    )


def _patch_svg(projection: str = "orthogonal"):  # noqa: ANN201
    """Patch get_topology_svg to return a stub SVG."""
    return patch("app.routers.topology.get_topology_svg", return_value=STUB_SVG)


@pytest.mark.anyio
async def test_svg_requires_credentials(client: AsyncClient) -> None:
    resp = await client.get("/api/topology/svg")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_svg_returns_svg_response(client: AsyncClient) -> None:
    _login()
    with _patch_svg():
        resp = await client.get("/api/topology/svg")
    assert resp.status_code == 200
    data = resp.json()
    assert data["svg"] == STUB_SVG
    assert data["theme"] == "unifi"
    assert data["projection"] == "orthogonal"


@pytest.mark.anyio
async def test_svg_with_theme_param(client: AsyncClient) -> None:
    _login()
    with _patch_svg():
        resp = await client.get("/api/topology/svg", params={"theme": "minimal"})
    assert resp.status_code == 200
    assert resp.json()["theme"] == "minimal"


@pytest.mark.anyio
async def test_svg_with_isometric_projection(client: AsyncClient) -> None:
    _login()
    with _patch_svg():
        resp = await client.get("/api/topology/svg", params={"projection": "isometric"})
    assert resp.status_code == 200
    assert resp.json()["projection"] == "isometric"


@pytest.mark.anyio
async def test_svg_invalid_projection_returns_400(client: AsyncClient) -> None:
    _login()
    resp = await client.get("/api/topology/svg", params={"projection": "3d"})
    assert resp.status_code == 400
    assert "Invalid projection" in resp.json()["detail"]


@pytest.mark.anyio
async def test_svg_invalid_theme_returns_400(client: AsyncClient) -> None:
    _login()
    with patch("app.routers.topology.get_topology_svg", side_effect=ValueError("Unknown theme: bad")):
        resp = await client.get("/api/topology/svg", params={"theme": "bad"})
    assert resp.status_code == 400
    assert "Unknown theme" in resp.json()["detail"]


@pytest.mark.anyio
async def test_themes_returns_list(client: AsyncClient) -> None:
    resp = await client.get("/api/topology/themes")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 6
    ids = {t["id"] for t in data}
    assert "unifi" in ids
    assert "minimal-dark" in ids


@pytest.mark.anyio
async def test_themes_have_id_and_name(client: AsyncClient) -> None:
    resp = await client.get("/api/topology/themes")
    for theme in resp.json():
        assert "id" in theme
        assert "name" in theme
