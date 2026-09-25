"""Align alert maintenance-link uniqueness with ORM metadata.

Revision ID: b51d4a0c9e73
Revises: a91e3c2d8f04
"""
from alembic import op

revision = "b51d4a0c9e73"
down_revision = "a91e3c2d8f04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("uq_alerts_maintenance_request_id", "alerts", type_="unique")
    op.drop_index("ix_alerts_maintenance_request_id", table_name="alerts")
    op.create_index("ix_alerts_maintenance_request_id", "alerts", ["maintenance_request_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_alerts_maintenance_request_id", table_name="alerts")
    op.create_index("ix_alerts_maintenance_request_id", "alerts", ["maintenance_request_id"])
    op.create_unique_constraint("uq_alerts_maintenance_request_id", "alerts", ["maintenance_request_id"])
