from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.schemas.energy import EnergyOverview
from app.services.energy import building_energy_overview
from app.services.requests import write_transaction

router = APIRouter(prefix="/api/energy", tags=["Energy intelligence"], responses={503: {"description": "Database service unavailable"}})


@router.get("/buildings", response_model=EnergyOverview, summary="Get building energy intelligence")
def list_building_energy(session: Annotated[Session, Depends(get_session)]):
    # Reading the summary may add one deduplicated system ENERGY alert for a
    # newly high-usage building. No alert is automatically resolved here.
    with write_transaction(session):
        return building_energy_overview(session)

