"""Tests for zone filter persistence service."""

from collections.abc import Iterator
from pathlib import Path

import pytest

from app.database import init_db_for_tests, reset_engine
from app.services.zone_filter import get_hidden_zone_ids, save_hidden_zone_ids


@pytest.fixture(autouse=True)
def _test_db(tmp_path: Path) -> Iterator[None]:
    init_db_for_tests(tmp_path / "test.db")
    yield
    reset_engine()


class TestZoneFilterService:
    def test_empty_by_default(self) -> None:
        assert get_hidden_zone_ids() == []

    def test_save_and_get(self) -> None:
        save_hidden_zone_ids(["z1", "z2"])
        assert sorted(get_hidden_zone_ids()) == ["z1", "z2"]

    def test_save_replaces_previous(self) -> None:
        save_hidden_zone_ids(["z1", "z2"])
        save_hidden_zone_ids(["z3"])
        assert get_hidden_zone_ids() == ["z3"]

    def test_save_empty_clears_all(self) -> None:
        save_hidden_zone_ids(["z1"])
        save_hidden_zone_ids([])
        assert get_hidden_zone_ids() == []
