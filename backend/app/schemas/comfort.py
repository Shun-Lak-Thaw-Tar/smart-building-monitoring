from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, field_serializer

from app.schemas.building import BuildingBrief


class ComfortCondition(str, Enum):
    COMFORTABLE = "COMFORTABLE"
    ATTENTION = "ATTENTION"
    UNCOMFORTABLE = "UNCOMFORTABLE"


class ComfortReason(str, Enum):
    WITHIN_PREFERRED_RANGES = "WITHIN_PREFERRED_RANGES"
    TEMPERATURE_OUTSIDE_PREFERRED_RANGE = "TEMPERATURE_OUTSIDE_PREFERRED_RANGE"
    HUMIDITY_OUTSIDE_PREFERRED_RANGE = "HUMIDITY_OUTSIDE_PREFERRED_RANGE"
    TEMPERATURE_AND_HUMIDITY_NEED_ADJUSTMENT = "TEMPERATURE_AND_HUMIDITY_NEED_ADJUSTMENT"
    TEMPERATURE_OUTSIDE_ACCEPTABLE_RANGE = "TEMPERATURE_OUTSIDE_ACCEPTABLE_RANGE"
    HUMIDITY_OUTSIDE_ACCEPTABLE_RANGE = "HUMIDITY_OUTSIDE_ACCEPTABLE_RANGE"
    TEMPERATURE_AND_HUMIDITY_OUTSIDE_ACCEPTABLE_RANGE = "TEMPERATURE_AND_HUMIDITY_OUTSIDE_ACCEPTABLE_RANGE"


class ComfortRecommendation(str, Enum):
    NO_ACTION_NEEDED = "NO_ACTION_NEEDED"
    ADJUST_TEMPERATURE = "ADJUST_TEMPERATURE"
    ADJUST_HUMIDITY = "ADJUST_HUMIDITY"
    ADJUST_TEMPERATURE_AND_HUMIDITY = "ADJUST_TEMPERATURE_AND_HUMIDITY"


class ComfortTrendPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    temperature: Decimal
    humidity: Decimal
    recorded_at: datetime

    @field_serializer("temperature", "humidity", when_used="json")
    def serialize_measurement(self, value: Decimal) -> float:
        return float(value)


class BuildingComfortSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    building: BuildingBrief
    latest_temperature: Decimal | None
    latest_humidity: Decimal | None
    condition: ComfortCondition | None
    reason: ComfortReason | None
    recommendation: ComfortRecommendation | None
    timestamp: datetime | None
    recent_readings: list[ComfortTrendPoint]

    @field_serializer("latest_temperature", "latest_humidity", when_used="json")
    def serialize_measurement(self, value: Decimal | None) -> float | None:
        return float(value) if value is not None else None
