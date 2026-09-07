"""Live staff-account verification; only this run's temporary account is removed."""
import argparse
from pathlib import Path
import secrets
import sys
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from sqlalchemy import delete, select

from app.core.config import settings
from app.db.session import get_engine
from app.models import User


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8002")
    args = parser.parse_args()
    name = "Temporary staff verification " + uuid4().hex
    password = secrets.token_urlsafe(24)
    with httpx.Client(base_url=args.base_url, timeout=10) as client:
        login = client.post("/api/auth/login", json={"name": "Demo Admin", "password": settings.demo_admin_password, "role": "ADMIN"})
        assert login.status_code == 200
        admin = {"Authorization": "Bearer " + login.json()["access_token"]}
        assert client.get("/api/users/staff", headers=admin).status_code == 200
        try:
            response = client.post("/api/users/staff", headers=admin, json={"name": name, "password": password})
            assert response.status_code == 201
            user = response.json()
            assert set(user) == {"user_id", "name", "role"} and user["role"] == "STAFF"
            assert user in client.get("/api/users/staff", headers=admin).json()
            staff_login = client.post("/api/auth/login", json={"name": name, "password": password, "role": "STAFF"})
            assert staff_login.status_code == 200
            staff = {"Authorization": "Bearer " + staff_login.json()["access_token"]}
            assert client.get("/api/users/staff", headers=staff).status_code == 403
            assert client.post("/api/users/staff", headers=staff, json={"name": name, "password": password}).status_code == 403
            assert client.post("/api/auth/login", json={"name": name, "password": password, "role": "ADMIN"}).status_code == 401
        finally:
            with get_engine().begin() as connection:
                condition = (User.name == name) & (User.role == "STAFF")
                ids = connection.scalars(select(User.user_id).where(condition)).all()
                if len(ids) > 1:
                    raise RuntimeError("Unexpected cleanup matches")
                connection.execute(delete(User).where(condition))
    print("Live staff-account checks passed. Temporary account removed; no credentials or tokens displayed.")


if __name__ == "__main__":
    main()
