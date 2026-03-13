"""Settings router for AI configuration management."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import DEFAULT_DB_PATH
from app.services.ai_settings import (
    delete_ai_config,
    get_ai_analysis_settings,
    get_ai_config,
    get_full_ai_config,
    save_ai_analysis_settings,
    save_ai_config,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings", tags=["settings"])

PRESETS: list[dict[str, object]] = [
    {
        "id": "anthropic",
        "name": "Anthropic Claude",
        "base_url": "https://api.anthropic.com/v1",
        "provider_type": "anthropic",
        "default_model": "claude-sonnet-4-6",
        "models": ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-6"],
    },
    {
        "id": "openai",
        "name": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "provider_type": "openai",
        "default_model": "gpt-4.1-mini",
        "models": ["gpt-4.1-nano", "gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o"],
    },
]


class AiConfigInput(BaseModel):
    base_url: str
    api_key: str
    model: str
    provider_type: str


class AiAnalysisSettingsInput(BaseModel):
    site_profile: str


@router.get("/ai")
async def get_config() -> dict[str, object]:
    config = get_ai_config(DEFAULT_DB_PATH)
    logger.debug("Get AI config: source=%s", config.get("source"))
    return config


@router.put("/ai")
async def save_config(body: AiConfigInput) -> dict[str, str]:
    logger.debug("Save AI config: provider=%s, model=%s, base_url=%s", body.provider_type, body.model, body.base_url)
    save_ai_config(DEFAULT_DB_PATH, body.base_url, body.api_key, body.model, body.provider_type)
    return {"status": "ok"}


@router.delete("/ai")
async def delete_config() -> dict[str, str]:
    logger.debug("Delete AI config")
    delete_ai_config(DEFAULT_DB_PATH)
    return {"status": "ok"}


class AiTestInput(BaseModel):
    base_url: str
    api_key: str = ""
    model: str
    provider_type: str


@router.post("/ai/test")
async def test_connection(body: AiTestInput | None = None) -> dict[str, str]:
    import httpx

    if body and body.base_url and body.model:
        base_url = body.base_url
        api_key = body.api_key
        model = body.model
        provider_type = body.provider_type
        if not api_key:
            full_config = get_full_ai_config(DEFAULT_DB_PATH)
            api_key = full_config["api_key"] if full_config else ""
        if not api_key:
            raise HTTPException(status_code=400, detail="No API key provided")
    else:
        full_config = get_full_ai_config(DEFAULT_DB_PATH)
        if full_config is None:
            raise HTTPException(status_code=400, detail="No AI provider configured")
        base_url = full_config["base_url"]
        api_key = full_config["api_key"]
        model = full_config["model"]
        provider_type = full_config["provider_type"]

    logger.debug("Testing AI connection: provider=%s, model=%s", provider_type, model)
    try:
        if provider_type == "anthropic":
            resp = httpx.post(
                f"{base_url}/messages",
                headers={
                    "x-api-key": str(api_key),
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": str(model),
                    "max_tokens": 10,
                    "messages": [{"role": "user", "content": "Say OK"}],
                },
                timeout=15.0,
            )
        else:
            resp = httpx.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": str(model),
                    "messages": [{"role": "user", "content": "Say OK"}],
                    "max_tokens": 10,
                },
                timeout=15.0,
            )
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        logger.debug("AI test failed: provider returned %s: %s", e.response.status_code, e.response.text[:200])
        raise HTTPException(
            status_code=502,
            detail=f"Provider returned HTTP {e.response.status_code}",
        ) from e
    except httpx.ConnectError as e:
        logger.debug("AI test failed: connection error: %s", e)
        raise HTTPException(status_code=502, detail="Connection to provider failed") from e
    except httpx.TimeoutException as e:
        logger.debug("AI test failed: timeout")
        raise HTTPException(status_code=504, detail="Connection timed out") from e

    logger.debug("AI test connection succeeded")
    return {"status": "ok"}


@router.get("/ai/presets")
async def get_presets() -> list[dict[str, object]]:
    return PRESETS


@router.get("/ai-analysis")
async def get_analysis_settings() -> dict[str, str]:
    settings = get_ai_analysis_settings(DEFAULT_DB_PATH)
    logger.debug("Get AI analysis settings: %s", settings)
    return settings


@router.put("/ai-analysis")
async def save_analysis_settings(body: AiAnalysisSettingsInput) -> dict[str, str]:
    logger.debug("Save AI analysis settings: site_profile=%s", body.site_profile)
    try:
        save_ai_analysis_settings(DEFAULT_DB_PATH, body.site_profile)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"status": "ok"}
