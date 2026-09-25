"""Add acknowledgement and maintenance request linkage to alerts.

Revision ID: f3d7c09a4b82
Revises: e1a74b2cf89d
Create Date: 2026-09-23
"""

from alembic import op
import sqlalchemy as sa

revision = "f3d7c09a4b82"
down_revision = "e1a74b2cf89d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_alerts_status", "alerts", type_="check")
    op.add_column("alerts", sa.Column("acknowledged_by", sa.Integer(), nullable=True))
    op.add_column("alerts", sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("alerts", sa.Column("resolved_by", sa.Integer(), nullable=True))
    op.add_column("alerts", sa.Column("maintenance_request_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_alerts_acknowledged_by_users", "alerts", "users", ["acknowledged_by"], ["user_id"], ondelete="SET NULL")
    op.create_foreign_key("fk_alerts_resolved_by_users", "alerts", "users", ["resolved_by"], ["user_id"], ondelete="SET NULL")
    op.create_foreign_key("fk_alerts_maintenance_request_id_maintenance_requests", "alerts", "maintenance_requests", ["maintenance_request_id"], ["request_id"], ondelete="SET NULL")
    op.create_index("ix_alerts_acknowledged_by", "alerts", ["acknowledged_by"])
    op.create_index("ix_alerts_resolved_by", "alerts", ["resolved_by"])
    op.create_index("ix_alerts_maintenance_request_id", "alerts", ["maintenance_request_id"])
    op.create_unique_constraint("uq_alerts_maintenance_request_id", "alerts", ["maintenance_request_id"])
    op.create_check_constraint("ck_alerts_status", "alerts", "status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')")


def downgrade() -> None:
    op.drop_constraint("ck_alerts_status", "alerts", type_="check")
    op.drop_constraint("uq_alerts_maintenance_request_id", "alerts", type_="unique")
    op.drop_index("ix_alerts_maintenance_request_id", table_name="alerts")
    op.drop_index("ix_alerts_resolved_by", table_name="alerts")
    op.drop_index("ix_alerts_acknowledged_by", table_name="alerts")
    op.drop_constraint("fk_alerts_maintenance_request_id_maintenance_requests", "alerts", type_="foreignkey")
    op.drop_constraint("fk_alerts_resolved_by_users", "alerts", type_="foreignkey")
    op.drop_constraint("fk_alerts_acknowledged_by_users", "alerts", type_="foreignkey")
    op.drop_column("alerts", "maintenance_request_id")
    op.drop_column("alerts", "resolved_by")
    op.drop_column("alerts", "acknowledged_at")
    op.drop_column("alerts", "acknowledged_by")
    op.create_check_constraint("ck_alerts_status", "alerts", "status IN ('ACTIVE', 'RESOLVED')")
