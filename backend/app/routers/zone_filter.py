"""Zone filter router for persisting hidden zone selections."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.database import DEFAULT_DB_PATH
from app.services.zone_filter import get_hidden_zone_ids, save_hidden_zone_ids

router = APIRouter(prefix="/api/settings", tags=["settings"])


class ZoneFilterInput(BaseModel):
    hidden_zone_ids: list[str]


@router.get("/zone-filter")
async def get_zone_filter() -> dict[str, list[str]]:
    return {"hidden_zone_ids": get_hidden_zone_ids(DEFAULT_DB_PATH)}


@router.put("/zone-filter")
async def save_zone_filter(body: ZoneFilterInput) -> dict[str, str]:
    save_hidden_zone_ids(DEFAULT_DB_PATH, body.hidden_zone_ids)
    return {"status": "ok"}
