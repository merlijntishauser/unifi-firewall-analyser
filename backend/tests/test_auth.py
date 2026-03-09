import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_health(client: AsyncClient) -> None:
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.anyio
async def test_status_no_credentials(client: AsyncClient) -> None:
    resp = await client.get("/api/auth/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["configured"] is False
    assert data["source"] == "none"
    assert data["url"] == ""


@pytest.mark.anyio
async def test_login_stores_credentials(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/auth/login",
        json={
            "url": "https://unifi.example.com",
            "username": "admin",
            "password": "secret",
            "site": "default",
            "verify_ssl": False,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"

    # Status should now show runtime credentials
    status_resp = await client.get("/api/auth/status")
    status_data = status_resp.json()
    assert status_data["configured"] is True
    assert status_data["source"] == "runtime"
    assert status_data["url"] == "https://unifi.example.com"


@pytest.mark.anyio
async def test_logout_clears_credentials(client: AsyncClient) -> None:
    # First login
    await client.post(
        "/api/auth/login",
        json={
            "url": "https://unifi.example.com",
            "username": "admin",
            "password": "secret",
        },
    )

    # Then logout
    resp = await client.post("/api/auth/logout")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"

    # Status should show no credentials
    status_resp = await client.get("/api/auth/status")
    status_data = status_resp.json()
    assert status_data["configured"] is False
    assert status_data["source"] == "none"


@pytest.mark.anyio
async def test_login_with_defaults(client: AsyncClient) -> None:
    """Login with only required fields uses sensible defaults."""
    resp = await client.post(
        "/api/auth/login",
        json={
            "url": "https://unifi.local",
            "username": "admin",
            "password": "pass",
        },
    )
    assert resp.status_code == 200

    from app.config import get_unifi_config

    config = get_unifi_config()
    assert config is not None
    assert config.site == "default"
    assert config.verify_ssl is False


@pytest.mark.anyio
async def test_login_replaces_previous_credentials(client: AsyncClient) -> None:
    """A second login replaces the first set of credentials."""
    await client.post(
        "/api/auth/login",
        json={"url": "https://first.example.com", "username": "u1", "password": "p1"},
    )
    await client.post(
        "/api/auth/login",
        json={"url": "https://second.example.com", "username": "u2", "password": "p2"},
    )

    status_resp = await client.get("/api/auth/status")
    data = status_resp.json()
    assert data["url"] == "https://second.example.com"


@pytest.mark.anyio
async def test_login_validation_missing_fields(client: AsyncClient) -> None:
    """Missing required fields should return 422."""
    resp = await client.post(
        "/api/auth/login",
        json={"url": "https://unifi.local"},
    )
    assert resp.status_code == 422
