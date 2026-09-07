from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_session
from app.schemas.monitoring import BuildingMonitoringResponse
from app.services.monitoring import building_summaries

router = APIRouter(prefix="/api/monitoring/buildings", tags=["Building monitoring"], dependencies=[Depends(get_current_user)],
                   responses={401: {"description": "Authentication required"}, 503: {"description": "Database service unavailable"}})


@router.get("", response_model=list[BuildingMonitoringResponse], summary="Monitor all buildings (STAFF or ADMIN)",
            description="Derived equipment/request status and latest simulated environment. Environmental values do not affect status.")
def list_building_monitoring(session: Annotated[Session, Depends(get_session)]):
    return building_summaries(session)


@router.get("/{building_id}", response_model=BuildingMonitoringResponse, summary="Monitor one building (STAFF or ADMIN)",
            responses={404: {"description": "Building not found"}})
def get_building_monitoring(building_id: int, session: Annotated[Session, Depends(get_session)]):
    results = building_summaries(session, building_id)
    if not results:
        raise HTTPException(404, "Building not found")
    return results[0]
