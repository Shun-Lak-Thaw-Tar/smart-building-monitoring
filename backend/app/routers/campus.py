from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin
from app.db.session import get_session
from app.schemas.campus import CampusOverviewResponse
from app.services.campus import campus_overview
from app.services.requests import write_transaction

router = APIRouter(prefix="/api/campus", tags=["Campus operations"], dependencies=[Depends(require_admin)],
                   responses={401: {"description": "Authentication required"}, 403: {"description": "Insufficient permissions"}, 503: {"description": "Database service unavailable"}})


@router.get("/overview", response_model=CampusOverviewResponse, summary="Get campus operations overview (ADMIN)")
def get_overview(session: Annotated[Session, Depends(get_session)]):
    # Energy and comfort summaries maintain their own deduplicated system alerts.
    with write_transaction(session):
        return campus_overview(session)
