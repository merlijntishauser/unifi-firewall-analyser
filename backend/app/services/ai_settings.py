"""AI configuration storage and retrieval."""

import logging
import os
import sqlite3
from pathlib import Path

from app.database import get_connection

logger = logging.getLogger(__name__)


def get_ai_config(db_path: Path) -> dict[str, object] | None:
    """Get AI config. Returns dict with has_key (bool) instead of actual key, plus source field."""
    base_url = os.environ.get("AI_BASE_URL")
    api_key = os.environ.get("AI_API_KEY")
    model = os.environ.get("AI_MODEL")
    provider_type = os.environ.get("AI_PROVIDER_TYPE", "openai")

    if base_url and api_key and model:
        logger.debug("AI config from env: provider=%s, model=%s", provider_type, model)
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
        logger.debug("No AI config found in env or db")
        return None

    logger.debug("AI config from db: provider=%s, model=%s", row["provider_type"], row["model"])
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
        logger.debug("Full AI config from env: provider=%s, model=%s", provider_type, model)
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
        logger.debug("No full AI config found")
        return None

    logger.debug("Full AI config from db: provider=%s, model=%s", row["provider_type"], row["model"])
    return {
        "base_url": row["base_url"],
        "api_key": row["api_key"],
        "model": row["model"],
        "provider_type": row["provider_type"],
    }


def save_ai_config(db_path: Path, base_url: str, api_key: str, model: str, provider_type: str) -> None:
    """Save AI config (upsert)."""
    logger.debug("Saving AI config: provider=%s, model=%s, base_url=%s", provider_type, model, base_url)
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
    logger.debug("Deleting AI config")
    conn = get_connection(db_path)
    conn.execute("DELETE FROM ai_config WHERE id = 1")
    conn.commit()
    conn.close()


_VALID_SITE_PROFILES = {"homelab", "smb", "enterprise"}


def get_ai_analysis_settings(db_path: Path) -> dict[str, str]:
    """Get AI analysis settings. Returns defaults if no row exists."""
    conn = get_connection(db_path)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT site_profile FROM ai_analysis_settings WHERE id = 1").fetchone()
    conn.close()

    if row is None:
        logger.debug("No AI analysis settings found, using defaults")
        return {"site_profile": "homelab"}

    logger.debug("AI analysis settings: site_profile=%s", row["site_profile"])
    return {"site_profile": row["site_profile"]}


def save_ai_analysis_settings(db_path: Path, site_profile: str) -> None:
    """Save AI analysis settings (upsert). Validates site_profile."""
    if site_profile not in _VALID_SITE_PROFILES:
        msg = f"Invalid site_profile '{site_profile}'. Must be one of: {', '.join(sorted(_VALID_SITE_PROFILES))}"
        raise ValueError(msg)

    logger.debug("Saving AI analysis settings: site_profile=%s", site_profile)
    conn = get_connection(db_path)
    conn.execute(
        """INSERT INTO ai_analysis_settings (id, site_profile)
           VALUES (1, ?)
           ON CONFLICT(id) DO UPDATE SET site_profile = excluded.site_profile""",
        (site_profile,),
    )
    conn.commit()
    conn.close()
