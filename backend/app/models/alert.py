from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Identity, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from .building import Building
    from .equipment import Equipment
    from .maintenance_request import MaintenanceRequest
    from .user import User


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (
        CheckConstraint("category IN ('EQUIPMENT', 'ENERGY', 'COMFORT')", name="ck_alerts_category"),
        CheckConstraint("severity IN ('INFO', 'WARNING', 'CRITICAL')", name="ck_alerts_severity"),
        CheckConstraint("status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')", name="ck_alerts_status"),
    )

    alert_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.building_id", ondelete="RESTRICT"), index=True)
    equipment_id: Mapped[int | None] = mapped_column(ForeignKey("equipment.equipment_id", ondelete="SET NULL"), index=True)
    category: Mapped[str] = mapped_column(String(20), index=True)
    severity: Mapped[str] = mapped_column(String(20), index=True)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), server_default=text("'ACTIVE'"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    acknowledged_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id", ondelete="SET NULL"), index=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id", ondelete="SET NULL"), index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    maintenance_request_id: Mapped[int | None] = mapped_column(
        ForeignKey("maintenance_requests.request_id", ondelete="SET NULL"), unique=True, index=True
    )

    building: Mapped[Building] = relationship(back_populates="alerts")
    equipment: Mapped[Equipment | None] = relationship(back_populates="alerts")
    acknowledged_by_user: Mapped[User | None] = relationship(foreign_keys=[acknowledged_by])
    resolved_by_user: Mapped[User | None] = relationship(foreign_keys=[resolved_by])
    maintenance_request: Mapped[MaintenanceRequest | None] = relationship(foreign_keys=[maintenance_request_id])
