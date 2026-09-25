from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.models import Alert, MaintenanceRequest
from test_auth import auth_db, tokens

pytestmark = pytest.mark.database


def alert_body(**overrides):
    return {
        "building_id": 1,
        "equipment_id": 1,
        "category": "EQUIPMENT",
        "severity": "WARNING",
        "title": "  Air conditioning attention needed  ",
        "description": "  Check the cooling unit before the next class.  ",
    } | overrides


def request_body(**overrides):
    return {
        "room_location": "Room 201",
        "fault_category": "Cooling",
        "description": "Review the alert and inspect the cooling unit.",
        "priority": "MEDIUM",
    } | overrides


def test_admin_create_and_staff_admin_read_alerts(auth_db, tokens, api_request):
    created = api_request("/api/alerts", "POST", headers=tokens["ADMIN"], json=alert_body())
    assert created.status_code == 201
    body = created.json()
    assert body["title"] == "Air conditioning attention needed"
    assert body["description"] == "Check the cooling unit before the next class."
    assert body["status"] == "ACTIVE" and body["resolved_at"] is None and body["acknowledged_at"] is None
    assert body["building"]["building_id"] == 1 and body["equipment"]["equipment_id"] == 1
    assert datetime.fromisoformat(body["created_at"].replace("Z", "+00:00")).tzinfo is not None
    for role in ("STAFF", "ADMIN"):
        listed = api_request("/api/alerts", headers=tokens[role])
        assert listed.status_code == 200 and [row["alert_id"] for row in listed.json()] == [body["alert_id"]]
        detail = api_request(f"/api/alerts/{body['alert_id']}", headers=tokens[role])
        assert detail.status_code == 200 and detail.json() == body


def test_alert_acknowledgement_and_resolution_persist(auth_db, tokens, api_request):
    first = api_request("/api/alerts", "POST", headers=tokens["ADMIN"], json=alert_body()).json()
    second = api_request("/api/alerts", "POST", headers=tokens["ADMIN"], json=alert_body(
        equipment_id=None, category="ENERGY", severity="CRITICAL", title="Energy consumption spike",
    )).json()
    assert [row["alert_id"] for row in api_request("/api/alerts?severity=CRITICAL", headers=tokens["STAFF"]).json()] == [second["alert_id"]]
    assert [row["alert_id"] for row in api_request("/api/alerts?category=EQUIPMENT&status=ACTIVE", headers=tokens["STAFF"]).json()] == [first["alert_id"]]
    acknowledged = api_request(f"/api/alerts/{first['alert_id']}/acknowledge", "PATCH", headers=tokens["ADMIN"])
    assert acknowledged.status_code == 200
    body = acknowledged.json()
    assert body["status"] == "ACKNOWLEDGED" and body["acknowledged_at"] is not None
    assert body["acknowledged_by"]["role"] == "ADMIN"
    assert [row["alert_id"] for row in api_request("/api/alerts?status=ACKNOWLEDGED", headers=tokens["STAFF"]).json()] == [first["alert_id"]]
    again = api_request(f"/api/alerts/{first['alert_id']}/acknowledge", "PATCH", headers=tokens["ADMIN"])
    assert again.status_code == 200
    assert datetime.fromisoformat(again.json()["acknowledged_at"].replace("Z", "+00:00")) == datetime.fromisoformat(body["acknowledged_at"].replace("Z", "+00:00"))
    resolved = api_request(f"/api/alerts/{first['alert_id']}/resolve", "PATCH", headers=tokens["ADMIN"])
    assert resolved.status_code == 200
    resolved_body = resolved.json()
    assert resolved_body["status"] == "RESOLVED" and resolved_body["resolved_at"] is not None
    assert resolved_body["resolved_by"]["role"] == "ADMIN"
    persisted = api_request(f"/api/alerts/{first['alert_id']}", headers=tokens["STAFF"]).json()
    assert persisted["status"] == "RESOLVED"
    assert datetime.fromisoformat(persisted["acknowledged_at"].replace("Z", "+00:00")) == datetime.fromisoformat(body["acknowledged_at"].replace("Z", "+00:00"))
    assert datetime.fromisoformat(persisted["resolved_at"].replace("Z", "+00:00")) == datetime.fromisoformat(resolved_body["resolved_at"].replace("Z", "+00:00"))
    connection, _ = auth_db
    assert connection.scalar(select(Alert.resolved_at).where(Alert.alert_id == first["alert_id"])) is not None


def test_admin_creates_one_linked_maintenance_request(auth_db, tokens, api_request):
    alert = api_request("/api/alerts", "POST", headers=tokens["ADMIN"], json=alert_body()).json()
    created = api_request(f"/api/alerts/{alert['alert_id']}/maintenance-request", "POST", headers=tokens["ADMIN"], json=request_body())
    assert created.status_code == 201
    response = created.json()
    linked = response["maintenance_request"]
    assert linked["building"]["building_id"] == alert["building"]["building_id"]
    assert linked["equipment"]["equipment_id"] == alert["equipment"]["equipment_id"]
    assert linked["status"] == "PENDING" and linked["priority"] == "MEDIUM"
    detail = api_request(f"/api/requests/{linked['request_id']}", headers=tokens["ADMIN"])
    assert detail.status_code == 200 and detail.json()["submitted_by"]["role"] == "ADMIN"
    duplicate = api_request(f"/api/alerts/{alert['alert_id']}/maintenance-request", "POST", headers=tokens["ADMIN"], json=request_body())
    assert duplicate.status_code == 409 and duplicate.json() == {"detail": "A maintenance request is already linked to this alert"}
    connection, _ = auth_db
    assert connection.scalar(select(MaintenanceRequest.request_id).where(MaintenanceRequest.request_id == linked["request_id"])) == linked["request_id"]


@pytest.mark.parametrize("body,status,detail", [
    (alert_body(building_id=999999), 404, "Building not found"),
    (alert_body(equipment_id=999999), 404, "Equipment not found"),
    (alert_body(building_id=2, equipment_id=1), 400, "Equipment does not belong to the selected building"),
])
def test_alert_building_equipment_validation(auth_db, tokens, api_request, body, status, detail):
    response = api_request("/api/alerts", "POST", headers=tokens["ADMIN"], json=body)
    assert response.status_code == status and response.json() == {"detail": detail}


def test_staff_cannot_change_or_link_alerts(auth_db, tokens, api_request):
    assert api_request("/api/alerts", "POST", headers=tokens["STAFF"], json=alert_body()).status_code == 403
    created = api_request("/api/alerts", "POST", headers=tokens["ADMIN"], json=alert_body()).json()
    for method, path, body in [
        ("PATCH", f"/api/alerts/{created['alert_id']}/acknowledge", None),
        ("PATCH", f"/api/alerts/{created['alert_id']}/resolve", None),
        ("POST", f"/api/alerts/{created['alert_id']}/maintenance-request", request_body()),
    ]:
        response = api_request(path, method, headers=tokens["STAFF"], json=body)
        assert response.status_code == 403 and response.json() == {"detail": "Insufficient permissions"}


@pytest.mark.parametrize("path", ["/api/alerts?severity=INVALID", "/api/alerts?category=INVALID", "/api/alerts?status=INVALID", "/api/alerts/0"])
def test_alert_validation(auth_db, tokens, api_request, path):
    assert api_request(path, headers=tokens["STAFF"]).status_code == 422
