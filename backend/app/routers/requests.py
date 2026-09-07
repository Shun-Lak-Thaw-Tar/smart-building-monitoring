from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_current_user, require_admin, require_staff
from app.db.session import get_session
from app.models import Building, Equipment, MaintenanceRequest, RequestStatusHistory, User
from app.schemas.maintenance_request import (
    MaintenanceRequestAssign, MaintenanceRequestCreate, MaintenanceRequestResponse, MaintenanceRequestStatusUpdate,
    RequestPriority, RequestStatus, RequestStatusHistoryResponse,
)
from app.services.requests import request_query, visible_request, write_transaction

router = APIRouter(prefix="/api/requests", tags=["Maintenance requests"], responses={
    401: {"description": "Authentication required or invalid token"},
    403: {"description": "Insufficient permissions"},
    404: {"description": "Resource not found"},
    503: {"description": "Database service unavailable"},
})
DB = Annotated[Session, Depends(get_session)]
Staff = Annotated[User, Depends(require_staff)]
CurrentUser = Annotated[User, Depends(get_current_user)]
Admin = Annotated[User, Depends(require_admin)]


@router.post("", response_model=MaintenanceRequestResponse, status_code=201,
             summary="Submit a maintenance request", responses={400: {"description": "Equipment/building mismatch"}})
def create_request(data: MaintenanceRequestCreate, session: DB, user: Staff):
    with write_transaction(session):
        if session.get(Building, data.building_id) is None:
            raise HTTPException(404, "Building not found")
        if data.equipment_id is not None:
            equipment = session.get(Equipment, data.equipment_id)
            if equipment is None:
                raise HTTPException(404, "Equipment not found")
            if equipment.building_id != data.building_id:
                raise HTTPException(400, "Equipment does not belong to the selected building")
        record = MaintenanceRequest(**data.model_dump(), submitted_by=user.user_id,
                                    assigned_to=None, status="PENDING")
        session.add(record)
        session.flush()
        session.add(RequestStatusHistory(request_id=record.request_id, changed_by=user.user_id,
                                         previous_status=None, new_status="PENDING", note=None))
        session.flush()
        response = MaintenanceRequestResponse.model_validate(visible_request(session, user, record.request_id))
    return response


# Register /my before /{request_id}.
@router.get("/my", response_model=list[MaintenanceRequestResponse], summary="List my maintenance requests")
def my_requests(session: DB, user: Staff):
    return session.scalars(request_query().where(MaintenanceRequest.submitted_by == user.user_id)
                           .order_by(MaintenanceRequest.created_at.desc(), MaintenanceRequest.request_id.desc())).all()


@router.get("", response_model=list[MaintenanceRequestResponse], summary="List and filter maintenance requests")
def list_requests(
    session: DB, user: Admin,
    building_id: int | None = None,
    status: RequestStatus | None = None,
    priority: RequestPriority | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
):
    statement = request_query()
    if building_id is not None:
        statement = statement.where(MaintenanceRequest.building_id == building_id)
    if status is not None:
        statement = statement.where(MaintenanceRequest.status == status)
    if priority is not None:
        statement = statement.where(MaintenanceRequest.priority == priority)
    term = search.strip() if search else ""
    if term:
        statement = statement.join(MaintenanceRequest.building).outerjoin(MaintenanceRequest.equipment)
        statement = statement.where(or_(*[
            column.icontains(term, autoescape=True) for column in (
                MaintenanceRequest.fault_category, MaintenanceRequest.room_location,
                MaintenanceRequest.description, Equipment.equipment_name, Building.building_name,
            )
        ]))
    return session.scalars(statement.order_by(
        MaintenanceRequest.created_at.desc(), MaintenanceRequest.request_id.desc(),
    )).all()


@router.get("/{request_id}", response_model=MaintenanceRequestResponse, summary="Get a maintenance request")
def get_request(request_id: int, session: DB, user: CurrentUser):
    return visible_request(session, user, request_id)


@router.get("/{request_id}/history", response_model=list[RequestStatusHistoryResponse], summary="Get request status timeline")
def get_history(request_id: int, session: DB, user: CurrentUser):
    visible_request(session, user, request_id)
    return session.scalars(select(RequestStatusHistory).options(joinedload(RequestStatusHistory.changed_by_user))
                           .where(RequestStatusHistory.request_id == request_id)
                           .order_by(RequestStatusHistory.changed_at, RequestStatusHistory.status_history_id)).all()


@router.patch("/{request_id}/assign", response_model=MaintenanceRequestResponse, summary="Assign request to an administrator",
              responses={400: {"description": "Assignee must be an administrator"}})
def assign_request(request_id: int, data: MaintenanceRequestAssign, session: DB, user: Admin):
    with write_transaction(session):
        record = visible_request(session, user, request_id, lock=True)
        assignee = session.get(User, data.assigned_to)
        if assignee is None:
            raise HTTPException(404, "Assignee not found")
        if assignee.role != "ADMIN":
            raise HTTPException(400, "Assignee must be an administrator")
        if record.assigned_to != assignee.user_id:
            record.assigned_to = assignee.user_id
            session.flush()
        response = MaintenanceRequestResponse.model_validate(visible_request(session, user, request_id))
    return response


@router.patch("/{request_id}/status", response_model=MaintenanceRequestResponse, summary="Update request status and timeline")
def update_status(request_id: int, data: MaintenanceRequestStatusUpdate, session: DB, user: Admin):
    with write_transaction(session):
        record = visible_request(session, user, request_id, lock=True)
        if record.status != data.status:
            previous = record.status
            record.status = data.status
            session.add(RequestStatusHistory(request_id=request_id, changed_by=user.user_id,
                                             previous_status=previous, new_status=data.status, note=data.note))
            session.flush()
        response = MaintenanceRequestResponse.model_validate(record)
    return response
