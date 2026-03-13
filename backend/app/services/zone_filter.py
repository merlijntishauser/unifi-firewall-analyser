"""Zone filter persistence service."""

from __future__ import annotations

import logging

from sqlalchemy import select

from app.database import get_session
from app.models_db import HiddenZoneRow

logger = logging.getLogger(__name__)


def get_hidden_zone_ids() -> list[str]:
    """Return all hidden zone IDs."""
    session = get_session()
    try:
        rows = session.execute(select(HiddenZoneRow.zone_id)).scalars().all()
        logger.debug("Loaded %d hidden zone IDs", len(rows))
        return list(rows)
    finally:
        session.close()


def save_hidden_zone_ids(zone_ids: list[str]) -> None:
    """Replace hidden zone IDs with the given list."""
    logger.debug("Saving %d hidden zone IDs: %s", len(zone_ids), zone_ids)
    session = get_session()
    try:
        session.query(HiddenZoneRow).delete()
        for zid in zone_ids:
            session.add(HiddenZoneRow(zone_id=zid))
        session.commit()
    finally:
        session.close()
