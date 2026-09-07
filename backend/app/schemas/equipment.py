from enum import Enum

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

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


class EquipmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    building_id: int
    equipment_name: str = Field(min_length=1, max_length=150)
    equipment_type: str = Field(min_length=1, max_length=100)
    location: str = Field(min_length=1, max_length=150)
    status: EquipmentStatus = EquipmentStatus.OPERATIONAL


class EquipmentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    equipment_name: str | None = Field(default=None, min_length=1, max_length=150)
    equipment_type: str | None = Field(default=None, min_length=1, max_length=100)
    location: str | None = Field(default=None, min_length=1, max_length=150)
    status: EquipmentStatus | None = None

    @model_validator(mode="after")
    def require_nonnull_update(self):
        if not self.model_fields_set:
            raise ValueError("At least one equipment field is required")
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Equipment fields cannot be null")
        return self
