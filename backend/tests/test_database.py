"""Tests for database setup and migrations."""

import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pytest

from app.database import get_engine, get_session, init_db_for_tests, reset_engine


@pytest.fixture
def db_path(tmp_path: Path) -> Iterator[Path]:
    path = tmp_path / "test.db"
    yield path
    reset_engine()


class TestInitDbForTests:
    def test_creates_tables(self, db_path: Path) -> None:
        init_db_for_tests(db_path)
        conn = sqlite3.connect(db_path)
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in cursor.fetchall()}
        conn.close()
        assert "ai_config" in tables
        assert "ai_analysis_cache" in tables
        assert "hidden_zones" in tables
        assert "ai_analysis_settings" in tables

    def test_idempotent(self, db_path: Path) -> None:
        init_db_for_tests(db_path)
        init_db_for_tests(db_path)  # Should not raise

    def test_creates_parent_directory(self, tmp_path: Path) -> None:
        db_path = tmp_path / "subdir" / "test.db"
        init_db_for_tests(db_path)
        assert db_path.exists()
        reset_engine()


class TestInitDbWithAlembic:
    def test_creates_tables_via_migrations(self, db_path: Path) -> None:
        from app.database import init_db
        init_db(db_path)
        conn = sqlite3.connect(db_path)
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in cursor.fetchall()}
        conn.close()
        assert "ai_config" in tables
        assert "ai_analysis_cache" in tables
        assert "hidden_zones" in tables
        assert "ai_analysis_settings" in tables
        assert "alembic_version" in tables

    def test_idempotent(self, db_path: Path) -> None:
        from app.database import init_db
        init_db(db_path)
        reset_engine()
        init_db(db_path)  # Should not raise


class TestGetEngine:
    def test_returns_engine_after_init(self, db_path: Path) -> None:
        init_db_for_tests(db_path)
        engine = get_engine()
        assert engine is not None

    def test_raises_before_init(self) -> None:
        with pytest.raises(RuntimeError, match="not initialized"):
            get_engine()


class TestGetSession:
    def test_returns_session_after_init(self, db_path: Path) -> None:
        init_db_for_tests(db_path)
        session = get_session()
        assert session is not None
        session.close()

    def test_raises_before_init(self) -> None:
        with pytest.raises(RuntimeError, match="not initialized"):
            get_session()
