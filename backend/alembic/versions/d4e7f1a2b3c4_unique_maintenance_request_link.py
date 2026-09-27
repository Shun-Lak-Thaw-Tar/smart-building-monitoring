"""Prevent duplicate maintenance records for a resolved request.

Revision ID: d4e7f1a2b3c4
Revises: c2a4b57e1f90
"""

from alembic import op


revision = "d4e7f1a2b3c4"
down_revision = "c2a4b57e1f90"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint("uq_maintenance_history_request_id", "maintenance_history", ["request_id"])


def downgrade() -> None:
    op.drop_constraint("uq_maintenance_history_request_id", "maintenance_history", type_="unique")
