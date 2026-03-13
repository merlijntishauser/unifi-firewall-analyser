from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.database import init_db
from app.models import AiAnalysisResult, FindingModel


@pytest.fixture(autouse=True)
def _use_test_db(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    init_db(db_path)
    monkeypatch.setattr("app.routers.analyze.DEFAULT_DB_PATH", db_path)
    return db_path


@pytest.mark.anyio
async def test_analyze_no_config_returns_error_status(client: AsyncClient) -> None:
    """When no AI config exists, the service returns status=error (not HTTP 400)."""
    resp = await client.post(
        "/api/analyze",
        json={
            "source_zone_name": "LAN",
            "destination_zone_name": "WAN",
            "rules": [],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "error"
    assert data["message"] is not None


@pytest.mark.anyio
async def test_analyze_returns_findings(client: AsyncClient) -> None:
    mock_result = AiAnalysisResult(
        status="ok",
        findings=[
            FindingModel(id="ai-0", severity="high", title="Test", description="Test finding", source="ai"),
        ],
        cached=False,
    )

    with patch("app.routers.analyze.analyze_with_ai", new_callable=AsyncMock, return_value=mock_result):
        resp = await client.post(
            "/api/analyze",
            json={
                "source_zone_name": "LAN",
                "destination_zone_name": "WAN",
                "rules": [
                    {
                        "id": "r1",
                        "name": "Test",
                        "enabled": True,
                        "action": "ALLOW",
                        "source_zone_id": "z1",
                        "destination_zone_id": "z2",
                    }
                ],
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["cached"] is False
    assert len(data["findings"]) == 1
    assert data["findings"][0]["source"] == "ai"


@pytest.mark.anyio
async def test_analyze_returns_ok_with_no_findings(client: AsyncClient) -> None:
    mock_result = AiAnalysisResult(status="ok", findings=[], cached=False)

    with patch("app.routers.analyze.analyze_with_ai", new_callable=AsyncMock, return_value=mock_result):
        resp = await client.post(
            "/api/analyze",
            json={
                "source_zone_name": "LAN",
                "destination_zone_name": "WAN",
                "rules": [],
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["findings"] == []
    assert data["cached"] is False


@pytest.mark.anyio
async def test_analyze_cached_result(client: AsyncClient) -> None:
    mock_result = AiAnalysisResult(
        status="ok",
        findings=[FindingModel(id="ai-0", severity="low", title="Cached", description="From cache", source="ai")],
        cached=True,
    )

    with patch("app.routers.analyze.analyze_with_ai", new_callable=AsyncMock, return_value=mock_result):
        resp = await client.post(
            "/api/analyze",
            json={
                "source_zone_name": "LAN",
                "destination_zone_name": "WAN",
                "rules": [],
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["cached"] is True


@pytest.mark.anyio
async def test_analyze_passes_static_findings(client: AsyncClient) -> None:
    """Verify that the router runs static analysis and passes findings to the AI analyzer."""
    mock_result = AiAnalysisResult(status="ok", findings=[], cached=False)

    with patch("app.routers.analyze.analyze_with_ai", new_callable=AsyncMock, return_value=mock_result) as mock_ai:
        await client.post(
            "/api/analyze",
            json={
                "source_zone_name": "LAN",
                "destination_zone_name": "WAN",
                "rules": [
                    {
                        "id": "r1",
                        "name": "Allow All",
                        "enabled": True,
                        "action": "ALLOW",
                        "source_zone_id": "z1",
                        "destination_zone_id": "z2",
                        "protocol": "all",
                    }
                ],
            },
        )

    # Verify static_findings kwarg was passed
    call_kwargs = mock_ai.call_args
    assert "static_findings" in call_kwargs.kwargs
    assert isinstance(call_kwargs.kwargs["static_findings"], list)
