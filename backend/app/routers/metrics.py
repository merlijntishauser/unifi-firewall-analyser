"""Router for metrics endpoints."""

import structlog
from fastapi import APIRouter

from app.config import get_unifi_config, has_credentials
from app.models import MetricsDevicesResponse, MetricsHistoryResponse, Notification
from app.services.metrics import (
    dismiss_notification,
    get_device_history,
    get_latest_snapshots,
    get_notifications,
)

log = structlog.get_logger()

router = APIRouter(tags=["metrics"])


def _fetch_live_stats() -> list[object]:  # pragma: no cover -- integration with live controller
    """Fetch current device stats for name/model enrichment."""
    if not has_credentials():
        return []
    credentials = get_unifi_config()
    if credentials is None:
        return []
    from unifi_topology import fetch_device_stats, normalize_device_stats

    from app.services.firewall import to_topology_config

    config = to_topology_config(credentials)
    raw = fetch_device_stats(config, site=credentials.site)
    return list(normalize_device_stats(raw))  # type: ignore[arg-type]


@router.get("/devices")
async def metrics_devices() -> MetricsDevicesResponse:
    live = _fetch_live_stats()
    snapshots = get_latest_snapshots(current_stats=live or None)  # type: ignore[arg-type]
    return MetricsDevicesResponse(devices=snapshots)


@router.get("/devices/{mac}/history")
async def metrics_history(mac: str, hours: int = 24) -> MetricsHistoryResponse:
    history = get_device_history(mac, hours=hours)
    return MetricsHistoryResponse(mac=mac, history=history)


@router.get("/notifications")
async def metrics_notifications() -> list[Notification]:
    return get_notifications()


@router.post("/notifications/{notification_id}/dismiss")
async def dismiss(notification_id: int) -> dict[str, str]:
    dismiss_notification(notification_id)
    return {"status": "ok"}
