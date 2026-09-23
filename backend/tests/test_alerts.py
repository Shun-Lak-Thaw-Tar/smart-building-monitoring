from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.models import Alert
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


def test_admin_create_and_staff_admin_read_alerts(auth_db, tokens, api_request):
    created = api_request("/api/alerts", "POST", headers=tokens["ADMIN"], json=alert_body())
    assert created.status_code == 201
    body = created.json()
    assert body["title"] == "Air conditioning attention needed"
    assert body["description"] == "Check the cooling unit before the next class."
    assert body["status"] == "ACTIVE" and body["resolved_at"] is None
    assert body["building"]["building_id"] == 1 and body["equipment"]["equipment_id"] == 1
    assert datetime.fromisoformat(body["created_at"].replace("Z", "+00:00")).tzinfo is not None
    for role in ("STAFF", "ADMIN"):
        listed = api_request("/api/alerts", headers=tokens[role])
        assert listed.status_code == 200 and [row["alert_id"] for row in listed.json()] == [body["alert_id"]]
        detail = api_request(f"/api/alerts/{body['alert_id']}", headers=tokens[role])
        assert detail.status_code == 200 and detail.json() == body


def test_alert_filters_and_resolution_persistence(auth_db, tokens, api_request):
    first = api_request("/api/alerts", "POST", headers=tokens["ADMIN"], json=alert_body()).json()
    second = api_request("/api/alerts", "POST", headers=tokens["ADMIN"], json=alert_body(
        equipment_id=None, category="ENERGY", severity="CRITICAL", title="Energy consumption spike",
    )).json()
    assert [row["alert_id"] for row in api_request("/api/alerts?severity=CRITICAL", headers=tokens["STAFF"]).json()] == [second["alert_id"]]
    assert [row["alert_id"] for row in api_request("/api/alerts?category=EQUIPMENT&status=ACTIVE", headers=tokens["STAFF"]).json()] == [first["alert_id"]]
    resolved = api_request(f"/api/alerts/{first['alert_id']}/resolve", "PATCH", headers=tokens["ADMIN"])
    assert resolved.status_code == 200
    body = resolved.json()
    assert body["status"] == "RESOLVED" and body["resolved_at"] is not None
    persisted = api_request(f"/api/alerts/{first['alert_id']}", headers=tokens["STAFF"])
    assert persisted.json()["status"] == "RESOLVED"
    assert datetime.fromisoformat(persisted.json()["resolved_at"].replace("Z", "+00:00")) == datetime.fromisoformat(body["resolved_at"].replace("Z", "+00:00"))
    again = api_request(f"/api/alerts/{first['alert_id']}/resolve", "PATCH", headers=tokens["ADMIN"])
    assert again.status_code == 200
    assert datetime.fromisoformat(again.json()["resolved_at"].replace("Z", "+00:00")) == datetime.fromisoformat(body["resolved_at"].replace("Z", "+00:00"))
    connection, _ = auth_db
    assert connection.scalar(select(Alert.resolved_at).where(Alert.alert_id == first["alert_id"])) is not None


@pytest.mark.parametrize("body,status,detail", [
    (alert_body(building_id=999999), 404, "Building not found"),
    (alert_body(equipment_id=999999), 404, "Equipment not found"),
    (alert_body(building_id=2, equipment_id=1), 400, "Equipment does not belong to the selected building"),
])
def test_alert_building_equipment_validation(auth_db, tokens, api_request, body, status, detail):
    response = api_request("/api/alerts", "POST", headers=tokens["ADMIN"], json=body)
    assert response.status_code == status and response.json() == {"detail": detail}


def test_staff_cannot_create_or_resolve_alerts(auth_db, tokens, api_request):
    assert api_request("/api/alerts", "POST", headers=tokens["STAFF"], json=alert_body()).status_code == 403
    created = api_request("/api/alerts", "POST", headers=tokens["ADMIN"], json=alert_body()).json()
    response = api_request(f"/api/alerts/{created['alert_id']}/resolve", "PATCH", headers=tokens["STAFF"])
    assert response.status_code == 403 and response.json() == {"detail": "Insufficient permissions"}


@pytest.mark.parametrize("path", ["/api/alerts?severity=INVALID", "/api/alerts?category=INVALID", "/api/alerts?status=INVALID", "/api/alerts/0"])
def test_alert_validation(auth_db, tokens, api_request, path):
    assert api_request(path, headers=tokens["STAFF"]).status_code == 422
