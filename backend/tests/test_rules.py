from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.config import set_runtime_credentials
from app.services.firewall_writer import WriteError


def _login() -> None:
    set_runtime_credentials(
        url="https://unifi.example.com",
        username="admin",
        password="secret",
    )


@pytest.mark.anyio
async def test_rules_requires_credentials(client: AsyncClient) -> None:
    resp = await client.get("/api/rules")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_rules_returns_list(client: AsyncClient) -> None:
    _login()
    resp = await client.get("/api/rules")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0

    for rule in data:
        assert "id" in rule
        assert "name" in rule
        assert "action" in rule
        assert "enabled" in rule
        assert "source_zone_id" in rule
        assert "destination_zone_id" in rule


@pytest.mark.anyio
async def test_rules_filter_by_source_zone(client: AsyncClient) -> None:
    _login()
    resp = await client.get("/api/rules", params={"source_zone": "zone-guest"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    for rule in data:
        assert rule["source_zone_id"] == "zone-guest"


@pytest.mark.anyio
async def test_rules_filter_by_destination_zone(client: AsyncClient) -> None:
    _login()
    resp = await client.get("/api/rules", params={"destination_zone": "zone-internal"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    for rule in data:
        assert rule["destination_zone_id"] == "zone-internal"


@pytest.mark.anyio
async def test_rules_filter_by_both_zones(client: AsyncClient) -> None:
    _login()
    resp = await client.get(
        "/api/rules",
        params={"source_zone": "zone-iot", "destination_zone": "zone-internal"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    for rule in data:
        assert rule["source_zone_id"] == "zone-iot"
        assert rule["destination_zone_id"] == "zone-internal"


@pytest.mark.anyio
async def test_rules_filter_returns_empty_for_no_match(client: AsyncClient) -> None:
    _login()
    resp = await client.get(
        "/api/rules",
        params={"source_zone": "nonexistent-zone"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data == []


@pytest.mark.anyio
async def test_zone_pairs_requires_credentials(client: AsyncClient) -> None:
    resp = await client.get("/api/zone-pairs")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_zone_pairs_returns_list(client: AsyncClient) -> None:
    _login()
    resp = await client.get("/api/zone-pairs")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0

    for pair in data:
        assert "source_zone_id" in pair
        assert "destination_zone_id" in pair
        assert "rules" in pair
        assert "allow_count" in pair
        assert "block_count" in pair
        assert isinstance(pair["rules"], list)
        assert "analysis" in pair
        assert "score" in pair["analysis"]
        assert "grade" in pair["analysis"]
        assert "findings" in pair["analysis"]


@pytest.mark.anyio
async def test_zone_pairs_counts_are_correct(client: AsyncClient) -> None:
    _login()
    resp = await client.get("/api/zone-pairs")
    data = resp.json()

    for pair in data:
        rules = pair["rules"]
        expected_allow = sum(
            1 for r in rules if r["action"] == "ALLOW" and r["enabled"]
        )
        expected_block = sum(
            1 for r in rules if r["action"] in ("BLOCK", "REJECT") and r["enabled"]
        )
        assert pair["allow_count"] == expected_allow
        assert pair["block_count"] == expected_block


@pytest.mark.anyio
async def test_toggle_requires_credentials(client: AsyncClient) -> None:
    resp = await client.patch("/api/rules/rule-1/toggle", json={"enabled": False})
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_toggle_calls_writer(client: AsyncClient) -> None:
    _login()
    with patch("app.routers.rules.toggle_policy") as mock_toggle:
        resp = await client.patch("/api/rules/rule-1/toggle", json={"enabled": False})
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
    mock_toggle.assert_called_once()
    call_kwargs = mock_toggle.call_args
    assert call_kwargs[0][1] == "rule-1"
    assert call_kwargs[1]["enabled"] is False


@pytest.mark.anyio
async def test_toggle_returns_502_on_write_error(client: AsyncClient) -> None:
    _login()
    with patch("app.routers.rules.toggle_policy", side_effect=WriteError("controller error")):
        resp = await client.patch("/api/rules/rule-1/toggle", json={"enabled": True})
    assert resp.status_code == 502
    assert "controller error" in resp.json()["detail"]


@pytest.mark.anyio
async def test_swap_order_requires_credentials(client: AsyncClient) -> None:
    resp = await client.put(
        "/api/rules/reorder",
        json={"policy_id_a": "rule-1", "policy_id_b": "rule-2"},
    )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_swap_order_calls_writer(client: AsyncClient) -> None:
    _login()
    with patch("app.routers.rules.swap_policy_order") as mock_swap:
        resp = await client.put(
            "/api/rules/reorder",
            json={"policy_id_a": "rule-1", "policy_id_b": "rule-2"},
        )
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
    mock_swap.assert_called_once()
    args = mock_swap.call_args[0]
    assert args[1] == "rule-1"
    assert args[2] == "rule-2"


@pytest.mark.anyio
async def test_swap_order_returns_502_on_write_error(client: AsyncClient) -> None:
    _login()
    with patch("app.routers.rules.swap_policy_order", side_effect=WriteError("swap failed")):
        resp = await client.put(
            "/api/rules/reorder",
            json={"policy_id_a": "rule-1", "policy_id_b": "rule-2"},
        )
    assert resp.status_code == 502
    assert "swap failed" in resp.json()["detail"]
