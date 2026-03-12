from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import get_unifi_config, has_credentials
from app.models import Rule, ZonePair
from app.services.firewall import get_rules, get_zone_pairs
from app.services.firewall_writer import WriteError, swap_policy_order, toggle_policy

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


class ToggleRequest(BaseModel):
    enabled: bool


@router.patch("/rules/{rule_id}/toggle")
async def toggle_rule(rule_id: str, body: ToggleRequest) -> dict[str, str]:
    if not has_credentials():
        raise HTTPException(status_code=401, detail="No credentials configured")

    credentials = get_unifi_config()
    assert credentials is not None
    try:
        toggle_policy(credentials, rule_id, enabled=body.enabled)
    except WriteError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"status": "ok"}


class SwapOrderRequest(BaseModel):
    policy_id_a: str
    policy_id_b: str


@router.put("/rules/reorder")
async def reorder_rules(body: SwapOrderRequest) -> dict[str, str]:
    if not has_credentials():
        raise HTTPException(status_code=401, detail="No credentials configured")

    credentials = get_unifi_config()
    assert credentials is not None
    try:
        swap_policy_order(credentials, body.policy_id_a, body.policy_id_b)
    except WriteError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"status": "ok"}
