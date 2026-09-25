from enum import Enum

from pydantic import AwareDatetime, BaseModel, ConfigDict

from app.schemas.building import BuildingBrief


class RoomType(str, Enum):
    OFFICE = "OFFICE"
    MEETING_ROOM = "MEETING_ROOM"
    COMPUTER_LAB = "COMPUTER_LAB"
    TECHNICAL_SERVER_ROOM = "TECHNICAL_SERVER_ROOM"


class RoomEquipmentBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    equipment_id: int
    equipment_name: str
    equipment_type: str
    location: str
    status: str


class RoomRequestBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    request_id: int
    room_location: str
    fault_category: str
    priority: str
    status: str
    created_at: AwareDatetime


class RoomAlertBrief(BaseModel):
    alert_id: int
    equipment_name: str | None
    category: str
    severity: str
    title: str
    created_at: AwareDatetime


class RoomResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    room_id: int
    room_number: str
    room_name: str
    room_type: RoomType
    floor: int
    description: str | None
    building: BuildingBrief
    equipment: list[RoomEquipmentBrief] = []
    equipment_attention_count: int = 0
    open_request_count: int = 0
    high_priority_open_request_count: int = 0
    active_alert_count: int = 0
    critical_alert_count: int = 0
    open_requests: list[RoomRequestBrief] = []
    active_alerts: list[RoomAlertBrief] = []


class RoomBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    room_id: int
    room_number: str
    room_name: str
    floor: int
