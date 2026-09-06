from decimal import Decimal

from pydantic import AwareDatetime, BaseModel, ConfigDict, field_serializer

from app.schemas.building import BuildingBrief


class EnvironmentalReadingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    reading_id: int
    temperature: Decimal
    humidity: Decimal
    energy_consumption: Decimal
    recorded_at: AwareDatetime

    # Pydantic defaults Decimal JSON output to strings. The API contract requires
    # JSON numbers while retaining Decimal values during Python-side validation.
    @field_serializer("temperature", "humidity", "energy_consumption", when_used="json")
    def serialize_measurement(self, value: Decimal) -> float:
        return float(value)


class BuildingEnvironmentResponse(BaseModel):
    building: BuildingBrief
    reading: EnvironmentalReadingResponse


class BuildingEnvironmentHistoryResponse(BaseModel):
    building: BuildingBrief
    readings: list[EnvironmentalReadingResponse]
