from datetime import datetime, timezone
import secrets

import pytest
from sqlalchemy import event, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import get_engine, get_session
from app.main import app
from app.models import Building, Equipment, EnvironmentalReading, MaintenanceRequest, RequestStatusHistory, User

pytestmark = pytest.mark.database


@pytest.fixture
def api_db(api_headers, monkeypatch):
    if not settings.database_url:
        pytest.skip("Configure DATABASE_URL and migrate/seed PostgreSQL for API tests.")
    with get_engine().connect() as connection:
        transaction = connection.begin()
        monkeypatch.setattr(settings, "jwt_secret", secrets.token_urlsafe(48))
        user = User(user_id=-34590, name="__read_api_staff__", role="STAFF", password_hash="!test-only-unusable")
        connection.execute(User.__table__.insert().values(user_id=user.user_id, name=user.name, role=user.role, password_hash=user.password_hash))
        api_headers["Authorization"] = "Bearer " + create_access_token(user)

        def session_override():
            with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
                yield session

        app.dependency_overrides[get_session] = session_override
        try:
            yield connection
        finally:
            app.dependency_overrides.pop(get_session)
            transaction.rollback()


def test_buildings(api_db, api_request):
    response = api_request("/api/buildings")
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 3
    assert [r["building_id"] for r in rows] == sorted(r["building_id"] for r in rows)
    assert {r["building_name"] for r in rows} == {"Building 216", "Building 209", "JS Building"}
    assert set(rows[0]) == {"building_id", "building_name", "description"}
    detail = api_request(f"/api/buildings/{rows[0]['building_id']}")
    assert detail.status_code == 200 and detail.json() == rows[0]


def test_equipment_and_filter(api_db, api_request):
    response = api_request("/api/equipment")
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 9
    order = [(r["building"]["building_id"], r["equipment_name"]) for r in rows]
    assert order == sorted(order)
    for row in rows:
        assert set(row) == {"equipment_id", "equipment_name", "equipment_type", "location", "status", "created_at", "building"}
        assert set(row["building"]) == {"building_id", "building_name"}
        expected = api_db.scalar(select(Building.building_name).where(Building.building_id == row["building"]["building_id"]))
        assert row["building"]["building_name"] == expected
        assert datetime.fromisoformat(row["created_at"]).tzinfo is not None
    building_id = rows[0]["building"]["building_id"]
    filtered = api_request(f"/api/equipment?building_id={building_id}")
    assert filtered.status_code == 200
    assert len(filtered.json()) == 3
    assert all(r["building"]["building_id"] == building_id for r in filtered.json())
    empty = api_request("/api/equipment?building_id=999")
    assert empty.status_code == 200 and empty.json() == []
    detail = api_request(f"/api/equipment/{rows[0]['equipment_id']}")
    assert detail.status_code == 200 and detail.json() == rows[0]


@pytest.mark.parametrize("path,message", [
    ("/api/buildings/999", "Building not found"),
    ("/api/equipment/999", "Equipment not found"),
    ("/api/environment/999", "Building not found"),
])
def test_missing_resource(api_db, api_request, path, message):
    response = api_request(path)
    assert response.status_code == 404
    assert response.json() == {"detail": message}


@pytest.mark.parametrize("path", [
    "/api/buildings/abc", "/api/equipment/abc", "/api/environment/abc",
    "/api/equipment?building_id=abc", "/api/environment/1?limit=0",
    "/api/environment/1?limit=101", "/api/environment/1?limit=abc",
])
def test_validation(api_db, api_request, path):
    response = api_request(path)
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], list)


def test_environment_overview_and_history(api_db, api_request):
    response = api_request("/api/environment")
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 3
    ids = [row["building"]["building_id"] for row in rows]
    assert ids == sorted(set(ids))
    for row in rows:
        assert set(row) == {"building", "reading"}
        reading = row["reading"]
        assert set(reading) == {"reading_id", "temperature", "humidity", "energy_consumption", "recorded_at"}
        assert all(isinstance(reading[field], (int, float)) for field in ("temperature", "humidity", "energy_consumption"))
        latest = api_db.scalar(select(func.max(EnvironmentalReading.recorded_at)).where(
            EnvironmentalReading.building_id == row["building"]["building_id"]))
        assert datetime.fromisoformat(reading["recorded_at"]) == latest
    building_id = ids[0]
    history = api_request(f"/api/environment/{building_id}")
    assert history.status_code == 200
    assert history.json()["building"] == rows[0]["building"]
    readings = history.json()["readings"]
    assert len(readings) == 5
    timestamps = [datetime.fromisoformat(row["recorded_at"]) for row in readings]
    assert timestamps == sorted(timestamps, reverse=True)
    limited = api_request(f"/api/environment/{building_id}?limit=2")
    assert limited.status_code == 200 and limited.json()["readings"] == readings[:2]
    for limit in (1, 100):
        assert api_request(f"/api/environment/{building_id}?limit={limit}").status_code == 200


def test_timestamp_latest_and_ties(api_db, api_request):
    building_id = api_db.scalar(select(Building.building_id).order_by(Building.building_id))
    # Lower ID has the newer timestamp. Both IDs are negative and rolled back.
    for reading_id, year in ((-33330, 2030), (-33329, 2020), (-33331, 2030)):
        api_db.execute(EnvironmentalReading.__table__.insert().values(
            reading_id=reading_id, building_id=building_id, temperature=22, humidity=45,
            energy_consumption=120, recorded_at=datetime(year, 1, 1, tzinfo=timezone.utc),
        ))
    overview = api_request("/api/environment").json()
    result = next(row for row in overview if row["building"]["building_id"] == building_id)
    assert result["reading"]["reading_id"] == -33330
    history = api_request(f"/api/environment/{building_id}?limit=2").json()["readings"]
    assert [r["reading_id"] for r in history] == [-33330, -33331]


def test_default_history_limit(api_db, api_request):
    building_id = api_db.scalar(select(Building.building_id).limit(1))
    for sample in range(7):
        api_db.execute(EnvironmentalReading.__table__.insert().values(
            reading_id=-33400 - sample, building_id=building_id,
            temperature=22, humidity=45, energy_consumption=120,
            recorded_at=datetime(2020, 1, sample + 1, tzinfo=timezone.utc),
        ))
    assert len(api_request(f"/api/environment/{building_id}").json()["readings"]) == 10


def test_building_without_readings(api_db, api_request):
    api_db.execute(Building.__table__.insert().values(building_id=-33330, building_name="__api_empty_building__"))
    response = api_request("/api/environment/-33330")
    assert response.status_code == 200
    assert response.json() == {"building": {"building_id": -33330, "building_name": "__api_empty_building__"}, "readings": []}
    assert all(row["building"]["building_id"] != -33330 for row in api_request("/api/environment").json())


def test_empty_collections(api_db, api_request):
    # Only the existing demo tables are touched, entirely inside this rollback transaction.
    api_db.execute(RequestStatusHistory.__table__.delete())
    api_db.execute(MaintenanceRequest.__table__.delete())
    api_db.execute(EnvironmentalReading.__table__.delete())
    api_db.execute(Equipment.__table__.delete())
    api_db.execute(Building.__table__.delete())
    for path in ("/api/buildings", "/api/equipment", "/api/environment"):
        response = api_request(path)
        assert response.status_code == 200 and response.json() == []


@pytest.mark.parametrize("path", ["/api/equipment", "/api/environment"])
def test_single_select_for_nested_collections(api_db, api_request, path):
    selects = []

    def record(connection, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            selects.append(statement)

    event.listen(api_db, "before_cursor_execute", record)
    try:
        assert api_request(path).status_code == 200
        assert len(selects) == 2  # One current-user lookup plus one resource SELECT.
    finally:
        event.remove(api_db, "before_cursor_execute", record)
