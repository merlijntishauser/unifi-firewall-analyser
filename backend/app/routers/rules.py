from fastapi import APIRouter, HTTPException

from app.config import get_unifi_config, has_credentials
from app.models import Rule, ZonePair
from app.services.firewall import get_rules, get_zone_pairs

router = APIRouter(prefix="/api", tags=["rules"])


@router.get("/rules")
async def list_rules(
    source_zone: str | None = None,
    destination_zone: str | None = None,
) -> list[Rule]:
    if not has_credentials():
        raise HTTPException(status_code=401, detail="No credentials configured")

    credentials = get_unifi_config()
    assert credentials is not None  # guaranteed by has_credentials()
    rules = get_rules(credentials)

    if source_zone is not None:
        rules = [r for r in rules if r.source_zone_id == source_zone]
    if destination_zone is not None:
        rules = [r for r in rules if r.destination_zone_id == destination_zone]

    return rules


@router.get("/zone-pairs")
async def list_zone_pairs() -> list[ZonePair]:
    if not has_credentials():
        raise HTTPException(status_code=401, detail="No credentials configured")

    credentials = get_unifi_config()
    assert credentials is not None  # guaranteed by has_credentials()
    return get_zone_pairs(credentials)
