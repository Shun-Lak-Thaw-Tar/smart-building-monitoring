from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from app.models import Alert, Building, EnvironmentalReading
from test_auth import auth_db, tokens

pytestmark = pytest.mark.database


def add_readings(connection, building_id, values, *, start_id, start_time):
    for offset, value in enumerate(values):
        connection.execute(EnvironmentalReading.__table__.insert().values(
            reading_id=start_id + offset,
            building_id=building_id,
            temperature=22,
            humidity=45,
            energy_consumption=value,
            recorded_at=start_time + timedelta(hours=offset),
        ))


@pytest.mark.parametrize("role", ["STAFF", "ADMIN"])
def test_energy_baseline_calculation_and_read_permissions(auth_db, tokens, api_request, role):
    response = api_request("/api/energy/buildings", headers=tokens[role])
    assert response.status_code == 200
    overview = response.json()
    rows = overview["buildings"]
    assert overview["tariff_per_kwh"] == 0.2
    assert overview["emission_factor_kg_per_kwh"] == 0.45
    assert [row["building"]["building_id"] for row in rows] == [1, 2, 3]
    for row in rows:
        assert row["latest_consumption"] is not None
        assert row["recent_average"] is not None
        assert row["condition"] == "NORMAL"
        assert row["trend"] in {"UP", "DOWN", "STABLE"}
        assert len(row["recent_readings"]) == 5
        assert row["timestamp"] == row["recent_readings"][-1]["recorded_at"]
    assert api_request("/api/energy/buildings", headers={}).status_code == 401


def test_high_usage_calculation_comparison_and_deduplicated_alert(auth_db, tokens, api_request):
    connection, _ = auth_db
    building_id = 2_000_000_120
    connection.execute(Building.__table__.insert().values(building_id=building_id, building_name="__energy_high__"))
    add_readings(connection, building_id, [100, 100, 100, 100, 100, 130], start_id=2_000_000_120, start_time=datetime(2030, 1, 1, tzinfo=timezone.utc))
    first = api_request("/api/energy/buildings", headers=tokens["ADMIN"])
    assert first.status_code == 200
    overview = first.json()
    row = next(item for item in overview["buildings"] if item["building"]["building_id"] == building_id)
    assert row["latest_consumption"] == 130
    assert row["recent_average"] == 100
    assert row["percentage_difference"] == 30
    assert row["trend"] == "UP" and row["condition"] == "HIGH_USAGE"
    assert row["forecast_consumption"] == 136
    assert row["estimated_cost"] == 27.2 and row["estimated_carbon"] == 61.2
    assert overview["campus_totals"]["forecast_consumption"] >= 136
    assert [item["building"]["building_id"] for item in overview["buildings"]] == [1, 2, 3, building_id]
    alerts = connection.execute(select(Alert.status, Alert.severity).where(Alert.building_id == building_id, Alert.category == "ENERGY")).all()
    assert alerts == [("ACTIVE", "WARNING")]
    second = api_request("/api/energy/buildings", headers=tokens["STAFF"])
    assert second.status_code == 200
    assert connection.scalar(select(func.count()).select_from(Alert).where(Alert.building_id == building_id, Alert.category == "ENERGY")) == 1


def test_no_data_and_normal_return_behaviour(auth_db, tokens, api_request):
    connection, _ = auth_db
    empty_id, normal_id = 2_000_000_121, 2_000_000_122
    connection.execute(Building.__table__.insert(), [
        {"building_id": empty_id, "building_name": "__energy_empty__"},
        {"building_id": normal_id, "building_name": "__energy_normal__"},
    ])
    add_readings(connection, normal_id, [100, 100, 100, 100, 100, 115], start_id=2_000_000_130, start_time=datetime(2031, 1, 1, tzinfo=timezone.utc))
    rows = api_request("/api/energy/buildings", headers=tokens["STAFF"]).json()["buildings"]
    empty = next(item for item in rows if item["building"]["building_id"] == empty_id)
    normal = next(item for item in rows if item["building"]["building_id"] == normal_id)
    assert empty == {
        "building": {"building_id": empty_id, "building_name": "__energy_empty__"},
        "latest_consumption": None, "recent_average": None, "trend": "NO_DATA",
        "forecast_consumption": None, "estimated_cost": None, "estimated_carbon": None,
        "percentage_difference": None, "condition": None, "timestamp": None, "recent_readings": [],
    }
    assert normal["condition"] == "NORMAL" and normal["percentage_difference"] == 15
    assert connection.scalar(select(func.count()).select_from(Alert).where(Alert.building_id == normal_id, Alert.category == "ENERGY")) == 0
