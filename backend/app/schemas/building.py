from pydantic import BaseModel, ConfigDict


class BuildingBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    building_id: int
    building_name: str


class BuildingResponse(BuildingBrief):
    description: str | None
