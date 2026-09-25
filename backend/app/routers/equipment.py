from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import require_admin
from app.db.session import get_session
from app.models import Building, Equipment, MaintenanceHistory, Room
from app.schemas.equipment import EquipmentCreate, EquipmentResponse, EquipmentUpdate
from app.schemas.equipment_intelligence import EquipmentIntelligenceResponse
from app.services.equipment_intelligence import equipment_intelligence
from app.services.requests import write_transaction
from app.schemas.maintenance_history import MaintenanceHistoryResponse
from app.schemas.ids import OptionalQueryDatabaseId, PathDatabaseId
from app.services.maintenance_history import ordered_history_query

router = APIRouter(
    prefix="/api/equipment", tags=["Equipment"],
    responses={503: {"description": "Database service unavailable"}},
)


@router.get("", response_model=list[EquipmentResponse], summary="List equipment")
def list_equipment(
    session: Annotated[Session, Depends(get_session)],
    building_id: OptionalQueryDatabaseId = None,
    room_id: OptionalQueryDatabaseId = None,
):
    statement = select(Equipment).options(joinedload(Equipment.building), joinedload(Equipment.room))
    if building_id is not None:
        statement = statement.where(Equipment.building_id == building_id)
    if room_id is not None:
        statement = statement.where(Equipment.room_id == room_id)
    return session.scalars(statement.order_by(
        Equipment.building_id, Equipment.equipment_name, Equipment.equipment_id,
    )).all()


@router.get(
    "/intelligence", response_model=list[EquipmentIntelligenceResponse], summary="List equipment intelligence",
)
def list_equipment_intelligence(session: Annotated[Session, Depends(get_session)]):
    return equipment_intelligence(session)


@router.get(
    "/{equipment_id}", response_model=EquipmentResponse, summary="Get equipment",
    responses={404: {"description": "Equipment not found"}},
)
def get_equipment(equipment_id: PathDatabaseId, session: Annotated[Session, Depends(get_session)]):
    equipment = session.scalar(select(Equipment).options(
        joinedload(Equipment.building), joinedload(Equipment.room),
    ).where(Equipment.equipment_id == equipment_id))
    if equipment is None:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return equipment


@router.get(
    "/{equipment_id}/intelligence", response_model=EquipmentIntelligenceResponse, summary="Get equipment intelligence",
    responses={404: {"description": "Equipment not found"}},
)
def get_equipment_intelligence(equipment_id: PathDatabaseId, session: Annotated[Session, Depends(get_session)]):
    intelligence = equipment_intelligence(session, equipment_id)
    if not intelligence:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return intelligence[0]


def validate_room_assignment(session: Session, building_id: int, room_id: int | None) -> None:
    if room_id is None:
        return
    room = session.get(Room, room_id)
    if room is None:
        raise HTTPException(404, "Room not found")
    if room.building_id != building_id:
        raise HTTPException(422, "Room must belong to the selected building")


@router.post("", response_model=EquipmentResponse, status_code=201, summary="Add equipment (ADMIN)",
             dependencies=[Depends(require_admin)], responses={403: {"description": "Insufficient permissions"}, 404: {"description": "Building not found"}})
def create_equipment(data: EquipmentCreate, session: Annotated[Session, Depends(get_session)]):
    with write_transaction(session):
        building = session.get(Building, data.building_id)
        if building is None:
            raise HTTPException(404, "Building not found")
        validate_room_assignment(session, data.building_id, data.room_id)
        equipment = Equipment(**data.model_dump())
        session.add(equipment)
        session.flush()
        response = EquipmentResponse.model_validate(equipment)
    return response


@router.patch("/{equipment_id}", response_model=EquipmentResponse, summary="Update equipment (ADMIN)",
              dependencies=[Depends(require_admin)], responses={403: {"description": "Insufficient permissions"}, 404: {"description": "Equipment not found"}})
def update_equipment(equipment_id: PathDatabaseId, data: EquipmentUpdate, session: Annotated[Session, Depends(get_session)]):
    with write_transaction(session):
        equipment = session.scalar(select(Equipment).options(joinedload(Equipment.building), joinedload(Equipment.room))
                                   .where(Equipment.equipment_id == equipment_id).with_for_update(of=Equipment))
        if equipment is None:
            raise HTTPException(404, "Equipment not found")
        if "room_id" in data.model_fields_set:
            validate_room_assignment(session, equipment.building_id, data.room_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            if getattr(equipment, field) != value:
                setattr(equipment, field, value)
        session.flush()
        session.expire(equipment, ["room"])
        response = EquipmentResponse.model_validate(equipment)
    return response


@router.get("/{equipment_id}/history", response_model=list[MaintenanceHistoryResponse], summary="Get equipment maintenance history (ADMIN)",
            dependencies=[Depends(require_admin)], responses={403: {"description": "Insufficient permissions"}, 404: {"description": "Equipment not found"}})
def equipment_history(equipment_id: PathDatabaseId, session: Annotated[Session, Depends(get_session)]):
    if session.get(Equipment, equipment_id) is None:
        raise HTTPException(404, "Equipment not found")
    return session.scalars(ordered_history_query().where(MaintenanceHistory.equipment_id == equipment_id)).all()
