"""Regression coverage for PostgreSQL INTEGER identifiers at the API boundary."""
import pytest

from test_auth import ADMIN_ID, auth_db, tokens


pytestmark = pytest.mark.database

OVERSIZED_ID = "999999999999999999999"


@pytest.mark.parametrize("method, path, role, body", [
    ("GET", "/api/buildings/" + OVERSIZED_ID, "STAFF", None),
    ("GET", "/api/equipment/" + OVERSIZED_ID, "STAFF", None),
    ("PATCH", "/api/equipment/" + OVERSIZED_ID, "ADMIN", {"status": "OPERATIONAL"}),
    ("GET", "/api/equipment/" + OVERSIZED_ID + "/history", "ADMIN", None),
    ("GET", "/api/equipment/" + OVERSIZED_ID + "/intelligence", "STAFF", None),
    ("GET", "/api/environment/" + OVERSIZED_ID, "STAFF", None),
    ("GET", "/api/monitoring/buildings/" + OVERSIZED_ID, "STAFF", None),
    ("GET", "/api/requests/" + OVERSIZED_ID, "STAFF", None),
    ("GET", "/api/requests/" + OVERSIZED_ID + "/history", "STAFF", None),
    ("PATCH", "/api/requests/" + OVERSIZED_ID + "/assign", "ADMIN", {"assigned_to": ADMIN_ID}),
    ("PATCH", "/api/requests/" + OVERSIZED_ID + "/status", "ADMIN", {"status": "RESOLVED"}),
])
def test_oversized_path_ids_are_rejected(auth_db, tokens, api_request, method, path, role, body):
    assert api_request(path, method, headers=tokens[role], json=body).status_code == 422


@pytest.mark.parametrize("path", [
    "/api/equipment?building_id=" + OVERSIZED_ID,
    "/api/requests?building_id=" + OVERSIZED_ID,
    "/api/maintenance-history?building_id=" + OVERSIZED_ID,
    "/api/maintenance-history?equipment_id=" + OVERSIZED_ID,
])
def test_oversized_query_ids_are_rejected(auth_db, tokens, api_request, path):
    assert api_request(path, headers=tokens["ADMIN"]).status_code == 422


@pytest.mark.parametrize("path", ["/api/equipment/0", "/api/equipment/-1"])
def test_nonpositive_path_ids_are_rejected(auth_db, tokens, api_request, path):
    assert api_request(path, headers=tokens["STAFF"]).status_code == 422


def test_valid_range_ids_keep_existing_responses(auth_db, tokens, api_request):
    assert api_request("/api/equipment/1", headers=tokens["STAFF"]).status_code == 200
    assert api_request("/api/equipment/999999", headers=tokens["STAFF"]).status_code == 404


def test_oversized_body_ids_are_rejected(auth_db, tokens, api_request):
    request = {
        "building_id": int(OVERSIZED_ID), "equipment_id": 1,
        "room_location": "Room 210", "fault_category": "Equipment",
        "description": "Boundary validation", "priority": "MEDIUM",
    }
    assert api_request("/api/requests", "POST", headers=tokens["STAFF"], json=request).status_code == 422
    assert api_request("/api/requests", "POST", headers=tokens["STAFF"], json=request | {"building_id": 1, "equipment_id": int(OVERSIZED_ID)}).status_code == 422
    assert api_request("/api/equipment", "POST", headers=tokens["ADMIN"], json={
        "building_id": int(OVERSIZED_ID), "equipment_name": "Boundary device",
        "equipment_type": "Test", "location": "Room 210",
    }).status_code == 422
    assert api_request("/api/requests/1/assign", "PATCH", headers=tokens["ADMIN"],
                      json={"assigned_to": int(OVERSIZED_ID)}).status_code == 422
    assert api_request("/api/maintenance-history", "POST", headers=tokens["ADMIN"],
                      json={"equipment_id": int(OVERSIZED_ID), "action_details": "Boundary validation"}).status_code == 422
    assert api_request("/api/maintenance-history", "POST", headers=tokens["ADMIN"],
                      json={"equipment_id": 1, "request_id": int(OVERSIZED_ID), "action_details": "Boundary validation"}).status_code == 422
