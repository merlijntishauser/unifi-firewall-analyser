"""Zone filter persistence service."""

from __future__ import annotations

from pathlib import Path

from app.database import get_connection


def get_hidden_zone_ids(db_path: Path) -> list[str]:
    """Return all hidden zone IDs."""
    conn = get_connection(db_path)
    try:
        rows = conn.execute("SELECT zone_id FROM hidden_zones").fetchall()
        return [row[0] for row in rows]
    finally:
        conn.close()


def save_hidden_zone_ids(db_path: Path, zone_ids: list[str]) -> None:
    """Replace hidden zone IDs with the given list."""
    conn = get_connection(db_path)
    try:
        conn.execute("DELETE FROM hidden_zones")
        if zone_ids:
            conn.executemany(
                "INSERT INTO hidden_zones (zone_id) VALUES (?)",
                [(zid,) for zid in zone_ids],
            )
        conn.commit()
    finally:
        conn.close()
