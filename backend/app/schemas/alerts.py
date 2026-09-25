from enum import Enum

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.schemas.auth import UserBrief
from app.schemas.building import BuildingBrief
from app.schemas.ids import DatabaseId
from app.schemas.maintenance_request import RequestPriority, RequestStatus


class AlertCategory(str, Enum):
    EQUIPMENT = "EQUIPMENT"
    ENERGY = "ENERGY"
    COMFORT = "COMFORT"


class AlertSeverity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class AlertStatus(str, Enum):
    ACTIVE = "ACTIVE"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"


class AlertEquipmentBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    equipment_id: int
    equipment_name: str
    location: str


class AlertMaintenanceRequestBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    request_id: int
    status: RequestStatus
    priority: RequestPriority
    building: BuildingBrief
    equipment: AlertEquipmentBrief | None


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    alert_id: int
    building: BuildingBrief
    equipment: AlertEquipmentBrief | None
    category: AlertCategory
    severity: AlertSeverity
    title: str
    description: str
    status: AlertStatus
    created_at: AwareDatetime
    acknowledged_by: UserBrief | None = Field(validation_alias="acknowledged_by_user")
    acknowledged_at: AwareDatetime | None
    resolved_by: UserBrief | None = Field(validation_alias="resolved_by_user")
    resolved_at: AwareDatetime | None
    maintenance_request: AlertMaintenanceRequestBrief | None


class AlertCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    building_id: DatabaseId
    equipment_id: DatabaseId | None = None
    category: AlertCategory
    severity: AlertSeverity
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=2000)


class AlertMaintenanceRequestCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    room_location: str = Field(min_length=1, max_length=150)
    fault_category: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=5000)
    priority: RequestPriority
