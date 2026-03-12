"""Tests for zone filter router."""

from pathlib import Path

import pytest
from httpx import AsyncClient

from app.database import init_db

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _use_test_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db_path = tmp_path / "test.db"
    init_db(db_path)
    monkeypatch.setattr("app.routers.zone_filter.DEFAULT_DB_PATH", db_path)


async def test_get_hidden_zones_empty(client: AsyncClient) -> None:
    resp = await client.get("/api/settings/zone-filter")
    assert resp.status_code == 200
    assert resp.json() == {"hidden_zone_ids": []}


async def test_save_and_get_hidden_zones(client: AsyncClient) -> None:
    resp = await client.put(
        "/api/settings/zone-filter",
        json={"hidden_zone_ids": ["z1", "z2"]},
    )
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}

    resp = await client.get("/api/settings/zone-filter")
    assert sorted(resp.json()["hidden_zone_ids"]) == ["z1", "z2"]


async def test_save_replaces_previous(client: AsyncClient) -> None:
    await client.put("/api/settings/zone-filter", json={"hidden_zone_ids": ["z1"]})
    await client.put("/api/settings/zone-filter", json={"hidden_zone_ids": ["z2"]})
    resp = await client.get("/api/settings/zone-filter")
    assert resp.json()["hidden_zone_ids"] == ["z2"]
