import secrets

import pytest
from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.models import User
from test_auth import auth_db, tokens

pytestmark = pytest.mark.database


def test_staff_listing_and_empty(auth_db, tokens, api_request):
    connection, _ = auth_db
    response = api_request("/api/users/staff", headers=tokens["ADMIN"])
    assert response.status_code == 200
    rows = response.json()
    expected = connection.scalars(select(User.name).where(User.role == "STAFF").order_by(User.name, User.user_id)).all()
    assert [row["name"] for row in rows] == expected
    assert all(set(row) == {"user_id", "name", "role"} and row["role"] == "STAFF" for row in rows)
    connection.execute(User.__table__.delete().where(User.role == "STAFF"))
    empty = api_request("/api/users/staff", headers=tokens["ADMIN"])
    assert empty.status_code == 200 and empty.json() == []


def test_creation_hash_and_login(auth_db, tokens, api_request):
    connection, _ = auth_db
    password = secrets.token_urlsafe(20) + " "  # Password whitespace must be preserved.
    response = api_request("/api/users/staff", "POST", headers=tokens["ADMIN"], json={"name": "  New Office Staff  ", "password": password})
    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"user_id", "name", "role"}
    assert body["role"] == "STAFF" and body["name"] == "New Office Staff"
    stored = connection.scalar(select(User.password_hash).where(User.user_id == body["user_id"]))
    assert stored.startswith("$argon2id$") and stored != password
    assert verify_password(password, stored)
    assert password not in response.text and stored not in response.text
    assert body in api_request("/api/users/staff", headers=tokens["ADMIN"]).json()
    for role, status in (("STAFF", 200), ("ADMIN", 401)):
        login = api_request("/api/auth/login", "POST", json={"name": body["name"], "password": password, "role": role})
        assert login.status_code == status


@pytest.mark.parametrize("name", ["__auth_staff__", "__auth_admin__"])
def test_duplicate_across_roles(auth_db, tokens, api_request, name):
    response = api_request("/api/users/staff", "POST", headers=tokens["ADMIN"], json={"name": " " + name + " ", "password": secrets.token_urlsafe(20)})
    assert response.status_code == 409
    assert response.json() == {"detail": "A user with this name already exists"}


@pytest.mark.parametrize("case", ["blank", "long_name", "short_password", "long_password", "role", "missing_name"])
def test_validation_never_echoes_password(auth_db, tokens, api_request, case):
    password = secrets.token_urlsafe(20)
    data = {"name": "New Test Staff", "password": password}
    if case == "blank": data["name"] = "   "
    if case == "long_name": data["name"] = "x" * 101
    if case == "short_password": data["password"] = password[:7]
    if case == "long_password": data["password"] = password * 40
    if case == "role": data["role"] = "ADMIN"
    if case == "missing_name": del data["name"]
    response = api_request("/api/users/staff", "POST", headers=tokens["ADMIN"], json=data)
    assert response.status_code == 422
    assert data["password"] not in response.text


@pytest.mark.parametrize("method", ["GET", "POST"])
def test_staff_and_unauthenticated_denied(auth_db, tokens, api_request, method):
    kwargs = {"json": {"name": "No access", "password": secrets.token_urlsafe(20)}} if method == "POST" else {}
    for headers, status, detail in ((tokens["STAFF"], 403, "Insufficient permissions"), ({}, 401, "Authentication required")):
        response = api_request("/api/users/staff", method, headers=headers, **kwargs)
        assert response.status_code == status and response.json() == {"detail": detail}


def test_unique_race_rollback(auth_db, tokens, api_request):
    connection, _ = auth_db
    name = "__concurrent_staff__"

    def simulate_race(session, flush_context, instances):
        # Insert after the application's precheck so the actual PostgreSQL UNIQUE
        # constraint rejects the pending ORM insert. Both writes roll back.
        for user in list(session.new):
            if isinstance(user, User) and user.name == name:
                session.connection().execute(User.__table__.insert().values(
                    user_id=-34999, name=name, role="STAFF", password_hash="!unusable-test-value"))

    event.listen(Session, "before_flush", simulate_race)
    try:
        response = api_request("/api/users/staff", "POST", headers=tokens["ADMIN"], json={"name": name, "password": secrets.token_urlsafe(20)})
    finally:
        event.remove(Session, "before_flush", simulate_race)
    assert response.status_code == 409
    assert response.json() == {"detail": "A user with this name already exists"}
    assert connection.scalar(select(User.user_id).where(User.name == name)) is None


def test_staff_openapi(api_request):
    operations = api_request("/openapi.json").json()["paths"]["/api/users/staff"]
    assert set(operations) == {"get", "post"}
    assert {"201", "401", "403", "409", "422"} <= set(operations["post"]["responses"])
    assert all(operation.get("security") for operation in operations.values())
