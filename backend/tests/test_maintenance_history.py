from datetime import datetime, timezone

import pytest
from sqlalchemy import event, func, select

from app.models import Equipment, MaintenanceHistory, MaintenanceRequest, RequestStatusHistory
from test_auth import auth_db, tokens

pytestmark = pytest.mark.database


def test_history_reads_filters_order_and_query_count(auth_db, tokens, api_request):
    connection, _ = auth_db
    connection.execute(MaintenanceHistory.__table__.insert(), [
        dict(history_id=-36701, equipment_id=1, completed_by=-34502, action_details="First", completed_at=datetime(2020, 1, 1, tzinfo=timezone.utc)),
        dict(history_id=-36702, equipment_id=7, completed_by=-34502, action_details="Second", completed_at=datetime(2021, 1, 1, tzinfo=timezone.utc)),
    ])
    response = api_request("/api/maintenance-history", headers=tokens["ADMIN"])
    assert response.status_code == 200
    rows = response.json()
    assert [row["history_id"] for row in rows] == [-36702, -36701]
    assert rows[0]["equipment"]["building"]["building_id"] == 3
    assert rows[0]["request"] is None and rows[0]["completed_by"]["role"] == "ADMIN"
    assert set(rows[0]["completed_by"]) == {"user_id", "name", "role"}
    for query in ("building_id=1", "equipment_id=1", "building_id=1&equipment_id=1"):
        assert len(api_request("/api/maintenance-history?" + query, headers=tokens["ADMIN"]).json()) == 1
    for query in ("building_id=999", "building_id=1&equipment_id=7"):
        response = api_request("/api/maintenance-history?" + query, headers=tokens["ADMIN"])
        assert response.status_code == 200 and response.json() == []
    assert len(api_request("/api/equipment/1/history", headers=tokens["ADMIN"]).json()) == 1
    assert api_request("/api/equipment/2/history", headers=tokens["ADMIN"]).json() == []
    assert api_request("/api/equipment/999999/history", headers=tokens["ADMIN"]).json() == {"detail": "Equipment not found"}
    selects = []
    def count(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"): selects.append(statement)
    event.listen(connection, "before_cursor_execute", count)
    try:
        assert api_request("/api/maintenance-history", headers=tokens["ADMIN"]).status_code == 200
        assert len(selects) == 2  # Authentication plus eager-loaded history query.
    finally:
        event.remove(connection, "before_cursor_execute", count)


@pytest.mark.parametrize("path", ["/api/maintenance-history", "/api/equipment/1/history"])
def test_history_read_permissions(auth_db, tokens, api_request, path):
    assert api_request(path, headers=tokens["STAFF"]).status_code == 403
    assert api_request(path, headers={}).status_code == 401


def test_preventive_creation_and_state_independence(auth_db, tokens, api_request):
    connection, _ = auth_db
    original = connection.scalar(select(Equipment.status).where(Equipment.equipment_id == 1))
    response = api_request("/api/maintenance-history", "POST", headers=tokens["ADMIN"], json={"equipment_id": 1, "action_details": "  Filter cleaned  "})
    assert response.status_code == 201
    row = response.json()
    assert row["request"] is None and row["action_details"] == "Filter cleaned"
    assert row["completed_by"]["user_id"] == -34502
    assert datetime.fromisoformat(row["completed_at"]).tzinfo is not None
    assert "password" not in response.text
    assert connection.scalar(select(Equipment.status).where(Equipment.equipment_id == 1)) == original
    assert connection.scalar(select(func.count()).select_from(RequestStatusHistory)) == 0
    body = {"equipment_id": 1, "action_details": "Test"}
    assert api_request("/api/maintenance-history", "POST", headers=tokens["STAFF"], json=body).status_code == 403
    assert api_request("/api/maintenance-history", "POST", headers={}, json=body).status_code == 401


@pytest.mark.parametrize("request_equipment,status,expected,detail", [
    (2, "RESOLVED", 400, "Maintenance request does not belong to the selected equipment"),
    (None, "RESOLVED", 400, "Maintenance request does not belong to the selected equipment"),
    (1, "PENDING", 400, "Maintenance request must be resolved before recording completed maintenance"),
    (1, "IN_PROGRESS", 400, "Maintenance request must be resolved before recording completed maintenance"),
    (1, "RESOLVED", 201, None),
])
def test_linked_request_validation(auth_db, tokens, api_request, request_equipment, status, expected, detail):
    connection, _ = auth_db
    connection.execute(MaintenanceRequest.__table__.insert().values(
        request_id=-36740, submitted_by=-34501, building_id=1, equipment_id=request_equipment,
        room_location="Test", fault_category="Other", description="Test", priority="LOW", status=status))
    body = {"equipment_id": 1, "request_id": -36740, "action_details": "Completed service"}
    response = api_request("/api/maintenance-history", "POST", headers=tokens["ADMIN"], json=body)
    assert response.status_code == expected
    if detail:
        assert response.json() == {"detail": detail}
    else:
        assert response.json()["request"] == {"request_id": -36740, "status": "RESOLVED"}
        assert api_request("/api/maintenance-history", "POST", headers=tokens["ADMIN"], json=body).status_code == 201
        assert connection.scalar(select(func.count()).select_from(MaintenanceHistory)) == 2
    assert connection.scalar(select(MaintenanceRequest.status).where(MaintenanceRequest.request_id == -36740)) == status
    assert connection.scalar(select(func.count()).select_from(RequestStatusHistory)) == 0


@pytest.mark.parametrize("change,expected", [
    ({"equipment_id": 999999}, 404), ({"request_id": 999999}, 404),
    ({"action_details": " "}, 422), ({"action_details": "x" * 2001}, 422),
    ({"completed_by": -34501}, 422), ({"completed_at": "2020-01-01T00:00:00Z"}, 422),
])
def test_maintenance_validation(auth_db, tokens, api_request, change, expected):
    body = {"equipment_id": 1, "action_details": "Test"} | change
    assert api_request("/api/maintenance-history", "POST", headers=tokens["ADMIN"], json=body).status_code == expected


def test_maintenance_write_rollback(auth_db, tokens, api_request):
    connection, _ = auth_db
    before = connection.scalar(select(func.count()).select_from(MaintenanceHistory))
    def fail(mapper, conn, target):
        raise RuntimeError("Injected maintenance insert failure")
    event.listen(MaintenanceHistory, "before_insert", fail)
    try:
        response = api_request("/api/maintenance-history", "POST", headers=tokens["ADMIN"], json={"equipment_id": 1, "action_details": "Test"})
        assert response.status_code == 500
    finally:
        event.remove(MaintenanceHistory, "before_insert", fail)
    assert connection.scalar(select(func.count()).select_from(MaintenanceHistory)) == before


def test_request_resolution_does_not_record_completed_work(auth_db, tokens, api_request):
    connection, _ = auth_db
    record = api_request("/api/requests", "POST", headers=tokens["STAFF"], json={
        "building_id": 1, "equipment_id": 1, "room_location": "Test", "fault_category": "Other",
        "description": "Resolution and completed work are separate", "priority": "LOW",
    })
    assert record.status_code == 201
    response = api_request(f"/api/requests/{record.json()['request_id']}/status", "PATCH",
                           headers=tokens["ADMIN"], json={"status": "RESOLVED"})
    assert response.status_code == 200
    assert connection.scalar(select(func.count()).select_from(MaintenanceHistory)) == 0
