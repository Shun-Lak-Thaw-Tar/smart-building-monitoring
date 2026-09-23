from datetime import datetime, timezone

import pytest
from sqlalchemy import func, select

from app.models import Alert, Building, EnvironmentalReading
from test_auth import auth_db, tokens

pytestmark = pytest.mark.database


def add_reading(connection, building_id, *, reading_id, temperature, humidity):
    connection.execute(EnvironmentalReading.__table__.insert().values(
        reading_id=reading_id, building_id=building_id, temperature=temperature,
        humidity=humidity, energy_consumption=100,
        recorded_at=datetime(2035, 1, 1, tzinfo=timezone.utc),
    ))


@pytest.mark.parametrize("role", ["STAFF", "ADMIN"])
def test_comfort_baseline_and_read_permissions(auth_db, tokens, api_request, role):
    response = api_request("/api/comfort/buildings", headers=tokens[role])
    assert response.status_code == 200
    rows = response.json()
    assert [row["building"]["building_id"] for row in rows] == [1, 2, 3]
    assert all(row["condition"] == "COMFORTABLE" for row in rows)
    for row in rows:
        assert row["latest_temperature"] is not None and row["latest_humidity"] is not None
        assert row["reason"] == "WITHIN_PREFERRED_RANGES"
        assert row["recommendation"] == "NO_ACTION_NEEDED"
        assert len(row["recent_readings"]) == 5
    assert api_request("/api/comfort/buildings", headers={}).status_code == 401


@pytest.mark.parametrize("temperature,humidity,condition,reason,recommendation", [
    (22, 50, "COMFORTABLE", "WITHIN_PREFERRED_RANGES", "NO_ACTION_NEEDED"),
    (19, 50, "ATTENTION", "TEMPERATURE_OUTSIDE_PREFERRED_RANGE", "ADJUST_TEMPERATURE"),
    (22, 65, "ATTENTION", "HUMIDITY_OUTSIDE_PREFERRED_RANGE", "ADJUST_HUMIDITY"),
    (29, 50, "UNCOMFORTABLE", "TEMPERATURE_OUTSIDE_ACCEPTABLE_RANGE", "ADJUST_TEMPERATURE"),
    (22, 72, "UNCOMFORTABLE", "HUMIDITY_OUTSIDE_ACCEPTABLE_RANGE", "ADJUST_HUMIDITY"),
])
def test_comfort_conditions(auth_db, tokens, api_request, temperature, humidity, condition, reason, recommendation):
    connection, _ = auth_db
    building_id = 2_000_000_150
    connection.execute(Building.__table__.insert().values(building_id=building_id, building_name="__comfort_rule__"))
    add_reading(connection, building_id, reading_id=2_000_000_150, temperature=temperature, humidity=humidity)
    row = next(item for item in api_request("/api/comfort/buildings", headers=tokens["ADMIN"]).json() if item["building"]["building_id"] == building_id)
    assert (row["condition"], row["reason"], row["recommendation"]) == (condition, reason, recommendation)


def test_uncomfortable_creates_deduplicated_comfort_alert(auth_db, tokens, api_request):
    connection, _ = auth_db
    building_id = 2_000_000_151
    connection.execute(Building.__table__.insert().values(building_id=building_id, building_name="__comfort_alert__"))
    add_reading(connection, building_id, reading_id=2_000_000_151, temperature=30, humidity=75)
    first = api_request("/api/comfort/buildings", headers=tokens["STAFF"])
    row = next(item for item in first.json() if item["building"]["building_id"] == building_id)
    assert row["condition"] == "UNCOMFORTABLE"
    alerts = connection.execute(select(Alert.status, Alert.severity).where(Alert.building_id == building_id, Alert.category == "COMFORT")).all()
    assert alerts == [("ACTIVE", "WARNING")]
    assert api_request("/api/comfort/buildings", headers=tokens["ADMIN"]).status_code == 200
    assert connection.scalar(select(func.count()).select_from(Alert).where(Alert.building_id == building_id, Alert.category == "COMFORT")) == 1


def test_comfort_no_data(auth_db, tokens, api_request):
    connection, _ = auth_db
    building_id = 2_000_000_152
    connection.execute(Building.__table__.insert().values(building_id=building_id, building_name="__comfort_empty__"))
    row = next(item for item in api_request("/api/comfort/buildings", headers=tokens["STAFF"]).json() if item["building"]["building_id"] == building_id)
    assert row == {
        "building": {"building_id": building_id, "building_name": "__comfort_empty__"},
        "latest_temperature": None, "latest_humidity": None, "condition": None,
        "reason": None, "recommendation": None, "timestamp": None, "recent_readings": [],
    }
