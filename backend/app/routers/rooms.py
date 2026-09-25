import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.db.session import get_session
from app.models import Alert, MaintenanceRequest, Room
from app.schemas.ids import OptionalQueryDatabaseId, PathDatabaseId
from app.schemas.room import RoomAlertBrief, RoomRequestBrief, RoomResponse, RoomType

router = APIRouter(
    prefix="/api/rooms", tags=["Rooms"],
    responses={503: {"description": "Database service unavailable"}},
)


def room_for_request(request: MaintenanceRequest, room_ids: dict[tuple[int, str], int]) -> int | None:
    if request.equipment is not None and request.equipment.room_id is not None:
        return request.equipment.room_id
    for (building_id, room_number), room_id in room_ids.items():
        if building_id == request.building_id and re.search(
            rf"(?<![A-Za-z0-9]){re.escape(room_number)}(?![A-Za-z0-9])", request.room_location,
        ):
            return room_id
    return None


def enrich_rooms(session: Session, rooms: list[Room]) -> list[RoomResponse]:
    room_ids = {(room.building_id, room.room_number): room.room_id for room in rooms}
    requests_by_room: dict[int, list[MaintenanceRequest]] = {room.room_id: [] for room in rooms}
    alerts_by_room: dict[int, list[Alert]] = {room.room_id: [] for room in rooms}
    requests = session.scalars(select(MaintenanceRequest).options(joinedload(MaintenanceRequest.equipment)).where(
        MaintenanceRequest.status.in_(("PENDING", "IN_PROGRESS")),
    ).order_by(MaintenanceRequest.created_at.desc(), MaintenanceRequest.request_id.desc())).all()
    for request in requests:
        room_id = room_for_request(request, room_ids)
        if room_id in requests_by_room:
            requests_by_room[room_id].append(request)
    alerts = session.scalars(select(Alert).options(joinedload(Alert.equipment)).where(
        Alert.status.in_(("ACTIVE", "ACKNOWLEDGED")),
    ).order_by(Alert.created_at.desc(), Alert.alert_id.desc())).all()
    for alert in alerts:
        room_id = alert.equipment.room_id if alert.equipment is not None else None
        if room_id in alerts_by_room:
            alerts_by_room[room_id].append(alert)

    responses = []
    for room in rooms:
        response = RoomResponse.model_validate(room)
        room_requests = requests_by_room[room.room_id]
        room_alerts = alerts_by_room[room.room_id]
        response.equipment_attention_count = sum(item.status != "OPERATIONAL" for item in room.equipment)
        response.open_request_count = len(room_requests)
        response.high_priority_open_request_count = sum(item.priority == "HIGH" for item in room_requests)
        response.active_alert_count = len(room_alerts)
        response.critical_alert_count = sum(item.severity == "CRITICAL" for item in room_alerts)
        response.open_requests = [RoomRequestBrief.model_validate(item) for item in room_requests]
        response.active_alerts = [RoomAlertBrief(
            alert_id=item.alert_id, equipment_name=item.equipment.equipment_name if item.equipment else None,
            category=item.category, severity=item.severity, title=item.title, created_at=item.created_at,
        ) for item in room_alerts]
        responses.append(response)
    return responses


@router.get("", response_model=list[RoomResponse], summary="List rooms")
def list_rooms(
    session: Annotated[Session, Depends(get_session)],
    building_id: OptionalQueryDatabaseId = None,
    floor: Annotated[int | None, Query(ge=0, le=200)] = None,
    room_type: RoomType | None = None,
    search: Annotated[str | None, Query(max_length=120)] = None,
):
    statement = select(Room).options(joinedload(Room.building), selectinload(Room.equipment))
    if building_id is not None:
        statement = statement.where(Room.building_id == building_id)
    if floor is not None:
        statement = statement.where(Room.floor == floor)
    if room_type is not None:
        statement = statement.where(Room.room_type == room_type.value)
    if search and search.strip():
        term = f"%{search.strip()}%"
        statement = statement.where(or_(Room.room_number.ilike(term), Room.room_name.ilike(term)))
    rooms = session.scalars(statement.order_by(Room.building_id, Room.floor, Room.room_number, Room.room_id)).all()
    return enrich_rooms(session, rooms)


@router.get(
    "/{room_id}", response_model=RoomResponse, summary="Get room",
    responses={404: {"description": "Room not found"}},
)
def get_room(room_id: PathDatabaseId, session: Annotated[Session, Depends(get_session)]):
    room = session.scalar(select(Room).options(joinedload(Room.building), selectinload(Room.equipment)).where(Room.room_id == room_id))
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return enrich_rooms(session, [room])[0]

