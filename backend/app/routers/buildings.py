from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.models import Building
from app.schemas.building import BuildingResponse

router = APIRouter(
    prefix="/api/buildings", tags=["Buildings"],
    responses={503: {"description": "Database service unavailable"}},
)


@router.get("", response_model=list[BuildingResponse], summary="List buildings")
def list_buildings(session: Annotated[Session, Depends(get_session)]):
    return session.scalars(select(Building).order_by(Building.building_id)).all()


@router.get(
    "/{building_id}", response_model=BuildingResponse, summary="Get building",
    responses={404: {"description": "Building not found"}},
)
def get_building(building_id: int, session: Annotated[Session, Depends(get_session)]):
    building = session.get(Building, building_id)
    if building is None:
        raise HTTPException(status_code=404, detail="Building not found")
    return building
