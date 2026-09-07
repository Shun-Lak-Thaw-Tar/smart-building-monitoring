import secrets
from datetime import datetime, timedelta, timezone
import jwt

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.seed_demo import seed_users
from app.db.session import get_engine, get_session
from app.main import app
from app.models import MaintenanceRequest, RequestStatusHistory, User

pytestmark = pytest.mark.database


class AuthContext(tuple):
    def __repr__(self):
        return "<PostgreSQL auth context; temporary password redacted>"


class TokenHeaders(dict):
    def __repr__(self):
        return "<temporary Bearer headers redacted>"


@pytest.fixture
def auth_db(monkeypatch):
    if not settings.database_url:
        pytest.skip("PostgreSQL configuration required")
    monkeypatch.setattr(settings, "jwt_secret", secrets.token_urlsafe(48))
    password = secrets.token_urlsafe(24)
    with get_engine().connect() as connection:
        transaction = connection.begin()
        # Isolate request tests from any persisted demo workflow, then roll back.
        connection.execute(RequestStatusHistory.__table__.delete())
        connection.execute(MaintenanceRequest.__table__.delete())
        connection.execute(User.__table__.insert(), [
            dict(user_id=-34501, name="__auth_staff__", role="STAFF", password_hash=hash_password(password)),
            dict(user_id=-34502, name="__auth_admin__", role="ADMIN", password_hash=hash_password(password)),
            dict(user_id=-34503, name="__auth_other_staff__", role="STAFF", password_hash=hash_password(password)),
        ])

        def override():
            with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
                yield session
        app.dependency_overrides[get_session] = override
        try:
            yield AuthContext((connection, password))
        finally:
            app.dependency_overrides.pop(get_session)
            transaction.rollback()


@pytest.mark.parametrize("role", ["STAFF", "ADMIN"])
def test_valid_login(auth_db, api_request, role):
    connection, password = auth_db
    response = api_request("/api/auth/login", "POST", json={"name": f"__auth_{role.lower()}__", "password": password, "role": role})
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["role"] == role and body["token_type"] == "bearer"
    assert body["expires_in"] == settings.jwt_expire_minutes * 60
    assert set(body["user"]) == {"user_id", "name", "role"}
    stored = connection.scalar(select(User.password_hash).where(User.name == body["user"]["name"]))
    assert stored.startswith("$argon2id$") and stored != password
    assert stored not in response.text and password not in response.text


@pytest.mark.parametrize("case", ["unknown", "password", "role"])
def test_generic_login_failure(auth_db, api_request, case):
    _, password = auth_db
    body = {"name": "__auth_staff__", "password": password, "role": "STAFF"}
    body[{"unknown": "name", "password": "password", "role": "role"}[case]] = "ADMIN" if case == "role" else secrets.token_urlsafe(16)
    response = api_request("/api/auth/login", "POST", json=body)
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid login credentials or role"}
    assert response.headers["www-authenticate"] == "Bearer"


def test_invalid_login_role(auth_db, api_request):
    response = api_request("/api/auth/login", "POST", json={"name": "test", "password": secrets.token_urlsafe(16), "role": "INVALID"})
    assert response.status_code == 422


def test_user_seed_validation_and_idempotency(auth_db, monkeypatch):
    connection, _ = auth_db
    with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
        monkeypatch.setattr(settings, "demo_staff_password", "CHANGE_ME")
        with pytest.raises(RuntimeError, match="DEMO_STAFF_PASSWORD"):
            seed_users(session)
        for field in ("demo_staff_password", "demo_admin_password", "demo_maintenance_admin_password"):
            monkeypatch.setattr(settings, field, secrets.token_urlsafe(24))
        users, added = seed_users(session)
        assert len(users) == 3
        assert seed_users(session)[1] == 0
        assert all(user.password_hash.startswith("$argon2id$") for user in users.values())


@pytest.fixture
def tokens(auth_db):
    connection, _ = auth_db
    with Session(bind=connection) as session:
        return TokenHeaders({role: {"Authorization": "Bearer " + create_access_token(session.get(User, user_id))}
                for role, user_id in (("STAFF", -34501), ("ADMIN", -34502), ("OTHER", -34503))})


@pytest.mark.parametrize("role", ["STAFF", "ADMIN"])
def test_me_and_existing_reads(auth_db, tokens, api_request, role):
    response = api_request("/api/auth/me", headers=tokens[role])
    assert response.status_code == 200 and response.json()["role"] == role
    for path in ("/api/buildings", "/api/buildings/1", "/api/equipment", "/api/equipment/1", "/api/environment", "/api/environment/1"):
        assert api_request(path, headers=tokens[role]).status_code == 200
        missing = api_request(path, headers={})
        assert missing.status_code == 401 and missing.json() == {"detail": "Authentication required"}
        assert missing.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize("case", ["malformed", "expired", "signature", "missing_user", "missing_claim", "huge_subject"])
def test_invalid_tokens(auth_db, api_request, case):
    now = datetime.now(timezone.utc)
    claims = {"sub": "-34501", "name": "test", "role": "STAFF", "iat": now, "exp": now + timedelta(minutes=5)}
    if case == "expired":
        claims["iat"], claims["exp"] = now - timedelta(hours=2), now - timedelta(hours=1)
    if case == "missing_user": claims["sub"] = "-39999"
    if case == "huge_subject": claims["sub"] = "9" * 100
    if case == "missing_claim": del claims["exp"]
    token = jwt.encode(claims, secrets.token_urlsafe(48) if case == "signature" else settings.jwt_secret, algorithm="HS256")
    if case == "malformed": token = "invalid"
    response = api_request("/api/auth/me", headers={"Authorization": "Bearer " + token})
    assert response.status_code == 401 and response.json() == {"detail": "Invalid or expired token"}
    assert response.headers["www-authenticate"] == "Bearer"


def test_admin_lookup_and_database_role_authority(auth_db, tokens, api_request):
    response = api_request("/api/users/admins", headers=tokens["ADMIN"])
    assert response.status_code == 200
    rows = response.json()
    assert all(set(row) == {"user_id", "name", "role"} and row["role"] == "ADMIN" for row in rows)
    connection, _ = auth_db
    expected = connection.scalars(select(User.name).where(User.role == "ADMIN").order_by(User.name, User.user_id)).all()
    assert [r["name"] for r in rows] == expected  # Respect PostgreSQL's configured collation.
    assert api_request("/api/users/admins", headers=tokens["STAFF"]).status_code == 403
    connection, _ = auth_db
    connection.execute(User.__table__.update().where(User.user_id == -34502).values(role="STAFF"))
    assert api_request("/api/users/admins", headers=tokens["ADMIN"]).status_code == 403
