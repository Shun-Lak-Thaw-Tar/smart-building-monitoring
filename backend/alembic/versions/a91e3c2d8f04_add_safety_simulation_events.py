"""Add simulated safety and security events.

Revision ID: a91e3c2d8f04
Revises: f3d7c09a4b82
"""
from alembic import op
import sqlalchemy as sa

revision = "a91e3c2d8f04"
down_revision = "f3d7c09a4b82"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table("safety_events",
        sa.Column("event_id", sa.Integer(), sa.Identity(), primary_key=True),
        sa.Column("building_id", sa.Integer(), sa.ForeignKey("buildings.building_id", ondelete="RESTRICT"), nullable=True),
        sa.Column("section", sa.String(30), nullable=False), sa.Column("name", sa.String(160), nullable=False),
        sa.Column("event_type", sa.String(40), nullable=False), sa.Column("status", sa.String(20), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="INFO"), sa.Column("description", sa.Text(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("section IN ('FIRE_SAFETY', 'SECURITY_ACCESS', 'HAZARD_ADVISORY')", name="ck_safety_events_section"),
        sa.CheckConstraint("status IN ('NORMAL', 'FAULT', 'TESTING', 'OFFLINE', 'ALARM', 'ACTIVE', 'RESOLVED')", name="ck_safety_events_status"),
        sa.CheckConstraint("severity IN ('INFO', 'WARNING', 'CRITICAL')", name="ck_safety_events_severity"),
    )
    for col in ("building_id", "section", "event_type", "status", "occurred_at"):
        op.create_index(f"ix_safety_events_{col}", "safety_events", [col])

def downgrade() -> None:
    op.drop_table("safety_events")
