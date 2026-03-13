"""SQLite database setup for AI configuration and analysis caching."""

import os
import sqlite3
from pathlib import Path

# Keep both spellings for convenience in container environments.
DEFAULT_DB_PATH = Path(
    os.environ.get("ANALYSER_DB_PATH", os.environ.get("ANALYZER_DB_PATH", "data/analyser.db"))
)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS ai_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    base_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    model TEXT NOT NULL,
    provider_type TEXT NOT NULL DEFAULT 'openai'
);

CREATE TABLE IF NOT EXISTS ai_analysis_cache (
    cache_key TEXT PRIMARY KEY,
    zone_pair_key TEXT NOT NULL,
    findings TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hidden_zones (
    zone_id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS ai_analysis_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    site_profile TEXT NOT NULL DEFAULT 'homelab'
);
"""


def init_db(db_path: Path = DEFAULT_DB_PATH) -> None:
    """Initialize the database with required tables."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.executescript(_SCHEMA)
    conn.close()


def get_connection(db_path: Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """Get a database connection."""
    return sqlite3.connect(db_path)
