from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_current_user, require_admin
from app.db.session import get_session
from app.models import Alert, Building, Equipment, MaintenanceRequest, RequestStatusHistory, User
from app.schemas.alerts import (
    AlertCategory,
    AlertCreate,
    AlertMaintenanceRequestCreate,
    AlertResponse,
    AlertSeverity,
    AlertStatus,
)
from app.schemas.ids import OptionalQueryDatabaseId, PathDatabaseId
from app.services.requests import write_transaction

router = APIRouter(prefix="/api/alerts", tags=["Alerts"], responses={503: {"description": "Database service unavailable"}})


def alert_query():
    return select(Alert).options(
        joinedload(Alert.building),
        joinedload(Alert.equipment),
        joinedload(Alert.acknowledged_by_user),
        joinedload(Alert.resolved_by_user),
        joinedload(Alert.maintenance_request).joinedload(MaintenanceRequest.building),
        joinedload(Alert.maintenance_request).joinedload(MaintenanceRequest.equipment),
    )


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


@router.patch("/{alert_id}/acknowledge", response_model=AlertResponse, summary="Acknowledge an alert (ADMIN)",
              dependencies=[Depends(require_admin)], responses={403: {"description": "Insufficient permissions"}, 404: {"description": "Alert not found"}})
def acknowledge_alert(
    alert_id: PathDatabaseId,
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    with write_transaction(session):
        alert = session.scalar(alert_query().where(Alert.alert_id == alert_id).with_for_update(of=Alert))
        if alert is None:
            raise HTTPException(404, "Alert not found")
        if alert.status == "ACTIVE":
            alert.status = "ACKNOWLEDGED"
            alert.acknowledged_at = datetime.now(timezone.utc)
            alert.acknowledged_by = current_user.user_id
            alert.acknowledged_by_user = current_user
            session.flush()
        response = AlertResponse.model_validate(alert)
    return response


@router.post("/{alert_id}/maintenance-request", response_model=AlertResponse, status_code=201,
             summary="Create a maintenance request from an alert (ADMIN)", dependencies=[Depends(require_admin)],
             responses={403: {"description": "Insufficient permissions"}, 404: {"description": "Alert not found"}, 409: {"description": "A maintenance request is already linked to this alert"}})
def create_maintenance_request_from_alert(
    alert_id: PathDatabaseId,
    data: AlertMaintenanceRequestCreate,
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    with write_transaction(session):
        alert = session.scalar(alert_query().where(Alert.alert_id == alert_id).with_for_update(of=Alert))
        if alert is None:
            raise HTTPException(404, "Alert not found")
        if alert.maintenance_request_id is not None:
            raise HTTPException(409, "A maintenance request is already linked to this alert")

        request = MaintenanceRequest(
            submitted_by=current_user.user_id,
            building_id=alert.building_id,
            equipment_id=alert.equipment_id,
            room_location=data.room_location,
            fault_category=data.fault_category,
            description=data.description,
            priority=data.priority.value,
            status="PENDING",
        )
        session.add(request)
        session.flush()
        session.add(RequestStatusHistory(
            request_id=request.request_id,
            changed_by=current_user.user_id,
            previous_status=None,
            new_status="PENDING",
            note=None,
        ))
        alert.maintenance_request_id = request.request_id
        alert.maintenance_request = request
        request.building = alert.building
        request.equipment = alert.equipment
        session.flush()
        response = AlertResponse.model_validate(alert)
    return response


@router.patch("/{alert_id}/resolve", response_model=AlertResponse, summary="Resolve an alert (ADMIN)",
              dependencies=[Depends(require_admin)], responses={403: {"description": "Insufficient permissions"}, 404: {"description": "Alert not found"}})
def resolve_alert(
    alert_id: PathDatabaseId,
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    with write_transaction(session):
        alert = session.scalar(alert_query().where(Alert.alert_id == alert_id).with_for_update(of=Alert))
        if alert is None:
            raise HTTPException(404, "Alert not found")
        if alert.status != "RESOLVED":
            alert.status = "RESOLVED"
            alert.resolved_at = datetime.now(timezone.utc)
            alert.resolved_by = current_user.user_id
            alert.resolved_by_user = current_user
            session.flush()
        response = AlertResponse.model_validate(alert)
    return response
