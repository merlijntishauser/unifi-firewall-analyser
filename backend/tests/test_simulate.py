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
async def test_simulate_requires_credentials(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/simulate",
        json={"src_ip": "192.168.1.10", "dst_ip": "10.0.100.5"},
    )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_simulate_lan_to_guest_blocked(client: AsyncClient) -> None:
    """LAN to Guest has no explicit allow rule, so default policy blocks."""
    _login()
    resp = await client.post(
        "/api/simulate",
        json={"src_ip": "192.168.1.10", "dst_ip": "10.0.100.5"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["source_zone_id"] == "zone-internal"
    assert data["destination_zone_id"] == "zone-guest"
    assert data["verdict"] == "BLOCK"
    assert data["default_policy_used"] is True


@pytest.mark.anyio
async def test_simulate_iot_to_lan_blocked(client: AsyncClient) -> None:
    _login()
    resp = await client.post(
        "/api/simulate",
        json={"src_ip": "10.0.200.50", "dst_ip": "192.168.1.100"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["source_zone_id"] == "zone-iot"
    assert data["destination_zone_id"] == "zone-internal"
    assert data["verdict"] == "BLOCK"
    assert data["matched_rule_name"] == "Block IoT to LAN"


@pytest.mark.anyio
async def test_simulate_unknown_source_ip(client: AsyncClient) -> None:
    _login()
    resp = await client.post(
        "/api/simulate",
        json={"src_ip": "8.8.8.8", "dst_ip": "192.168.1.10"},
    )
    assert resp.status_code == 400
    assert "source IP" in resp.json()["detail"]


@pytest.mark.anyio
async def test_simulate_unknown_destination_ip(client: AsyncClient) -> None:
    _login()
    resp = await client.post(
        "/api/simulate",
        json={"src_ip": "192.168.1.10", "dst_ip": "8.8.8.8"},
    )
    assert resp.status_code == 400
    assert "destination IP" in resp.json()["detail"]


@pytest.mark.anyio
async def test_simulate_with_protocol_and_port(client: AsyncClient) -> None:
    _login()
    resp = await client.post(
        "/api/simulate",
        json={
            "src_ip": "10.0.100.5",
            "dst_ip": "10.0.200.50",
            "protocol": "tcp",
            "port": 443,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "verdict" in data
    assert "evaluations" in data


@pytest.mark.anyio
async def test_simulate_response_includes_zone_names(client: AsyncClient) -> None:
    _login()
    resp = await client.post(
        "/api/simulate",
        json={"src_ip": "10.0.200.50", "dst_ip": "192.168.1.100"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["source_zone_name"] == "IoT"
    assert data["destination_zone_name"] == "Internal"
