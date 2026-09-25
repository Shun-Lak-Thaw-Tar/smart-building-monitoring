from datetime import datetime
from decimal import Decimal
from enum import Enum
from pydantic import BaseModel, ConfigDict, field_serializer
from app.schemas.building import BuildingBrief
class EnergyCondition(str, Enum): NORMAL="NORMAL"; HIGH_USAGE="HIGH_USAGE"
class EnergyTrend(str, Enum): UP="UP"; DOWN="DOWN"; STABLE="STABLE"; NO_DATA="NO_DATA"
class EnergyTrendPoint(BaseModel):
 model_config=ConfigDict(from_attributes=True); consumption: Decimal; recorded_at: datetime
 @field_serializer("consumption", when_used="json")
 def serialize_consumption(self,v): return float(v)
class BuildingEnergySummary(BaseModel):
 model_config=ConfigDict(from_attributes=True); building: BuildingBrief; latest_consumption: Decimal|None; recent_average: Decimal|None; forecast_consumption: Decimal|None; estimated_cost: Decimal|None; estimated_carbon: Decimal|None; trend: EnergyTrend; percentage_difference: float|None; condition: EnergyCondition|None; timestamp: datetime|None; recent_readings:list[EnergyTrendPoint]
 @field_serializer("latest_consumption","recent_average","forecast_consumption","estimated_cost","estimated_carbon",when_used="json")
 def serialize_measurement(self,v): return float(v) if v is not None else None
class CampusEnergyTotals(BaseModel):
 latest_consumption:Decimal; forecast_consumption:Decimal; estimated_cost:Decimal; estimated_carbon:Decimal
 @field_serializer("latest_consumption","forecast_consumption","estimated_cost","estimated_carbon",when_used="json")
 def serialize_total(self,v): return float(v)
class EnergyOverview(BaseModel):
 buildings:list[BuildingEnergySummary]; tariff_per_kwh:Decimal; emission_factor_kg_per_kwh:Decimal; campus_totals:CampusEnergyTotals
 @field_serializer("tariff_per_kwh","emission_factor_kg_per_kwh",when_used="json")
 def serialize_config(self,v): return float(v)
