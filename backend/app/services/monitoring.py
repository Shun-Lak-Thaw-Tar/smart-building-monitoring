from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.models import Building, EnvironmentalReading, Equipment, MaintenanceRequest
from app.schemas.monitoring import BuildingMonitoringResponse, BuildingOverallStatus, EquipmentSummary, RequestSummary


def overall_status(equipment: EquipmentSummary, requests: RequestSummary) -> BuildingOverallStatus:
    if equipment.out_of_service or requests.unresolved_high_priority:
        return BuildingOverallStatus.CRITICAL
    if equipment.maintenance_required or requests.pending or requests.in_progress:
        return BuildingOverallStatus.ATTENTION
    return BuildingOverallStatus.NORMAL


def building_summaries(session: Session, building_id: int | None = None) -> list[BuildingMonitoringResponse]:
    statement = select(Building).order_by(Building.building_id)
    if building_id is not None:
        statement = statement.where(Building.building_id == building_id)
    buildings = session.scalars(statement).all()
    if not buildings:
        return []
    ids = [building.building_id for building in buildings]

    equipment_rows = session.execute(select(
        Equipment.building_id, func.count().label("total"),
        func.count().filter(Equipment.status == "OPERATIONAL").label("operational"),
        func.count().filter(Equipment.status == "MAINTENANCE_REQUIRED").label("maintenance_required"),
        func.count().filter(Equipment.status == "OUT_OF_SERVICE").label("out_of_service"),
    ).where(Equipment.building_id.in_(ids)).group_by(Equipment.building_id)).mappings()
    equipment_counts = {row["building_id"]: EquipmentSummary(**row) for row in equipment_rows}

    request_rows = session.execute(select(
        MaintenanceRequest.building_id, func.count().label("total"),
        func.count().filter(MaintenanceRequest.status == "PENDING").label("pending"),
        func.count().filter(MaintenanceRequest.status == "IN_PROGRESS").label("in_progress"),
        func.count().filter(MaintenanceRequest.status == "RESOLVED").label("resolved"),
        func.count().filter(and_(MaintenanceRequest.priority == "HIGH", MaintenanceRequest.status.in_(("PENDING", "IN_PROGRESS")))).label("unresolved_high_priority"),
    ).where(MaintenanceRequest.building_id.in_(ids)).group_by(MaintenanceRequest.building_id)).mappings()
    request_counts = {row["building_id"]: RequestSummary(**row) for row in request_rows}

    ranked = select(
        EnvironmentalReading.reading_id,
        func.row_number().over(partition_by=EnvironmentalReading.building_id,
                               order_by=(EnvironmentalReading.recorded_at.desc(), EnvironmentalReading.reading_id.desc())).label("position"),
    ).where(EnvironmentalReading.building_id.in_(ids)).subquery()
    latest = session.scalars(select(EnvironmentalReading).join(ranked, ranked.c.reading_id == EnvironmentalReading.reading_id)
                             .where(ranked.c.position == 1)).all()
    latest_by_building = {reading.building_id: reading for reading in latest}

    result = []
    for building in buildings:
        equipment = equipment_counts.get(building.building_id, EquipmentSummary())
        requests = request_counts.get(building.building_id, RequestSummary())
        result.append(BuildingMonitoringResponse(
            building=building, overall_status=overall_status(equipment, requests),
            latest_environment=latest_by_building.get(building.building_id),
            equipment_summary=equipment, request_summary=requests,
        ))
    return result
