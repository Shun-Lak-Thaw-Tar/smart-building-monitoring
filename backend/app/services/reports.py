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


def operational_report(session: Session, report_type: str, building_id: int | None = None, status: str | None = None, category: str | None = None, start_date: date | None = None, end_date: date | None = None) -> dict:
    start, end = _date_bounds(start_date, end_date)
    if report_type == "MAINTENANCE_REQUESTS":
        statement = request_query()
        if building_id: statement = statement.where(MaintenanceRequest.building_id == building_id)
        if status: statement = statement.where(MaintenanceRequest.status == status)
        if start: statement = statement.where(MaintenanceRequest.created_at >= start)
        if end: statement = statement.where(MaintenanceRequest.created_at <= end)
        requests = session.scalars(statement.order_by(MaintenanceRequest.created_at.desc(), MaintenanceRequest.request_id.desc())).all()
        rows = [{"Request ID": item.request_id, "Building": item.building.building_name, "Equipment": item.equipment.equipment_name if item.equipment else "", "Status": item.status, "Priority": item.priority, "Category": item.fault_category, "Created": item.created_at.isoformat()} for item in requests]
        return {"columns": list(rows[0]) if rows else ["Request ID", "Building", "Equipment", "Status", "Priority", "Category", "Created"], "rows": rows, "summary": {"total": len(rows), "open": sum(item.status != "RESOLVED" for item in requests)}}
    if report_type == "EQUIPMENT_HEALTH":
        data = equipment_intelligence(session)
        if building_id: data = [item for item in data if item.equipment.building.building_id == building_id]
        if status: data = [item for item in data if item.health_band.value == status]
        rows = [{"Equipment": item.equipment.equipment_name, "Building": item.equipment.building.building_name, "Room": item.equipment.room.room_number if item.equipment.room else "", "Status": item.equipment.status, "Health Score": item.score, "Health Band": item.health_band.value, "Open Requests": item.open_request_count} for item in data]
        return {"columns": list(rows[0]) if rows else ["Equipment", "Building", "Room", "Status", "Health Score", "Health Band", "Open Requests"], "rows": rows, "summary": {"total": len(rows), "high_risk": sum(item.health_band.value == "HIGH_RISK" for item in data)}}
    if report_type == "ENERGY_SUSTAINABILITY":
        data = building_energy_overview(session)["buildings"]
        if building_id: data = [item for item in data if item["building"].building_id == building_id]
        if status: data = [item for item in data if item["condition"] == status]
        rows = [{"Building": item["building"].building_name, "Latest Consumption": float(item["latest_consumption"]) if item["latest_consumption"] is not None else None, "Forecast": float(item["forecast_consumption"]) if item["forecast_consumption"] is not None else None, "Estimated Cost": float(item["estimated_cost"]) if item["estimated_cost"] is not None else None, "Estimated Carbon": float(item["estimated_carbon"]) if item["estimated_carbon"] is not None else None, "Condition": item["condition"] or "NO_DATA"} for item in data]
        return {"columns": list(rows[0]) if rows else ["Building", "Latest Consumption", "Forecast", "Estimated Cost", "Estimated Carbon", "Condition"], "rows": rows, "summary": {"total": len(rows), "high_usage": sum(item["condition"] == "HIGH_USAGE" for item in data)}}
    if report_type == "COMFORT":
        data = building_comfort_summaries(session)
        if building_id: data = [item for item in data if item["building"].building_id == building_id]
        if status: data = [item for item in data if item["condition"] == status]
        rows = [{"Building": item["building"].building_name, "Temperature": float(item["latest_temperature"]) if item["latest_temperature"] is not None else None, "Humidity": float(item["latest_humidity"]) if item["latest_humidity"] is not None else None, "Condition": item["condition"] or "NO_DATA", "Reason": item["reason"] or ""} for item in data]
        return {"columns": list(rows[0]) if rows else ["Building", "Temperature", "Humidity", "Condition", "Reason"], "rows": rows, "summary": {"total": len(rows), "uncomfortable": sum(item["condition"] == "UNCOMFORTABLE" for item in data)}}
    if report_type == "ALERTS_INCIDENTS":
        statement = select(Alert).options(joinedload(Alert.building), joinedload(Alert.equipment))
        if building_id: statement = statement.where(Alert.building_id == building_id)
        if status: statement = statement.where(Alert.status == status)
        if category: statement = statement.where(Alert.category == category)
        if start: statement = statement.where(Alert.created_at >= start)
        if end: statement = statement.where(Alert.created_at <= end)
        data = session.scalars(statement.order_by(Alert.created_at.desc(), Alert.alert_id.desc())).all()
        rows = [{"Alert ID": item.alert_id, "Building": item.building.building_name, "Title": item.title, "Category": item.category, "Severity": item.severity, "Status": item.status, "Created": item.created_at.isoformat()} for item in data]
        return {"columns": list(rows[0]) if rows else ["Alert ID", "Building", "Title", "Category", "Severity", "Status", "Created"], "rows": rows, "summary": {"total": len(rows), "active": sum(item.status != "RESOLVED" for item in data)}}
    statement = select(SafetyEvent).options(joinedload(SafetyEvent.building))
    if building_id: statement = statement.where(SafetyEvent.building_id == building_id)
    if status: statement = statement.where(SafetyEvent.status == status)
    if category: statement = statement.where(SafetyEvent.section == category)
    if start: statement = statement.where(SafetyEvent.occurred_at >= start)
    if end: statement = statement.where(SafetyEvent.occurred_at <= end)
    data = session.scalars(statement.order_by(SafetyEvent.occurred_at.desc(), SafetyEvent.event_id.desc())).all()
    rows = [{"Event ID": item.event_id, "Building": item.building.building_name if item.building else "Campus-wide", "Section": item.section, "Name": item.name, "Event Type": item.event_type, "Status": item.status, "Severity": item.severity, "Occurred": item.occurred_at.isoformat()} for item in data]
    return {"columns": list(rows[0]) if rows else ["Event ID", "Building", "Section", "Name", "Event Type", "Status", "Severity", "Occurred"], "rows": rows, "summary": {"total": len(rows), "serious": sum(item.status in {"ALARM", "FORCED_ENTRY"} or item.severity == "CRITICAL" for item in data)}}
