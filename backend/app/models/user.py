from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import CheckConstraint, DateTime, Identity, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from .maintenance_request import MaintenanceRequest
    from .request_status_history import RequestStatusHistory
    from .maintenance_history import MaintenanceHistory


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('STAFF', 'ADMIN')", name="ck_users_role"),)

    user_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    submitted_requests: Mapped[list[MaintenanceRequest]] = relationship(back_populates="submitter", foreign_keys="MaintenanceRequest.submitted_by", passive_deletes="all")
    assigned_requests: Mapped[list[MaintenanceRequest]] = relationship(back_populates="assignee", foreign_keys="MaintenanceRequest.assigned_to", passive_deletes="all")
    status_changes: Mapped[list[RequestStatusHistory]] = relationship(back_populates="changed_by_user", passive_deletes="all")
    maintenance_records: Mapped[list[MaintenanceHistory]] = relationship(back_populates="completed_by_user", passive_deletes="all")
