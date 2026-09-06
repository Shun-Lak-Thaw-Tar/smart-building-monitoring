from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Identity, Index, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from .building import Building


class EnvironmentalReading(Base):
    __tablename__ = "environmental_readings"
    __table_args__ = (
        CheckConstraint("humidity >= 0 AND humidity <= 100", name="ck_environmental_readings_humidity"),
        CheckConstraint("energy_consumption >= 0", name="ck_environmental_readings_energy"),
        Index("ix_environmental_readings_building_id_recorded_at", "building_id", "recorded_at"),
    )

    reading_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.building_id", ondelete="RESTRICT"))
    temperature: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    humidity: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    energy_consumption: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    building: Mapped[Building] = relationship(back_populates="readings")
