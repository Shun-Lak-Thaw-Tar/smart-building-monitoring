from datetime import date
from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.dependencies import require_admin
from app.db.session import get_session
from app.schemas.ids import OptionalQueryDatabaseId
from app.schemas.reports import ReportResponse, ReportType
from app.services.reports import operational_report

router = APIRouter(prefix="/api/reports", tags=["Reports"], dependencies=[Depends(require_admin)])

@router.get("/{report_type}", response_model=ReportResponse, summary="Get filtered operational report (ADMIN)")
def get_report(report_type: ReportType, session: Annotated[Session, Depends(get_session)], building_id: OptionalQueryDatabaseId = None, status: str | None = None, category: str | None = None, start_date: date | None = None, end_date: date | None = None):
    data = operational_report(session, report_type.value, building_id, status, category, start_date, end_date)
    return {"report_type": report_type, **data}
