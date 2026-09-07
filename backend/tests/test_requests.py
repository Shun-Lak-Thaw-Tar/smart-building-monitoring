import pytest
from datetime import datetime, timezone
from sqlalchemy import event, func, select
from sqlalchemy.orm import Session
from urllib.parse import urlencode

from app.models import MaintenanceRequest, RequestStatusHistory
from test_auth import auth_db, tokens

pytestmark = pytest.mark.database


@pytest.fixture
def payload():
    return {"building_id": 1, "equipment_id": 2, "room_location": " Room 205 ",
            "fault_category": "Equipment", "description": "A test display fault", "priority": "HIGH"}


def create(api_request, tokens, payload):
    response = api_request("/api/requests", "POST", headers=tokens["STAFF"], json=payload)
    assert response.status_code == 201
    return response.json()


def test_staff_create_initial_history(auth_db, tokens, api_request, payload):
    result = create(api_request, tokens, payload)
    assert result["status"] == "PENDING" and result["assigned_to"] is None
    assert result["submitted_by"]["user_id"] == -34501
    assert result["room_location"] == "Room 205"
    history = api_request(f"/api/requests/{result['request_id']}/history", headers=tokens["STAFF"]).json()
    assert len(history) == 1
    assert history[0]["previous_status"] is None and history[0]["new_status"] == "PENDING"
    assert history[0]["changed_by"]["user_id"] == -34501 and history[0]["note"] is None
    assert api_request("/api/requests", "POST", headers=tokens["ADMIN"], json=payload).status_code == 403


@pytest.mark.parametrize("change,status,detail", [
    ({"building_id": 999}, 404, "Building not found"),
    ({"equipment_id": 999}, 404, "Equipment not found"),
    ({"building_id": 3}, 400, "Equipment does not belong to the selected building"),
    ({"priority": "INVALID"}, 422, None),
    ({"room_location": "   "}, 422, None),
    ({"submitted_by": -34503}, 422, None),
    ({"status": "RESOLVED"}, 422, None),
    ({"assigned_to": -34502}, 422, None),
])
def test_creation_validation(auth_db, tokens, api_request, payload, change, status, detail):
    response = api_request("/api/requests", "POST", headers=tokens["STAFF"], json=payload | change)
    assert response.status_code == status
    if detail: assert response.json() == {"detail": detail}


def test_optional_equipment_ownership_and_my(auth_db, tokens, api_request, payload):
    empty = api_request("/api/requests/my", headers=tokens["STAFF"])
    assert empty.status_code == 200 and empty.json() == []
    first = create(api_request, tokens, payload | {"equipment_id": None})
    second = create(api_request, tokens, payload)
    assert first["equipment"] is None
    rows = api_request("/api/requests/my", headers=tokens["STAFF"]).json()
    assert [r["request_id"] for r in rows] == [second["request_id"], first["request_id"]]
    assert api_request("/api/requests/my", headers=tokens["OTHER"]).json() == []
    assert api_request("/api/requests/my", headers=tokens["ADMIN"]).status_code == 403
    for suffix in ("", "/history"):
        path = f"/api/requests/{first['request_id']}{suffix}"
        assert api_request(path, headers=tokens["STAFF"]).status_code == 200
        assert api_request(path, headers=tokens["ADMIN"]).status_code == 200
        response = api_request(path, headers=tokens["OTHER"])
        assert response.status_code == 404 and response.json() == {"detail": "Maintenance request not found"}


def test_creation_atomicity(auth_db, tokens, api_request, payload):
    connection, _ = auth_db
    before = connection.scalar(select(func.count()).select_from(MaintenanceRequest))

    def fail_history(session, flush_context, instances):
        if any(isinstance(item, RequestStatusHistory) for item in session.new):
            raise RuntimeError("Injected test history failure")

    event.listen(Session, "before_flush", fail_history)
    try:
        assert api_request("/api/requests", "POST", headers=tokens["STAFF"], json=payload).status_code == 500
    finally:
        event.remove(Session, "before_flush", fail_history)
    assert connection.scalar(select(func.count()).select_from(MaintenanceRequest)) == before


def test_admin_filters_search_and_order(auth_db, tokens, api_request, payload):
    first = create(api_request, tokens, payload | {"fault_category": "SpecialFault", "room_location": "SpecialRoom", "description": "Unique signal flicker"})
    second = create(api_request, tokens, payload | {"building_id": 3, "equipment_id": 7, "priority": "LOW", "description": "Cooling"})
    assert api_request("/api/requests", headers=tokens["STAFF"]).status_code == 403
    rows = api_request("/api/requests", headers=tokens["ADMIN"]).json()
    assert [r["request_id"] for r in rows] == [second["request_id"], first["request_id"]]
    for term in ("specialfault", "SPECIALROOM", " signal ", "Projector 04", "Building 216"):
        response = api_request("/api/requests?" + urlencode({"search": term}), headers=tokens["ADMIN"])
        assert response.status_code == 200
        assert [r["request_id"] for r in response.json()] == [first["request_id"]]
    for params in ({"building_id": 1}, {"priority": "HIGH"},
                   {"building_id": 1, "status": "PENDING", "priority": "HIGH", "search": "signal"}):
        assert [r["request_id"] for r in api_request("/api/requests?" + urlencode(params), headers=tokens["ADMIN"]).json()] == [first["request_id"]]
    assert len(api_request("/api/requests?search=%20%20", headers=tokens["ADMIN"]).json()) == 2
    for query in ("building_id=999", "status=RESOLVED", "search=nomatches", "search=%25"):
        assert api_request("/api/requests?" + query, headers=tokens["ADMIN"]).json() == []


@pytest.mark.parametrize("query", ["priority=INVALID", "status=INVALID", "building_id=abc", "search=" + "x" * 101])
def test_admin_filter_validation(auth_db, tokens, api_request, query):
    assert api_request("/api/requests?" + query, headers=tokens["ADMIN"]).status_code == 422


def test_assignment_and_idempotency(auth_db, tokens, api_request, payload):
    record = create(api_request, tokens, payload)
    path = f"/api/requests/{record['request_id']}/assign"
    assert api_request(path, "PATCH", headers=tokens["STAFF"], json={"assigned_to": -34502}).status_code == 403
    for user_id, status, detail in ((-39999, 404, "Assignee not found"), (-34501, 400, "Assignee must be an administrator")):
        response = api_request(path, "PATCH", headers=tokens["ADMIN"], json={"assigned_to": user_id})
        assert response.status_code == status and response.json() == {"detail": detail}
    first = api_request(path, "PATCH", headers=tokens["ADMIN"], json={"assigned_to": -34502})
    assert first.status_code == 200 and first.json()["assigned_to"]["user_id"] == -34502
    again = api_request(path, "PATCH", headers=tokens["ADMIN"], json={"assigned_to": -34502})
    assert again.json() == first.json()
    assert len(api_request(f"/api/requests/{record['request_id']}/history", headers=tokens["ADMIN"]).json()) == 1
    missing = api_request("/api/requests/999999/assign", "PATCH", headers=tokens["ADMIN"], json={"assigned_to": -34502})
    assert missing.status_code == 404 and missing.json() == {"detail": "Maintenance request not found"}


def test_status_transitions_history_and_noop(auth_db, tokens, api_request, payload):
    connection, _ = auth_db
    record = create(api_request, tokens, payload)
    request_id = record["request_id"]
    old = datetime(2000, 1, 1, tzinfo=timezone.utc)
    connection.execute(MaintenanceRequest.__table__.update().where(MaintenanceRequest.request_id == request_id).values(updated_at=old))
    path = f"/api/requests/{request_id}/status"
    assert api_request(path, "PATCH", headers=tokens["STAFF"], json={"status": "IN_PROGRESS"}).status_code == 403
    transitions = ["IN_PROGRESS", "RESOLVED", "IN_PROGRESS", "PENDING"]
    for status in transitions:
        response = api_request(path, "PATCH", headers=tokens["ADMIN"], json={"status": status, "note": "  Inspected  "})
        assert response.status_code == 200 and response.json()["status"] == status
        assert datetime.fromisoformat(response.json()["updated_at"]) > old
    last = response.json()
    noop = api_request(path, "PATCH", headers=tokens["ADMIN"], json={"status": "PENDING", "note": "No extra event"})
    assert noop.json() == last
    history = api_request(f"/api/requests/{request_id}/history", headers=tokens["ADMIN"]).json()
    assert len(history) == 5
    assert [row["new_status"] for row in history] == ["PENDING"] + transitions
    assert [row["previous_status"] for row in history] == [None, "PENDING", "IN_PROGRESS", "RESOLVED", "IN_PROGRESS"]
    assert all(row["note"] == "Inspected" and row["changed_by"]["user_id"] == -34502 for row in history[1:])
    ordering = [(row["changed_at"], row["status_history_id"]) for row in history]
    assert ordering == sorted(ordering)
    assert api_request(path, "PATCH", headers=tokens["ADMIN"], json={"status": "INVALID"}).status_code == 422
    assert api_request(path, "PATCH", headers=tokens["ADMIN"], json={"status": "RESOLVED", "note": "x" * 501}).status_code == 422
    assert api_request("/api/requests/999999/status", "PATCH", headers=tokens["ADMIN"], json={"status": "RESOLVED"}).status_code == 404


def test_status_atomicity(auth_db, tokens, api_request, payload):
    connection, _ = auth_db
    record = create(api_request, tokens, payload)

    def fail_history(mapper, conn, target):
        raise RuntimeError("Injected history insert failure after request update")

    event.listen(RequestStatusHistory, "before_insert", fail_history)
    try:
        response = api_request(f"/api/requests/{record['request_id']}/status", "PATCH", headers=tokens["ADMIN"], json={"status": "RESOLVED"})
        assert response.status_code == 500
    finally:
        event.remove(RequestStatusHistory, "before_insert", fail_history)
    assert connection.scalar(select(MaintenanceRequest.status).where(MaintenanceRequest.request_id == record["request_id"])) == "PENDING"
    assert connection.scalar(select(func.count()).select_from(RequestStatusHistory).where(RequestStatusHistory.request_id == record["request_id"])) == 1


def test_request_collection_query_count(auth_db, tokens, api_request, payload):
    connection, _ = auth_db
    create(api_request, tokens, payload)
    create(api_request, tokens, payload)
    statements = []

    def count(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    event.listen(connection, "before_cursor_execute", count)
    try:
        assert api_request("/api/requests", headers=tokens["ADMIN"]).status_code == 200
        assert len(statements) == 2  # Current user plus one eager-loaded collection.
    finally:
        event.remove(connection, "before_cursor_execute", count)
