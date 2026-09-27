from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import require_admin
from app.db.session import get_session
from app.models import Equipment, MaintenanceHistory, MaintenanceRequest, RequestStatusHistory, User
from app.schemas.maintenance_history import MaintenanceHistoryCreate, MaintenanceHistoryDetailResponse, MaintenanceHistoryResponse, ResolvedRequestOption
from app.schemas.ids import OptionalQueryDatabaseId
from app.services.maintenance_history import history_query, ordered_history_query
from app.services.requests import write_transaction

router = APIRouter(prefix="/api/maintenance-history", tags=["Maintenance history"], dependencies=[Depends(require_admin)],
                   responses={401: {"description": "Authentication required"}, 403: {"description": "Insufficient permissions"},
                              503: {"description": "Database service unavailable"}})


@router.get("/resolved-requests", response_model=list[ResolvedRequestOption], summary="List resolved requests available for maintenance records")
def resolved_requests(session: Annotated[Session, Depends(get_session)]):
    from app.services.requests import request_query
    return session.scalars(request_query().where(
        MaintenanceRequest.status == "RESOLVED",
        MaintenanceRequest.equipment_id.is_not(None),
        ~MaintenanceRequest.maintenance_records.any(),
    ).order_by(MaintenanceRequest.request_id.desc())).all()


@router.get("/{history_id}", response_model=MaintenanceHistoryDetailResponse, summary="Get maintenance record detail")
def get_history_record(history_id: int, session: Annotated[Session, Depends(get_session)]):
    record = session.scalar(history_query().where(MaintenanceHistory.history_id == history_id))
    if record is None:
        raise HTTPException(404, "Maintenance record not found")
    timeline = []
    if record.request_id:
        timeline = session.scalars(select(RequestStatusHistory).options(joinedload(RequestStatusHistory.changed_by_user)).where(
            RequestStatusHistory.request_id == record.request_id).order_by(RequestStatusHistory.changed_at, RequestStatusHistory.status_history_id)).all()
    return MaintenanceHistoryDetailResponse.model_validate(record).model_copy(update={"timeline": timeline})


@router.get("", response_model=list[MaintenanceHistoryResponse], summary="List completed maintenance (ADMIN)")
def list_history(session: Annotated[Session, Depends(get_session)], building_id: OptionalQueryDatabaseId = None,
                 equipment_id: OptionalQueryDatabaseId = None):
    statement = ordered_history_query()
    if building_id is not None:
        statement = statement.join(MaintenanceHistory.equipment).where(Equipment.building_id == building_id)
    if equipment_id is not None:
        statement = statement.where(MaintenanceHistory.equipment_id == equipment_id)
    return session.scalars(statement).all()


@router.post("", response_model=MaintenanceHistoryResponse, status_code=201, summary="Record completed maintenance (ADMIN)",
             responses={400: {"description": "Request must match equipment and be resolved"}, 404: {"description": "Equipment or request not found"}, 409: {"description": "Resolved request already has maintenance"}})
def create_history(data: MaintenanceHistoryCreate, session: Annotated[Session, Depends(get_session)],
                   user: Annotated[User, Depends(require_admin)]):
    with write_transaction(session):
        if session.get(Equipment, data.equipment_id) is None:
            raise HTTPException(404, "Equipment not found")
        if data.request_id is not None:
            # Serialize with request status edits so the validated state cannot change mid-write.
            request = session.scalar(select(MaintenanceRequest).where(MaintenanceRequest.request_id == data.request_id).with_for_update())
            if request is None:
                raise HTTPException(404, "Maintenance request not found")
            if request.equipment_id != data.equipment_id:
                raise HTTPException(400, "Maintenance request does not belong to the selected equipment")
            if request.status != "RESOLVED":
                raise HTTPException(400, "Maintenance request must be resolved before recording completed maintenance")
            if session.scalar(select(MaintenanceHistory.history_id).where(MaintenanceHistory.request_id == request.request_id).limit(1)):
                raise HTTPException(409, "A maintenance record already exists for this resolved request")
        record = MaintenanceHistory(**data.model_dump(), completed_by=user.user_id)
        session.add(record)
        session.flush()
        response = MaintenanceHistoryResponse.model_validate(session.scalar(history_query().where(MaintenanceHistory.history_id == record.history_id)))
    return response
