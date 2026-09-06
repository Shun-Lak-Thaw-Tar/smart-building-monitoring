from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Identity, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from .maintenance_request import MaintenanceRequest
    from .user import User


class RequestStatusHistory(Base):
    __tablename__ = "request_status_history"
    __table_args__ = (
        CheckConstraint("previous_status IS NULL OR previous_status IN ('PENDING', 'IN_PROGRESS', 'RESOLVED')", name="ck_request_status_history_previous_status"),
        CheckConstraint("new_status IN ('PENDING', 'IN_PROGRESS', 'RESOLVED')", name="ck_request_status_history_new_status"),
    )

    status_history_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("maintenance_requests.request_id", ondelete="CASCADE"), index=True)
    changed_by: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="RESTRICT"), index=True)
    previous_status: Mapped[str | None] = mapped_column(String(30))
    new_status: Mapped[str] = mapped_column(String(30))
    note: Mapped[str | None] = mapped_column(Text)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    request: Mapped[MaintenanceRequest] = relationship(back_populates="status_history")
    changed_by_user: Mapped[User] = relationship(back_populates="status_changes")
