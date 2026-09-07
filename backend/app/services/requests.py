from contextlib import contextmanager

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import MaintenanceRequest, User


def request_query():
    return select(MaintenanceRequest).options(
        joinedload(MaintenanceRequest.building), joinedload(MaintenanceRequest.equipment),
        joinedload(MaintenanceRequest.submitter), joinedload(MaintenanceRequest.assignee),
    )


def visible_request(session: Session, user: User, request_id: int, *, lock: bool = False):
    statement = request_query().where(MaintenanceRequest.request_id == request_id)
    if user.role == "STAFF":
        statement = statement.where(MaintenanceRequest.submitted_by == user.user_id)
    if lock:
        # Lock only the request, not the nullable joined tables. Serialize admin edits.
        statement = statement.with_for_update(of=MaintenanceRequest)
    record = session.scalar(statement.execution_options(populate_existing=True))
    if record is None:
        raise HTTPException(404, "Maintenance request not found")
    return record


@contextmanager
def write_transaction(session: Session):
    """Own the request session transaction, including any earlier auth/validation reads."""
    try:
        yield
        session.commit()
    except Exception:
        session.rollback()
        raise
