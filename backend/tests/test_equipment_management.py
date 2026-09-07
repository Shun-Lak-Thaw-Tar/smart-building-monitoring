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
