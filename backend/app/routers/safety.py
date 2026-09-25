from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import require_admin
from app.db.session import get_session
from app.models import Alert, Building, SafetyEvent
from app.schemas.safety import SafetyEventCreate, SafetyEventResponse, SafetySection
from app.services.requests import write_transaction

router = APIRouter(prefix="/api/safety", tags=["Safety and security"], responses={503: {"description": "Database service unavailable"}})


@router.get("/events", response_model=list[SafetyEventResponse], summary="List simulated safety events")
def list_events(session: Annotated[Session, Depends(get_session)], section: SafetySection | None = None):
    statement = select(SafetyEvent).options(joinedload(SafetyEvent.building)).order_by(SafetyEvent.occurred_at.desc(), SafetyEvent.event_id.desc())
    if section:
        statement = statement.where(SafetyEvent.section == section)
    return session.scalars(statement).all()


@router.post("/events", response_model=SafetyEventResponse, status_code=201, summary="Trigger a simulated event (ADMIN)", dependencies=[Depends(require_admin)])
def trigger_event(data: SafetyEventCreate, session: Annotated[Session, Depends(get_session)]):
    valid = {
        "FIRE_SAFETY": {"NORMAL", "FAULT", "TESTING", "OFFLINE", "ALARM"},
        "SECURITY_ACCESS": {"GRANTED", "DENIED", "DOOR_OPEN", "FORCED_ENTRY"},
        "HAZARD_ADVISORY": {"ACTIVE", "RESOLVED"},
    }
    if data.status not in valid[data.section.value]:
        raise HTTPException(422, "Status is not valid for this simulation section")
    if data.section.value != "HAZARD_ADVISORY" and data.building_id is None:
        raise HTTPException(422, "A building is required for this simulation event")
    with write_transaction(session):
        building = session.get(Building, data.building_id) if data.building_id else None
        if data.building_id and building is None:
            raise HTTPException(404, "Building not found")
        event = SafetyEvent(**data.model_dump())
        session.add(event)
        # Alarms, forced entry, and critical active hazards surface through the one existing alert workflow.
        serious = data.status in {"ALARM", "FORCED_ENTRY"} or (data.section.value == "HAZARD_ADVISORY" and data.status == "ACTIVE" and data.severity.value == "CRITICAL")
        if serious:
            title = f"[SIMULATION] {data.name}: {data.event_type}"
            target_buildings = [building] if building else session.scalars(select(Building)).all()
            for target in target_buildings:
                duplicate = session.scalar(select(Alert.alert_id).where(Alert.building_id == target.building_id, Alert.title == title, Alert.status.in_(["ACTIVE", "ACKNOWLEDGED"])).limit(1))
                if duplicate is None:
                    session.add(Alert(building_id=target.building_id, equipment_id=None, category="EQUIPMENT", severity="CRITICAL", title=title, description=data.description or "Simulated safety and security event."))
        session.flush()
        event.building = building
        return SafetyEventResponse.model_validate(event)
