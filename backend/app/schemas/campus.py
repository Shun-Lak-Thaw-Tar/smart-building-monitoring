from decimal import Decimal

from pydantic import BaseModel, field_serializer

from app.schemas.building import BuildingBrief
from app.schemas.comfort import ComfortCondition
from app.schemas.energy import EnergyCondition
from app.schemas.monitoring import BuildingOverallStatus


class CampusBuildingOverview(BaseModel):
    building: BuildingBrief
    operational_status: BuildingOverallStatus
    open_maintenance_requests: int
    high_priority_open_requests: int
    equipment_attention_count: int
    active_alert_count: int
    critical_alert_count: int
    energy_condition: EnergyCondition | None
    latest_energy_value: Decimal | None
    comfort_condition: ComfortCondition | None
    latest_temperature: Decimal | None
    latest_humidity: Decimal | None

    @field_serializer("latest_energy_value", "latest_temperature", "latest_humidity", when_used="json")
    def serialize_measurement(self, value: Decimal | None) -> float | None:
        return float(value) if value is not None else None


class CampusTotals(BaseModel):
    buildings: int
    normal_buildings: int
    attention_buildings: int
    critical_buildings: int
    open_maintenance_requests: int
    high_priority_open_requests: int
    equipment_attention_count: int
    active_alert_count: int
    critical_alert_count: int
    high_usage_buildings: int
    uncomfortable_buildings: int


class CampusOverviewResponse(BaseModel):
    totals: CampusTotals
    buildings: list[CampusBuildingOverview]
