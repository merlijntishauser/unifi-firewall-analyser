"""Tests for AI settings service."""

from pathlib import Path

import pytest

from app.database import init_db
from app.services.ai_settings import (
    delete_ai_config,
    get_ai_analysis_settings,
    get_ai_config,
    get_full_ai_config,
    save_ai_analysis_settings,
    save_ai_config,
)


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    path = tmp_path / "test.db"
    init_db(path)
    return path


class TestAiKeyFile:
    def test_reads_key_from_file(self, db_path: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        key_file = tmp_path / "ai_key.txt"
        key_file.write_text("sk-from-file\n")
        monkeypatch.setenv("AI_BASE_URL", "https://api.openai.com/v1")
        monkeypatch.setenv("AI_API_KEY_FILE", str(key_file))
        monkeypatch.setenv("AI_MODEL", "gpt-4o")
        monkeypatch.delenv("AI_API_KEY", raising=False)

        result = get_full_ai_config(db_path)
        assert result is not None
        assert result["api_key"] == "sk-from-file"

    def test_env_var_takes_priority_over_file(self, db_path: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        key_file = tmp_path / "ai_key.txt"
        key_file.write_text("sk-from-file")
        monkeypatch.setenv("AI_BASE_URL", "https://api.openai.com/v1")
        monkeypatch.setenv("AI_API_KEY", "sk-from-env")
        monkeypatch.setenv("AI_API_KEY_FILE", str(key_file))
        monkeypatch.setenv("AI_MODEL", "gpt-4o")

        result = get_full_ai_config(db_path)
        assert result is not None
        assert result["api_key"] == "sk-from-env"

    def test_missing_file_falls_through_to_db(self, db_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("AI_BASE_URL", "https://api.openai.com/v1")
        monkeypatch.setenv("AI_API_KEY_FILE", "/nonexistent/path")
        monkeypatch.setenv("AI_MODEL", "gpt-4o")
        monkeypatch.delenv("AI_API_KEY", raising=False)

        save_ai_config(db_path, "https://api.openai.com/v1", "sk-from-db", "gpt-4o", "openai")
        result = get_full_ai_config(db_path)
        assert result is not None
        assert result["api_key"] == "sk-from-db"

    def test_file_key_used_in_public_config(self, db_path: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        key_file = tmp_path / "ai_key.txt"
        key_file.write_text("sk-from-file")
        monkeypatch.setenv("AI_BASE_URL", "https://api.openai.com/v1")
        monkeypatch.setenv("AI_API_KEY_FILE", str(key_file))
        monkeypatch.setenv("AI_MODEL", "gpt-4o")
        monkeypatch.delenv("AI_API_KEY", raising=False)

        result = get_ai_config(db_path)
        assert result is not None
        assert result["has_key"] is True
        assert result["source"] == "env"

    def test_no_file_env_var_returns_empty(self, db_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("AI_API_KEY_FILE", raising=False)
        monkeypatch.delenv("AI_API_KEY", raising=False)
        monkeypatch.setenv("AI_BASE_URL", "https://api.openai.com/v1")
        monkeypatch.setenv("AI_MODEL", "gpt-4o")

        result = get_ai_config(db_path)
        # No env key, no file, no db -- should be source=none with no key
        assert result["source"] == "none"
        assert result["has_key"] is False
        assert result["key_source"] == "none"


class TestGetAiConfig:
    def test_returns_source_none_when_no_config(self, db_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("AI_API_KEY", raising=False)
        monkeypatch.delenv("AI_API_KEY_FILE", raising=False)
        result = get_ai_config(db_path)
        assert result["source"] == "none"
        assert result["has_key"] is False
        assert result["key_source"] == "none"

    def test_reports_env_key_when_no_full_config(self, db_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("AI_API_KEY", "sk-env-only")
        monkeypatch.delenv("AI_BASE_URL", raising=False)
        monkeypatch.delenv("AI_MODEL", raising=False)
        result = get_ai_config(db_path)
        assert result["source"] == "none"
        assert result["has_key"] is True
        assert result["key_source"] == "env"

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


    def test_db_config_with_env_key_fallback(self, db_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """When DB has no key but AI_API_KEY env var is set, has_key should be True."""
        save_ai_config(db_path, "https://api.openai.com/v1", "", "gpt-4o", "openai")
        monkeypatch.setenv("AI_API_KEY", "sk-from-env")
        monkeypatch.delenv("AI_BASE_URL", raising=False)
        monkeypatch.delenv("AI_MODEL", raising=False)

        result = get_ai_config(db_path)
        assert result is not None
        assert result["source"] == "db"
        assert result["has_key"] is True


class TestGetFullAiConfigEnvKeyFallback:
    def test_db_config_uses_env_key_when_db_key_empty(self, db_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """When DB key is empty but AI_API_KEY env var is set, use the env key."""
        save_ai_config(db_path, "https://api.openai.com/v1", "", "gpt-4o", "openai")
        monkeypatch.setenv("AI_API_KEY", "sk-from-env")
        monkeypatch.delenv("AI_BASE_URL", raising=False)
        monkeypatch.delenv("AI_MODEL", raising=False)

        result = get_full_ai_config(db_path)
        assert result is not None
        assert result["api_key"] == "sk-from-env"
        assert result["base_url"] == "https://api.openai.com/v1"

    def test_db_key_takes_priority_over_env_key(self, db_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """When both DB and env have keys, DB key wins."""
        save_ai_config(db_path, "https://api.openai.com/v1", "sk-from-db", "gpt-4o", "openai")
        monkeypatch.setenv("AI_API_KEY", "sk-from-env")
        monkeypatch.delenv("AI_BASE_URL", raising=False)
        monkeypatch.delenv("AI_MODEL", raising=False)

        result = get_full_ai_config(db_path)
        assert result is not None
        assert result["api_key"] == "sk-from-db"


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

    def test_empty_key_preserves_existing(self, db_path: Path) -> None:
        save_ai_config(db_path, "https://api.openai.com/v1", "sk-original", "gpt-4o", "openai")
        save_ai_config(db_path, "https://api.openai.com/v1", "", "gpt-4o-mini", "openai")

        result = get_full_ai_config(db_path)
        assert result is not None
        assert result["api_key"] == "sk-original"
        assert result["model"] == "gpt-4o-mini"

    def test_empty_key_on_new_config_stores_empty(self, db_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("AI_API_KEY", raising=False)
        monkeypatch.delenv("AI_API_KEY_FILE", raising=False)
        save_ai_config(db_path, "https://api.openai.com/v1", "", "gpt-4o", "openai")

        result = get_full_ai_config(db_path)
        assert result is not None
        assert result["api_key"] == ""


class TestDeleteAiConfig:
    def test_removes_config(self, db_path: Path) -> None:
        save_ai_config(db_path, "https://api.openai.com/v1", "sk-secret", "gpt-4o", "openai")
        delete_ai_config(db_path)
        result = get_ai_config(db_path)
        assert result["source"] == "none"

    def test_delete_when_no_config_does_not_raise(self, db_path: Path) -> None:
        delete_ai_config(db_path)  # Should not raise


class TestGetAiAnalysisSettings:
    def test_returns_default_when_no_row(self, db_path: Path) -> None:
        result = get_ai_analysis_settings(db_path)
        assert result == {"site_profile": "homelab"}

    def test_returns_saved_value(self, db_path: Path) -> None:
        save_ai_analysis_settings(db_path, "enterprise")
        result = get_ai_analysis_settings(db_path)
        assert result == {"site_profile": "enterprise"}


class TestSaveAiAnalysisSettings:
    def test_upsert_updates_existing(self, db_path: Path) -> None:
        save_ai_analysis_settings(db_path, "homelab")
        save_ai_analysis_settings(db_path, "smb")
        result = get_ai_analysis_settings(db_path)
        assert result["site_profile"] == "smb"

    def test_rejects_invalid_profile(self, db_path: Path) -> None:
        with pytest.raises(ValueError, match="Invalid site_profile"):
            save_ai_analysis_settings(db_path, "invalid")

    def test_all_valid_profiles(self, db_path: Path) -> None:
        for profile in ("homelab", "smb", "enterprise"):
            save_ai_analysis_settings(db_path, profile)
            result = get_ai_analysis_settings(db_path)
            assert result["site_profile"] == profile
