"""Settings router for AI configuration management."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import DEFAULT_DB_PATH
from app.services.ai_settings import (
    delete_ai_config,
    get_ai_config,
    save_ai_config,
)

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


@router.get("/ai")
async def get_config() -> dict[str, object]:
    config = get_ai_config(DEFAULT_DB_PATH)
    if config is None:
        return {"source": "none", "has_key": False, "base_url": "", "model": "", "provider_type": ""}
    return config


@router.put("/ai")
async def save_config(body: AiConfigInput) -> dict[str, str]:
    save_ai_config(DEFAULT_DB_PATH, body.base_url, body.api_key, body.model, body.provider_type)
    return {"status": "ok"}


@router.delete("/ai")
async def delete_config() -> dict[str, str]:
    delete_ai_config(DEFAULT_DB_PATH)
    return {"status": "ok"}


@router.post("/ai/test")
async def test_connection() -> dict[str, str]:
    config = get_ai_config(DEFAULT_DB_PATH)
    if config is None or not config["has_key"]:
        raise HTTPException(status_code=400, detail="No AI provider configured")
    return {"status": "ok"}


@router.get("/ai/presets")
async def get_presets() -> list[dict[str, object]]:
    return PRESETS
