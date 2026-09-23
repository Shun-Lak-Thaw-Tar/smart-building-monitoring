from enum import Enum

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.schemas.building import BuildingBrief
from app.schemas.ids import DatabaseId


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
    RESOLVED = "RESOLVED"


class AlertEquipmentBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    equipment_id: int
    equipment_name: str
    location: str


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
    resolved_at: AwareDatetime | None


class AlertCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    building_id: DatabaseId
    equipment_id: DatabaseId | None = None
    category: AlertCategory
    severity: AlertSeverity
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=2000)
