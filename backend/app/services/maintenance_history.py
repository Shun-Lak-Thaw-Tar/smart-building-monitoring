from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.models import Equipment, MaintenanceHistory


def history_query():
    return select(MaintenanceHistory).options(
        joinedload(MaintenanceHistory.equipment).joinedload(Equipment.building),
        joinedload(MaintenanceHistory.request), joinedload(MaintenanceHistory.completed_by_user),
    )


def ordered_history_query():
    return history_query().order_by(MaintenanceHistory.completed_at.desc(), MaintenanceHistory.history_id.desc())
