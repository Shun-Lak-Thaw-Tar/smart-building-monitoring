import pytest

from app.models import Alert, Building, MaintenanceRequest
from test_auth import STAFF_ID, auth_db, tokens

pytestmark = pytest.mark.database


def test_admin_campus_overview_aggregates_existing_services(auth_db, tokens, api_request):
    connection, _ = auth_db
    connection.execute(MaintenanceRequest.__table__.insert(), [
        {"request_id": 2_000_000_160, "building_id": 1, "submitted_by": STAFF_ID, "room_location": "Test", "fault_category": "Test", "description": "Open high", "priority": "HIGH", "status": "PENDING"},
        {"request_id": 2_000_000_161, "building_id": 1, "submitted_by": STAFF_ID, "room_location": "Test", "fault_category": "Test", "description": "Open medium", "priority": "MEDIUM", "status": "IN_PROGRESS"},
    ])
    connection.execute(Alert.__table__.insert(), [
        {"alert_id": 2_000_000_160, "building_id": 1, "category": "EQUIPMENT", "severity": "CRITICAL", "title": "Critical", "description": "Critical active", "status": "ACTIVE"},
        {"alert_id": 2_000_000_161, "building_id": 1, "category": "COMFORT", "severity": "WARNING", "title": "Warning", "description": "Warning active", "status": "ACTIVE"},
        {"alert_id": 2_000_000_162, "building_id": 1, "category": "ENERGY", "severity": "WARNING", "title": "Resolved", "description": "Old alert", "status": "RESOLVED"},
    ])
    response = api_request("/api/campus/overview", headers=tokens["ADMIN"])
    assert response.status_code == 200
    body = response.json()
    assert [row["building"]["building_id"] for row in body["buildings"]] == [1, 2, 3]
    first = body["buildings"][0]
    assert first["operational_status"] == "CRITICAL"
    assert first["open_maintenance_requests"] == 2
    assert first["high_priority_open_requests"] == 1
    assert first["equipment_attention_count"] == 1
    assert first["active_alert_count"] == 2 and first["critical_alert_count"] == 1
    assert first["energy_condition"] == "NORMAL" and first["latest_energy_value"] is not None
    assert first["comfort_condition"] == "COMFORTABLE"
    assert first["latest_temperature"] is not None and first["latest_humidity"] is not None
    totals = body["totals"]
    assert totals["buildings"] == 3
    assert totals["open_maintenance_requests"] == 2
    assert totals["high_priority_open_requests"] == 1
    assert totals["active_alert_count"] == 2 and totals["critical_alert_count"] == 1


def test_campus_overview_includes_building_without_environmental_data(auth_db, tokens, api_request):
    connection, _ = auth_db
    building_id = 2_000_000_162
    connection.execute(Building.__table__.insert().values(building_id=building_id, building_name="__campus_empty__"))
    body = api_request("/api/campus/overview", headers=tokens["ADMIN"]).json()
    empty = next(row for row in body["buildings"] if row["building"]["building_id"] == building_id)
    assert empty == {
        "building": {"building_id": building_id, "building_name": "__campus_empty__"},
        "operational_status": "NORMAL", "open_maintenance_requests": 0,
        "high_priority_open_requests": 0, "equipment_attention_count": 0,
        "active_alert_count": 0, "critical_alert_count": 0,
        "energy_condition": None, "latest_energy_value": None,
        "comfort_condition": None, "latest_temperature": None, "latest_humidity": None,
    }


def test_campus_operations_is_admin_only(auth_db, tokens, api_request):
    staff = api_request("/api/campus/overview", headers=tokens["STAFF"])
    assert staff.status_code == 403 and staff.json() == {"detail": "Insufficient permissions"}
    anonymous = api_request("/api/campus/overview")
    assert anonymous.status_code == 401
