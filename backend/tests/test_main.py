"""Tests for app startup (lifespan)."""

from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.main import lifespan


@pytest.mark.anyio
async def test_lifespan_calls_init_db() -> None:
    test_app = FastAPI()
    with patch("app.main.init_db") as mock_init:
        async with lifespan(test_app):
            mock_init.assert_called_once()


@pytest.mark.anyio
async def test_root_returns_404_without_frontend_dist(
    client: AsyncClient,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FRONTEND_DIST_DIR", str(tmp_path / "missing"))

    response = await client.get("/")

    assert response.status_code == 404


@pytest.mark.anyio
async def test_serves_index_for_spa_routes(
    client: AsyncClient,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir()
    (dist_dir / "index.html").write_text("<!doctype html><title>UniFi Firewall Analyser</title>", encoding="utf-8")
    monkeypatch.setenv("FRONTEND_DIST_DIR", str(dist_dir))

    response = await client.get("/zone/internal")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "UniFi Firewall Analyser" in response.text


@pytest.mark.anyio
async def test_serves_existing_static_assets(
    client: AsyncClient,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dist_dir = tmp_path / "dist"
    assets_dir = dist_dir / "assets"
    assets_dir.mkdir(parents=True)
    (dist_dir / "index.html").write_text("<!doctype html><title>UniFi Firewall Analyser</title>", encoding="utf-8")
    (assets_dir / "app.js").write_text("console.log('ok');", encoding="utf-8")
    monkeypatch.setenv("FRONTEND_DIST_DIR", str(dist_dir))

    response = await client.get("/assets/app.js")

    assert response.status_code == 200
    assert "console.log('ok');" in response.text


@pytest.mark.anyio
async def test_missing_static_assets_return_404(
    client: AsyncClient,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir()
    (dist_dir / "index.html").write_text("<!doctype html><title>UniFi Firewall Analyser</title>", encoding="utf-8")
    monkeypatch.setenv("FRONTEND_DIST_DIR", str(dist_dir))

    response = await client.get("/assets/missing.js")

    assert response.status_code == 404
