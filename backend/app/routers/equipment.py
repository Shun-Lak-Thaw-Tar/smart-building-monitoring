from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_session
from app.models import Equipment
from app.schemas.equipment import EquipmentResponse

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
