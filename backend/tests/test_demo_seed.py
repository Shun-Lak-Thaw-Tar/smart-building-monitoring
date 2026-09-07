import secrets

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import verify_password
from app.db.seed_demo import seed_demo
from app.db.session import get_engine
from app.models import MaintenanceHistory, MaintenanceRequest, RequestStatusHistory, User

pytestmark = pytest.mark.database


def test_fresh_demo_seed_and_rerun(monkeypatch):
    if not settings.database_url:
        pytest.skip("PostgreSQL configuration required")
    passwords = {}
    for field in ("demo_staff_password", "demo_admin_password", "demo_maintenance_admin_password"):
        passwords[field] = secrets.token_urlsafe(24)
        monkeypatch.setattr(settings, field, passwords[field])
    with get_engine().connect() as connection:
        transaction = connection.begin()
        try:
            # Build a fresh application demo inside an isolated rollback transaction.
            connection.execute(RequestStatusHistory.__table__.delete())
            connection.execute(MaintenanceRequest.__table__.delete())
            connection.execute(User.__table__.delete())
            with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
                assert seed_demo(session) == {"users": 3, "requests": 4, "status_history": 7}
                hashes = list(session.scalars(select(User.password_hash).order_by(User.user_id)))
                assert seed_demo(session) == {"users": 0, "requests": 0, "status_history": 0}
                assert list(session.scalars(select(User.password_hash).order_by(User.user_id))) == hashes
                assert session.scalar(select(func.count()).select_from(User)) == 3
                assert session.scalar(select(func.count()).select_from(MaintenanceRequest)) == 4
                assert session.scalar(select(func.count()).select_from(RequestStatusHistory)) == 7
                assert session.scalar(select(func.count()).select_from(MaintenanceHistory)) == 0
                staff = session.scalar(select(User).where(User.name == "Demo Staff"))
                assert verify_password(passwords["demo_staff_password"], staff.password_hash)
                requests = session.scalars(select(MaintenanceRequest).order_by(MaintenanceRequest.created_at)).all()
                assert [r.status for r in requests] == ["PENDING", "IN_PROGRESS", "RESOLVED", "PENDING"]
                for request in requests:
                    history = session.scalars(select(RequestStatusHistory).where(RequestStatusHistory.request_id == request.request_id)
                                              .order_by(RequestStatusHistory.changed_at)).all()
                    assert history[0].changed_by == staff.user_id and history[0].previous_status is None
                    assert all(row.changed_by == request.assigned_to for row in history[1:])
                requests[0].status = "RESOLVED"
                session.flush()
                assert seed_demo(session) == {"users": 0, "requests": 0, "status_history": 0}
                assert requests[0].status == "RESOLVED"
        finally:
            transaction.rollback()
