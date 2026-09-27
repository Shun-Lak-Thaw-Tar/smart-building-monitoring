"""Add structured room and preferred maintenance date to requests.

Revision ID: c2a4b57e1f90
Revises: b51d4a0c9e73
Create Date: 2026-09-25
"""

from alembic import op
import sqlalchemy as sa


revision = "c2a4b57e1f90"
down_revision = "b51d4a0c9e73"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("maintenance_requests", sa.Column("room_id", sa.Integer(), nullable=True))
    op.add_column("maintenance_requests", sa.Column("preferred_maintenance_date", sa.Date(), nullable=True))
    op.create_foreign_key(
        "fk_maintenance_requests_room_id_rooms", "maintenance_requests", "rooms",
        ["room_id"], ["room_id"], ondelete="SET NULL",
    )
    op.create_index("ix_maintenance_requests_room_id", "maintenance_requests", ["room_id"])


def downgrade() -> None:
    op.drop_index("ix_maintenance_requests_room_id", table_name="maintenance_requests")
    op.drop_constraint("fk_maintenance_requests_room_id_rooms", "maintenance_requests", type_="foreignkey")
    op.drop_column("maintenance_requests", "preferred_maintenance_date")
    op.drop_column("maintenance_requests", "room_id")
