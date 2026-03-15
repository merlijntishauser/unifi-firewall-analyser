"""Metrics service for device statistics persistence and retrieval."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

import structlog
from sqlalchemy import text

from app.database import get_session
from app.models import MetricsHistoryPoint, MetricsSnapshot, Notification
from app.models_db import DeviceMetricRow, NotificationRow

if TYPE_CHECKING:
    from unifi_topology import DeviceStats

log = structlog.get_logger()


def record_snapshot(stats: list[DeviceStats]) -> None:
    """Write current device stats to the device_metrics table."""
    now = datetime.now(UTC).isoformat()
    session = get_session()
    try:
        for s in stats:
            total_poe = sum(p.poe_power for p in s.poe_ports) if s.poe_ports else None
            row = DeviceMetricRow(
                mac=s.mac,
                timestamp=now,
                cpu=s.cpu,
                mem=s.mem,
                temperature=s.temperature,
                uptime=s.uptime,
                tx_bytes=s.tx_bytes,
                rx_bytes=s.rx_bytes,
                num_sta=s.num_sta,
                poe_consumption=total_poe,
            )
            session.add(row)
        session.commit()
        log.debug("metrics_snapshot_recorded", device_count=len(stats))
    finally:
        session.close()


def get_latest_snapshots(current_stats: list[DeviceStats] | None = None) -> list[MetricsSnapshot]:
    """Get the most recent metric row per device MAC.

    When current_stats is provided, enrich with live name/model/type/version/status.
    """
    session = get_session()
    try:
        rows = session.execute(
            text(
                "SELECT dm.* FROM device_metrics dm "
                "INNER JOIN (SELECT mac, MAX(timestamp) AS max_ts FROM device_metrics GROUP BY mac) latest "
                "ON dm.mac = latest.mac AND dm.timestamp = latest.max_ts"
            )
        ).fetchall()
    finally:
        session.close()

    stats_lookup: dict[str, DeviceStats] = {}
    if current_stats:
        stats_lookup = {s.mac: s for s in current_stats}

    snapshots: list[MetricsSnapshot] = []
    for row in rows:
        live = stats_lookup.get(row.mac)
        snapshots.append(
            MetricsSnapshot(
                mac=row.mac,
                name=live.name if live else row.mac,
                model=live.model_name if live else "",
                type=live.type if live else "",
                cpu=row.cpu,
                mem=row.mem,
                temperature=row.temperature,
                uptime=row.uptime,
                tx_bytes=row.tx_bytes,
                rx_bytes=row.rx_bytes,
                num_sta=row.num_sta,
                version=live.version if live else "",
                poe_consumption=row.poe_consumption,
                status="online" if live else "unknown",
            )
        )
    return snapshots


def get_device_history(mac: str, hours: int = 24) -> list[MetricsHistoryPoint]:
    """Get metric rows for a device within a time range."""
    cutoff = (datetime.now(UTC) - timedelta(hours=hours)).isoformat()
    session = get_session()
    try:
        rows = session.execute(
            text("SELECT * FROM device_metrics WHERE mac = :mac AND timestamp >= :cutoff ORDER BY timestamp ASC"),
            {"mac": mac, "cutoff": cutoff},
        ).fetchall()
    finally:
        session.close()

    return [
        MetricsHistoryPoint(
            timestamp=row.timestamp,
            cpu=row.cpu,
            mem=row.mem,
            temperature=row.temperature,
            uptime=row.uptime,
            tx_bytes=row.tx_bytes,
            rx_bytes=row.rx_bytes,
            num_sta=row.num_sta,
            poe_consumption=row.poe_consumption,
        )
        for row in rows
    ]


def get_notifications(include_resolved: bool = True) -> list[Notification]:
    """Get notifications, optionally including resolved ones."""
    session = get_session()
    try:
        if include_resolved:
            rows = session.query(NotificationRow).order_by(NotificationRow.created_at.desc()).all()
        else:
            rows = (
                session.query(NotificationRow)
                .filter(NotificationRow.resolved_at.is_(None), NotificationRow.dismissed == 0)
                .order_by(NotificationRow.created_at.desc())
                .all()
            )
    finally:
        session.close()

    return [
        Notification(
            id=row.id,
            device_mac=row.device_mac,
            check_id=row.check_id,
            severity=row.severity,
            title=row.title,
            message=row.message,
            created_at=row.created_at,
            resolved_at=row.resolved_at,
            dismissed=bool(row.dismissed),
        )
        for row in rows
    ]


def dismiss_notification(notification_id: int) -> None:
    """Mark a notification as dismissed."""
    session = get_session()
    try:
        row = session.get(NotificationRow, notification_id)
        if row is not None:
            row.dismissed = 1
            session.commit()
            log.info("notification_dismissed", notification_id=notification_id)
    finally:
        session.close()


def create_notification(device_mac: str, check_id: str, severity: str, title: str, message: str) -> None:
    """Create a new notification."""
    now = datetime.now(UTC).isoformat()
    session = get_session()
    try:
        row = NotificationRow(
            device_mac=device_mac,
            check_id=check_id,
            severity=severity,
            title=title,
            message=message,
            created_at=now,
        )
        session.add(row)
        session.commit()
        log.info("notification_created", check_id=check_id, device_mac=device_mac, severity=severity)
    finally:
        session.close()


def resolve_notifications(device_mac: str, check_id: str) -> None:
    """Resolve all active notifications for a device/check combination."""
    now = datetime.now(UTC).isoformat()
    session = get_session()
    try:
        rows = (
            session.query(NotificationRow)
            .filter(
                NotificationRow.device_mac == device_mac,
                NotificationRow.check_id == check_id,
                NotificationRow.resolved_at.is_(None),
            )
            .all()
        )
        for row in rows:
            row.resolved_at = now
        if rows:
            session.commit()
            log.debug("notifications_resolved", check_id=check_id, device_mac=device_mac, count=len(rows))
    finally:
        session.close()


def prune_old_data(hours: int = 24) -> None:
    """Delete old metrics rows and resolved notifications."""
    cutoff = (datetime.now(UTC) - timedelta(hours=hours)).isoformat()
    session = get_session()
    try:
        session.execute(
            text("DELETE FROM device_metrics WHERE timestamp < :cutoff"),
            {"cutoff": cutoff},
        )
        session.execute(
            text("DELETE FROM notifications WHERE resolved_at IS NOT NULL AND resolved_at < :cutoff"),
            {"cutoff": cutoff},
        )
        session.commit()
        log.info("metrics_pruned", cutoff=cutoff)
    finally:
        session.close()
