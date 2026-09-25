from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Identity, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from .building import Building
    from .equipment import Equipment


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = (UniqueConstraint("building_id", "room_number", name="uq_rooms_building_room_number"),)

    room_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.building_id", ondelete="RESTRICT"), index=True)
    room_number: Mapped[str] = mapped_column(String(20))
    room_name: Mapped[str] = mapped_column(String(120))
    room_type: Mapped[str] = mapped_column(String(50), index=True)
    floor: Mapped[int] = mapped_column(Integer, index=True)
    description: Mapped[str | None] = mapped_column(Text)

    building: Mapped[Building] = relationship(back_populates="rooms")
    equipment: Mapped[list[Equipment]] = relationship(back_populates="room", passive_deletes="all")
