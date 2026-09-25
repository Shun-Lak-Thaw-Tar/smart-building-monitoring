import pytest
from sqlalchemy import select
from app.models import Alert, SafetyEvent
from test_auth import auth_db, tokens

pytestmark = pytest.mark.database


def payload(**overrides):
    return {"building_id": 1, "section": "FIRE_SAFETY", "name": "North stair detector", "event_type": "SMOKE_DETECTOR", "status": "ALARM", "severity": "CRITICAL", "description": "Demonstration alarm."} | overrides


def test_admin_can_persist_simulated_event_and_create_one_alert(auth_db, tokens, api_request):
    created = api_request("/api/safety/events", "POST", headers=tokens["ADMIN"], json=payload())
    assert created.status_code == 201
    body = created.json()
    assert body["section"] == "FIRE_SAFETY" and body["status"] == "ALARM"
    listed = api_request("/api/safety/events?section=FIRE_SAFETY", headers=tokens["ADMIN"])
    assert listed.status_code == 200 and listed.json()[0]["event_id"] == body["event_id"]
    again = api_request("/api/safety/events", "POST", headers=tokens["ADMIN"], json=payload())
    assert again.status_code == 201
    connection, _ = auth_db
    assert len(connection.scalars(select(Alert).where(Alert.title == "[SIMULATION] North stair detector: SMOKE_DETECTOR")).all()) == 1
    assert len(connection.scalars(select(SafetyEvent)).all()) == 2


def test_staff_can_read_but_cannot_trigger_simulations(auth_db, tokens, api_request):
    assert api_request("/api/safety/events", "POST", headers=tokens["STAFF"], json=payload()).status_code == 403
    assert api_request("/api/safety/events", headers=tokens["STAFF"]).status_code == 200


def test_security_and_hazard_validation(auth_db, tokens, api_request):
    invalid = api_request("/api/safety/events", "POST", headers=tokens["ADMIN"], json=payload(section="SECURITY_ACCESS", status="ALARM"))
    assert invalid.status_code == 422
    campus_hazard = api_request("/api/safety/events", "POST", headers=tokens["ADMIN"], json=payload(building_id=None, section="HAZARD_ADVISORY", name="Campus weather advisory", event_type="SEVERE_WEATHER", status="ACTIVE", severity="WARNING"))
    assert campus_hazard.status_code == 201 and campus_hazard.json()["building"] is None
