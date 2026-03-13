"""Tests for AI analyzer service."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.database import get_connection, init_db
from app.models import Rule
from app.services.ai_analyzer import (
    AI_PROMPT_VERSION,
    _build_cache_key,
    _build_system_prompt,
    _get_cached,
    _parse_findings,
    _save_cache,
    _summarize_static_findings,
    analyze_with_ai,
)
from app.services.ai_settings import save_ai_config
from app.services.analyzer import Finding

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
        "rule_ids": ["rule-1"],
        "confidence": "high",
        "rationale": "No source IP restriction.",
        "recommended_action": "Add source IP constraints.",
    },
    {
        "severity": "low",
        "title": "Rule ordering",
        "description": "Block rule after allow may not catch all cases.",
        "rule_ids": ["rule-1", "rule-2"],
        "confidence": "medium",
        "rationale": "Order matters.",
        "recommended_action": "Review rule order.",
    },
]

# Legacy format without new fields
SAMPLE_FINDINGS_LEGACY = [
    {
        "severity": "medium",
        "title": "Broad allow rule",
        "description": "Rule allows all HTTP traffic without IP restrictions.",
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


class TestNoConfigReturnsError:
    @pytest.mark.anyio
    async def test_no_config_returns_error_status(self, db_path: Path) -> None:
        result = await analyze_with_ai(SAMPLE_RULES, "LAN", "WAN", db_path)
        assert result.status == "error"
        assert result.message == "No AI provider configured"
        assert result.findings == []
        assert result.cached is False


class TestCacheHit:
    @pytest.mark.anyio
    async def test_cache_hit_returns_cached_findings(self, db_path: Path) -> None:
        save_ai_config(db_path, "http://test-api.com/v1", "test-key", "test-model", "openai")
        cache_key = _build_cache_key(
            SAMPLE_RULES, "LAN", "WAN", "test-model", "homelab", AI_PROMPT_VERSION,
            "No static analysis findings.",
        )
        _save_cache(db_path, cache_key, "LAN->WAN", SAMPLE_FINDINGS_RAW)

        with patch("app.services.ai_analyzer.httpx") as mock_httpx:
            result = await analyze_with_ai(SAMPLE_RULES, "LAN", "WAN", db_path)
            mock_httpx.post.assert_not_called()

        assert result.status == "ok"
        assert result.cached is True
        assert len(result.findings) == 2
        assert result.findings[0].title == "Broad allow rule"
        assert result.findings[1].title == "Rule ordering"


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

        assert result.status == "ok"
        assert result.cached is False
        assert len(result.findings) == 2
        assert result.findings[0].severity == "medium"
        assert result.findings[0].title == "Broad allow rule"
        assert result.findings[0].confidence == "high"
        assert result.findings[0].rule_ids == ["rule-1"]
        assert result.findings[0].recommended_action == "Add source IP constraints."
        assert result.findings[1].severity == "low"


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

        assert result.status == "ok"
        assert len(result.findings) == 2
        # Verify the Anthropic endpoint was called
        call_args = mock_post.call_args
        assert "/messages" in call_args[0][0]
        assert "x-api-key" in call_args[1]["headers"]


class TestInvalidJsonFromLLM:
    @pytest.mark.anyio
    async def test_invalid_json_returns_error(self, db_path: Path) -> None:
        save_ai_config(db_path, "http://test-api.com/v1", "test-key", "test-model", "openai")

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "This is not valid JSON at all"}}]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("app.services.ai_analyzer.httpx.post", return_value=mock_response):
            result = await analyze_with_ai(SAMPLE_RULES, "LAN", "WAN", db_path)

        assert result.status == "error"
        assert "parse" in (result.message or "").lower()
        assert result.findings == []


class TestHTTPErrorReturnsError:
    @pytest.mark.anyio
    async def test_http_error_returns_error_status(self, db_path: Path) -> None:
        save_ai_config(db_path, "http://test-api.com/v1", "test-key", "test-model", "openai")

        mock_response = MagicMock(status_code=500)
        mock_response.text = "Internal Server Error"
        exc = httpx.HTTPStatusError("500", response=mock_response, request=MagicMock())
        with patch("app.services.ai_analyzer.httpx.post", side_effect=exc):
            result = await analyze_with_ai(SAMPLE_RULES, "LAN", "WAN", db_path)

        assert result.status == "error"
        assert "500" in (result.message or "")

    @pytest.mark.anyio
    async def test_timeout_returns_error_status(self, db_path: Path) -> None:
        save_ai_config(db_path, "http://test-api.com/v1", "test-key", "test-model", "openai")

        with patch("app.services.ai_analyzer.httpx.post", side_effect=httpx.TimeoutException("timed out")):
            result = await analyze_with_ai(SAMPLE_RULES, "LAN", "WAN", db_path)

        assert result.status == "error"
        assert "timed out" in (result.message or "").lower()

    @pytest.mark.anyio
    async def test_connection_error_returns_error_status(self, db_path: Path) -> None:
        save_ai_config(db_path, "http://test-api.com/v1", "test-key", "test-model", "openai")

        with patch("app.services.ai_analyzer.httpx.post", side_effect=httpx.ConnectError("refused")):
            result = await analyze_with_ai(SAMPLE_RULES, "LAN", "WAN", db_path)

        assert result.status == "error"
        assert "connection" in (result.message or "").lower()

    @pytest.mark.anyio
    async def test_unexpected_error_returns_error_status(self, db_path: Path) -> None:
        save_ai_config(db_path, "http://test-api.com/v1", "test-key", "test-model", "openai")

        with patch("app.services.ai_analyzer.httpx.post", side_effect=RuntimeError("unexpected")):
            result = await analyze_with_ai(SAMPLE_RULES, "LAN", "WAN", db_path)

        assert result.status == "error"
        assert "unexpected" in (result.message or "").lower()


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
            result = await analyze_with_ai(SAMPLE_RULES, "LAN", "WAN", db_path)

        assert result.status == "ok"

        # Verify cache entry exists using the same key computation
        cache_key = _build_cache_key(
            SAMPLE_RULES, "LAN", "WAN", "test-model", "homelab", AI_PROMPT_VERSION,
            "No static analysis findings.",
        )
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

        for finding in result.findings:
            assert finding.source == "ai"

    @pytest.mark.anyio
    async def test_cached_findings_also_have_source_ai(self, db_path: Path) -> None:
        save_ai_config(db_path, "http://test-api.com/v1", "test-key", "test-model", "openai")
        cache_key = _build_cache_key(
            SAMPLE_RULES, "LAN", "WAN", "test-model", "homelab", AI_PROMPT_VERSION,
            "No static analysis findings.",
        )
        _save_cache(db_path, cache_key, "LAN->WAN", SAMPLE_FINDINGS_RAW)

        result = await analyze_with_ai(SAMPLE_RULES, "LAN", "WAN", db_path)
        for finding in result.findings:
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

    def test_handles_code_block_without_closing(self) -> None:
        text = '```json\n[{"severity": "high", "title": "Risk", "description": "Desc"}]'
        result = _parse_findings(text)
        assert len(result) == 1
        assert result[0]["title"] == "Risk"

    def test_non_list_returns_empty(self) -> None:
        text = '{"severity": "high", "title": "Single", "description": "Not a list"}'
        result = _parse_findings(text)
        assert result == []

    def test_extracts_enriched_fields(self) -> None:
        text = json.dumps([{
            "severity": "high",
            "title": "Risk",
            "description": "Desc",
            "rule_ids": ["r1"],
            "confidence": "high",
            "rationale": "Because",
            "recommended_action": "Fix it",
        }])
        result = _parse_findings(text)
        assert result[0]["rule_ids"] == ["r1"]
        assert result[0]["confidence"] == "high"
        assert result[0]["rationale"] == "Because"
        assert result[0]["recommended_action"] == "Fix it"

    def test_missing_enriched_fields_get_defaults(self) -> None:
        text = json.dumps([{"severity": "low", "title": "Basic", "description": "Minimal"}])
        result = _parse_findings(text)
        assert result[0]["rule_ids"] == []
        assert result[0]["confidence"] == ""
        assert result[0]["rationale"] == ""
        assert result[0]["recommended_action"] == ""


class TestBuildCacheKeyDeterministic:
    def test_same_rules_same_key(self) -> None:
        key1 = _build_cache_key(SAMPLE_RULES, "LAN", "WAN", "gpt-4o", "homelab", "v1")
        key2 = _build_cache_key(SAMPLE_RULES, "LAN", "WAN", "gpt-4o", "homelab", "v1")
        assert key1 == key2

    def test_different_order_same_key(self) -> None:
        reversed_rules = list(reversed(SAMPLE_RULES))
        key1 = _build_cache_key(SAMPLE_RULES, "LAN", "WAN", "gpt-4o", "homelab", "v1")
        key2 = _build_cache_key(reversed_rules, "LAN", "WAN", "gpt-4o", "homelab", "v1")
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
        key1 = _build_cache_key(SAMPLE_RULES, "LAN", "WAN", "gpt-4o", "homelab", "v1")
        key2 = _build_cache_key(other_rules, "LAN", "WAN", "gpt-4o", "homelab", "v1")
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
        key1 = _build_cache_key(SAMPLE_RULES, "LAN", "WAN", "gpt-4o", "homelab", "v1")
        key2 = _build_cache_key(rules_with_desc, "LAN", "WAN", "gpt-4o", "homelab", "v1")
        assert key1 == key2

    def test_different_model_different_key(self) -> None:
        key1 = _build_cache_key(SAMPLE_RULES, "LAN", "WAN", "gpt-4o", "homelab", "v1")
        key2 = _build_cache_key(SAMPLE_RULES, "LAN", "WAN", "claude-sonnet-4-6", "homelab", "v1")
        assert key1 != key2

    def test_different_site_profile_different_key(self) -> None:
        key1 = _build_cache_key(SAMPLE_RULES, "LAN", "WAN", "gpt-4o", "homelab", "v1")
        key2 = _build_cache_key(SAMPLE_RULES, "LAN", "WAN", "gpt-4o", "enterprise", "v1")
        assert key1 != key2

    def test_different_prompt_version_different_key(self) -> None:
        key1 = _build_cache_key(SAMPLE_RULES, "LAN", "WAN", "gpt-4o", "homelab", "v1")
        key2 = _build_cache_key(SAMPLE_RULES, "LAN", "WAN", "gpt-4o", "homelab", "v2")
        assert key1 != key2

    def test_different_zone_names_different_key(self) -> None:
        key1 = _build_cache_key(SAMPLE_RULES, "LAN", "WAN", "gpt-4o", "homelab", "v1")
        key2 = _build_cache_key(SAMPLE_RULES, "DMZ", "WAN", "gpt-4o", "homelab", "v1")
        assert key1 != key2

    def test_different_static_summary_different_key(self) -> None:
        key1 = _build_cache_key(SAMPLE_RULES, "LAN", "WAN", "gpt-4o", "homelab", "v1", "none")
        key2 = _build_cache_key(SAMPLE_RULES, "LAN", "WAN", "gpt-4o", "homelab", "v1", "[high] Issue")
        assert key1 != key2


class TestBuildSystemPrompt:
    def test_includes_zone_names(self) -> None:
        prompt = _build_system_prompt("LAN", "WAN", "homelab")
        assert "LAN" in prompt
        assert "WAN" in prompt

    def test_homelab_context(self) -> None:
        prompt = _build_system_prompt("LAN", "WAN", "homelab")
        assert "homelab" in prompt.lower()

    def test_enterprise_context(self) -> None:
        prompt = _build_system_prompt("LAN", "WAN", "enterprise")
        assert "enterprise" in prompt.lower()
        assert "least privilege" in prompt.lower()

    def test_smb_context(self) -> None:
        prompt = _build_system_prompt("LAN", "WAN", "smb")
        assert "small/medium business" in prompt.lower()

    def test_requires_structured_output(self) -> None:
        prompt = _build_system_prompt("LAN", "WAN", "homelab")
        assert "rule_ids" in prompt
        assert "confidence" in prompt
        assert "recommended_action" in prompt


class TestSummarizeStaticFindings:
    def test_no_findings(self) -> None:
        assert _summarize_static_findings([]) == "No static analysis findings."

    def test_with_findings(self) -> None:
        findings = [
            Finding(id="f1", severity="high", title="Broad allow", description="desc"),
            Finding(id="f2", severity="low", title="Missing log", description="desc"),
        ]
        summary = _summarize_static_findings(findings)
        assert "[high] Broad allow" in summary
        assert "[low] Missing log" in summary
        assert "Static analysis findings:" in summary


class TestStaticFindingsPassedToAI:
    @pytest.mark.anyio
    async def test_static_findings_included_in_prompt(self, db_path: Path) -> None:
        save_ai_config(db_path, "http://test-api.com/v1", "test-key", "test-model", "openai")

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": json.dumps(SAMPLE_FINDINGS_RAW)}}]
        }
        mock_response.raise_for_status = MagicMock()

        static = [Finding(id="f1", severity="high", title="Test finding", description="desc")]

        with patch("app.services.ai_analyzer.httpx.post", return_value=mock_response) as mock_post:
            await analyze_with_ai(SAMPLE_RULES, "LAN", "WAN", db_path, static_findings=static)

        # Check that the user prompt contains the static finding
        call_args = mock_post.call_args
        user_content = call_args[1]["json"]["messages"][-1]["content"]
        assert "[high] Test finding" in user_content
