from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Identity, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from .building import Building
    from .maintenance_request import MaintenanceRequest
    from .maintenance_history import MaintenanceHistory


class Equipment(Base):
    __tablename__ = "equipment"
    __table_args__ = (CheckConstraint("status IN ('OPERATIONAL', 'MAINTENANCE_REQUIRED', 'OUT_OF_SERVICE')", name="ck_equipment_status"),)

    equipment_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.building_id", ondelete="RESTRICT"), index=True)
    equipment_name: Mapped[str] = mapped_column(String(150))
    equipment_type: Mapped[str] = mapped_column(String(100))
    location: Mapped[str] = mapped_column(String(150))
    status: Mapped[str] = mapped_column(String(30), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    building: Mapped[Building] = relationship(back_populates="equipment")
    requests: Mapped[list[MaintenanceRequest]] = relationship(back_populates="equipment", passive_deletes="all")
    maintenance_records: Mapped[list[MaintenanceHistory]] = relationship(back_populates="equipment", passive_deletes="all")
