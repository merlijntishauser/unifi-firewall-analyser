import pytest
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.database import init_db
from app.models import FindingModel
from app.services.ai_settings import save_ai_config


@pytest.fixture(autouse=True)
def _use_test_db(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    init_db(db_path)
    monkeypatch.setattr("app.routers.analyze.DEFAULT_DB_PATH", db_path)
    return db_path


@pytest.mark.anyio
async def test_analyze_requires_ai_config(client: AsyncClient) -> None:
    resp = await client.post("/api/analyze", json={
        "source_zone_name": "LAN",
        "destination_zone_name": "WAN",
        "rules": [],
    })
    assert resp.status_code == 400


@pytest.mark.anyio
async def test_analyze_returns_findings(client: AsyncClient, _use_test_db) -> None:
    db_path = _use_test_db
    save_ai_config(db_path, "http://test.com/v1", "key", "model", "openai")

    mock_findings = [
        FindingModel(id="ai-0", severity="high", title="Test", description="Test finding", source="ai"),
    ]

    with patch("app.routers.analyze.analyze_with_ai", new_callable=AsyncMock, return_value=mock_findings):
        resp = await client.post("/api/analyze", json={
            "source_zone_name": "LAN",
            "destination_zone_name": "WAN",
            "rules": [{
                "id": "r1", "name": "Test", "enabled": True, "action": "ALLOW",
                "source_zone_id": "z1", "destination_zone_id": "z2",
            }],
        })

    assert resp.status_code == 200
    data = resp.json()
    assert "findings" in data
    assert len(data["findings"]) == 1
    assert data["findings"][0]["source"] == "ai"


@pytest.mark.anyio
async def test_analyze_returns_empty_on_no_findings(client: AsyncClient, _use_test_db) -> None:
    db_path = _use_test_db
    save_ai_config(db_path, "http://test.com/v1", "key", "model", "openai")

    with patch("app.routers.analyze.analyze_with_ai", new_callable=AsyncMock, return_value=[]):
        resp = await client.post("/api/analyze", json={
            "source_zone_name": "LAN",
            "destination_zone_name": "WAN",
            "rules": [],
        })

    assert resp.status_code == 200
    assert resp.json()["findings"] == []
