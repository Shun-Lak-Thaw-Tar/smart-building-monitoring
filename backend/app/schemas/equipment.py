from enum import Enum

from pydantic import AwareDatetime, BaseModel, ConfigDict

from app.schemas.building import BuildingBrief


class EquipmentStatus(str, Enum):
    OPERATIONAL = "OPERATIONAL"
    MAINTENANCE_REQUIRED = "MAINTENANCE_REQUIRED"
    OUT_OF_SERVICE = "OUT_OF_SERVICE"


class EquipmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    equipment_id: int
    equipment_name: str
    equipment_type: str
    location: str
    status: EquipmentStatus
    created_at: AwareDatetime
    building: BuildingBrief
