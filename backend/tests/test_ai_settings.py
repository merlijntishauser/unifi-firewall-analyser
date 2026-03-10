"""Tests for AI settings service."""

from pathlib import Path

import pytest

from app.database import init_db
from app.services.ai_settings import (
    delete_ai_config,
    get_ai_config,
    get_full_ai_config,
    save_ai_config,
)


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    path = tmp_path / "test.db"
    init_db(path)
    return path


class TestGetAiConfig:
    def test_returns_none_when_no_config(self, db_path: Path) -> None:
        result = get_ai_config(db_path)
        assert result is None

    def test_returns_saved_config(self, db_path: Path) -> None:
        save_ai_config(db_path, "https://api.openai.com/v1", "sk-secret", "gpt-4o", "openai")
        result = get_ai_config(db_path)
        assert result is not None
        assert result["base_url"] == "https://api.openai.com/v1"
        assert result["model"] == "gpt-4o"
        assert result["provider_type"] == "openai"
        assert result["source"] == "db"

    def test_returns_has_key_true_not_actual_key(self, db_path: Path) -> None:
        save_ai_config(db_path, "https://api.openai.com/v1", "sk-secret", "gpt-4o", "openai")
        result = get_ai_config(db_path)
        assert result is not None
        assert result["has_key"] is True
        assert "api_key" not in result

    def test_env_var_fallback(self, db_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("AI_BASE_URL", "https://api.anthropic.com/v1")
        monkeypatch.setenv("AI_API_KEY", "sk-env-key")
        monkeypatch.setenv("AI_MODEL", "claude-sonnet-4-6")
        monkeypatch.setenv("AI_PROVIDER_TYPE", "anthropic")

        result = get_ai_config(db_path)
        assert result is not None
        assert result["base_url"] == "https://api.anthropic.com/v1"
        assert result["model"] == "claude-sonnet-4-6"
        assert result["provider_type"] == "anthropic"
        assert result["has_key"] is True
        assert result["source"] == "env"

    def test_env_vars_take_precedence_over_db(self, db_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        save_ai_config(db_path, "https://api.openai.com/v1", "sk-db-key", "gpt-4o", "openai")

        monkeypatch.setenv("AI_BASE_URL", "https://api.anthropic.com/v1")
        monkeypatch.setenv("AI_API_KEY", "sk-env-key")
        monkeypatch.setenv("AI_MODEL", "claude-sonnet-4-6")

        result = get_ai_config(db_path)
        assert result is not None
        assert result["source"] == "env"
        assert result["base_url"] == "https://api.anthropic.com/v1"
        assert result["model"] == "claude-sonnet-4-6"

    def test_env_default_provider_type(self, db_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("AI_BASE_URL", "https://api.openai.com/v1")
        monkeypatch.setenv("AI_API_KEY", "sk-env-key")
        monkeypatch.setenv("AI_MODEL", "gpt-4o")
        monkeypatch.delenv("AI_PROVIDER_TYPE", raising=False)

        result = get_ai_config(db_path)
        assert result is not None
        assert result["provider_type"] == "openai"


class TestGetFullAiConfig:
    def test_returns_none_when_no_config(self, db_path: Path) -> None:
        result = get_full_ai_config(db_path)
        assert result is None

    def test_returns_actual_key(self, db_path: Path) -> None:
        save_ai_config(db_path, "https://api.openai.com/v1", "sk-secret-key", "gpt-4o", "openai")
        result = get_full_ai_config(db_path)
        assert result is not None
        assert result["api_key"] == "sk-secret-key"
        assert result["base_url"] == "https://api.openai.com/v1"
        assert result["model"] == "gpt-4o"
        assert result["provider_type"] == "openai"

    def test_env_var_returns_key(self, db_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("AI_BASE_URL", "https://api.anthropic.com/v1")
        monkeypatch.setenv("AI_API_KEY", "sk-env-key")
        monkeypatch.setenv("AI_MODEL", "claude-sonnet-4-6")
        monkeypatch.setenv("AI_PROVIDER_TYPE", "anthropic")

        result = get_full_ai_config(db_path)
        assert result is not None
        assert result["api_key"] == "sk-env-key"


class TestSaveAiConfig:
    def test_upsert_updates_existing(self, db_path: Path) -> None:
        save_ai_config(db_path, "https://api.openai.com/v1", "sk-old", "gpt-4o", "openai")
        save_ai_config(db_path, "https://api.anthropic.com/v1", "sk-new", "claude-sonnet-4-6", "anthropic")

        result = get_full_ai_config(db_path)
        assert result is not None
        assert result["base_url"] == "https://api.anthropic.com/v1"
        assert result["api_key"] == "sk-new"
        assert result["model"] == "claude-sonnet-4-6"
        assert result["provider_type"] == "anthropic"


class TestDeleteAiConfig:
    def test_removes_config(self, db_path: Path) -> None:
        save_ai_config(db_path, "https://api.openai.com/v1", "sk-secret", "gpt-4o", "openai")
        delete_ai_config(db_path)
        result = get_ai_config(db_path)
        assert result is None

    def test_delete_when_no_config_does_not_raise(self, db_path: Path) -> None:
        delete_ai_config(db_path)  # Should not raise
