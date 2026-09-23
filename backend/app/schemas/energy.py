from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, field_serializer

from app.schemas.building import BuildingBrief


class EnergyCondition(str, Enum):
    NORMAL = "NORMAL"
    HIGH_USAGE = "HIGH_USAGE"


class EnergyTrend(str, Enum):
    UP = "UP"
    DOWN = "DOWN"
    STABLE = "STABLE"
    NO_DATA = "NO_DATA"


class EnergyTrendPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    consumption: Decimal
    recorded_at: datetime

    @field_serializer("consumption", when_used="json")
    def serialize_consumption(self, value: Decimal) -> float:
        return float(value)


class BuildingEnergySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    building: BuildingBrief
    latest_consumption: Decimal | None
    recent_average: Decimal | None
    trend: EnergyTrend
    percentage_difference: float | None
    condition: EnergyCondition | None
    timestamp: datetime | None
    recent_readings: list[EnergyTrendPoint]

    @field_serializer("latest_consumption", "recent_average", when_used="json")
    def serialize_measurement(self, value: Decimal | None) -> float | None:
        return float(value) if value is not None else None
