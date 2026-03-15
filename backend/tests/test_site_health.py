"""Tests for site health service."""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.database import get_session, init_db_for_tests, reset_engine
from app.models import (
    FirewallSummary,
    HealthSummaryResponse,
    MetricsSummary,
    TopologySummary,
)
from app.models_db import SiteHealthCacheRow
from app.services.ai_settings import save_ai_config
from app.services.site_health import (
    HEALTH_PROMPT_VERSION,
    _build_cache_key,
    _build_health_prompt,
    _build_health_system_prompt,
    _compute_firewall_summary,
    _compute_metrics_summary,
    _compute_topology_summary,
    _get_cached,
    _parse_health_findings,
    _save_cache,
    analyze_site_health,
    get_health_summary,
)

MOCK_SUMMARY = HealthSummaryResponse(
    firewall=FirewallSummary(
        zone_pair_count=5,
        grade_distribution={"A": 3, "B": 1, "D": 1},
        finding_count_by_severity={"high": 2, "medium": 3, "low": 4},
        uncovered_pairs=1,
    ),
    topology=TopologySummary(
        device_count_by_type={"gateway": 1, "switch": 2, "ap": 3},
        offline_count=0,
        firmware_mismatches=1,
    ),
    metrics=MetricsSummary(
        active_notifications_by_severity={"warning": 2},
        high_resource_devices=1,
        recent_reboots=0,
    ),
)

SAMPLE_HEALTH_FINDINGS_RAW = [
    {
        "severity": "high",
        "title": "Single point of failure under load",
        "description": "Switch X is the sole uplink and CPU is at 85%.",
        "affected_module": "topology",
        "affected_entity_id": "aa:bb:cc:dd:ee:ff",
        "recommended_action": "Add redundant uplink or reduce load.",
        "confidence": "high",
    },
    {
        "severity": "medium",
        "title": "IoT zone exposure with high traffic",
        "description": "IoT zone has broad allow to external with unusual traffic patterns.",
        "affected_module": "firewall",
        "affected_entity_id": "IoT->External",
        "recommended_action": "Restrict IoT egress to known endpoints.",
        "confidence": "medium",
    },
]


@pytest.fixture(autouse=True)
def _clear_ai_env_vars(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("AI_BASE_URL", raising=False)
    monkeypatch.delenv("AI_API_KEY", raising=False)
    monkeypatch.delenv("AI_MODEL", raising=False)
    monkeypatch.delenv("AI_PROVIDER_TYPE", raising=False)


@pytest.fixture(autouse=True)
def _test_db(tmp_path: Path) -> Iterator[None]:
    init_db_for_tests(tmp_path / "test.db")
    yield
    reset_engine()


class TestComputeFirewallSummary:
    def test_computes_from_zone_pairs(self) -> None:
        from app.config import UnifiCredentials
        from app.models import FindingModel, Rule, ZonePair, ZonePairAnalysis

        pairs = [
            ZonePair(
                source_zone_id="z1",
                destination_zone_id="z2",
                rules=[
                    Rule(
                        id="r1",
                        name="Allow",
                        enabled=True,
                        action="ALLOW",
                        source_zone_id="z1",
                        destination_zone_id="z2",
                        index=1,
                    )
                ],
                allow_count=1,
                block_count=0,
                analysis=ZonePairAnalysis(
                    score=95,
                    grade="A",
                    findings=[
                        FindingModel(id="f1", severity="low", title="Minor", description="d"),
                    ],
                ),
            ),
            ZonePair(
                source_zone_id="z1",
                destination_zone_id="z3",
                rules=[
                    Rule(
                        id="rp",
                        name="Default",
                        enabled=True,
                        action="BLOCK",
                        source_zone_id="z1",
                        destination_zone_id="z3",
                        index=9000,
                        predefined=True,
                    )
                ],
                allow_count=0,
                block_count=1,
                analysis=ZonePairAnalysis(score=98, grade="A", findings=[]),
            ),
        ]
        creds = UnifiCredentials(url="https://x", username="u", password="p")
        with patch("app.services.site_health.get_zone_pairs", return_value=pairs):
            result = _compute_firewall_summary(creds)

        assert result.zone_pair_count == 2
        assert result.grade_distribution == {"A": 2}
        assert result.finding_count_by_severity == {"low": 1}
        assert result.uncovered_pairs == 1  # second pair has only predefined rules

    def test_handles_zone_pair_without_analysis(self) -> None:
        from app.config import UnifiCredentials
        from app.models import Rule, ZonePair

        pairs = [
            ZonePair(
                source_zone_id="z1",
                destination_zone_id="z2",
                rules=[
                    Rule(
                        id="r1",
                        name="Allow",
                        enabled=True,
                        action="ALLOW",
                        source_zone_id="z1",
                        destination_zone_id="z2",
                        index=1,
                    )
                ],
                allow_count=1,
                block_count=0,
                analysis=None,
            ),
        ]
        creds = UnifiCredentials(url="https://x", username="u", password="p")
        with patch("app.services.site_health.get_zone_pairs", return_value=pairs):
            result = _compute_firewall_summary(creds)

        assert result.zone_pair_count == 1
        assert result.grade_distribution == {}
        assert result.finding_count_by_severity == {}


class TestComputeTopologySummary:
    def test_computes_from_devices(self) -> None:
        from app.config import UnifiCredentials
        from app.models import TopologyDevice, TopologyDevicesResponse

        devices = [
            TopologyDevice(
                mac="a1",
                name="GW",
                model="UDM-Pro",
                model_name="",
                type="gateway",
                ip="1.1.1.1",
                version="4.0.6",
                status="online",
            ),
            TopologyDevice(
                mac="a2",
                name="SW1",
                model="USW-24",
                model_name="",
                type="switch",
                ip="1.1.1.2",
                version="7.1.0",
                status="online",
            ),
            TopologyDevice(
                mac="a3",
                name="SW2",
                model="USW-24",
                model_name="",
                type="switch",
                ip="1.1.1.3",
                version="7.0.9",
                status="offline",
            ),
        ]
        topo = TopologyDevicesResponse(devices=devices, edges=[])
        creds = UnifiCredentials(url="https://x", username="u", password="p")
        with patch("app.services.site_health.get_topology_devices", return_value=topo):
            result = _compute_topology_summary(creds)

        assert result.device_count_by_type == {"gateway": 1, "switch": 2}
        assert result.offline_count == 1
        assert result.firmware_mismatches == 1  # USW-24 has two different versions


class TestComputeMetricsSummary:
    def test_computes_from_snapshots_and_notifications(self) -> None:
        from app.models import MetricsSnapshot, Notification

        snapshots = [
            MetricsSnapshot(mac="a1", name="GW", model="UDM", type="gateway", cpu=85, mem=60, uptime=86400),
            MetricsSnapshot(mac="a2", name="SW", model="USW", type="switch", cpu=10, mem=90, uptime=3600),
            MetricsSnapshot(mac="a3", name="AP", model="UAP", type="ap", cpu=5, mem=20, uptime=172800),
        ]
        notifications = [
            Notification(
                id=1,
                device_mac="a1",
                check_id="cpu",
                severity="warning",
                title="CPU",
                message="High",
                created_at="2026-03-15T10:00:00",
            ),
            Notification(
                id=2,
                device_mac="a2",
                check_id="mem",
                severity="critical",
                title="MEM",
                message="High",
                created_at="2026-03-15T10:00:00",
            ),
        ]
        with (
            patch("app.services.site_health.get_latest_snapshots", return_value=snapshots),
            patch("app.services.site_health.get_notifications", return_value=notifications),
        ):
            result = _compute_metrics_summary()

        assert result.active_notifications_by_severity == {"warning": 1, "critical": 1}
        assert result.high_resource_devices == 2  # GW: cpu>80, SW: mem>85
        assert result.recent_reboots == 1  # SW: uptime < 86400


class TestGetHealthSummary:
    def test_returns_combined_summary(self) -> None:
        from app.config import UnifiCredentials

        creds = UnifiCredentials(url="https://x", username="u", password="p")
        fw = FirewallSummary(
            zone_pair_count=3, grade_distribution={"A": 3}, finding_count_by_severity={}, uncovered_pairs=0
        )
        topo = TopologySummary(device_count_by_type={"gateway": 1}, offline_count=0, firmware_mismatches=0)
        met = MetricsSummary(active_notifications_by_severity={}, high_resource_devices=0, recent_reboots=0)

        with (
            patch("app.services.site_health._compute_firewall_summary", return_value=fw),
            patch("app.services.site_health._compute_topology_summary", return_value=topo),
            patch("app.services.site_health._compute_metrics_summary", return_value=met),
        ):
            result = get_health_summary(creds)

        assert result.firewall == fw
        assert result.topology == topo
        assert result.metrics == met


class TestBuildHealthPrompt:
    def test_includes_all_sections(self) -> None:
        prompt = _build_health_prompt(MOCK_SUMMARY)
        assert "FIREWALL:" in prompt
        assert "Zone pairs: 5" in prompt
        assert "TOPOLOGY:" in prompt
        assert "gateway: 1" in prompt
        assert "METRICS:" in prompt
        assert "high_resource_devices" not in prompt  # should be human-readable
        assert HEALTH_PROMPT_VERSION in prompt


class TestBuildHealthSystemPrompt:
    def test_homelab_context(self) -> None:
        prompt = _build_health_system_prompt("homelab")
        assert "homelab" in prompt.lower()
        assert "cross-domain" in prompt.lower()

    def test_enterprise_context(self) -> None:
        prompt = _build_health_system_prompt("enterprise")
        assert "enterprise" in prompt.lower()
        assert "blast radius" in prompt.lower()

    def test_smb_context(self) -> None:
        prompt = _build_health_system_prompt("smb")
        assert "small/medium business" in prompt.lower()

    def test_requires_structured_output(self) -> None:
        prompt = _build_health_system_prompt("homelab")
        assert "affected_module" in prompt
        assert "affected_entity_id" in prompt
        assert "recommended_action" in prompt
        assert "confidence" in prompt


class TestBuildCacheKey:
    def test_same_input_same_key(self) -> None:
        key1 = _build_cache_key(MOCK_SUMMARY, "gpt-4o", "homelab")
        key2 = _build_cache_key(MOCK_SUMMARY, "gpt-4o", "homelab")
        assert key1 == key2

    def test_different_model_different_key(self) -> None:
        key1 = _build_cache_key(MOCK_SUMMARY, "gpt-4o", "homelab")
        key2 = _build_cache_key(MOCK_SUMMARY, "claude-sonnet-4-6", "homelab")
        assert key1 != key2

    def test_different_profile_different_key(self) -> None:
        key1 = _build_cache_key(MOCK_SUMMARY, "gpt-4o", "homelab")
        key2 = _build_cache_key(MOCK_SUMMARY, "gpt-4o", "enterprise")
        assert key1 != key2

    def test_different_summary_different_key(self) -> None:
        other = HealthSummaryResponse(
            firewall=FirewallSummary(
                zone_pair_count=10, grade_distribution={}, finding_count_by_severity={}, uncovered_pairs=0
            ),
            topology=MOCK_SUMMARY.topology,
            metrics=MOCK_SUMMARY.metrics,
        )
        key1 = _build_cache_key(MOCK_SUMMARY, "gpt-4o", "homelab")
        key2 = _build_cache_key(other, "gpt-4o", "homelab")
        assert key1 != key2


class TestCacheOperations:
    def test_save_and_retrieve(self) -> None:
        findings = [{"severity": "high", "title": "Test", "description": "Desc"}]
        _save_cache("test-key", findings, "2026-03-15T12:00:00")
        cached = _get_cached("test-key")
        assert cached is not None
        raw, created = cached
        assert len(raw) == 1
        assert raw[0]["title"] == "Test"
        assert created == "2026-03-15T12:00:00"

    def test_miss_returns_none(self) -> None:
        assert _get_cached("nonexistent") is None

    def test_upsert_overwrites(self) -> None:
        _save_cache("test-key", [{"a": 1}], "t1")
        _save_cache("test-key", [{"b": 2}], "t2")
        cached = _get_cached("test-key")
        assert cached is not None
        raw, created = cached
        assert raw[0]["b"] == 2
        assert created == "t2"


class TestParseHealthFindings:
    def test_valid_json(self) -> None:
        text = json.dumps(SAMPLE_HEALTH_FINDINGS_RAW)
        result = _parse_health_findings(text)
        assert len(result) == 2
        assert result[0]["affected_module"] == "topology"
        assert result[1]["affected_entity_id"] == "IoT->External"

    def test_markdown_code_block(self) -> None:
        text = "```json\n" + json.dumps(SAMPLE_HEALTH_FINDINGS_RAW) + "\n```"
        result = _parse_health_findings(text)
        assert len(result) == 2

    def test_filters_invalid(self) -> None:
        text = json.dumps(
            [
                {"severity": "high", "title": "Valid", "description": "OK"},
                {"severity": "low"},
                "not a dict",
            ]
        )
        result = _parse_health_findings(text)
        assert len(result) == 1

    def test_code_block_without_closing(self) -> None:
        text = "```json\n" + json.dumps(SAMPLE_HEALTH_FINDINGS_RAW)
        result = _parse_health_findings(text)
        assert len(result) == 2

    def test_non_list_returns_empty(self) -> None:
        result = _parse_health_findings('{"not": "a list"}')
        assert result == []

    def test_missing_optional_fields_get_defaults(self) -> None:
        text = json.dumps([{"severity": "low", "title": "Basic", "description": "Minimal"}])
        result = _parse_health_findings(text)
        assert result[0]["affected_module"] == ""
        assert result[0]["confidence"] == ""


class TestNoConfigReturnsError:
    @pytest.mark.anyio
    async def test_no_config(self) -> None:
        from app.config import UnifiCredentials

        creds = UnifiCredentials(url="https://x", username="u", password="p")
        result = await analyze_site_health(creds)
        assert result.status == "error"
        assert result.message == "No AI provider configured"


class TestAnalyzeSiteHealthCacheHit:
    @pytest.mark.anyio
    async def test_cache_hit(self) -> None:
        from app.config import UnifiCredentials

        save_ai_config("http://test-api.com/v1", "test-key", "test-model", "openai")
        creds = UnifiCredentials(url="https://x", username="u", password="p")

        with patch("app.services.site_health.get_health_summary", return_value=MOCK_SUMMARY):
            cache_key = _build_cache_key(MOCK_SUMMARY, "test-model", "homelab")
            _save_cache(cache_key, SAMPLE_HEALTH_FINDINGS_RAW, "2026-03-15T12:00:00")

            with patch("app.services._ai_provider.httpx.post") as mock_post:
                result = await analyze_site_health(creds)
                mock_post.assert_not_called()

        assert result.status == "ok"
        assert result.cached is True
        assert len(result.findings) == 2
        assert result.analyzed_at == "2026-03-15T12:00:00"


class TestAnalyzeSiteHealthCallsProvider:
    @pytest.mark.anyio
    async def test_openai_call(self) -> None:
        from app.config import UnifiCredentials

        save_ai_config("http://test-api.com/v1", "test-key", "test-model", "openai")
        creds = UnifiCredentials(url="https://x", username="u", password="p")

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": json.dumps(SAMPLE_HEALTH_FINDINGS_RAW)}}]
        }
        mock_response.raise_for_status = MagicMock()

        with (
            patch("app.services.site_health.get_health_summary", return_value=MOCK_SUMMARY),
            patch("app.services._ai_provider.httpx.post", return_value=mock_response),
        ):
            result = await analyze_site_health(creds)

        assert result.status == "ok"
        assert result.cached is False
        assert len(result.findings) == 2
        assert result.findings[0].affected_module == "topology"
        assert result.analyzed_at is not None


class TestAnalyzeSiteHealthAnthropicCall:
    @pytest.mark.anyio
    async def test_anthropic_call(self) -> None:
        from app.config import UnifiCredentials

        save_ai_config("http://test-api.com/v1", "test-key", "test-model", "anthropic")
        creds = UnifiCredentials(url="https://x", username="u", password="p")

        mock_response = MagicMock()
        mock_response.json.return_value = {"content": [{"text": json.dumps(SAMPLE_HEALTH_FINDINGS_RAW)}]}
        mock_response.raise_for_status = MagicMock()

        with (
            patch("app.services.site_health.get_health_summary", return_value=MOCK_SUMMARY),
            patch("app.services._ai_provider.httpx.post", return_value=mock_response) as mock_post,
        ):
            result = await analyze_site_health(creds)

        assert result.status == "ok"
        assert len(result.findings) == 2
        call_args = mock_post.call_args
        assert "/messages" in call_args[0][0]


class TestAnalyzeSiteHealthErrors:
    @pytest.mark.anyio
    async def test_http_error(self) -> None:
        from app.config import UnifiCredentials

        save_ai_config("http://test-api.com/v1", "test-key", "test-model", "openai")
        creds = UnifiCredentials(url="https://x", username="u", password="p")

        mock_resp = MagicMock(status_code=500)
        mock_resp.text = "Internal Server Error"
        exc = httpx.HTTPStatusError("500", response=mock_resp, request=MagicMock())

        with (
            patch("app.services.site_health.get_health_summary", return_value=MOCK_SUMMARY),
            patch("app.services._ai_provider.httpx.post", side_effect=exc),
        ):
            result = await analyze_site_health(creds)

        assert result.status == "error"
        assert "500" in (result.message or "")

    @pytest.mark.anyio
    async def test_timeout(self) -> None:
        from app.config import UnifiCredentials

        save_ai_config("http://test-api.com/v1", "test-key", "test-model", "openai")
        creds = UnifiCredentials(url="https://x", username="u", password="p")

        with (
            patch("app.services.site_health.get_health_summary", return_value=MOCK_SUMMARY),
            patch("app.services._ai_provider.httpx.post", side_effect=httpx.TimeoutException("timed out")),
        ):
            result = await analyze_site_health(creds)

        assert result.status == "error"
        assert "timed out" in (result.message or "").lower()

    @pytest.mark.anyio
    async def test_connect_error(self) -> None:
        from app.config import UnifiCredentials

        save_ai_config("http://test-api.com/v1", "test-key", "test-model", "openai")
        creds = UnifiCredentials(url="https://x", username="u", password="p")

        with (
            patch("app.services.site_health.get_health_summary", return_value=MOCK_SUMMARY),
            patch("app.services._ai_provider.httpx.post", side_effect=httpx.ConnectError("refused")),
        ):
            result = await analyze_site_health(creds)

        assert result.status == "error"
        assert "connection" in (result.message or "").lower()

    @pytest.mark.anyio
    async def test_unexpected_error(self) -> None:
        from app.config import UnifiCredentials

        save_ai_config("http://test-api.com/v1", "test-key", "test-model", "openai")
        creds = UnifiCredentials(url="https://x", username="u", password="p")

        with (
            patch("app.services.site_health.get_health_summary", return_value=MOCK_SUMMARY),
            patch("app.services._ai_provider.httpx.post", side_effect=RuntimeError("unexpected")),
        ):
            result = await analyze_site_health(creds)

        assert result.status == "error"
        assert "unexpected" in (result.message or "").lower()

    @pytest.mark.anyio
    async def test_parse_error(self) -> None:
        from app.config import UnifiCredentials

        save_ai_config("http://test-api.com/v1", "test-key", "test-model", "openai")
        creds = UnifiCredentials(url="https://x", username="u", password="p")

        mock_response = MagicMock()
        mock_response.json.return_value = {"choices": [{"message": {"content": "not valid json at all"}}]}
        mock_response.raise_for_status = MagicMock()

        with (
            patch("app.services.site_health.get_health_summary", return_value=MOCK_SUMMARY),
            patch("app.services._ai_provider.httpx.post", return_value=mock_response),
        ):
            result = await analyze_site_health(creds)

        assert result.status == "error"
        assert "parse" in (result.message or "").lower()


class TestResultsCachedAfterCall:
    @pytest.mark.anyio
    async def test_results_persisted(self) -> None:
        from app.config import UnifiCredentials

        save_ai_config("http://test-api.com/v1", "test-key", "test-model", "openai")
        creds = UnifiCredentials(url="https://x", username="u", password="p")

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": json.dumps(SAMPLE_HEALTH_FINDINGS_RAW)}}]
        }
        mock_response.raise_for_status = MagicMock()

        with (
            patch("app.services.site_health.get_health_summary", return_value=MOCK_SUMMARY),
            patch("app.services._ai_provider.httpx.post", return_value=mock_response),
        ):
            result = await analyze_site_health(creds)

        assert result.status == "ok"

        cache_key = _build_cache_key(MOCK_SUMMARY, "test-model", "homelab")
        session = get_session()
        try:
            row = session.get(SiteHealthCacheRow, cache_key)
            assert row is not None
            assert len(json.loads(row.findings)) == 2
        finally:
            session.close()
