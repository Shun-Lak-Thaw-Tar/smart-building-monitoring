from datetime import datetime, timezone

import pytest

from app.models import Equipment, MaintenanceHistory, MaintenanceRequest
from test_auth import ADMIN_ID, STAFF_ID, auth_db, tokens

pytestmark = pytest.mark.database


def test_equipment_intelligence_healthy_and_staff_admin_read_access(auth_db, tokens, api_request):
    for role in ("STAFF", "ADMIN"):
        listed = api_request("/api/equipment/intelligence", headers=tokens[role])
        assert listed.status_code == 200 and len(listed.json()) == 9
        healthy = next(item for item in listed.json() if item["equipment"]["equipment_id"] == 1)
        assert healthy["score"] == 100 and healthy["health_band"] == "HEALTHY"
        assert healthy["reasons"] == [{"code": "HEALTHY_NO_CURRENT_CONCERNS", "count": None}]
        assert healthy["open_request_count"] == healthy["high_priority_open_request_count"] == 0
        assert "CHECK_POWER_AND_THERMOSTAT" in healthy["suggestions"]
        detail = api_request("/api/equipment/1/intelligence", headers=tokens[role])
        assert detail.status_code == 200 and detail.json() == healthy
    assert api_request("/api/equipment/intelligence", headers={}).status_code == 401


def test_equipment_intelligence_status_requests_history_and_repeated_faults(auth_db, tokens, api_request):
    connection, _ = auth_db
    connection.execute(Equipment.__table__.update().where(Equipment.equipment_id == 1).values(status="OUT_OF_SERVICE"))
    connection.execute(MaintenanceRequest.__table__.insert(), [
        {"request_id": 2_000_000_500, "submitted_by": STAFF_ID, "building_id": 1, "equipment_id": 1,
         "room_location": "Room 201", "fault_category": "Cooling", "description": "High priority cooling fault", "priority": "HIGH", "status": "PENDING"},
        {"request_id": 2_000_000_501, "submitted_by": STAFF_ID, "building_id": 1, "equipment_id": 1,
         "room_location": "Room 201", "fault_category": "Cooling", "description": "Repeated cooling fault", "priority": "LOW", "status": "IN_PROGRESS"},
    ])
    connection.execute(MaintenanceHistory.__table__.insert().values(
        history_id=2_000_000_500, equipment_id=1, request_id=None, completed_by=ADMIN_ID,
        action_details="Recent cooling inspection", completed_at=datetime.now(timezone.utc),
    ))
    body = api_request("/api/equipment/1/intelligence", headers=tokens["ADMIN"]).json()
    assert body["score"] == 0 and body["health_band"] == "HIGH_RISK"
    assert body["open_request_count"] == 2 and body["high_priority_open_request_count"] == 1
    assert {item["code"] for item in body["reasons"]} == {
        "STATUS_OUT_OF_SERVICE", "OPEN_HIGH_PRIORITY_REQUESTS", "OPEN_LOW_PRIORITY_REQUESTS",
        "RECENT_MAINTENANCE", "REPEATED_RECENT_FAULTS",
    }
    assert body["recent_maintenance"][0]["action_details"] == "Recent cooling inspection"
    assert "KEEP_OUT_OF_SERVICE_UNTIL_INSPECTED" in body["suggestions"]
    assert "REVIEW_REPEATED_FAULT_PATTERN" in body["suggestions"]


def test_equipment_intelligence_attention_and_no_data_case(auth_db, tokens, api_request):
    attention = api_request("/api/equipment/2/intelligence", headers=tokens["ADMIN"]).json()
    assert attention["score"] == 75 and attention["health_band"] == "ATTENTION"
    assert attention["reasons"] == [{"code": "STATUS_MAINTENANCE_REQUIRED", "count": None}]
    created = api_request("/api/equipment", "POST", headers=tokens["ADMIN"], json={
        "building_id": 1, "equipment_name": "No data device", "equipment_type": "Custom", "location": "Room 202",
    })
    assert created.status_code == 201
    empty = api_request(f"/api/equipment/{created.json()['equipment_id']}/intelligence", headers=tokens["STAFF"]).json()
    assert empty["score"] == 100 and empty["health_band"] == "HEALTHY"
    assert empty["recent_maintenance"] == [] and empty["open_request_count"] == 0
    assert empty["suggestions"] == ["INSPECT_POWER_AND_CONNECTIONS"]
    missing = api_request("/api/equipment/999999/intelligence", headers=tokens["ADMIN"])
    assert missing.status_code == 404 and missing.json() == {"detail": "Equipment not found"}
