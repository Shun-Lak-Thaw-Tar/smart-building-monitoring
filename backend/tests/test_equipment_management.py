import pytest
from sqlalchemy import event

from test_auth import auth_db, tokens

pytestmark = pytest.mark.database


@pytest.fixture
def equipment_body():
    return {"building_id": 1, "equipment_name": " Test AC ", "equipment_type": " HVAC ", "location": " Room 200 "}


def test_equipment_create_patch_noop(auth_db, tokens, api_request, equipment_body):
    response = api_request("/api/equipment", "POST", headers=tokens["ADMIN"], json=equipment_body)
    assert response.status_code == 201
    record = response.json()
    assert record["status"] == "OPERATIONAL" and record["building"]["building_id"] == 1
    assert (record["equipment_name"], record["equipment_type"], record["location"]) == ("Test AC", "HVAC", "Room 200")
    path = f"/api/equipment/{record['equipment_id']}"
    for data in ({"status": "MAINTENANCE_REQUIRED"}, {"equipment_name": " Renamed ", "location": " New room ", "equipment_type": "AV", "status": "OUT_OF_SERVICE"}):
        updated = api_request(path, "PATCH", headers=tokens["ADMIN"], json=data)
        assert updated.status_code == 200
        assert all(updated.json()[key] == value.strip() for key, value in data.items())
    connection, _ = auth_db
    updates = []
    def count(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("UPDATE"): updates.append(statement)
    event.listen(connection, "before_cursor_execute", count)
    try:
        same = api_request(path, "PATCH", headers=tokens["ADMIN"], json={"status": "OUT_OF_SERVICE"})
        assert same.json() == updated.json() and not updates
    finally:
        event.remove(connection, "before_cursor_execute", count)
    assert api_request("/api/equipment", "POST", headers=tokens["ADMIN"], json=equipment_body | {"status": "OUT_OF_SERVICE"}).status_code == 201


@pytest.mark.parametrize("change", [{"equipment_name": " "}, {"equipment_type": " "}, {"location": " "},
    {"equipment_name": "x" * 151}, {"equipment_type": "x" * 101}, {"location": "x" * 151}, {"status": "INVALID"}, {"unknown": 1}])
def test_create_validation(auth_db, tokens, api_request, equipment_body, change):
    assert api_request("/api/equipment", "POST", headers=tokens["ADMIN"], json=equipment_body | change).status_code == 422


@pytest.mark.parametrize("data", [{}, {"building_id": 2}, {"status": None}, {"location": " "}, {"status": "INVALID"}])
def test_patch_validation(auth_db, tokens, api_request, data):
    assert api_request("/api/equipment/1", "PATCH", headers=tokens["ADMIN"], json=data).status_code == 422


def test_equipment_permissions_and_missing(auth_db, tokens, api_request, equipment_body):
    for method, path, data in (("POST", "/api/equipment", equipment_body), ("PATCH", "/api/equipment/1", {"status": "OPERATIONAL"})):
        assert api_request(path, method, headers=tokens["STAFF"], json=data).status_code == 403
        assert api_request(path, method, headers={}, json=data).status_code == 401
    response = api_request("/api/equipment", "POST", headers=tokens["ADMIN"], json=equipment_body | {"building_id": 999999})
    assert response.status_code == 404 and response.json() == {"detail": "Building not found"}
    response = api_request("/api/equipment/999999", "PATCH", headers=tokens["ADMIN"], json={"status": "OPERATIONAL"})
    assert response.status_code == 404 and response.json() == {"detail": "Equipment not found"}


def test_admin_created_equipment_is_fresh_for_staff_requests(auth_db, tokens, api_request, equipment_body):
    """A prior Staff read must not hide equipment subsequently created by Admin."""
    path = "/api/equipment?building_id=1"
    before = api_request(path, headers=tokens["STAFF"])
    assert before.status_code == 200
    existing_ids = {item["equipment_id"] for item in before.json()}

    created = api_request("/api/equipment", "POST", headers=tokens["ADMIN"], json=equipment_body)
    assert created.status_code == 201
    equipment_id = created.json()["equipment_id"]
    current = api_request(path, headers=tokens["STAFF"])
    assert current.status_code == 200
    assert {item["equipment_id"] for item in current.json()} == existing_ids | {equipment_id}
    assert all(item["building"]["building_id"] == 1 for item in current.json())
    other = api_request("/api/equipment?building_id=2", headers=tokens["STAFF"])
    assert other.status_code == 200
    assert equipment_id not in {item["equipment_id"] for item in other.json()}

    assert api_request("/api/equipment", "POST", headers=tokens["STAFF"], json=equipment_body).status_code == 403
    assert api_request(f"/api/equipment/{equipment_id}", "PATCH", headers=tokens["STAFF"], json={"status": "OUT_OF_SERVICE"}).status_code == 403
    body = {"building_id": 1, "equipment_id": equipment_id, "room_location": "Room 210",
            "fault_category": "Equipment", "description": "Check the newly added sensor", "priority": "MEDIUM"}
    submitted = api_request("/api/requests", "POST", headers=tokens["STAFF"], json=body)
    assert submitted.status_code == 201
    assert submitted.json()["equipment"]["equipment_id"] == equipment_id
    mismatch = api_request("/api/requests", "POST", headers=tokens["STAFF"], json=body | {"building_id": 2})
    assert mismatch.status_code == 400
    assert mismatch.json()["detail"] == "Equipment does not belong to the selected building"
    general = api_request("/api/requests", "POST", headers=tokens["STAFF"], json=body | {"equipment_id": None})
    assert general.status_code == 201 and general.json()["equipment"] is None
