"""Tests for zone filter persistence service."""

from pathlib import Path

from app.database import init_db
from app.services.zone_filter import get_hidden_zone_ids, save_hidden_zone_ids


class TestZoneFilterService:
    def test_empty_by_default(self, tmp_path: Path) -> None:
        db = tmp_path / "test.db"
        init_db(db)
        assert get_hidden_zone_ids(db) == []

    def test_save_and_get(self, tmp_path: Path) -> None:
        db = tmp_path / "test.db"
        init_db(db)
        save_hidden_zone_ids(db, ["z1", "z2"])
        assert sorted(get_hidden_zone_ids(db)) == ["z1", "z2"]

    def test_save_replaces_previous(self, tmp_path: Path) -> None:
        db = tmp_path / "test.db"
        init_db(db)
        save_hidden_zone_ids(db, ["z1", "z2"])
        save_hidden_zone_ids(db, ["z3"])
        assert get_hidden_zone_ids(db) == ["z3"]

    def test_save_empty_clears_all(self, tmp_path: Path) -> None:
        db = tmp_path / "test.db"
        init_db(db)
        save_hidden_zone_ids(db, ["z1"])
        save_hidden_zone_ids(db, [])
        assert get_hidden_zone_ids(db) == []
