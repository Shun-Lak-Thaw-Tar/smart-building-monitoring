from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.schemas.auth import UserBrief
from app.schemas.building import BuildingBrief
from app.schemas.maintenance_request import RequestStatus


class EquipmentMaintenanceBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    equipment_id: int
    equipment_name: str
    building: BuildingBrief


class MaintenanceRequestBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    request_id: int
    status: RequestStatus


class MaintenanceHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    history_id: int
    equipment: EquipmentMaintenanceBrief
    request: MaintenanceRequestBrief | None
    completed_by: UserBrief = Field(validation_alias="completed_by_user")
    action_details: str
    completed_at: AwareDatetime


class MaintenanceHistoryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    equipment_id: int
    request_id: int | None = None
    action_details: str = Field(min_length=1, max_length=2000)
