import socket

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.exc import InterfaceError, OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.core.dependencies import get_current_user
from app.main import app
from app.models import User


@pytest.fixture(autouse=True)
def authenticated_for_resource_error_tests():
    # Isolate existing resource failure handling; auth has its own PostgreSQL tests.
    app.dependency_overrides[get_current_user] = lambda: User(user_id=-1, name="test", role="STAFF")
    yield
    app.dependency_overrides.pop(get_current_user)


@pytest.fixture
def override_dependency():
    def override(dependency):
        app.dependency_overrides[get_session] = dependency
    yield override
    app.dependency_overrides.pop(get_session, None)


@pytest.mark.parametrize("error_class", [OperationalError, InterfaceError])
def test_connection_error_is_sanitized(api_request, override_dependency, caplog, error_class):
    def unavailable():
        raise error_class("SELECT private_table", {}, Exception("private-driver-detail"))
        yield

    override_dependency(unavailable)
    response = api_request("/api/buildings")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database service unavailable"}
    assert "private-driver-detail" not in response.text + caplog.text
    assert "private_table" not in response.text + caplog.text
    assert "Database connectivity failure" in caplog.text
    assert api_request("/api/health").status_code == 200


def test_real_psycopg_connection_refusal(api_request, override_dependency):
    # Reserve a non-listening local port, leaving the real PostgreSQL service alone.
    with socket.socket() as reserved:
        reserved.bind(("127.0.0.1", 0))
        url = URL.create("postgresql+psycopg", host="127.0.0.1", port=reserved.getsockname()[1], database="smart_building")
        engine = create_engine(url, connect_args={"connect_timeout": 1}, hide_parameters=True)

        def unavailable():
            with Session(engine) as session:
                yield session

        override_dependency(unavailable)
        try:
            response = api_request("/api/buildings")
            assert response.status_code == 503
            assert response.json() == {"detail": "Database service unavailable"}
        finally:
            engine.dispose()


@pytest.mark.parametrize("error", [
    RuntimeError("private-application-detail"),
    ProgrammingError("SELECT private_table", {}, Exception("private-application-detail")),
])
def test_application_bugs_remain_500(api_request, override_dependency, error):
    def broken():
        raise error
        yield

    override_dependency(broken)
    response = api_request("/api/buildings")
    assert response.status_code == 500
    assert "private-application-detail" not in response.text


def test_openapi_and_read_only_routes(api_request):
    schema = api_request("/openapi.json").json()
    resources = {"/api/buildings", "/api/buildings/{building_id}", "/api/equipment",
                 "/api/equipment/{equipment_id}", "/api/environment", "/api/environment/{building_id}"}
    assert resources | {"/api/health", "/api/auth/login", "/api/auth/me", "/api/users/admins"} <= set(schema["paths"])
    assert set(schema["paths"]) == resources | {
        "/api/health", "/api/auth/login", "/api/auth/me", "/api/users/admins",
        "/api/users/staff",
        "/api/maintenance-history", "/api/equipment/{equipment_id}/history",
        "/api/monitoring/buildings", "/api/monitoring/buildings/{building_id}",
        "/api/requests", "/api/requests/my", "/api/requests/{request_id}",
        "/api/requests/{request_id}/assign", "/api/requests/{request_id}/status", "/api/requests/{request_id}/history",
    }
    for path, methods in schema["paths"].items():
        for method, operation in methods.items():
            if path in {"/api/auth/login", "/api/health"}:
                assert not operation.get("security")
            else:
                assert operation.get("security")
    for path in resources:
        expected_methods = {"get", "post"} if path == "/api/equipment" else {"get", "patch"} if path == "/api/equipment/{equipment_id}" else {"get"}
        assert set(schema["paths"][path]) == expected_methods
        operation = schema["paths"][path]["get"]
        assert operation["summary"]
        assert "200" in operation["responses"] and "503" in operation["responses"]
        if "{" in path:
            assert "404" in operation["responses"]
    assert schema["components"]["schemas"]["EquipmentStatus"]["enum"] == [
        "OPERATIONAL", "MAINTENANCE_REQUIRED", "OUT_OF_SERVICE"]
    reading = schema["components"]["schemas"]["EnvironmentalReadingResponse"]["properties"]
    assert all(reading[field]["type"] == "number" for field in ("temperature", "humidity", "energy_consumption"))
    assert api_request("/api/equipment/1", method="DELETE").status_code == 405
