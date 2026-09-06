from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Identity, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from .user import User
    from .building import Building
    from .equipment import Equipment
    from .request_status_history import RequestStatusHistory
    from .maintenance_history import MaintenanceHistory


class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"
    __table_args__ = (
        CheckConstraint("priority IN ('LOW', 'MEDIUM', 'HIGH')", name="ck_maintenance_requests_priority"),
        CheckConstraint("status IN ('PENDING', 'IN_PROGRESS', 'RESOLVED')", name="ck_maintenance_requests_status"),
    )

    request_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    submitted_by: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="RESTRICT"), index=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.building_id", ondelete="RESTRICT"), index=True)
    equipment_id: Mapped[int | None] = mapped_column(ForeignKey("equipment.equipment_id", ondelete="SET NULL"), index=True)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.user_id", ondelete="SET NULL"), index=True)
    room_location: Mapped[str] = mapped_column(String(150))
    fault_category: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(20), index=True)
    status: Mapped[str] = mapped_column(String(30), server_default=text("'PENDING'"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    # SQLAlchemy-issued updates set this value; raw SQL writers must set it explicitly.
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    submitter: Mapped[User] = relationship(back_populates="submitted_requests", foreign_keys=[submitted_by])
    assignee: Mapped[User | None] = relationship(back_populates="assigned_requests", foreign_keys=[assigned_to])
    building: Mapped[Building] = relationship(back_populates="requests")
    equipment: Mapped[Equipment | None] = relationship(back_populates="requests")
    status_history: Mapped[list[RequestStatusHistory]] = relationship(back_populates="request", passive_deletes="all")
    maintenance_records: Mapped[list[MaintenanceHistory]] = relationship(back_populates="request", passive_deletes="all")
