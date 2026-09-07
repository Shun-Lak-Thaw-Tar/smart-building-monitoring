"""Real PostgreSQL integration checks. Writes roll back after every test.

No real passwords or usable hashes are generated. Synthetic workflow rows exist
only inside rolled-back test transactions, never in the baseline seed.
"""
from pathlib import Path

import pytest
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import func, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, configure_mappers

from app.core.config import settings
from app.db.base import Base
from app.db.seed import BUILDINGS, seed_baseline
from app.db.session import get_engine
from app.models import (
    Building, Equipment, EnvironmentalReading, User, MaintenanceRequest,
    RequestStatusHistory, MaintenanceHistory,
)

pytestmark = pytest.mark.database


@pytest.fixture
def connection():
    if not settings.database_url:
        pytest.skip("Configure DATABASE_URL and apply migrations for PostgreSQL tests.")
    with get_engine().connect() as conn:
        assert conn.dialect.name == "postgresql"
        transaction = conn.begin()
        try:
            yield conn
        finally:
            transaction.rollback()


def test_schema_and_migration_head(connection):
    assert connection.scalar(text("SELECT 1")) == 1
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    assert MigrationContext.configure(connection).get_current_revision() == ScriptDirectory.from_config(config).get_current_head()
    inspector = inspect(connection)
    expected = {"users", "buildings", "equipment", "maintenance_requests",
                "request_status_history", "maintenance_history", "environmental_readings"}
    assert set(inspector.get_table_names(schema="public")) == expected | {"alembic_version"}
    configure_mappers()
    for name in expected:
        columns = {c["name"]: c for c in inspector.get_columns(name)}
        assert set(columns) == set(Base.metadata.tables[name].columns.keys())
        for column in Base.metadata.tables[name].columns:
            actual = columns[column.name]
            assert actual["nullable"] == column.nullable
            assert str(actual["type"].compile(dialect=connection.dialect)) == str(column.type.compile(dialect=connection.dialect))
            if column.primary_key:
                assert actual["identity"]
            if column.server_default is not None and not column.primary_key:
                assert actual["default"] is not None
    assert {tuple(c["column_names"]) for c in inspector.get_unique_constraints("users")} == {("name",)}
    assert {tuple(c["column_names"]) for c in inspector.get_unique_constraints("buildings")} == {("building_name",)}


def test_foreign_keys_indexes_and_checks(connection):
    inspector = inspect(connection)
    expected_fks = {
        ("equipment", "building_id"): ("buildings", "building_id", "RESTRICT"),
        ("environmental_readings", "building_id"): ("buildings", "building_id", "RESTRICT"),
        ("maintenance_requests", "building_id"): ("buildings", "building_id", "RESTRICT"),
        ("maintenance_requests", "submitted_by"): ("users", "user_id", "RESTRICT"),
        ("maintenance_requests", "assigned_to"): ("users", "user_id", "SET NULL"),
        ("maintenance_requests", "equipment_id"): ("equipment", "equipment_id", "SET NULL"),
        ("request_status_history", "request_id"): ("maintenance_requests", "request_id", "CASCADE"),
        ("request_status_history", "changed_by"): ("users", "user_id", "RESTRICT"),
        ("maintenance_history", "equipment_id"): ("equipment", "equipment_id", "RESTRICT"),
        ("maintenance_history", "request_id"): ("maintenance_requests", "request_id", "SET NULL"),
        ("maintenance_history", "completed_by"): ("users", "user_id", "RESTRICT"),
    }
    actual = {}
    for name in Base.metadata.tables:
        for fk in inspector.get_foreign_keys(name):
            actual[(name, fk["constrained_columns"][0])] = (
                fk["referred_table"], fk["referred_columns"][0], fk["options"]["ondelete"])
    assert actual == expected_fks
    expected_indexes = {
        "equipment": {("building_id",), ("status",)},
        "maintenance_requests": {(c,) for c in ("submitted_by", "building_id", "equipment_id", "assigned_to", "status", "priority", "created_at")},
        "request_status_history": {(c,) for c in ("request_id", "changed_by", "changed_at")},
        "maintenance_history": {(c,) for c in ("equipment_id", "request_id", "completed_by", "completed_at")},
        "environmental_readings": {("building_id", "recorded_at")},
    }
    for name, columns in expected_indexes.items():
        assert {tuple(i["column_names"]) for i in inspector.get_indexes(name)} == columns
    assert sum(len(inspector.get_check_constraints(name)) for name in Base.metadata.tables) == 8


@pytest.fixture
def workflow(connection):
    # Negative IDs avoid consuming application identity sequences for test fixtures.
    connection.execute(User.__table__.insert(), [
        dict(user_id=-33301, name="__schema_test_staff__", password_hash="!unusable-test-value", role="STAFF"),
        dict(user_id=-33302, name="__schema_test_admin__", password_hash="!unusable-test-value", role="ADMIN"),
    ])
    connection.execute(Building.__table__.insert().values(building_id=-33301, building_name="__schema_test_building__"))
    connection.execute(Equipment.__table__.insert().values(
        equipment_id=-33301, building_id=-33301, equipment_name="Test equipment",
        equipment_type="Test", location="Test", status="OPERATIONAL"))
    connection.execute(MaintenanceRequest.__table__.insert().values(
        request_id=-33301, submitted_by=-33301, assigned_to=-33302, building_id=-33301,
        equipment_id=-33301, room_location="Test", fault_category="Flexible future category",
        description="Temporary schema test", priority="LOW"))
    connection.execute(RequestStatusHistory.__table__.insert().values(
        status_history_id=-33301, request_id=-33301, changed_by=-33301,
        previous_status=None, new_status="PENDING"))
    connection.execute(MaintenanceHistory.__table__.insert().values(
        history_id=-33301, equipment_id=-33301, request_id=-33301, completed_by=-33301,
        action_details="Temporary schema test"))
    return connection


@pytest.mark.parametrize("table,column,value,constraint", [
    (User, "role", "INVALID", "ck_users_role"),
    (Equipment, "status", "INVALID", "ck_equipment_status"),
    (MaintenanceRequest, "priority", "INVALID", "ck_maintenance_requests_priority"),
    (MaintenanceRequest, "status", "INVALID", "ck_maintenance_requests_status"),
    (RequestStatusHistory, "previous_status", "INVALID", "ck_request_status_history_previous_status"),
    (RequestStatusHistory, "new_status", "INVALID", "ck_request_status_history_new_status"),
])
def test_invalid_workflow_values(workflow, table, column, value, constraint):
    with pytest.raises(IntegrityError) as error:
        with workflow.begin_nested():
            workflow.execute(table.__table__.update().values({column: value}))
    assert error.value.orig.sqlstate == "23514"
    assert error.value.orig.diag.constraint_name == constraint


@pytest.mark.parametrize("humidity,energy,valid", [(-1, 10, False), (101, 10, False),
    (50, -1, False), (0, 0, True), (100, 10, True)])
def test_environment_bounds(connection, humidity, energy, valid):
    building_id = connection.scalar(select(Building.building_id).limit(1))
    statement = EnvironmentalReading.__table__.insert().values(
        reading_id=-33301, building_id=building_id, temperature=23,
        humidity=humidity, energy_consumption=energy)
    if valid:
        connection.execute(statement)
    else:
        with pytest.raises(IntegrityError) as error:
            with connection.begin_nested():
                connection.execute(statement)
        assert error.value.orig.sqlstate == "23514"


@pytest.mark.parametrize("model,column", [(User, "name"), (Building, "building_name")])
def test_unique_names(workflow, model, column):
    table = model.__table__
    data = dict(workflow.execute(select(table).where(list(table.primary_key)[0] == -33301)).mappings().one())
    data[list(table.primary_key)[0].name] = -33303
    with pytest.raises(IntegrityError) as error:
        with workflow.begin_nested():
            workflow.execute(table.insert().values(data))
    assert error.value.orig.sqlstate == "23505"


def test_delete_behaviour_and_defaults(workflow):
    row = workflow.execute(select(MaintenanceRequest.__table__).where(MaintenanceRequest.request_id == -33301)).mappings().one()
    assert row["status"] == "PENDING"
    assert row["created_at"].tzinfo is not None
    assert row["updated_at"].tzinfo is not None
    for model, key in ((Building, Building.building_id), (User, User.user_id), (Equipment, Equipment.equipment_id)):
        with pytest.raises(IntegrityError) as error:
            with workflow.begin_nested():
                workflow.execute(model.__table__.delete().where(key == -33301))
        assert error.value.orig.sqlstate in {"23001", "23503"}
    workflow.execute(User.__table__.delete().where(User.user_id == -33302))
    assert workflow.scalar(select(MaintenanceRequest.assigned_to).where(MaintenanceRequest.request_id == -33301)) is None
    # Remove the temporary service record so equipment deletion is permitted.
    workflow.execute(MaintenanceHistory.__table__.delete().where(MaintenanceHistory.history_id == -33301))
    workflow.execute(Equipment.__table__.delete().where(Equipment.equipment_id == -33301))
    assert workflow.scalar(select(MaintenanceRequest.equipment_id).where(MaintenanceRequest.request_id == -33301)) is None
    workflow.execute(MaintenanceRequest.__table__.delete().where(MaintenanceRequest.request_id == -33301))
    assert workflow.scalar(select(func.count()).select_from(RequestStatusHistory).where(RequestStatusHistory.request_id == -33301)) == 0


def test_request_delete_preserves_service_history(workflow):
    workflow.execute(MaintenanceRequest.__table__.delete().where(MaintenanceRequest.request_id == -33301))
    assert workflow.scalar(select(MaintenanceHistory.request_id).where(MaintenanceHistory.history_id == -33301)) is None
    assert workflow.scalar(select(MaintenanceHistory.history_id).where(MaintenanceHistory.history_id == -33301)) == -33301


def test_seed_counts_and_idempotency(connection):
    with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
        before = {name: session.scalar(select(func.count()).select_from(table)) for name, table in Base.metadata.tables.items()}
        assert seed_baseline(session) == {"buildings": 0, "equipment": 0, "environmental_readings": 0}
        assert seed_baseline(session) == {"buildings": 0, "equipment": 0, "environmental_readings": 0}
        after = {name: session.scalar(select(func.count()).select_from(table)) for name, table in Base.metadata.tables.items()}
        assert before == after
        assert {name: after[name] for name in ("buildings", "equipment", "environmental_readings")} == {
            "buildings": 3, "equipment": 9, "environmental_readings": 15}
        assert after["maintenance_history"] == before["maintenance_history"]
        assert set(session.scalars(select(Building.building_name))) == set(BUILDINGS)
        assert session.scalar(select(func.count()).select_from(Equipment).join(Building)) == 9
        assert session.scalar(select(func.count()).select_from(EnvironmentalReading).join(Building)) == 15
        per_building = session.execute(select(EnvironmentalReading.building_id, func.count()).group_by(EnvironmentalReading.building_id)).all()
        assert len(per_building) == 3 and all(count == 5 for _, count in per_building)
