import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.db.session import get_engine
from app.models import Alert, Building, MaintenanceRequest, Room
from test_auth import STAFF_ID
from app.db.seed import ROOMS
from test_auth import auth_db, tokens

pytestmark = pytest.mark.database


@pytest.fixture
def connection(isolated_test_database):
    with get_engine().connect() as database_connection:
        transaction = database_connection.begin()
        try:
            yield database_connection
        finally:
            transaction.rollback()


def test_room_schema_seed_and_building_relationship(connection):
    assert connection.scalar(select(func.count()).select_from(Room)) == 12
    assert connection.scalar(select(func.count()).select_from(Room).join(Building)) == 12
    rows = connection.execute(select(Building.building_name, Room.room_number, Room.room_type).join(Room)).all()
    assert len(rows) == len(ROOMS)
    assert {name for name, _, _ in rows} == {"Building 216", "Building 209", "JS Building"}
    assert all(room_number in {"201", "202", "301", "302"} for _, room_number, _ in rows)


def test_room_number_is_unique_per_building_but_reusable_elsewhere(connection):
    buildings = connection.scalars(select(Building.building_id).order_by(Building.building_id)).all()
    first, second = buildings[:2]
    connection.execute(Room.__table__.insert().values(
        room_id=2_000_000_230, building_id=first, room_number="999",
        room_name="Temporary Room", room_type="OFFICE", floor=9, description="Test room",
    ))
    connection.execute(Room.__table__.insert().values(
        room_id=2_000_000_231, building_id=second, room_number="999",
        room_name="Temporary Room", room_type="OFFICE", floor=9, description="Test room",
    ))
    with pytest.raises(IntegrityError) as error:
        with connection.begin_nested():
            connection.execute(Room.__table__.insert().values(
                room_id=2_000_000_232, building_id=first, room_number="999",
                room_name="Duplicate", room_type="OFFICE", floor=9, description="Test room",
            ))
    assert error.value.orig.sqlstate == "23505"
    assert error.value.orig.diag.constraint_name == "uq_rooms_building_room_number"


@pytest.mark.parametrize("role", ["STAFF", "ADMIN"])
def test_staff_and_admin_can_list_filter_search_and_view_rooms(auth_db, tokens, api_request, role):
    headers = tokens[role]
    response = api_request("/api/rooms", headers=headers)
    assert response.status_code == 200 and len(response.json()) == 12
    first = response.json()[0]
    assert set(first) == {"room_id", "room_number", "room_name", "room_type", "floor", "description", "building", "equipment", "equipment_attention_count", "open_request_count", "high_priority_open_request_count", "active_alert_count", "critical_alert_count", "open_requests", "active_alerts"}
    assert sum(len(row["equipment"]) for row in response.json()) == 5
    assert all({"equipment_id", "equipment_name", "equipment_type", "location", "status"} == set(item)
               for row in response.json() for item in row["equipment"])

    building = api_request("/api/rooms?building_id=1", headers=headers)
    assert building.status_code == 200 and len(building.json()) == 4
    assert {row["building"]["building_id"] for row in building.json()} == {1}

    filtered = api_request("/api/rooms?floor=3&room_type=COMPUTER_LAB", headers=headers)
    assert filtered.status_code == 200 and len(filtered.json()) == 3
    assert all(row["floor"] == 3 and row["room_type"] == "COMPUTER_LAB" for row in filtered.json())

    searched = api_request("/api/rooms?search=Admissions", headers=headers)
    assert searched.status_code == 200 and [row["room_name"] for row in searched.json()] == ["Admissions Office"]
    number_search = api_request("/api/rooms?building_id=2&search=201", headers=headers)
    assert number_search.status_code == 200 and len(number_search.json()) == 1

    detail = api_request(f"/api/rooms/{first['room_id']}", headers=headers)
    assert detail.status_code == 200 and detail.json() == first
    assert api_request("/api/rooms/2147483647", headers=headers).status_code == 404
    assert api_request("/api/rooms", headers={}).status_code == 401


@pytest.mark.parametrize("role", ["STAFF", "ADMIN"])
def test_room_maintenance_and_alert_aggregation(auth_db, tokens, api_request, role):
    connection, _ = auth_db
    connection.execute(MaintenanceRequest.__table__.insert(), [
        {"request_id": 2_000_000_350, "submitted_by": STAFF_ID, "building_id": 1, "equipment_id": 1,
         "room_location": "Other location", "fault_category": "HVAC", "description": "Equipment-linked request",
         "priority": "HIGH", "status": "PENDING"},
        {"request_id": 2_000_000_351, "submitted_by": STAFF_ID, "building_id": 1, "equipment_id": None,
         "room_location": "Room 201", "fault_category": "General", "description": "Location-linked request",
         "priority": "MEDIUM", "status": "IN_PROGRESS"},
        {"request_id": 2_000_000_352, "submitted_by": STAFF_ID, "building_id": 1, "equipment_id": 1,
         "room_location": "Room 201", "fault_category": "HVAC", "description": "Resolved request",
         "priority": "HIGH", "status": "RESOLVED"},
    ])
    connection.execute(Alert.__table__.insert(), [
        {"alert_id": 2_000_000_350, "building_id": 1, "equipment_id": 1, "category": "EQUIPMENT",
         "severity": "CRITICAL", "title": "Critical room alert", "description": "Active equipment alert", "status": "ACTIVE"},
        {"alert_id": 2_000_000_351, "building_id": 1, "equipment_id": 1, "category": "EQUIPMENT",
         "severity": "WARNING", "title": "Warning room alert", "description": "Active equipment alert", "status": "ACTIVE"},
        {"alert_id": 2_000_000_352, "building_id": 1, "equipment_id": None, "category": "ENERGY",
         "severity": "CRITICAL", "title": "Building alert", "description": "Not assigned to a room", "status": "ACTIVE"},
    ])
    rows = api_request("/api/rooms", headers=tokens[role]).json()
    room = next(item for item in rows if item["room_id"] == 1)
    assert room["open_request_count"] == 2 and room["high_priority_open_request_count"] == 1
    assert {item["request_id"] for item in room["open_requests"]} == {2_000_000_350, 2_000_000_351}
    assert room["active_alert_count"] == 2 and room["critical_alert_count"] == 1
    assert {item["alert_id"] for item in room["active_alerts"]} == {2_000_000_350, 2_000_000_351}
    empty = next(item for item in rows if item["room_id"] == 4)
    assert empty["open_request_count"] == empty["high_priority_open_request_count"] == 0
    assert empty["active_alert_count"] == empty["critical_alert_count"] == 0
    detail = api_request("/api/rooms/1", headers=tokens[role])
    assert detail.status_code == 200 and detail.json()["open_request_count"] == 2
