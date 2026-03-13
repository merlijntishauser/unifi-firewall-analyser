"""Tests for zone filter router."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from httpx import AsyncClient

from app.database import init_db_for_tests, reset_engine

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _use_test_db(tmp_path: Path) -> Iterator[None]:
    init_db_for_tests(tmp_path / "test.db")
    yield
    reset_engine()


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
