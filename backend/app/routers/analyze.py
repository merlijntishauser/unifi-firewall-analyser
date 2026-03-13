"""Router for AI-powered firewall rule analysis."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel

from app.database import DEFAULT_DB_PATH
from app.models import AiAnalysisResult, Rule
from app.services.ai_analyzer import analyze_with_ai
from app.services.analyzer import analyze_zone_pair

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["analyze"])


class AnalyzeRequest(BaseModel):
    source_zone_name: str
    destination_zone_name: str
    rules: list[Rule]


@router.post("/analyze", response_model=AiAnalysisResult)
async def analyze(body: AnalyzeRequest) -> AiAnalysisResult:
    logger.debug(
        "AI analysis requested: %s -> %s (%d rules)",
        body.source_zone_name, body.destination_zone_name, len(body.rules),
    )
    # Run static analysis to provide context to the AI
    static_result = analyze_zone_pair(
        body.rules, body.source_zone_name, body.destination_zone_name,
    )
    result = await analyze_with_ai(
        body.rules,
        body.source_zone_name,
        body.destination_zone_name,
        db_path=DEFAULT_DB_PATH,
        static_findings=static_result.findings,
    )
    logger.debug("AI analysis result: status=%s, findings=%d", result.status, len(result.findings))
    return result
