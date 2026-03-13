"""AI configuration storage and retrieval."""

import logging
import os
import sqlite3
from pathlib import Path

from app.database import get_connection

logger = logging.getLogger(__name__)


def _read_key_from_file() -> str:
    """Read AI API key from file path specified in AI_API_KEY_FILE env var."""
    key_file = os.environ.get("AI_API_KEY_FILE")
    if not key_file:
        return ""
    try:
        return Path(key_file).read_text().strip()
    except OSError:
        logger.warning("Could not read AI_API_KEY_FILE at %s", key_file)
        return ""


def _get_env_api_key() -> str:
    """Get AI API key from env var or file, with env var taking priority."""
    return os.environ.get("AI_API_KEY") or _read_key_from_file()


def get_ai_config(db_path: Path) -> dict[str, object]:
    """Get AI config. Returns dict with has_key (bool) instead of actual key, plus source field."""
    base_url = os.environ.get("AI_BASE_URL")
    api_key = _get_env_api_key()
    model = os.environ.get("AI_MODEL")
    provider_type = os.environ.get("AI_PROVIDER_TYPE", "openai")

    if base_url and api_key and model:
        logger.debug("AI config from env: provider=%s, model=%s", provider_type, model)
        return {
            "base_url": base_url,
            "model": model,
            "provider_type": provider_type,
            "has_key": True,
            "key_source": "env",
            "source": "env",
        }

    conn = get_connection(db_path)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT base_url, api_key, model, provider_type FROM ai_config WHERE id = 1").fetchone()
    conn.close()

    if row is None:
        has_env_key = bool(api_key)
        logger.debug("No AI config found in env or db (env_key=%s)", has_env_key)
        return {
            "base_url": "",
            "model": "",
            "provider_type": "",
            "has_key": has_env_key,
            "key_source": "env" if has_env_key else "none",
            "source": "none",
        }

    env_key = _get_env_api_key()
    db_has_key = bool(row["api_key"])
    has_env_key = bool(env_key)
    key_source = "db" if db_has_key else ("env" if has_env_key else "none")
    logger.debug("AI config from db: provider=%s, model=%s, key=%s", row["provider_type"], row["model"], key_source)
    return {
        "base_url": row["base_url"],
        "model": row["model"],
        "provider_type": row["provider_type"],
        "has_key": db_has_key or has_env_key,
        "key_source": key_source,
        "source": "db",
    }


def get_full_ai_config(db_path: Path) -> dict[str, str] | None:
    """Get full AI config including API key (for internal use only)."""
    base_url = os.environ.get("AI_BASE_URL")
    api_key = _get_env_api_key()
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

    # Use env API key as fallback when DB key is empty
    effective_key = row["api_key"] or api_key
    logger.debug("Full AI config from db: provider=%s, model=%s", row["provider_type"], row["model"])
    return {
        "base_url": row["base_url"],
        "api_key": effective_key,
        "model": row["model"],
        "provider_type": row["provider_type"],
    }


def save_ai_config(db_path: Path, base_url: str, api_key: str, model: str, provider_type: str) -> None:
    """Save AI config (upsert). If api_key is empty, preserves the existing key."""
    logger.debug("Saving AI config: provider=%s, model=%s, base_url=%s", provider_type, model, base_url)
    conn = get_connection(db_path)
    if api_key:
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
    else:
        conn.execute(
            """INSERT INTO ai_config (id, base_url, api_key, model, provider_type)
               VALUES (1, ?, '', ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 base_url = excluded.base_url,
                 model = excluded.model,
                 provider_type = excluded.provider_type""",
            (base_url, model, provider_type),
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
