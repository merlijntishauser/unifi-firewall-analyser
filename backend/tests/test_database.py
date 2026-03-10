"""Tests for database setup and migrations."""

import sqlite3
from pathlib import Path

import pytest

from app.database import get_connection, init_db


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "test.db"


class TestInitDb:
    def test_creates_tables(self, db_path: Path) -> None:
        init_db(db_path)
        conn = sqlite3.connect(db_path)
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in cursor.fetchall()}
        conn.close()
        assert "ai_config" in tables
        assert "ai_analysis_cache" in tables

    def test_idempotent(self, db_path: Path) -> None:
        init_db(db_path)
        init_db(db_path)  # Should not raise

    def test_creates_parent_directory(self, tmp_path: Path) -> None:
        db_path = tmp_path / "subdir" / "test.db"
        init_db(db_path)
        assert db_path.exists()


class TestGetConnection:
    def test_returns_connection(self, db_path: Path) -> None:
        init_db(db_path)
        conn = get_connection(db_path)
        assert isinstance(conn, sqlite3.Connection)
        conn.close()
