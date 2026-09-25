from datetime import date
from enum import Enum
from pydantic import BaseModel, ConfigDict


class ReportType(str, Enum):
    MAINTENANCE_REQUESTS = "MAINTENANCE_REQUESTS"
    EQUIPMENT_HEALTH = "EQUIPMENT_HEALTH"
    ENERGY_SUSTAINABILITY = "ENERGY_SUSTAINABILITY"
    COMFORT = "COMFORT"
    ALERTS_INCIDENTS = "ALERTS_INCIDENTS"
    SAFETY_SECURITY = "SAFETY_SECURITY"


class ReportResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    report_type: ReportType
    columns: list[str]
    rows: list[dict]
    summary: dict[str, int | float | str | None]
