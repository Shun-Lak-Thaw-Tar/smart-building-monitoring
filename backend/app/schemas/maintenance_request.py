from enum import Enum

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator

from app.schemas.auth import UserBrief
from app.schemas.building import BuildingBrief


class RequestPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class RequestStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"


class MaintenanceRequestCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    building_id: int
    equipment_id: int | None = None
    room_location: str = Field(min_length=1, max_length=150)
    fault_category: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=5000)
    priority: RequestPriority


class EquipmentBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    equipment_id: int
    equipment_name: str


class MaintenanceRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    request_id: int
    building: BuildingBrief
    equipment: EquipmentBrief | None
    submitted_by: UserBrief = Field(validation_alias="submitter")
    assigned_to: UserBrief | None = Field(validation_alias="assignee")
    room_location: str
    fault_category: str
    description: str
    priority: RequestPriority
    status: RequestStatus
    created_at: AwareDatetime
    updated_at: AwareDatetime


class RequestStatusHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status_history_id: int
    previous_status: RequestStatus | None
    new_status: RequestStatus
    note: str | None
    changed_at: AwareDatetime
    changed_by: UserBrief = Field(validation_alias="changed_by_user")


class MaintenanceRequestAssign(BaseModel):
    model_config = ConfigDict(extra="forbid")
    assigned_to: int


class MaintenanceRequestStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    status: RequestStatus
    note: str | None = Field(default=None, max_length=500)

    @field_validator("note")
    @classmethod
    def empty_note_to_none(cls, value: str | None) -> str | None:
        return value or None
