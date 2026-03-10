"""Tests for AI analyzer service."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.database import get_connection, init_db
from app.models import Rule
from app.services.ai_analyzer import (
    _build_cache_key,
    _get_cached,
    _parse_findings,
    _save_cache,
    analyze_with_ai,
)
from app.services.ai_settings import save_ai_config

SAMPLE_RULES = [
    Rule(
        id="rule-1",
        name="Allow HTTP",
        enabled=True,
        action="ALLOW",
        source_zone_id="zone-a",
        destination_zone_id="zone-b",
        protocol="tcp",
        port_ranges=["80", "443"],
        index=100,
    ),
    Rule(
        id="rule-2",
        name="Block All",
        enabled=True,
        action="BLOCK",
        source_zone_id="zone-a",
        destination_zone_id="zone-b",
        index=200,
    ),
]

SAMPLE_FINDINGS_RAW = [
    {
        "severity": "medium",
        "title": "Broad allow rule",
        "description": "Rule allows all HTTP traffic without IP restrictions.",
    },
    {
        "severity": "low",
        "title": "Rule ordering",
        "description": "Block rule after allow may not catch all cases.",
    },
]


@pytest.fixture(autouse=True)
def _clear_ai_env_vars(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ensure AI env vars don't interfere with tests."""
    monkeypatch.delenv("AI_BASE_URL", raising=False)
    monkeypatch.delenv("AI_API_KEY", raising=False)
    monkeypatch.delenv("AI_MODEL", raising=False)
    monkeypatch.delenv("AI_PROVIDER_TYPE", raising=False)


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    path = tmp_path / "test.db"
    init_db(path)
    return path


class TestNoConfigReturnsEmptyList:
    @pytest.mark.anyio
    async def test_no_config_returns_empty(self, db_path: Path) -> None:
        result = await analyze_with_ai(SAMPLE_RULES, "LAN", "WAN", db_path)
        assert result == []


class TestCacheHit:
    @pytest.mark.anyio
    async def test_cache_hit_returns_cached_findings(self, db_path: Path) -> None:
        save_ai_config(db_path, "http://test-api.com/v1", "test-key", "test-model", "openai")
        cache_key = _build_cache_key(SAMPLE_RULES)
        _save_cache(db_path, cache_key, "LAN->WAN", SAMPLE_FINDINGS_RAW)

        with patch("app.services.ai_analyzer.httpx") as mock_httpx:
            result = await analyze_with_ai(SAMPLE_RULES, "LAN", "WAN", db_path)
            mock_httpx.post.assert_not_called()

        assert len(result) == 2
        assert result[0].title == "Broad allow rule"
        assert result[1].title == "Rule ordering"


class TestOpenAIProviderCall:
    @pytest.mark.anyio
    async def test_openai_call_returns_findings(self, db_path: Path) -> None:
        save_ai_config(db_path, "http://test-api.com/v1", "test-key", "test-model", "openai")

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": json.dumps(SAMPLE_FINDINGS_RAW)}}]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("app.services.ai_analyzer.httpx.post", return_value=mock_response):
            result = await analyze_with_ai(SAMPLE_RULES, "LAN", "WAN", db_path)

        assert len(result) == 2
        assert result[0].severity == "medium"
        assert result[0].title == "Broad allow rule"
        assert result[1].severity == "low"


class TestAnthropicProviderCall:
    @pytest.mark.anyio
    async def test_anthropic_call_returns_findings(self, db_path: Path) -> None:
        save_ai_config(
            db_path, "http://test-api.com/v1", "test-key", "test-model", "anthropic"
        )

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "content": [{"text": json.dumps(SAMPLE_FINDINGS_RAW)}]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("app.services.ai_analyzer.httpx.post", return_value=mock_response) as mock_post:
            result = await analyze_with_ai(SAMPLE_RULES, "LAN", "WAN", db_path)

        assert len(result) == 2
        # Verify the Anthropic endpoint was called
        call_args = mock_post.call_args
        assert "/messages" in call_args[0][0]
        assert "x-api-key" in call_args[1]["headers"]


class TestInvalidJsonFromLLM:
    @pytest.mark.anyio
    async def test_invalid_json_returns_empty(self, db_path: Path) -> None:
        save_ai_config(db_path, "http://test-api.com/v1", "test-key", "test-model", "openai")

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "This is not valid JSON at all"}}]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("app.services.ai_analyzer.httpx.post", return_value=mock_response):
            result = await analyze_with_ai(SAMPLE_RULES, "LAN", "WAN", db_path)

        assert result == []


class TestHTTPErrorReturnsEmpty:
    @pytest.mark.anyio
    async def test_http_error_returns_empty(self, db_path: Path) -> None:
        save_ai_config(db_path, "http://test-api.com/v1", "test-key", "test-model", "openai")

        with patch(
            "app.services.ai_analyzer.httpx.post",
            side_effect=Exception("Connection refused"),
        ):
            result = await analyze_with_ai(SAMPLE_RULES, "LAN", "WAN", db_path)

        assert result == []


class TestResultsCachedAfterCall:
    @pytest.mark.anyio
    async def test_results_cached(self, db_path: Path) -> None:
        save_ai_config(db_path, "http://test-api.com/v1", "test-key", "test-model", "openai")

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": json.dumps(SAMPLE_FINDINGS_RAW)}}]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("app.services.ai_analyzer.httpx.post", return_value=mock_response):
            await analyze_with_ai(SAMPLE_RULES, "LAN", "WAN", db_path)

        # Verify cache entry exists
        cache_key = _build_cache_key(SAMPLE_RULES)
        cached = _get_cached(db_path, cache_key)
        assert cached is not None
        assert len(cached) == 2
        assert cached[0]["title"] == "Broad allow rule"

        # Also verify directly in DB
        conn = get_connection(db_path)
        row = conn.execute(
            "SELECT zone_pair_key FROM ai_analysis_cache WHERE cache_key = ?",
            (cache_key,),
        ).fetchone()
        conn.close()
        assert row is not None
        assert row[0] == "LAN->WAN"


class TestFindingsHaveSourceAI:
    @pytest.mark.anyio
    async def test_source_is_ai(self, db_path: Path) -> None:
        save_ai_config(db_path, "http://test-api.com/v1", "test-key", "test-model", "openai")

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": json.dumps(SAMPLE_FINDINGS_RAW)}}]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("app.services.ai_analyzer.httpx.post", return_value=mock_response):
            result = await analyze_with_ai(SAMPLE_RULES, "LAN", "WAN", db_path)

        for finding in result:
            assert finding.source == "ai"

    @pytest.mark.anyio
    async def test_cached_findings_also_have_source_ai(self, db_path: Path) -> None:
        save_ai_config(db_path, "http://test-api.com/v1", "test-key", "test-model", "openai")
        cache_key = _build_cache_key(SAMPLE_RULES)
        _save_cache(db_path, cache_key, "LAN->WAN", SAMPLE_FINDINGS_RAW)

        result = await analyze_with_ai(SAMPLE_RULES, "LAN", "WAN", db_path)
        for finding in result:
            assert finding.source == "ai"


class TestParseFindingsMarkdownCodeBlocks:
    def test_handles_json_code_block(self) -> None:
        text = '```json\n[{"severity": "high", "title": "Risk", "description": "Desc"}]\n```'
        result = _parse_findings(text)
        assert len(result) == 1
        assert result[0]["severity"] == "high"
        assert result[0]["title"] == "Risk"

    def test_handles_plain_code_block(self) -> None:
        text = '```\n[{"severity": "low", "title": "Info", "description": "Detail"}]\n```'
        result = _parse_findings(text)
        assert len(result) == 1
        assert result[0]["severity"] == "low"

    def test_handles_plain_json(self) -> None:
        text = '[{"severity": "medium", "title": "Warning", "description": "Check"}]'
        result = _parse_findings(text)
        assert len(result) == 1
        assert result[0]["severity"] == "medium"

    def test_filters_invalid_findings(self) -> None:
        text = json.dumps([
            {"severity": "high", "title": "Valid", "description": "OK"},
            {"severity": "low"},  # missing title and description
            "not a dict",
        ])
        result = _parse_findings(text)
        assert len(result) == 1
        assert result[0]["title"] == "Valid"

    def test_non_list_returns_empty(self) -> None:
        text = '{"severity": "high", "title": "Single", "description": "Not a list"}'
        result = _parse_findings(text)
        assert result == []


class TestBuildCacheKeyDeterministic:
    def test_same_rules_same_key(self) -> None:
        key1 = _build_cache_key(SAMPLE_RULES)
        key2 = _build_cache_key(SAMPLE_RULES)
        assert key1 == key2

    def test_different_order_same_key(self) -> None:
        reversed_rules = list(reversed(SAMPLE_RULES))
        key1 = _build_cache_key(SAMPLE_RULES)
        key2 = _build_cache_key(reversed_rules)
        assert key1 == key2

    def test_different_rules_different_key(self) -> None:
        other_rules = [
            Rule(
                id="rule-99",
                name="Other",
                enabled=False,
                action="BLOCK",
                source_zone_id="zone-x",
                destination_zone_id="zone-y",
                index=1,
            ),
        ]
        key1 = _build_cache_key(SAMPLE_RULES)
        key2 = _build_cache_key(other_rules)
        assert key1 != key2

    def test_description_excluded_from_key(self) -> None:
        rules_with_desc = [
            Rule(
                id="rule-1",
                name="Allow HTTP",
                description="Some description",
                enabled=True,
                action="ALLOW",
                source_zone_id="zone-a",
                destination_zone_id="zone-b",
                protocol="tcp",
                port_ranges=["80", "443"],
                index=100,
            ),
            Rule(
                id="rule-2",
                name="Block All",
                description="Another description",
                enabled=True,
                action="BLOCK",
                source_zone_id="zone-a",
                destination_zone_id="zone-b",
                index=200,
            ),
        ]
        key1 = _build_cache_key(SAMPLE_RULES)
        key2 = _build_cache_key(rules_with_desc)
        assert key1 == key2
