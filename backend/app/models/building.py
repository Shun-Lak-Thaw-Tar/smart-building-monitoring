from __future__ import annotations

from typing import TYPE_CHECKING
from sqlalchemy import Identity, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from .equipment import Equipment
    from .maintenance_request import MaintenanceRequest
    from .environmental_reading import EnvironmentalReading


class Building(Base):
    __tablename__ = "buildings"

    building_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    building_name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str | None] = mapped_column(Text)

    equipment: Mapped[list[Equipment]] = relationship(back_populates="building", passive_deletes="all")
    requests: Mapped[list[MaintenanceRequest]] = relationship(back_populates="building", passive_deletes="all")
    readings: Mapped[list[EnvironmentalReading]] = relationship(back_populates="building", passive_deletes="all")
