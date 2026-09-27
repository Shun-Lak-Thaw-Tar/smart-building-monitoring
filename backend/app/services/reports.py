"""Read-only operational report adapters over existing application services."""
from datetime import date, datetime, time, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import Alert, MaintenanceRequest, SafetyEvent
from app.services.comfort import building_comfort_summaries
from app.services.energy import building_energy_overview
from app.services.equipment_intelligence import equipment_intelligence
from app.services.requests import request_query


def _date_bounds(start_date: date | None, end_date: date | None):
    start = datetime.combine(start_date, time.min, timezone.utc) if start_date else None
    end = datetime.combine(end_date, time.max, timezone.utc) if end_date else None
    return start, end


def _iso(value):
    return value.isoformat() if value else ""


def _resolved_at(request: MaintenanceRequest):
    resolved = [entry.changed_at for entry in request.status_history if entry.new_status == "RESOLVED"]
    return max(resolved) if resolved else None


def operational_report(session: Session, report_type: str, building_id: int | None = None, status: str | None = None, category: str | None = None, severity: str | None = None, health_band: str | None = None, event_type: str | None = None, start_date: date | None = None, end_date: date | None = None) -> dict:
    start, end = _date_bounds(start_date, end_date)
    if report_type == "MAINTENANCE_REQUESTS":
        statement = request_query()
        if building_id: statement = statement.where(MaintenanceRequest.building_id == building_id)
        if status: statement = statement.where(MaintenanceRequest.status == status)
        if category: statement = statement.where(MaintenanceRequest.fault_category == category)
        if start: statement = statement.where(MaintenanceRequest.created_at >= start)
        if end: statement = statement.where(MaintenanceRequest.created_at <= end)
        requests = session.scalars(statement.order_by(MaintenanceRequest.created_at.desc(), MaintenanceRequest.request_id.desc())).all()
        rows = [{"Request ID": item.request_id, "Building": item.building.building_name, "Room": f"{item.room.room_number} · {item.room.room_name}" if item.room else item.room_location, "Equipment": item.equipment.equipment_name if item.equipment else "", "Category": item.fault_category, "Priority": item.priority, "Status": item.status, "Submitted By": item.submitter.name, "Assigned To": item.assignee.name if item.assignee else "", "Created": _iso(item.created_at), "Resolved": _iso(_resolved_at(item))} for item in requests]
        return {"columns": list(rows[0]) if rows else ["Request ID", "Building", "Room", "Equipment", "Category", "Priority", "Status", "Submitted By", "Assigned To", "Created", "Resolved"], "rows": rows, "summary": {"total": len(rows), "open": sum(item.status != "RESOLVED" for item in requests)}}
    if report_type == "EQUIPMENT_HEALTH":
        data = equipment_intelligence(session)
        if building_id: data = [item for item in data if item.equipment.building.building_id == building_id]
        if status: data = [item for item in data if item.equipment.status.value == status]
        if health_band: data = [item for item in data if item.health_band.value == health_band]
        rows = [{"Equipment": item.equipment.equipment_name, "Type": item.equipment.equipment_type, "Building": item.equipment.building.building_name, "Room": f"{item.equipment.room.room_number} · {item.equipment.room.room_name}" if item.equipment.room else "", "Status": item.equipment.status.value, "Health Score": item.score, "Health Band": item.health_band.value, "Key Risk / Reason": "; ".join(reason.code for reason in item.reasons), "Open Requests": item.open_request_count} for item in data]
        return {"columns": list(rows[0]) if rows else ["Equipment", "Type", "Building", "Room", "Status", "Health Score", "Health Band", "Key Risk / Reason", "Open Requests"], "rows": rows, "summary": {"total": len(rows), "high_risk": sum(item.health_band.value == "HIGH_RISK" for item in data)}}
    if report_type == "ENERGY_SUSTAINABILITY":
        data = building_energy_overview(session)["buildings"]
        if building_id: data = [item for item in data if item["building"].building_id == building_id]
        if status: data = [item for item in data if item["condition"] == status]
        rows = [{"Building": item["building"].building_name, "Latest Usage": float(item["latest_consumption"]) if item["latest_consumption"] is not None else None, "Trend": item["trend"], "Forecast": float(item["forecast_consumption"]) if item["forecast_consumption"] is not None else None, "Estimated Cost": float(item["estimated_cost"]) if item["estimated_cost"] is not None else None, "Estimated Carbon": float(item["estimated_carbon"]) if item["estimated_carbon"] is not None else None, "Condition": item["condition"] or "NO_DATA"} for item in data]
        return {"columns": list(rows[0]) if rows else ["Building", "Latest Usage", "Trend", "Forecast", "Estimated Cost", "Estimated Carbon", "Condition"], "rows": rows, "summary": {"total": len(rows), "high_usage": sum(item["condition"] == "HIGH_USAGE" for item in data)}}
    if report_type == "COMFORT":
        data = building_comfort_summaries(session)
        if building_id: data = [item for item in data if item["building"].building_id == building_id]
        if status: data = [item for item in data if item["condition"] == status]
        rows = [{"Building": item["building"].building_name, "Temperature": float(item["latest_temperature"]) if item["latest_temperature"] is not None else None, "Humidity": float(item["latest_humidity"]) if item["latest_humidity"] is not None else None, "Comfort Status": item["condition"] or "NO_DATA", "Reason": item["reason"] or "", "Recommendation": item["recommendation"] or ""} for item in data]
        return {"columns": list(rows[0]) if rows else ["Building", "Temperature", "Humidity", "Comfort Status", "Reason", "Recommendation"], "rows": rows, "summary": {"total": len(rows), "uncomfortable": sum(item["condition"] == "UNCOMFORTABLE" for item in data)}}
    if report_type == "ALERTS_INCIDENTS":
        statement = select(Alert).options(joinedload(Alert.building), joinedload(Alert.equipment))
        if building_id: statement = statement.where(Alert.building_id == building_id)
        if status: statement = statement.where(Alert.status == status)
        if category: statement = statement.where(Alert.category == category)
        if severity: statement = statement.where(Alert.severity == severity)
        if start: statement = statement.where(Alert.created_at >= start)
        if end: statement = statement.where(Alert.created_at <= end)
        data = session.scalars(statement.order_by(Alert.created_at.desc(), Alert.alert_id.desc())).all()
        rows = [{"Alert ID": item.alert_id, "Category": item.category, "Severity": item.severity, "Status": item.status, "Building": item.building.building_name, "Room": f"{item.equipment.room.room_number} · {item.equipment.room.room_name}" if item.equipment and item.equipment.room else "", "Equipment": item.equipment.equipment_name if item.equipment else "", "Message / Source": f"{item.title} — {item.description}", "Created": _iso(item.created_at), "Acknowledged": _iso(item.acknowledged_at), "Resolved": _iso(item.resolved_at)} for item in data]
        return {"columns": list(rows[0]) if rows else ["Alert ID", "Category", "Severity", "Status", "Building", "Room", "Equipment", "Message / Source", "Created", "Acknowledged", "Resolved"], "rows": rows, "summary": {"total": len(rows), "active": sum(item.status != "RESOLVED" for item in data)}}
    statement = select(SafetyEvent).options(joinedload(SafetyEvent.building))
    if building_id: statement = statement.where(SafetyEvent.building_id == building_id)
    if status: statement = statement.where(SafetyEvent.status == status)
    if category: statement = statement.where(SafetyEvent.section == category)
    if severity: statement = statement.where(SafetyEvent.severity == severity)
    if event_type: statement = statement.where(SafetyEvent.event_type == event_type)
    if start: statement = statement.where(SafetyEvent.occurred_at >= start)
    if end: statement = statement.where(SafetyEvent.occurred_at <= end)
    data = session.scalars(statement.order_by(SafetyEvent.occurred_at.desc(), SafetyEvent.event_id.desc())).all()
    rows = [{"Event Type": item.event_type, "Building / Area": item.building.building_name if item.building else "Campus-wide", "Severity": item.severity, "Status": item.status, "Description": item.description or item.name, "Created": _iso(item.occurred_at), "Context": "SIMULATION / DEMONSTRATION MODE"} for item in data]
    return {"columns": list(rows[0]) if rows else ["Event Type", "Building / Area", "Severity", "Status", "Description", "Created", "Context"], "rows": rows, "summary": {"total": len(rows), "serious": sum(item.status in {"ALARM", "FORCED_ENTRY"} or item.severity == "CRITICAL" for item in data)}}
