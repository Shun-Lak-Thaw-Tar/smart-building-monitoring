from enum import Enum

from pydantic import AwareDatetime, BaseModel, ConfigDict

from app.schemas.equipment import EquipmentResponse


class HealthBand(str, Enum):
    HEALTHY = "HEALTHY"
    ATTENTION = "ATTENTION"
    HIGH_RISK = "HIGH_RISK"


class HealthReason(BaseModel):
    code: str
    count: int | None = None


class MaintenanceContext(BaseModel):
    history_id: int
    action_details: str
    completed_at: AwareDatetime


class EquipmentIntelligenceResponse(BaseModel):
    equipment: EquipmentResponse
    score: int
    health_band: HealthBand
    reasons: list[HealthReason]
    open_request_count: int
    high_priority_open_request_count: int
    recent_maintenance: list[MaintenanceContext]
    suggestions: list[str]
