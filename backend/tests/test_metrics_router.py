"""Tests for metrics router endpoints."""

from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.models import MetricsHistoryPoint, MetricsSnapshot, Notification

STUB_SNAPSHOTS = [
    MetricsSnapshot(
        mac="aa:bb:cc:dd:ee:01",
        name="Switch",
        model="USW-24",
        type="switch",
        cpu=10.0,
        mem=30.0,
        uptime=86400,
    ),
]

STUB_HISTORY = [
    MetricsHistoryPoint(
        timestamp="2026-03-15T00:00:00+00:00",
        cpu=10.0,
        mem=30.0,
    ),
]

STUB_NOTIFICATIONS = [
    Notification(
        id=1,
        device_mac="aa:bb:cc:dd:ee:01",
        check_id="high_cpu",
        severity="warning",
        title="High CPU",
        message="CPU is high",
        created_at="2026-03-15T00:00:00+00:00",
    ),
]


@pytest.mark.anyio
async def test_metrics_devices_returns_snapshots(client: AsyncClient) -> None:
    with (
        patch("app.routers.metrics._fetch_live_stats", return_value=[]),
        patch("app.routers.metrics.get_latest_snapshots", return_value=STUB_SNAPSHOTS),
    ):
        resp = await client.get("/api/metrics/devices")
    assert resp.status_code == 200
    data = resp.json()
    assert "devices" in data
    assert len(data["devices"]) == 1
    assert data["devices"][0]["mac"] == "aa:bb:cc:dd:ee:01"


@pytest.mark.anyio
async def test_metrics_devices_empty(client: AsyncClient) -> None:
    with (
        patch("app.routers.metrics._fetch_live_stats", return_value=[]),
        patch("app.routers.metrics.get_latest_snapshots", return_value=[]),
    ):
        resp = await client.get("/api/metrics/devices")
    assert resp.status_code == 200
    assert resp.json()["devices"] == []


@pytest.mark.anyio
async def test_metrics_history_returns_data(client: AsyncClient) -> None:
    with patch("app.routers.metrics.get_device_history", return_value=STUB_HISTORY):
        resp = await client.get("/api/metrics/devices/aa:bb:cc:dd:ee:01/history")
    assert resp.status_code == 200
    data = resp.json()
    assert data["mac"] == "aa:bb:cc:dd:ee:01"
    assert len(data["history"]) == 1


@pytest.mark.anyio
async def test_metrics_history_with_hours_param(client: AsyncClient) -> None:
    with patch("app.routers.metrics.get_device_history", return_value=[]) as mock:
        resp = await client.get("/api/metrics/devices/aa:01/history", params={"hours": 48})
    assert resp.status_code == 200
    mock.assert_called_once_with("aa:01", hours=48)


@pytest.mark.anyio
async def test_notifications_returns_list(client: AsyncClient) -> None:
    with patch("app.routers.metrics.get_notifications", return_value=STUB_NOTIFICATIONS):
        resp = await client.get("/api/metrics/notifications")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["check_id"] == "high_cpu"


@pytest.mark.anyio
async def test_notifications_empty(client: AsyncClient) -> None:
    with patch("app.routers.metrics.get_notifications", return_value=[]):
        resp = await client.get("/api/metrics/notifications")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.anyio
async def test_dismiss_notification(client: AsyncClient) -> None:
    with patch("app.routers.metrics.dismiss_notification") as mock:
        resp = await client.post("/api/metrics/notifications/1/dismiss")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
    mock.assert_called_once_with(1)
