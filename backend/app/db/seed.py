"""Deterministic SIMULATED demo data; no users or maintenance workflow data.

Existing matching records are preserved. An advisory transaction lock serializes
seed runs without adding uniqueness rules to the agreed application schema.
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db.session import get_engine
from app.models import Building, Equipment, EnvironmentalReading, Room

BUILDINGS = ("Building 216", "Building 209", "JS Building")
EQUIPMENT = (
    ("Building 216", "Air Conditioner 01", "HVAC", "Room 201", "OPERATIONAL", "201"),
    ("Building 216", "Projector 04", "AV", "Room 205", "MAINTENANCE_REQUIRED", "202"),
    ("Building 216", "Lighting Zone A", "Electrical", "Corridor", "OPERATIONAL", None),
    ("Building 209", "Air Conditioner 02", "HVAC", "Room 305", "OPERATIONAL", "301"),
    ("Building 209", "Lift Controller 01", "Lift System", "Ground Floor", "OPERATIONAL", None),
    ("Building 209", "Projector 07", "AV", "Room 310", "OUT_OF_SERVICE", "302"),
    ("JS Building", "Air Conditioner 03", "HVAC", "Room 102", "OPERATIONAL", "201"),
    ("JS Building", "Lighting Zone B", "Electrical", "Corridor", "OPERATIONAL", None),
    ("JS Building", "Water Pump 01", "Plumbing", "Plant Room", "MAINTENANCE_REQUIRED", None),
)
ROOMS = (
    ("Building 216", "201", "Admissions Office", "OFFICE", 2, "Demo office for student admissions and campus enquiries."),
    ("Building 216", "202", "Faculty Meeting Room", "MEETING_ROOM", 2, "Demo meeting space for faculty planning and small group sessions."),
    ("Building 216", "301", "Computer Lab 216", "COMPUTER_LAB", 3, "Demo computer lab for scheduled teaching and practical work."),
    ("Building 216", "302", "Network Server Room", "TECHNICAL_SERVER_ROOM", 3, "Demo technical room for network and server infrastructure."),
    ("Building 209", "201", "Finance Office", "OFFICE", 2, "Demo office for finance and administrative support."),
    ("Building 209", "202", "Department Meeting Room", "MEETING_ROOM", 2, "Demo meeting space for departmental discussions and reviews."),
    ("Building 209", "301", "Computer Lab 209", "COMPUTER_LAB", 3, "Demo computer lab for digital learning activities."),
    ("Building 209", "302", "Technical Server Room", "TECHNICAL_SERVER_ROOM", 3, "Demo technical room supporting campus services."),
    ("JS Building", "201", "Student Services Office", "OFFICE", 2, "Demo office for student support and service enquiries."),
    ("JS Building", "202", "Project Meeting Room", "MEETING_ROOM", 2, "Demo meeting space for project work and consultations."),
    ("JS Building", "301", "Computer Lab JS", "COMPUTER_LAB", 3, "Demo computer lab for supervised coursework."),
    ("JS Building", "302", "Systems Server Room", "TECHNICAL_SERVER_ROOM", 3, "Demo technical room for building systems infrastructure."),
)
# Fixed UTC timestamps ensure reruns never produce new baseline time-series rows.
BASELINE_START = datetime(2026, 9, 1, 8, tzinfo=timezone.utc)


def seed_baseline(session: Session) -> dict[str, int]:
    """Insert missing baseline rows in the caller's transaction; never commit here."""
    session.execute(text("SELECT pg_advisory_xact_lock(333, 32)"))
    added = {"buildings": 0, "equipment": 0, "environmental_readings": 0, "rooms": 0}
    buildings = {}
    for name in BUILDINGS:
        building = session.scalar(select(Building).where(Building.building_name == name))
        if building is None:
            building = Building(building_name=name)
            session.add(building)
            session.flush()
            added["buildings"] += 1
        buildings[name] = building

    for name, room_number, room_name, room_type, floor, description in ROOMS:
        building_id = buildings[name].building_id
        existing = session.scalar(select(Room.room_id).where(
            Room.building_id == building_id, Room.room_number == room_number,
        ).limit(1))
        if existing is None:
            session.add(Room(building_id=building_id, room_number=room_number, room_name=room_name,
                             room_type=room_type, floor=floor, description=description))
            added["rooms"] += 1
    session.flush()

    room_ids = {(room.building_id, room.room_number): room.room_id for room in session.scalars(select(Room)).all()}
    for name, equipment_name, equipment_type, location, status, room_number in EQUIPMENT:
        building_id = buildings[name].building_id
        assigned_room_id = room_ids[(building_id, room_number)] if room_number else None
        existing = session.scalar(select(Equipment).where(
            Equipment.building_id == building_id,
            Equipment.equipment_name == equipment_name,
            Equipment.location == location,
        ).limit(1))
        if existing is None:
            session.add(Equipment(building_id=building_id, room_id=assigned_room_id, equipment_name=equipment_name,
                                  equipment_type=equipment_type, location=location, status=status))
            added["equipment"] += 1
        elif room_number and existing.room_id != assigned_room_id:
            existing.room_id = assigned_room_id

    for offset, name in enumerate(BUILDINGS):
        for sample in range(5):
            recorded_at = BASELINE_START + timedelta(hours=sample)
            building_id = buildings[name].building_id
            existing = session.scalar(select(EnvironmentalReading.reading_id).where(
                EnvironmentalReading.building_id == building_id,
                EnvironmentalReading.recorded_at == recorded_at,
            ).limit(1))
            if existing is None:
                session.add(EnvironmentalReading(
                    building_id=building_id, recorded_at=recorded_at,
                    temperature=Decimal("21.50") + Decimal(offset) + Decimal(sample) * Decimal("0.40"),
                    humidity=Decimal("43.00") + Decimal(offset * 4 + sample * 2),
                    energy_consumption=Decimal("110.00") + Decimal(offset * 20 + sample * 5),
                ))
                added["environmental_readings"] += 1
    session.flush()
    return added


def main() -> None:
    with Session(get_engine()) as session, session.begin():
        added = seed_baseline(session)
    print("SIMULATED baseline rows added:", added)


if __name__ == "__main__":
    main()
