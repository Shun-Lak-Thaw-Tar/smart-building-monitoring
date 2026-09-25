from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Identity, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from .building import Building


class SafetyEvent(Base):
    """A deliberately simulated safety, access, or hazard event for demonstrations."""

    __tablename__ = "safety_events"
    __table_args__ = (
        CheckConstraint("section IN ('FIRE_SAFETY', 'SECURITY_ACCESS', 'HAZARD_ADVISORY')", name="ck_safety_events_section"),
        CheckConstraint("status IN ('NORMAL', 'FAULT', 'TESTING', 'OFFLINE', 'ALARM', 'ACTIVE', 'RESOLVED')", name="ck_safety_events_status"),
        CheckConstraint("severity IN ('INFO', 'WARNING', 'CRITICAL')", name="ck_safety_events_severity"),
    )

    event_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    building_id: Mapped[int | None] = mapped_column(ForeignKey("buildings.building_id", ondelete="RESTRICT"), index=True)
    section: Mapped[str] = mapped_column(String(30), index=True)
    name: Mapped[str] = mapped_column(String(160))
    event_type: Mapped[str] = mapped_column(String(40), index=True)
    status: Mapped[str] = mapped_column(String(20), index=True)
    severity: Mapped[str] = mapped_column(String(20), server_default="INFO")
    description: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    building: Mapped[Building | None] = relationship(back_populates="safety_events")
