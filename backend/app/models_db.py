"""SQLAlchemy ORM models for persistent application state."""

import sqlalchemy as sa
from sqlalchemy import CheckConstraint, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class AiConfigRow(Base):
    __tablename__ = "ai_config"
    __table_args__ = (CheckConstraint("id = 1", name="singleton_ai_config"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    base_url: Mapped[str] = mapped_column(Text, nullable=False)
    api_key: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    provider_type: Mapped[str] = mapped_column(String, nullable=False, default="openai")


class AiAnalysisCacheRow(Base):
    __tablename__ = "ai_analysis_cache"

    cache_key: Mapped[str] = mapped_column(Text, primary_key=True)
    zone_pair_key: Mapped[str] = mapped_column(Text, nullable=False)
    findings: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)


class HiddenZoneRow(Base):
    __tablename__ = "hidden_zones"

    zone_id: Mapped[str] = mapped_column(Text, primary_key=True)


class AiAnalysisSettingsRow(Base):
    __tablename__ = "ai_analysis_settings"
    __table_args__ = (CheckConstraint("id = 1", name="singleton_ai_analysis_settings"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    site_profile: Mapped[str] = mapped_column(Text, nullable=False, default="homelab")


class SiteHealthCacheRow(Base):
    __tablename__ = "site_health_cache"

    cache_key: Mapped[str] = mapped_column(Text, primary_key=True)
    findings: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)


class DeviceMetricRow(Base):
    __tablename__ = "device_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mac: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    timestamp: Mapped[str] = mapped_column(Text, nullable=False)
    cpu: Mapped[float] = mapped_column(sa.Float, nullable=False)
    mem: Mapped[float] = mapped_column(sa.Float, nullable=False)
    temperature: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    uptime: Mapped[int] = mapped_column(Integer, nullable=False)
    tx_bytes: Mapped[int] = mapped_column(sa.BigInteger, nullable=False)
    rx_bytes: Mapped[int] = mapped_column(sa.BigInteger, nullable=False)
    num_sta: Mapped[int] = mapped_column(Integer, nullable=False)
    poe_consumption: Mapped[float | None] = mapped_column(sa.Float, nullable=True)


class NotificationRow(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_mac: Mapped[str] = mapped_column(Text, nullable=False)
    check_id: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    resolved_at: Mapped[str | None] = mapped_column(Text, nullable=True)
    dismissed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
