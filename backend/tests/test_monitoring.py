from datetime import datetime, timezone

import pytest
from sqlalchemy import event, func, select

from app.models import Building, EnvironmentalReading, Equipment, MaintenanceRequest
from test_auth import auth_db, tokens

pytestmark = pytest.mark.database


@pytest.mark.parametrize("role", ["STAFF", "ADMIN"])
def test_monitoring_baseline(auth_db, tokens, api_request, role):
    connection, _ = auth_db
    response = api_request("/api/monitoring/buildings", headers=tokens[role])
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 3
    assert [row["building"]["building_id"] for row in rows] == [1, 2, 3]
    for row in rows:
        building_id = row["building"]["building_id"]
        assert row["equipment_summary"]["total"] == 3
        assert sum(row["equipment_summary"][key] for key in ("operational", "maintenance_required", "out_of_service")) == 3
        assert row["request_summary"]["total"] == connection.scalar(select(func.count()).select_from(MaintenanceRequest).where(MaintenanceRequest.building_id == building_id))
        assert datetime.fromisoformat(row["latest_environment"]["recorded_at"]) == connection.scalar(select(func.max(EnvironmentalReading.recorded_at)).where(EnvironmentalReading.building_id == building_id))
    assert rows[1]["overall_status"] == "CRITICAL"  # Out-of-service projector.
    assert api_request("/api/monitoring/buildings/1", headers=tokens[role]).json() == rows[0]
    missing = api_request("/api/monitoring/buildings/999999", headers=tokens[role])
    assert missing.status_code == 404 and missing.json() == {"detail": "Building not found"}
    assert api_request("/api/monitoring/buildings", headers={}).status_code == 401


@pytest.mark.parametrize("equipment_status,priority,request_status,expected", [
    ("OPERATIONAL", None, None, "NORMAL"),
    ("OUT_OF_SERVICE", None, None, "CRITICAL"),
    ("MAINTENANCE_REQUIRED", None, None, "ATTENTION"),
    ("OPERATIONAL", "HIGH", "PENDING", "CRITICAL"),
    ("OPERATIONAL", "HIGH", "IN_PROGRESS", "CRITICAL"),
    ("OPERATIONAL", "LOW", "PENDING", "ATTENTION"),
    ("OPERATIONAL", "MEDIUM", "IN_PROGRESS", "ATTENTION"),
    ("OPERATIONAL", "HIGH", "RESOLVED", "NORMAL"),
    ("MAINTENANCE_REQUIRED", "HIGH", "PENDING", "CRITICAL"),
    ("OUT_OF_SERVICE", "LOW", "PENDING", "CRITICAL"),
])
def test_derived_status_rules(auth_db, tokens, api_request, equipment_status, priority, request_status, expected):
    connection, _ = auth_db
    connection.execute(Building.__table__.insert().values(building_id=-36780, building_name="__monitoring_test__"))
    connection.execute(Equipment.__table__.insert().values(equipment_id=-36780, building_id=-36780,
        equipment_name="Test", equipment_type="Test", location="Test", status=equipment_status))
    if priority:
        connection.execute(MaintenanceRequest.__table__.insert().values(request_id=-36780, building_id=-36780,
            submitted_by=-34501, room_location="Test", fault_category="Test", description="Test", priority=priority, status=request_status))
    response = api_request("/api/monitoring/buildings/-36780", headers=tokens["STAFF"])
    assert response.status_code == 200
    row = response.json()
    assert row["overall_status"] == expected and row["latest_environment"] is None
    summary = row["request_summary"]
    assert summary["total"] == int(priority is not None)
    assert summary["unresolved_high_priority"] == int(priority == "HIGH" and request_status in ("PENDING", "IN_PROGRESS"))
    for state in ("pending", "in_progress", "resolved"):
        assert summary[state] == int(request_status == state.upper())
    # Display-only environmental data cannot change the computed status.
    for reading_id, year in ((-36780, 2020), (-36781, 2030), (-36782, 2030)):
        connection.execute(EnvironmentalReading.__table__.insert().values(reading_id=reading_id, building_id=-36780,
            temperature=99, humidity=100, energy_consumption=999, recorded_at=datetime(year, 1, 1, tzinfo=timezone.utc)))
    row = api_request("/api/monitoring/buildings/-36780", headers=tokens["STAFF"]).json()
    assert row["overall_status"] == expected and row["latest_environment"]["reading_id"] == -36781


def test_monitoring_fixed_query_count(auth_db, tokens, api_request):
    connection, _ = auth_db
    selects = []
    def count(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"): selects.append(statement)
    event.listen(connection, "before_cursor_execute", count)
    try:
        assert api_request("/api/monitoring/buildings", headers=tokens["ADMIN"]).status_code == 200
        original = len(selects)
        for index in range(4):
            connection.execute(Building.__table__.insert().values(building_id=-36800-index, building_name=f"__empty_monitor_{index}__"))
        selects.clear()
        response = api_request("/api/monitoring/buildings", headers=tokens["ADMIN"])
        assert response.status_code == 200 and len(response.json()) == 7
        assert len(selects) == original == 5  # Auth + four bounded resource queries.
        empty = next(row for row in response.json() if row["building"]["building_id"] == -36800)
        assert empty["overall_status"] == "NORMAL" and empty["equipment_summary"]["total"] == 0
    finally:
        event.remove(connection, "before_cursor_execute", count)
