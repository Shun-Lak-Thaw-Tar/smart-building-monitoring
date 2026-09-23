from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.schemas.comfort import BuildingComfortSummary
from app.services.comfort import building_comfort_summaries
from app.services.requests import write_transaction

router = APIRouter(prefix="/api/comfort", tags=["Comfort intelligence"], responses={503: {"description": "Database service unavailable"}})


@router.get("/buildings", response_model=list[BuildingComfortSummary], summary="Get building comfort intelligence")
def list_building_comfort(session: Annotated[Session, Depends(get_session)]):
    # One deduplicated system COMFORT alert may be added for newly
    # uncomfortable buildings. Existing alerts are never auto-resolved here.
    with write_transaction(session):
        return building_comfort_summaries(session)
