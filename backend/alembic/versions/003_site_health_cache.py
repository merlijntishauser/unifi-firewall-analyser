"""Add site health analysis cache table.

Revision ID: 003
Revises: 002
Create Date: 2026-03-15
"""

from typing import Sequence, Union

from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS site_health_cache (
            cache_key TEXT PRIMARY KEY,
            findings TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)


def downgrade() -> None:
    op.drop_table("site_health_cache")
