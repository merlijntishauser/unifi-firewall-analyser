"""Initial schema.

Revision ID: 001
Revises: None
Create Date: 2026-03-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            base_url TEXT NOT NULL,
            api_key TEXT NOT NULL,
            model TEXT NOT NULL,
            provider_type TEXT NOT NULL DEFAULT 'openai'
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_analysis_cache (
            cache_key TEXT PRIMARY KEY,
            zone_pair_key TEXT NOT NULL,
            findings TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS hidden_zones (
            zone_id TEXT PRIMARY KEY
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_analysis_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            site_profile TEXT NOT NULL DEFAULT 'homelab'
        )
    """)


def downgrade() -> None:
    op.drop_table("ai_analysis_settings")
    op.drop_table("hidden_zones")
    op.drop_table("ai_analysis_cache")
    op.drop_table("ai_config")
