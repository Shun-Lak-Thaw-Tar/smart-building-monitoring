"""One high-level campus view composed from existing operational services."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Alert
from app.schemas.campus import CampusBuildingOverview, CampusOverviewResponse, CampusTotals
from app.services.comfort import building_comfort_summaries
from app.services.energy import building_energy_summaries
from app.services.monitoring import building_summaries


def campus_overview(session: Session) -> CampusOverviewResponse:
    monitoring = building_summaries(session)
    energy = {item["building"].building_id: item for item in building_energy_summaries(session)}
    comfort = {item["building"].building_id: item for item in building_comfort_summaries(session)}
    building_ids = [item.building.building_id for item in monitoring]
    alert_rows = session.execute(select(
        Alert.building_id,
        func.count().filter(Alert.status.in_(("ACTIVE", "ACKNOWLEDGED"))).label("active_alert_count"),
        func.count().filter(Alert.status.in_(("ACTIVE", "ACKNOWLEDGED")), Alert.severity == "CRITICAL").label("critical_alert_count"),
    ).where(Alert.building_id.in_(building_ids)).group_by(Alert.building_id)).mappings()
    alerts = {row["building_id"]: row for row in alert_rows}

    buildings = []
    for item in monitoring:
        building_id = item.building.building_id
        equipment, requests = item.equipment_summary, item.request_summary
        energy_item, comfort_item = energy.get(building_id, {}), comfort.get(building_id, {})
        alert_counts = alerts.get(building_id, {})
        buildings.append(CampusBuildingOverview(
            building=item.building,
            operational_status=item.overall_status,
            open_maintenance_requests=requests.pending + requests.in_progress,
            high_priority_open_requests=requests.unresolved_high_priority,
            equipment_attention_count=equipment.maintenance_required + equipment.out_of_service,
            active_alert_count=alert_counts.get("active_alert_count", 0),
            critical_alert_count=alert_counts.get("critical_alert_count", 0),
            energy_condition=energy_item.get("condition"),
            latest_energy_value=energy_item.get("latest_consumption"),
            comfort_condition=comfort_item.get("condition"),
            latest_temperature=comfort_item.get("latest_temperature"),
            latest_humidity=comfort_item.get("latest_humidity"),
        ))
    totals = CampusTotals(
        buildings=len(buildings),
        normal_buildings=sum(item.operational_status == "NORMAL" for item in buildings),
        attention_buildings=sum(item.operational_status == "ATTENTION" for item in buildings),
        critical_buildings=sum(item.operational_status == "CRITICAL" for item in buildings),
        open_maintenance_requests=sum(item.open_maintenance_requests for item in buildings),
        high_priority_open_requests=sum(item.high_priority_open_requests for item in buildings),
        equipment_attention_count=sum(item.equipment_attention_count for item in buildings),
        active_alert_count=sum(item.active_alert_count for item in buildings),
        critical_alert_count=sum(item.critical_alert_count for item in buildings),
        high_usage_buildings=sum(item.energy_condition == "HIGH_USAGE" for item in buildings),
        uncomfortable_buildings=sum(item.comfort_condition == "UNCOMFORTABLE" for item in buildings),
    )
    return CampusOverviewResponse(totals=totals, buildings=buildings)

