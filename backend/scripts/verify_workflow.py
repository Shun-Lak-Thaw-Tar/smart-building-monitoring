"""Run live HTTP checks without printing credentials/tokens; remove only our own request.

Run from backend/: python scripts/verify_workflow.py --base-url http://127.0.0.1:8001
"""
import argparse
from pathlib import Path
import sys
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from sqlalchemy import delete, select

from app.core.config import settings
from app.db.session import get_engine
from app.models import MaintenanceRequest


def require(response, expected, label):
    if response.status_code != expected:
        raise RuntimeError(f"{label}: expected {expected}, received {response.status_code}")
    return response.json()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8001")
    args = parser.parse_args()
    marker = "Temporary HTTP verification " + uuid4().hex
    staff_id = None
    with httpx.Client(base_url=args.base_url, timeout=10) as client:
        require(client.get("/api/health"), 200, "Public health")
        require(client.get("/api/buildings"), 401, "Protected building collection")
        headers = {}
        for name, role, field in (("Demo Staff", "STAFF", "demo_staff_password"), ("Demo Admin", "ADMIN", "demo_admin_password")):
            login = require(client.post("/api/auth/login", json={
                "name": name, "password": getattr(settings, field), "role": role,
            }), 200, role + " login")
            headers[role] = {"Authorization": "Bearer " + login["access_token"]}
            me = require(client.get("/api/auth/me", headers=headers[role]), 200, role + " identity")
            assert me["role"] == role
            if role == "STAFF": staff_id = me["user_id"]
        require(client.post("/api/auth/login", json={"name": "Demo Staff", "password": settings.demo_staff_password, "role": "ADMIN"}), 401, "Wrong selected role")
        buildings = require(client.get("/api/buildings", headers=headers["STAFF"]), 200, "Buildings")
        equipment = require(client.get("/api/equipment", headers=headers["ADMIN"]), 200, "Equipment")
        overview = require(client.get("/api/environment", headers=headers["STAFF"]), 200, "Monitoring")
        assert (len(buildings), len(equipment), len(overview)) == (3, 9, 3)
        require(client.get("/api/requests/my", headers=headers["STAFF"]), 200, "Staff requests")
        require(client.get("/api/requests", headers=headers["ADMIN"]), 200, "Admin requests")
        admins = require(client.get("/api/users/admins", headers=headers["ADMIN"]), 200, "Admin lookup")
        try:
            record = require(client.post("/api/requests", headers=headers["STAFF"], json={
                "building_id": buildings[0]["building_id"], "room_location": "Verification",
                "fault_category": "Other", "description": marker, "priority": "LOW",
            }), 201, "Staff creation")
            request_id = record["request_id"]
            assert record["submitted_by"]["user_id"] == staff_id and record["status"] == "PENDING"
            require(client.patch(f"/api/requests/{request_id}/assign", headers=headers["ADMIN"], json={"assigned_to": admins[0]["user_id"]}), 200, "Assignment")
            require(client.patch(f"/api/requests/{request_id}/status", headers=headers["ADMIN"], json={"status": "IN_PROGRESS", "note": "Temporary verification"}), 200, "Status update")
            history = require(client.get(f"/api/requests/{request_id}/history", headers=headers["STAFF"]), 200, "History")
            assert [row["new_status"] for row in history] == ["PENDING", "IN_PROGRESS"]
            assert all("password_hash" not in str(value) for value in (record, history, admins))
        finally:
            # Unique marker + authenticated submitter limits cleanup to this run.
            with get_engine().begin() as connection:
                condition = (MaintenanceRequest.description == marker) & (MaintenanceRequest.submitted_by == staff_id)
                ids = connection.scalars(select(MaintenanceRequest.request_id).where(condition)).all()
                if len(ids) > 1:
                    raise RuntimeError("Unexpected verification matches; cleanup stopped.")
                connection.execute(delete(MaintenanceRequest).where(condition))
        print("Live HTTP checks passed: authentication, RBAC, 3 buildings, 9 equipment, 3 summaries, request creation, assignment, status, history.")
        print("Temporary verification request and timeline removed. No credentials or tokens displayed.")


if __name__ == "__main__":
    main()
