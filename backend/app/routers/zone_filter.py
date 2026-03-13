"""Zone filter router for persisting hidden zone selections."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.zone_filter import get_hidden_zone_ids, save_hidden_zone_ids

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings", tags=["settings"])


class ZoneFilterInput(BaseModel):
    hidden_zone_ids: list[str]


@router.get("/zone-filter")
async def get_zone_filter() -> dict[str, list[str]]:
    hidden = get_hidden_zone_ids()
    logger.debug("Get zone filter: %d hidden zones", len(hidden))
    return {"hidden_zone_ids": hidden}


@router.put("/zone-filter")
async def save_zone_filter(body: ZoneFilterInput) -> dict[str, str]:
    logger.debug("Save zone filter: %d hidden zones", len(body.hidden_zone_ids))
    save_hidden_zone_ids(body.hidden_zone_ids)
    return {"status": "ok"}
