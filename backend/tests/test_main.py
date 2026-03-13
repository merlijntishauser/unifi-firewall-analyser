"""Tests for app startup (lifespan)."""

from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.main import (
    _check_plaintext_db_key,
    _get_app_access_url,
    _get_frontend_dist_dir,
    _get_frontend_response,
    _log_startup_banner,
    lifespan,
)


@pytest.mark.anyio
async def test_lifespan_calls_init_db() -> None:
    test_app = FastAPI()
    with patch("app.main.init_db") as mock_init:
        async with lifespan(test_app):
            mock_init.assert_called_once()


def test_get_app_access_url_defaults_to_localhost(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("APP_ACCESS_URL", raising=False)
    monkeypatch.delenv("PORT", raising=False)

    assert _get_app_access_url() == "http://localhost:8080"


def test_get_app_access_url_uses_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ACCESS_URL", "http://localhost:8081/")

    assert _get_app_access_url() == "http://localhost:8081"


def test_get_frontend_dist_dir_defaults_to_repo_frontend_dist(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("FRONTEND_DIST_DIR", raising=False)

    dist_dir = _get_frontend_dist_dir()

    assert dist_dir.name == "dist"
    assert dist_dir.parent.name == "frontend"


def test_log_startup_banner_logs_ascii_art(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ACCESS_URL", "http://localhost:8081")
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")

    with patch("app.main.startup_logger.info") as mock_info:
        _log_startup_banner()

    logged_lines = [call.args[0] for call in mock_info.call_args_list]
    assert any("Firewall Analyser" in line for line in logged_lines)
    assert any("http://localhost:8081" in line for line in logged_lines)
    assert any("/api/health" in line for line in logged_lines)
    assert any("DEBUG" in line for line in logged_lines)
    assert any("disabled" in line for line in logged_lines)


def test_log_startup_banner_shows_auth_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ACCESS_URL", "http://localhost:8081")
    with patch("app.main.app_settings") as mock_settings:
        mock_settings.app_password = "secret"
        with patch("app.main.startup_logger.info") as mock_info:
            _log_startup_banner()

    logged_lines = [call.args[0] for call in mock_info.call_args_list]
    assert any("enabled" in line for line in logged_lines)


def test_check_plaintext_db_key_warns_when_key_in_db(tmp_path: Path) -> None:
    from app.database import init_db_for_tests, reset_engine
    from app.services.ai_settings import save_ai_config

    db_path = tmp_path / "test.db"
    init_db_for_tests(db_path)
    save_ai_config("https://api.openai.com/v1", "sk-secret", "gpt-4o", "openai")

    try:
        with (
            patch("app.main.app_settings") as mock_settings,
            patch("app.main.log") as mock_log,
        ):
            mock_settings.app_password = "secret"
            _check_plaintext_db_key()
        mock_log.warning.assert_called_once()
        assert mock_log.warning.call_args[0][0] == "plaintext_db_key"
    finally:
        reset_engine()


def test_check_plaintext_db_key_silent_without_app_password() -> None:
    with (
        patch("app.main.app_settings") as mock_settings,
        patch("app.main.log") as mock_log,
    ):
        mock_settings.app_password = ""
        _check_plaintext_db_key()
    mock_log.warning.assert_not_called()


def test_check_plaintext_db_key_silent_when_no_key_in_db(tmp_path: Path) -> None:
    from app.database import init_db_for_tests, reset_engine

    db_path = tmp_path / "test.db"
    init_db_for_tests(db_path)

    try:
        with (
            patch("app.main.app_settings") as mock_settings,
            patch("app.main.log") as mock_log,
        ):
            mock_settings.app_password = "secret"
            _check_plaintext_db_key()
        mock_log.warning.assert_not_called()
    finally:
        reset_engine()


@pytest.mark.anyio
async def test_root_returns_404_without_frontend_dist(
    client: AsyncClient,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FRONTEND_DIST_DIR", str(tmp_path / "missing"))

    response = await client.get("/")

    assert response.status_code == 404


def test_get_frontend_response_rejects_path_traversal(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir()
    (dist_dir / "index.html").write_text("<!doctype html><title>UniFi Firewall Analyser</title>", encoding="utf-8")
    monkeypatch.setenv("FRONTEND_DIST_DIR", str(dist_dir))

    response = _get_frontend_response("../secret.txt")

    assert response is None


def test_get_frontend_response_returns_none_without_index(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir()
    monkeypatch.setenv("FRONTEND_DIST_DIR", str(dist_dir))

    response = _get_frontend_response("")

    assert response is None


@pytest.mark.anyio
async def test_root_serves_index_when_frontend_dist_exists(
    client: AsyncClient,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir()
    (dist_dir / "index.html").write_text("<!doctype html><title>UniFi Firewall Analyser</title>", encoding="utf-8")
    monkeypatch.setenv("FRONTEND_DIST_DIR", str(dist_dir))

    response = await client.get("/")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "UniFi Firewall Analyser" in response.text


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


@pytest.mark.anyio
async def test_api_paths_are_not_handled_by_frontend_catchall(
    client: AsyncClient,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir()
    (dist_dir / "index.html").write_text("<!doctype html><title>UniFi Firewall Analyser</title>", encoding="utf-8")
    monkeypatch.setenv("FRONTEND_DIST_DIR", str(dist_dir))

    response = await client.get("/api/not-real")

    assert response.status_code == 404
