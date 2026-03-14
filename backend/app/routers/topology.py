"""Router for topology SVG rendering."""

import structlog
from fastapi import APIRouter, HTTPException

from app.config import get_unifi_config, has_credentials
from app.models import TopologySvgResponse, TopologyTheme
from app.services.topology import VALID_PROJECTIONS, get_available_themes, get_topology_svg

log = structlog.get_logger()

router = APIRouter(tags=["topology"])


@router.get("/svg")
async def topology_svg(theme: str = "unifi", projection: str = "orthogonal") -> TopologySvgResponse:
    if not has_credentials():
        raise HTTPException(status_code=401, detail="No credentials configured")

    if projection not in VALID_PROJECTIONS:
        valid = ", ".join(VALID_PROJECTIONS)
        raise HTTPException(status_code=400, detail=f"Invalid projection: {projection}. Valid: {valid}")

    credentials = get_unifi_config()
    assert credentials is not None

    try:
        svg = get_topology_svg(credentials, theme_name=theme, projection=projection)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    log.info("topology_svg_served", theme=theme, projection=projection)
    return TopologySvgResponse(svg=svg, theme=theme, projection=projection)


@router.get("/themes")
async def topology_themes() -> list[TopologyTheme]:
    themes = get_available_themes()
    return [TopologyTheme(id=t["id"], name=t["name"]) for t in themes]
