import pytest
from test_auth import auth_db, tokens

pytestmark = pytest.mark.database


@pytest.mark.parametrize("report_type", ["MAINTENANCE_REQUESTS", "EQUIPMENT_HEALTH", "ENERGY_SUSTAINABILITY", "COMFORT", "ALERTS_INCIDENTS", "SAFETY_SECURITY"])
def test_admin_reports_and_empty_filters(auth_db, tokens, api_request, report_type):
    response = api_request(f"/api/reports/{report_type}", headers=tokens["ADMIN"])
    assert response.status_code == 200
    body = response.json()
    assert body["report_type"] == report_type and body["columns"] and isinstance(body["rows"], list)
    filtered = api_request(f"/api/reports/{report_type}?building_id=999999", headers=tokens["ADMIN"])
    assert filtered.status_code == 200 and filtered.json()["rows"] == []


def test_staff_cannot_access_reports(auth_db, tokens, api_request):
    assert api_request("/api/reports/MAINTENANCE_REQUESTS", headers=tokens["STAFF"]).status_code == 403
