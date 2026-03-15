"""Tests for health router endpoints."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import set_runtime_credentials
from app.database import init_db_for_tests, reset_engine
from app.main import app
from app.models import (
    FirewallSummary,
    HealthAnalysisResult,
    HealthFinding,
    HealthSummaryResponse,
    MetricsSummary,
    TopologySummary,
)

MOCK_SUMMARY = HealthSummaryResponse(
    firewall=FirewallSummary(
        zone_pair_count=5,
        grade_distribution={"A": 3, "B": 2},
        finding_count_by_severity={"low": 2},
        uncovered_pairs=1,
    ),
    topology=TopologySummary(
        device_count_by_type={"gateway": 1, "switch": 2},
        offline_count=0,
        firmware_mismatches=0,
    ),
    metrics=MetricsSummary(
        active_notifications_by_severity={},
        high_resource_devices=0,
        recent_reboots=0,
    ),
)

MOCK_ANALYSIS = HealthAnalysisResult(
    status="ok",
    findings=[
        HealthFinding(
            severity="high",
            title="Cross-domain issue",
            description="Switch under load with permissive firewall.",
            affected_module="topology",
            affected_entity_id="aa:bb:cc",
            recommended_action="Add redundancy.",
            confidence="high",
        ),
    ],
    cached=False,
    analyzed_at="2026-03-15T12:00:00+00:00",
)


@pytest.fixture(autouse=True)
def _test_db(tmp_path: Path) -> Iterator[None]:
    init_db_for_tests(tmp_path / "test.db")
    yield
    reset_engine()


@pytest.fixture
async def client() -> AsyncClient:  # type: ignore[misc]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac  # type: ignore[misc]


class TestSummaryEndpoint:
    @pytest.mark.anyio
    async def test_returns_summary(self, client: AsyncClient) -> None:
        set_runtime_credentials("https://unifi.local", "admin", "password")
        with patch("app.routers.health.get_health_summary", return_value=MOCK_SUMMARY):
            resp = await client.get("/api/health/summary")

        assert resp.status_code == 200
        data = resp.json()
        assert data["firewall"]["zone_pair_count"] == 5
        assert data["topology"]["device_count_by_type"]["gateway"] == 1
        assert data["metrics"]["high_resource_devices"] == 0

    @pytest.mark.anyio
    async def test_no_credentials_returns_401(self, client: AsyncClient) -> None:
        resp = await client.get("/api/health/summary")
        assert resp.status_code == 401


class TestAnalyzeEndpoint:
    @pytest.mark.anyio
    async def test_returns_analysis(self, client: AsyncClient) -> None:
        set_runtime_credentials("https://unifi.local", "admin", "password")
        with patch("app.routers.health.analyze_site_health", return_value=MOCK_ANALYSIS):
            resp = await client.post("/api/health/analyze")

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert len(data["findings"]) == 1
        assert data["findings"][0]["affected_module"] == "topology"
        assert data["cached"] is False
        assert data["analyzed_at"] is not None

    @pytest.mark.anyio
    async def test_no_credentials_returns_401(self, client: AsyncClient) -> None:
        resp = await client.post("/api/health/analyze")
        assert resp.status_code == 401

    @pytest.mark.anyio
    async def test_error_status_returned(self, client: AsyncClient) -> None:
        set_runtime_credentials("https://unifi.local", "admin", "password")
        error_result = HealthAnalysisResult(status="error", message="No AI provider configured")
        with patch("app.routers.health.analyze_site_health", return_value=error_result):
            resp = await client.post("/api/health/analyze")

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "error"
        assert "No AI provider" in data["message"]
