"""Allow simulated Security & Access event statuses.

Revision ID: e5f8a3b6c9d0
Revises: d4e7f1a2b3c4
"""

from alembic import op
import sqlalchemy as sa


revision = "e5f8a3b6c9d0"
down_revision = "d4e7f1a2b3c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_safety_events_status", "safety_events", type_="check")
    op.create_check_constraint(
        "ck_safety_events_status",
        "safety_events",
        "status IN ('NORMAL', 'FAULT', 'TESTING', 'OFFLINE', 'ALARM', 'GRANTED', 'DENIED', 'DOOR_OPEN', 'FORCED_ENTRY', 'ACTIVE', 'RESOLVED')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_safety_events_status", "safety_events", type_="check")
    op.create_check_constraint(
        "ck_safety_events_status",
        "safety_events",
        "status IN ('NORMAL', 'FAULT', 'TESTING', 'OFFLINE', 'ALARM', 'ACTIVE', 'RESOLVED')",
    )
