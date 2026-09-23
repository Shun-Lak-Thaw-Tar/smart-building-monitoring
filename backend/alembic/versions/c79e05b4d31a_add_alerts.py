"""add unified alerts

Revision ID: c79e05b4d31a
Revises: a48d71c20e9f
Create Date: 2026-09-23 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c79e05b4d31a"
down_revision: Union[str, Sequence[str], None] = "a48d71c20e9f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "alerts",
        sa.Column("alert_id", sa.Integer(), sa.Identity(always=False), nullable=False),
        sa.Column("building_id", sa.Integer(), nullable=False),
        sa.Column("equipment_id", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'ACTIVE'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("category IN ('EQUIPMENT', 'ENERGY', 'COMFORT')", name="ck_alerts_category"),
        sa.CheckConstraint("severity IN ('INFO', 'WARNING', 'CRITICAL')", name="ck_alerts_severity"),
        sa.CheckConstraint("status IN ('ACTIVE', 'RESOLVED')", name="ck_alerts_status"),
        sa.ForeignKeyConstraint(["building_id"], ["buildings.building_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["equipment_id"], ["equipment.equipment_id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("alert_id"),
    )
    op.create_index("ix_alerts_building_id", "alerts", ["building_id"])
    op.create_index("ix_alerts_equipment_id", "alerts", ["equipment_id"])
    op.create_index("ix_alerts_category", "alerts", ["category"])
    op.create_index("ix_alerts_severity", "alerts", ["severity"])
    op.create_index("ix_alerts_status", "alerts", ["status"])
    op.create_index("ix_alerts_created_at", "alerts", ["created_at"])


def downgrade() -> None:
    op.drop_table("alerts")
