"""Live equipment/history/monitoring checks. Cleans only this run's marked records."""
import argparse
from pathlib import Path
import sys
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from sqlalchemy import delete, select

from app.core.config import settings
from app.db.session import get_engine
from app.models import Equipment, MaintenanceHistory


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8003")
    args = parser.parse_args()
    marker = "Temporary Batch 2 verification " + uuid4().hex
    with httpx.Client(base_url=args.base_url, timeout=10) as client:
        headers = {}
        for name, role, password in (("Demo Staff", "STAFF", settings.demo_staff_password), ("Demo Admin", "ADMIN", settings.demo_admin_password)):
            login = client.post("/api/auth/login", json={"name": name, "password": password, "role": role})
            assert login.status_code == 200
            headers[role] = {"Authorization": "Bearer " + login.json()["access_token"]}
        for path in ("/api/equipment", "/api/environment", "/api/monitoring/buildings"):
            assert client.get(path, headers=headers["STAFF"]).status_code == 200
        assert client.get("/api/maintenance-history", headers=headers["STAFF"]).status_code == 403
        assert client.get("/api/monitoring/buildings").status_code == 401
        buildings = client.get("/api/buildings", headers=headers["ADMIN"]).json()
        body = {"building_id": buildings[0]["building_id"], "equipment_name": marker, "equipment_type": "Test", "location": "Verification"}
        assert client.post("/api/equipment", headers=headers["STAFF"], json=body).status_code == 403
        try:
            response = client.post("/api/equipment", headers=headers["ADMIN"], json=body)
            assert response.status_code == 201 and response.json()["status"] == "OPERATIONAL"
            equipment_id = response.json()["equipment_id"]
            response = client.patch(f"/api/equipment/{equipment_id}", headers=headers["ADMIN"], json={"status": "MAINTENANCE_REQUIRED"})
            assert response.status_code == 200 and response.json()["status"] == "MAINTENANCE_REQUIRED"
            summaries = client.get("/api/monitoring/buildings", headers=headers["ADMIN"])
            assert summaries.status_code == 200 and len(summaries.json()) == 3
            building209 = next(row for row in summaries.json() if row["building"]["building_name"] == "Building 209")
            assert building209["overall_status"] == "CRITICAL"
            response = client.post("/api/maintenance-history", headers=headers["ADMIN"], json={"equipment_id": equipment_id, "action_details": marker})
            assert response.status_code == 201 and response.json()["request"] is None
            assert client.get("/api/maintenance-history", headers=headers["ADMIN"]).status_code == 200
            history = client.get(f"/api/equipment/{equipment_id}/history", headers=headers["ADMIN"])
            assert history.status_code == 200 and len(history.json()) == 1
            assert client.get(f"/api/equipment/{equipment_id}", headers=headers["ADMIN"]).json()["status"] == "MAINTENANCE_REQUIRED"
        finally:
            with get_engine().begin() as connection:
                ids = connection.scalars(select(Equipment.equipment_id).where(Equipment.equipment_name == marker)).all()
                if len(ids) > 1:
                    raise RuntimeError("Unexpected cleanup matches")
                for equipment_id in ids:
                    connection.execute(delete(MaintenanceHistory).where(MaintenanceHistory.equipment_id == equipment_id, MaintenanceHistory.action_details == marker))
                    connection.execute(delete(Equipment).where(Equipment.equipment_id == equipment_id, Equipment.equipment_name == marker))
    print("Live Batch 2 checks passed: equipment create/update, maintenance history, monitoring, and role restrictions.")
    print("Only temporary verification equipment/history removed. No credentials/tokens displayed.")


if __name__ == "__main__":
    main()
