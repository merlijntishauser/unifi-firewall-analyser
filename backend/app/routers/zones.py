from fastapi import APIRouter, HTTPException

from app.config import get_unifi_config, has_credentials
from app.models import Zone
from app.services.firewall import get_zones

router = APIRouter(prefix="/api", tags=["zones"])


@router.get("/zones")
async def list_zones() -> list[Zone]:
    if not has_credentials():
        raise HTTPException(status_code=401, detail="No credentials configured")

    credentials = get_unifi_config()
    assert credentials is not None  # guaranteed by has_credentials()
    return get_zones(credentials)
