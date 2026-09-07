from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import require_admin
from app.db.session import get_session
from app.models import Building, Equipment, MaintenanceHistory
from app.schemas.equipment import EquipmentCreate, EquipmentResponse, EquipmentUpdate
from app.services.requests import write_transaction
from app.schemas.maintenance_history import MaintenanceHistoryResponse
from app.services.maintenance_history import ordered_history_query

router = APIRouter(
    prefix="/api/equipment", tags=["Equipment"],
    responses={503: {"description": "Database service unavailable"}},
)


@router.get("", response_model=list[EquipmentResponse], summary="List equipment")
def list_equipment(
    session: Annotated[Session, Depends(get_session)],
    building_id: Annotated[int | None, Query(description="Filter by building ID")] = None,
):
    statement = select(Equipment).options(joinedload(Equipment.building))
    if building_id is not None:
        statement = statement.where(Equipment.building_id == building_id)
    return session.scalars(statement.order_by(
        Equipment.building_id, Equipment.equipment_name, Equipment.equipment_id,
    )).all()


@router.get(
    "/{equipment_id}", response_model=EquipmentResponse, summary="Get equipment",
    responses={404: {"description": "Equipment not found"}},
)
def get_equipment(equipment_id: int, session: Annotated[Session, Depends(get_session)]):
    equipment = session.scalar(select(Equipment).options(
        joinedload(Equipment.building),
    ).where(Equipment.equipment_id == equipment_id))
    if equipment is None:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return equipment


@router.post("", response_model=EquipmentResponse, status_code=201, summary="Add equipment (ADMIN)",
             dependencies=[Depends(require_admin)], responses={403: {"description": "Insufficient permissions"}, 404: {"description": "Building not found"}})
def create_equipment(data: EquipmentCreate, session: Annotated[Session, Depends(get_session)]):
    with write_transaction(session):
        building = session.get(Building, data.building_id)
        if building is None:
            raise HTTPException(404, "Building not found")
        equipment = Equipment(**data.model_dump())
        session.add(equipment)
        session.flush()
        response = EquipmentResponse.model_validate(equipment)
    return response


@router.patch("/{equipment_id}", response_model=EquipmentResponse, summary="Update equipment (ADMIN)",
              dependencies=[Depends(require_admin)], responses={403: {"description": "Insufficient permissions"}, 404: {"description": "Equipment not found"}})
def update_equipment(equipment_id: int, data: EquipmentUpdate, session: Annotated[Session, Depends(get_session)]):
    with write_transaction(session):
        equipment = session.scalar(select(Equipment).options(joinedload(Equipment.building))
                                   .where(Equipment.equipment_id == equipment_id).with_for_update(of=Equipment))
        if equipment is None:
            raise HTTPException(404, "Equipment not found")
        for field, value in data.model_dump(exclude_unset=True).items():
            if getattr(equipment, field) != value:
                setattr(equipment, field, value)
        session.flush()
        response = EquipmentResponse.model_validate(equipment)
    return response


@router.get("/{equipment_id}/history", response_model=list[MaintenanceHistoryResponse], summary="Get equipment maintenance history (ADMIN)",
            dependencies=[Depends(require_admin)], responses={403: {"description": "Insufficient permissions"}, 404: {"description": "Equipment not found"}})
def equipment_history(equipment_id: int, session: Annotated[Session, Depends(get_session)]):
    if session.get(Equipment, equipment_id) is None:
        raise HTTPException(404, "Equipment not found")
    return session.scalars(ordered_history_query().where(MaintenanceHistory.equipment_id == equipment_id)).all()
