"""link equipment to rooms

Revision ID: e1a74b2cf89d
Revises: d82f914e6a2b
Create Date: 2026-09-23 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e1a74b2cf89d"
down_revision: Union[str, Sequence[str], None] = "d82f914e6a2b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("equipment", sa.Column("room_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_equipment_room_id_rooms", "equipment", "rooms", ["room_id"], ["room_id"], ondelete="SET NULL")
    op.create_index("ix_equipment_room_id", "equipment", ["room_id"])


def downgrade() -> None:
    op.drop_index("ix_equipment_room_id", table_name="equipment")
    op.drop_constraint("fk_equipment_room_id_rooms", "equipment", type_="foreignkey")
    op.drop_column("equipment", "room_id")
