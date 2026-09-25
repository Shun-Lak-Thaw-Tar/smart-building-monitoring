from enum import Enum
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field
from app.schemas.building import BuildingBrief
from app.schemas.ids import DatabaseId


class SafetySection(str, Enum):
    FIRE_SAFETY = "FIRE_SAFETY"
    SECURITY_ACCESS = "SECURITY_ACCESS"
    HAZARD_ADVISORY = "HAZARD_ADVISORY"


class FireStatus(str, Enum):
    NORMAL = "NORMAL"; FAULT = "FAULT"; TESTING = "TESTING"; OFFLINE = "OFFLINE"; ALARM = "ALARM"


class AccessEventType(str, Enum):
    GRANTED = "GRANTED"; DENIED = "DENIED"; DOOR_OPEN = "DOOR_OPEN"; FORCED_ENTRY = "FORCED_ENTRY"


class HazardType(str, Enum):
    FIRE = "FIRE"; FLOOD = "FLOOD"; SEVERE_WEATHER = "SEVERE_WEATHER"; EARTHQUAKE = "EARTHQUAKE"; POWER_FAILURE = "POWER_FAILURE"


class SafetySeverity(str, Enum):
    INFO = "INFO"; WARNING = "WARNING"; CRITICAL = "CRITICAL"


class SafetyEventCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    building_id: DatabaseId | None = None
    section: SafetySection
    name: str = Field(min_length=1, max_length=160)
    event_type: str = Field(min_length=1, max_length=40)
    status: str = Field(min_length=1, max_length=20)
    severity: SafetySeverity = SafetySeverity.INFO
    description: str | None = Field(default=None, max_length=2000)


class SafetyEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    event_id: int
    building: BuildingBrief | None
    section: SafetySection
    name: str
    event_type: str
    status: str
    severity: SafetySeverity
    description: str | None
    occurred_at: AwareDatetime
    resolved_at: AwareDatetime | None
