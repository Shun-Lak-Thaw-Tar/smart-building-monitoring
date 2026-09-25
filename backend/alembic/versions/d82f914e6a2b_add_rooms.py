"""add rooms

Revision ID: d82f914e6a2b
Revises: c79e05b4d31a
Create Date: 2026-09-23 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d82f914e6a2b"
down_revision: Union[str, Sequence[str], None] = "c79e05b4d31a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "rooms",
        sa.Column("room_id", sa.Integer(), sa.Identity(always=False), nullable=False),
        sa.Column("building_id", sa.Integer(), nullable=False),
        sa.Column("room_number", sa.String(length=20), nullable=False),
        sa.Column("room_name", sa.String(length=120), nullable=False),
        sa.Column("room_type", sa.String(length=50), nullable=False),
        sa.Column("floor", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["building_id"], ["buildings.building_id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("room_id"),
        sa.UniqueConstraint("building_id", "room_number", name="uq_rooms_building_room_number"),
    )
    op.create_index("ix_rooms_building_id", "rooms", ["building_id"])
    op.create_index("ix_rooms_floor", "rooms", ["floor"])
    op.create_index("ix_rooms_room_type", "rooms", ["room_type"])


def downgrade() -> None:
    op.drop_table("rooms")
