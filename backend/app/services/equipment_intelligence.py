from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import Equipment, MaintenanceHistory, MaintenanceRequest
from app.schemas.equipment import EquipmentResponse
from app.schemas.equipment_intelligence import EquipmentIntelligenceResponse, HealthBand, HealthReason, MaintenanceContext

RECENT_DAYS = 90
REQUEST_PENALTIES = {"HIGH": 30, "MEDIUM": 15, "LOW": 7}


def assistant_suggestions(equipment: Equipment, recent_faults: Counter[str], recent_maintenance: list[MaintenanceHistory]) -> list[str]:
    equipment_type = equipment.equipment_type.casefold()
    if "hvac" in equipment_type or "air condition" in equipment_type:
        suggestions = ["CHECK_POWER_AND_THERMOSTAT", "INSPECT_AIRFLOW_AND_FILTER"]
    elif "av" in equipment_type or "projector" in equipment_type:
        suggestions = ["CHECK_POWER_AND_CABLES", "TEST_DISPLAY_INPUT"]
    elif "electrical" in equipment_type:
        suggestions = ["CHECK_CIRCUIT_AND_CONTROLS"]
    elif "lift" in equipment_type:
        suggestions = ["CHECK_CONTROLLER_AND_SAFETY_SYSTEMS"]
    elif "plumb" in equipment_type or "pump" in equipment_type:
        suggestions = ["CHECK_PUMP_AND_CONNECTIONS"]
    else:
        suggestions = ["INSPECT_POWER_AND_CONNECTIONS"]
    if equipment.status == "OUT_OF_SERVICE":
        suggestions.append("KEEP_OUT_OF_SERVICE_UNTIL_INSPECTED")
    elif equipment.status == "MAINTENANCE_REQUIRED":
        suggestions.append("SCHEDULE_TECHNICIAN_INSPECTION")
    if any(count >= 2 for count in recent_faults.values()):
        suggestions.append("REVIEW_REPEATED_FAULT_PATTERN")
    if recent_maintenance:
        suggestions.append("REVIEW_RECENT_MAINTENANCE_CONTEXT")
    return suggestions


def equipment_intelligence(session: Session, equipment_id: int | None = None) -> list[EquipmentIntelligenceResponse]:
    statement = select(Equipment).options(joinedload(Equipment.building), joinedload(Equipment.room))
    if equipment_id is not None:
        statement = statement.where(Equipment.equipment_id == equipment_id)
    equipment_items = session.scalars(statement.order_by(Equipment.building_id, Equipment.equipment_name, Equipment.equipment_id)).all()
    if not equipment_items:
        return []
    ids = [item.equipment_id for item in equipment_items]
    now = datetime.now(timezone.utc)
    recent_since = now - timedelta(days=RECENT_DAYS)
    requests = session.scalars(select(MaintenanceRequest).where(MaintenanceRequest.equipment_id.in_(ids))).all()
    histories = session.scalars(select(MaintenanceHistory).where(
        MaintenanceHistory.equipment_id.in_(ids), MaintenanceHistory.completed_at >= recent_since,
    ).order_by(MaintenanceHistory.completed_at.desc(), MaintenanceHistory.history_id.desc())).all()
    requests_by_equipment = defaultdict(list)
    recent_faults = defaultdict(Counter)
    for request in requests:
        requests_by_equipment[request.equipment_id].append(request)
        if request.created_at >= recent_since:
            recent_faults[request.equipment_id][request.fault_category] += 1
    histories_by_equipment = defaultdict(list)
    for history in histories:
        histories_by_equipment[history.equipment_id].append(history)

    results = []
    for equipment in equipment_items:
        score, reasons = 100, []
        if equipment.status == "OUT_OF_SERVICE":
            score -= 50
            reasons.append(HealthReason(code="STATUS_OUT_OF_SERVICE"))
        elif equipment.status == "MAINTENANCE_REQUIRED":
            score -= 25
            reasons.append(HealthReason(code="STATUS_MAINTENANCE_REQUIRED"))
        open_requests = [item for item in requests_by_equipment[equipment.equipment_id] if item.status != "RESOLVED"]
        priority_counts = Counter(item.priority for item in open_requests)
        for priority, penalty in REQUEST_PENALTIES.items():
            count = priority_counts[priority]
            if count:
                score -= penalty * count
                reasons.append(HealthReason(code=f"OPEN_{priority}_PRIORITY_REQUESTS", count=count))
        recent = histories_by_equipment[equipment.equipment_id]
        if recent:
            score -= min(15, len(recent) * 5)
            reasons.append(HealthReason(code="RECENT_MAINTENANCE", count=len(recent)))
        repeated = sum(count >= 2 for count in recent_faults[equipment.equipment_id].values())
        if repeated:
            score -= min(20, repeated * 10)
            reasons.append(HealthReason(code="REPEATED_RECENT_FAULTS", count=repeated))
        score = max(0, score)
        if not reasons:
            reasons.append(HealthReason(code="HEALTHY_NO_CURRENT_CONCERNS"))
        band = HealthBand.HEALTHY if score >= 80 else HealthBand.ATTENTION if score >= 50 else HealthBand.HIGH_RISK
        results.append(EquipmentIntelligenceResponse(
            equipment=EquipmentResponse.model_validate(equipment), score=score, health_band=band, reasons=reasons,
            open_request_count=len(open_requests), high_priority_open_request_count=priority_counts["HIGH"],
            recent_maintenance=[MaintenanceContext(history_id=item.history_id, action_details=item.action_details, completed_at=item.completed_at) for item in recent[:3]],
            suggestions=assistant_suggestions(equipment, recent_faults[equipment.equipment_id], recent),
        ))
    return results
