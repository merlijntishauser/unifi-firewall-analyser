import pytest
from httpx import AsyncClient

from app.config import set_runtime_credentials


def _login() -> None:
    set_runtime_credentials(
        url="https://unifi.example.com",
        username="admin",
        password="secret",
    )


@pytest.mark.anyio
async def test_zones_requires_credentials(client: AsyncClient) -> None:
    resp = await client.get("/api/zones")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_zones_returns_list(client: AsyncClient) -> None:
    _login()
    resp = await client.get("/api/zones")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0

    # Each zone should have id and name
    for zone in data:
        assert "id" in zone
        assert "name" in zone
        assert "networks" in zone


@pytest.mark.anyio
async def test_zones_contain_expected_zones(client: AsyncClient) -> None:
    _login()
    resp = await client.get("/api/zones")
    data = resp.json()
    zone_names = {z["name"] for z in data}
    assert "External" in zone_names
    assert "Internal" in zone_names
    assert "Guest" in zone_names
    assert "IoT" in zone_names
