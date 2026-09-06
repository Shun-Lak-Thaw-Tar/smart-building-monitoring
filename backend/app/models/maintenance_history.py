from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import DateTime, ForeignKey, Identity, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from .equipment import Equipment
    from .maintenance_request import MaintenanceRequest
    from .user import User


class MaintenanceHistory(Base):
    __tablename__ = "maintenance_history"

    history_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.equipment_id", ondelete="RESTRICT"), index=True)
    request_id: Mapped[int | None] = mapped_column(ForeignKey("maintenance_requests.request_id", ondelete="SET NULL"), index=True)
    completed_by: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="RESTRICT"), index=True)
    action_details: Mapped[str] = mapped_column(Text)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    equipment: Mapped[Equipment] = relationship(back_populates="maintenance_records")
    request: Mapped[MaintenanceRequest | None] = relationship(back_populates="maintenance_records")
    completed_by_user: Mapped[User] = relationship(back_populates="maintenance_records")
