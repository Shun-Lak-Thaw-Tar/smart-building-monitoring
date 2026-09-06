from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.models import Building, EnvironmentalReading
from app.schemas.environment import (
    BuildingEnvironmentHistoryResponse, BuildingEnvironmentResponse,
)

router = APIRouter(
    prefix="/api/environment", tags=["Environment"],
    responses={503: {"description": "Database service unavailable"}},
)


@router.get(
    "", response_model=list[BuildingEnvironmentResponse],
    summary="Get latest environmental readings",
    description="One latest simulated reading per building with data. Buildings without readings are omitted.",
)
def get_environment(session: Annotated[Session, Depends(get_session)]):
    # Rank by timestamp first. ID only breaks ties at the same timestamp.
    ranked = select(
        EnvironmentalReading.reading_id,
        func.row_number().over(
            partition_by=EnvironmentalReading.building_id,
            order_by=(EnvironmentalReading.recorded_at.desc(), EnvironmentalReading.reading_id.desc()),
        ).label("position"),
    ).subquery()
    statement = (
        select(Building, EnvironmentalReading)
        .join(EnvironmentalReading, EnvironmentalReading.building_id == Building.building_id)
        .join(ranked, ranked.c.reading_id == EnvironmentalReading.reading_id)
        .where(ranked.c.position == 1)
        .order_by(Building.building_id)
    )
    return [{"building": building, "reading": reading} for building, reading in session.execute(statement)]


@router.get(
    "/{building_id}", response_model=BuildingEnvironmentHistoryResponse,
    summary="Get building environmental history",
    responses={404: {"description": "Building not found"}},
)
def get_environment_history(
    building_id: int,
    session: Annotated[Session, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=100, description="Maximum recent readings")] = 10,
):
    building = session.get(Building, building_id)
    if building is None:
        raise HTTPException(status_code=404, detail="Building not found")
    readings = session.scalars(
        select(EnvironmentalReading)
        .where(EnvironmentalReading.building_id == building_id)
        .order_by(EnvironmentalReading.recorded_at.desc(), EnvironmentalReading.reading_id.desc())
        .limit(limit)
    ).all()
    return {"building": building, "readings": readings}
