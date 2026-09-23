"""add user account status

Revision ID: a48d71c20e9f
Revises: 9cf1817549e9
Create Date: 2026-09-23 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a48d71c20e9f"
down_revision: Union[str, Sequence[str], None] = "9cf1817549e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The server default backfills every existing user as active and keeps that
    # safe default for all future accounts, preserving existing data.
    op.add_column(
        "users",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("users", "is_active")
