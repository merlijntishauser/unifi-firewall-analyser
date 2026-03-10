"""Tests for settings router."""

from pathlib import Path

import pytest
from httpx import AsyncClient

from app.database import init_db


@pytest.fixture(autouse=True)
def _use_test_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db_path = tmp_path / "test.db"
    init_db(db_path)
    monkeypatch.setattr("app.routers.settings.DEFAULT_DB_PATH", db_path)


@pytest.mark.anyio
async def test_get_ai_config_empty(client: AsyncClient) -> None:
    resp = await client.get("/api/settings/ai")
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "none"
    assert data["has_key"] is False
    assert data["base_url"] == ""
    assert data["model"] == ""
    assert data["provider_type"] == ""


@pytest.mark.anyio
async def test_put_ai_config(client: AsyncClient) -> None:
    resp = await client.put(
        "/api/settings/ai",
        json={
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-secret",
            "model": "gpt-4o",
            "provider_type": "openai",
        },
    )
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.anyio
async def test_get_ai_config_after_save(client: AsyncClient) -> None:
    await client.put(
        "/api/settings/ai",
        json={
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-secret",
            "model": "gpt-4o",
            "provider_type": "openai",
        },
    )
    resp = await client.get("/api/settings/ai")
    assert resp.status_code == 200
    data = resp.json()
    assert data["base_url"] == "https://api.openai.com/v1"
    assert data["model"] == "gpt-4o"
    assert data["provider_type"] == "openai"
    assert data["has_key"] is True
    assert data["source"] == "db"
    assert "api_key" not in data


@pytest.mark.anyio
async def test_delete_ai_config(client: AsyncClient) -> None:
    await client.put(
        "/api/settings/ai",
        json={
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-secret",
            "model": "gpt-4o",
            "provider_type": "openai",
        },
    )
    resp = await client.delete("/api/settings/ai")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}

    get_resp = await client.get("/api/settings/ai")
    assert get_resp.json()["source"] == "none"


@pytest.mark.anyio
async def test_get_presets(client: AsyncClient) -> None:
    resp = await client.get("/api/settings/ai/presets")
    assert resp.status_code == 200
    presets = resp.json()
    assert isinstance(presets, list)
    assert len(presets) == 2
    ids = {p["id"] for p in presets}
    assert ids == {"anthropic", "openai"}
    for preset in presets:
        assert "name" in preset
        assert "base_url" in preset
        assert "provider_type" in preset
        assert "default_model" in preset
        assert "models" in preset


@pytest.mark.anyio
async def test_test_connection_no_config(client: AsyncClient) -> None:
    resp = await client.post("/api/settings/ai/test")
    assert resp.status_code == 400
    assert resp.json()["detail"] == "No AI provider configured"


@pytest.mark.anyio
async def test_test_connection_with_config(client: AsyncClient) -> None:
    await client.put(
        "/api/settings/ai",
        json={
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-secret",
            "model": "gpt-4o",
            "provider_type": "openai",
        },
    )
    resp = await client.post("/api/settings/ai/test")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
