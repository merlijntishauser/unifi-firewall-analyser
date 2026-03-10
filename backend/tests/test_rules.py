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
