"""Router for site health endpoints."""

import structlog
from fastapi import APIRouter, HTTPException

from app.config import get_unifi_config, has_credentials
from app.models import HealthAnalysisResult, HealthSummaryResponse
from app.services.site_health import analyze_site_health, get_health_summary

log = structlog.get_logger()

router = APIRouter(tags=["health"])


@router.get("/summary")
async def health_summary() -> HealthSummaryResponse:
    if not has_credentials():
        raise HTTPException(status_code=401, detail="No credentials configured")

    credentials = get_unifi_config()
    assert credentials is not None

    return get_health_summary(credentials)


@router.post("/analyze")
async def health_analyze() -> HealthAnalysisResult:
    if not has_credentials():
        raise HTTPException(status_code=401, detail="No credentials configured")

    credentials = get_unifi_config()
    assert credentials is not None

    log.info("health_analysis_requested")
    result = await analyze_site_health(credentials)
    log.info("health_analysis_complete", status=result.status, finding_count=len(result.findings))
    return result
