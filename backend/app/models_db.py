"""SQLAlchemy ORM models for persistent application state."""

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
