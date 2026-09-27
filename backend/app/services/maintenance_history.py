from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.models import Equipment, MaintenanceHistory, MaintenanceRequest


def history_query():
    return select(MaintenanceHistory).options(
        joinedload(MaintenanceHistory.equipment).joinedload(Equipment.building),
        joinedload(MaintenanceHistory.equipment).joinedload(Equipment.room),
        joinedload(MaintenanceHistory.request).joinedload(MaintenanceRequest.building),
        joinedload(MaintenanceHistory.request).joinedload(MaintenanceRequest.room),
        joinedload(MaintenanceHistory.request).joinedload(MaintenanceRequest.equipment),
        joinedload(MaintenanceHistory.request).joinedload(MaintenanceRequest.submitter),
        joinedload(MaintenanceHistory.request).joinedload(MaintenanceRequest.assignee),
        joinedload(MaintenanceHistory.completed_by_user),
    )


def ordered_history_query():
    return history_query().order_by(MaintenanceHistory.completed_at.desc(), MaintenanceHistory.history_id.desc())
