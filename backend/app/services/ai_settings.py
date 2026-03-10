"""AI configuration storage and retrieval."""

import os
import sqlite3
from pathlib import Path

from app.database import get_connection


def get_ai_config(db_path: Path) -> dict[str, object] | None:
    """Get AI config. Returns dict with has_key (bool) instead of actual key, plus source field."""
    base_url = os.environ.get("AI_BASE_URL")
    api_key = os.environ.get("AI_API_KEY")
    model = os.environ.get("AI_MODEL")
    provider_type = os.environ.get("AI_PROVIDER_TYPE", "openai")

    if base_url and api_key and model:
        return {
            "base_url": base_url,
            "model": model,
            "provider_type": provider_type,
            "has_key": True,
            "source": "env",
        }

    conn = get_connection(db_path)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT base_url, api_key, model, provider_type FROM ai_config WHERE id = 1").fetchone()
    conn.close()

    if row is None:
        return None

    return {
        "base_url": row["base_url"],
        "model": row["model"],
        "provider_type": row["provider_type"],
        "has_key": bool(row["api_key"]),
        "source": "db",
    }


def get_full_ai_config(db_path: Path) -> dict[str, str] | None:
    """Get full AI config including API key (for internal use only)."""
    base_url = os.environ.get("AI_BASE_URL")
    api_key = os.environ.get("AI_API_KEY")
    model = os.environ.get("AI_MODEL")
    provider_type = os.environ.get("AI_PROVIDER_TYPE", "openai")

    if base_url and api_key and model:
        return {
            "base_url": base_url,
            "api_key": api_key,
            "model": model,
            "provider_type": provider_type,
        }

    conn = get_connection(db_path)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT base_url, api_key, model, provider_type FROM ai_config WHERE id = 1").fetchone()
    conn.close()

    if row is None:
        return None

    return {
        "base_url": row["base_url"],
        "api_key": row["api_key"],
        "model": row["model"],
        "provider_type": row["provider_type"],
    }


def save_ai_config(db_path: Path, base_url: str, api_key: str, model: str, provider_type: str) -> None:
    """Save AI config (upsert)."""
    conn = get_connection(db_path)
    conn.execute(
        """INSERT INTO ai_config (id, base_url, api_key, model, provider_type)
           VALUES (1, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             base_url = excluded.base_url,
             api_key = excluded.api_key,
             model = excluded.model,
             provider_type = excluded.provider_type""",
        (base_url, api_key, model, provider_type),
    )
    conn.commit()
    conn.close()


def delete_ai_config(db_path: Path) -> None:
    """Delete AI config."""
    conn = get_connection(db_path)
    conn.execute("DELETE FROM ai_config WHERE id = 1")
    conn.commit()
    conn.close()
