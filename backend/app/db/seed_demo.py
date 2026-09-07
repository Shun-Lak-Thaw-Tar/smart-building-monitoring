"""Separate application demo seed. Credentials only come from local settings."""
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import get_engine
from app.models import Building, Equipment, MaintenanceRequest, RequestStatusHistory, User

DEMO_USERS = (
    ("Demo Staff", "STAFF", "demo_staff_password"),
    ("Demo Admin", "ADMIN", "demo_admin_password"),
    ("Maintenance Admin", "ADMIN", "demo_maintenance_admin_password"),
)

DEMO_REQUESTS = (
    ("Building 216", "Projector 04", "Room 205", "Equipment",
     "Projector repeatedly loses its display signal.", "HIGH", None, ("PENDING",)),
    ("JS Building", "Air Conditioner 03", "Room 102", "Air Conditioning",
     "Air conditioner is running but the room is not cooling properly.", "MEDIUM", "Maintenance Admin", ("PENDING", "IN_PROGRESS")),
    ("Building 209", "Projector 07", "Room 310", "Equipment",
     "Projector has no power and cannot be used.", "HIGH", "Demo Admin", ("PENDING", "IN_PROGRESS", "RESOLVED")),
    ("JS Building", "Water Pump 01", "Plant Room", "Plumbing",
     "Water pump is making an unusual noise during operation.", "HIGH", None, ("PENDING",)),
)
DEMO_START = datetime(2026, 9, 2, 8, tzinfo=timezone.utc)


def seed_users(session: Session) -> tuple[dict[str, User], int]:
    # Validate all configuration before inserting anything. Never include values in errors.
    for _, _, field in DEMO_USERS:
        value = getattr(settings, field)
        if not value or value.upper() in {"CHANGE_ME", "PASSWORD", "CHANGEME"} or len(value) < 12:
            raise RuntimeError(f"Set {field.upper()} to a non-placeholder password of at least 12 characters.")
    session.execute(text("SELECT pg_advisory_xact_lock(333, 345)"))
    users, added = {}, 0
    for name, role, field in DEMO_USERS:
        user = session.scalar(select(User).where(User.name == name))
        if user is None:
            user = User(name=name, role=role, password_hash=hash_password(getattr(settings, field)))
            session.add(user)
            session.flush()
            added += 1
        elif user.role != role:
            raise RuntimeError(f"Existing demo account {name} has an unexpected role; no changes committed.")
        users[name] = user
    return users, added


def seed_demo(session: Session) -> dict[str, int]:
    users, users_added = seed_users(session)
    added = {"users": users_added, "requests": 0, "status_history": 0}
    staff = users["Demo Staff"]
    for index, (building_name, equipment_name, room, category, description, priority, assigned_name, statuses) in enumerate(DEMO_REQUESTS):
        created_at = DEMO_START + timedelta(hours=index)
        # Fixed submitting user + timestamp identifies demo records. Existing data,
        # including later administrator changes and history, is never reset.
        existing = session.scalar(select(MaintenanceRequest.request_id).where(
            MaintenanceRequest.submitted_by == staff.user_id,
            MaintenanceRequest.created_at == created_at,
        ).limit(1))
        if existing is not None:
            continue
        building = session.scalar(select(Building).where(Building.building_name == building_name))
        equipment = session.scalar(select(Equipment).where(
            Equipment.building_id == building.building_id,
            Equipment.equipment_name == equipment_name,
        ).limit(1)) if building else None
        if building is None or equipment is None:
            raise RuntimeError("Run python -m app.db.seed before the demo application seed.")
        assignee = users[assigned_name] if assigned_name else None
        record = MaintenanceRequest(
            submitted_by=staff.user_id, building_id=building.building_id,
            equipment_id=equipment.equipment_id, assigned_to=assignee.user_id if assignee else None,
            room_location=room, fault_category=category, description=description,
            priority=priority, status=statuses[-1], created_at=created_at,
            updated_at=created_at + timedelta(minutes=15 * (len(statuses) - 1)),
        )
        session.add(record)
        session.flush()
        for step, status in enumerate(statuses):
            session.add(RequestStatusHistory(
                request_id=record.request_id,
                changed_by=staff.user_id if step == 0 else assignee.user_id,
                previous_status=statuses[step - 1] if step else None, new_status=status,
                note=None, changed_at=created_at + timedelta(minutes=15 * step),
            ))
            added["status_history"] += 1
        added["requests"] += 1
    session.flush()
    return added


def main() -> None:
    with Session(get_engine()) as session, session.begin():
        added = seed_demo(session)
    print("Demo application rows added:", added)


if __name__ == "__main__":
    main()
