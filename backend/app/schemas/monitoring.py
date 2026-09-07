from enum import Enum

from pydantic import BaseModel

from app.schemas.building import BuildingBrief
from app.schemas.environment import EnvironmentalReadingResponse


class BuildingOverallStatus(str, Enum):
    NORMAL = "NORMAL"
    ATTENTION = "ATTENTION"
    CRITICAL = "CRITICAL"


class EquipmentSummary(BaseModel):
    total: int = 0
    operational: int = 0
    maintenance_required: int = 0
    out_of_service: int = 0


class RequestSummary(BaseModel):
    total: int = 0
    pending: int = 0
    in_progress: int = 0
    resolved: int = 0
    unresolved_high_priority: int = 0


class BuildingMonitoringResponse(BaseModel):
    building: BuildingBrief
    overall_status: BuildingOverallStatus
    latest_environment: EnvironmentalReadingResponse | None
    equipment_summary: EquipmentSummary
    request_summary: RequestSummary
