from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import require_admin
from app.db.session import get_session
from app.models import Alert, Building, Equipment
from app.schemas.alerts import AlertCategory, AlertCreate, AlertResponse, AlertSeverity, AlertStatus
from app.schemas.ids import OptionalQueryDatabaseId, PathDatabaseId
from app.services.requests import write_transaction

router = APIRouter(prefix="/api/alerts", tags=["Alerts"], responses={503: {"description": "Database service unavailable"}})


def alert_query():
    return select(Alert).options(joinedload(Alert.building), joinedload(Alert.equipment))


@router.get("", response_model=list[AlertResponse], summary="List alerts")
def list_alerts(
    session: Annotated[Session, Depends(get_session)],
    building_id: OptionalQueryDatabaseId = None,
    category: AlertCategory | None = None,
    severity: AlertSeverity | None = None,
    status: AlertStatus | None = None,
):
    statement = alert_query()
    if building_id is not None:
        statement = statement.where(Alert.building_id == building_id)
    if category is not None:
        statement = statement.where(Alert.category == category)
    if severity is not None:
        statement = statement.where(Alert.severity == severity)
    if status is not None:
        statement = statement.where(Alert.status == status)
    return session.scalars(statement.order_by(Alert.created_at.desc(), Alert.alert_id.desc())).all()


@router.get("/{alert_id}", response_model=AlertResponse, summary="Get an alert", responses={404: {"description": "Alert not found"}})
def get_alert(alert_id: PathDatabaseId, session: Annotated[Session, Depends(get_session)]):
    alert = session.scalar(alert_query().where(Alert.alert_id == alert_id))
    if alert is None:
        raise HTTPException(404, "Alert not found")
    return alert


@router.post("", response_model=AlertResponse, status_code=201, summary="Create an alert (ADMIN)",
             dependencies=[Depends(require_admin)], responses={403: {"description": "Insufficient permissions"}, 404: {"description": "Building or equipment not found"}, 400: {"description": "Equipment does not belong to the selected building"}})
def create_alert(data: AlertCreate, session: Annotated[Session, Depends(get_session)]):
    with write_transaction(session):
        if session.get(Building, data.building_id) is None:
            raise HTTPException(404, "Building not found")
        if data.equipment_id is not None:
            equipment = session.get(Equipment, data.equipment_id)
            if equipment is None:
                raise HTTPException(404, "Equipment not found")
            if equipment.building_id != data.building_id:
                raise HTTPException(400, "Equipment does not belong to the selected building")
        alert = Alert(**data.model_dump())
        session.add(alert)
        session.flush()
        response = AlertResponse.model_validate(session.scalar(alert_query().where(Alert.alert_id == alert.alert_id)))
    return response


@router.patch("/{alert_id}/resolve", response_model=AlertResponse, summary="Resolve an alert (ADMIN)",
              dependencies=[Depends(require_admin)], responses={403: {"description": "Insufficient permissions"}, 404: {"description": "Alert not found"}})
def resolve_alert(alert_id: PathDatabaseId, session: Annotated[Session, Depends(get_session)]):
    with write_transaction(session):
        alert = session.scalar(alert_query().where(Alert.alert_id == alert_id).with_for_update(of=Alert))
        if alert is None:
            raise HTTPException(404, "Alert not found")
        if alert.status == "ACTIVE":
            alert.status = "RESOLVED"
            alert.resolved_at = datetime.now(timezone.utc)
            session.flush()
        response = AlertResponse.model_validate(alert)
    return response
