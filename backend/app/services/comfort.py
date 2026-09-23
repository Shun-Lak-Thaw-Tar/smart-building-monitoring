"""Explainable comfort classifications from existing temperature and humidity readings.

Preferred conditions: 20–26°C and 40–60% humidity.
Acceptable conditions: 18–28°C and 30–70% humidity.
Both preferred values are COMFORTABLE. A value outside preferred but still
acceptable needs ATTENTION. A value outside acceptable is UNCOMFORTABLE.
"""
from collections import defaultdict
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Alert, Building, EnvironmentalReading

PREFERRED_TEMPERATURE_MIN = Decimal("20")
PREFERRED_TEMPERATURE_MAX = Decimal("26")
PREFERRED_HUMIDITY_MIN = Decimal("40")
PREFERRED_HUMIDITY_MAX = Decimal("60")
ACCEPTABLE_TEMPERATURE_MIN = Decimal("18")
ACCEPTABLE_TEMPERATURE_MAX = Decimal("28")
ACCEPTABLE_HUMIDITY_MIN = Decimal("30")
ACCEPTABLE_HUMIDITY_MAX = Decimal("70")
RECENT_READING_LIMIT = 6


def building_comfort_summaries(session: Session) -> list[dict]:
    buildings = session.scalars(select(Building).order_by(Building.building_id)).all()
    readings_by_building: dict[int, list[EnvironmentalReading]] = defaultdict(list)
    for reading in session.scalars(select(EnvironmentalReading).order_by(
        EnvironmentalReading.building_id,
        EnvironmentalReading.recorded_at.desc(),
        EnvironmentalReading.reading_id.desc(),
    )).all():
        readings_by_building[reading.building_id].append(reading)

    summaries, uncomfortable = [], []
    for building in buildings:
        readings = readings_by_building[building.building_id]
        if not readings:
            summaries.append({
                "building": building, "latest_temperature": None, "latest_humidity": None,
                "condition": None, "reason": None, "recommendation": None,
                "timestamp": None, "recent_readings": [],
            })
            continue
        latest = readings[0]
        condition, reason, recommendation = classify_comfort(latest.temperature, latest.humidity)
        summary = {
            "building": building,
            "latest_temperature": latest.temperature,
            "latest_humidity": latest.humidity,
            "condition": condition,
            "reason": reason,
            "recommendation": recommendation,
            "timestamp": latest.recorded_at,
            "recent_readings": [
                {"temperature": reading.temperature, "humidity": reading.humidity, "recorded_at": reading.recorded_at}
                for reading in reversed(readings[:RECENT_READING_LIMIT])
            ],
        }
        summaries.append(summary)
        if condition == "UNCOMFORTABLE":
            uncomfortable.append(summary)
    _create_missing_uncomfortable_alerts(session, uncomfortable)
    return summaries


def classify_comfort(temperature: Decimal, humidity: Decimal) -> tuple[str, str, str]:
    temperature_preferred = PREFERRED_TEMPERATURE_MIN <= temperature <= PREFERRED_TEMPERATURE_MAX
    humidity_preferred = PREFERRED_HUMIDITY_MIN <= humidity <= PREFERRED_HUMIDITY_MAX
    temperature_acceptable = ACCEPTABLE_TEMPERATURE_MIN <= temperature <= ACCEPTABLE_TEMPERATURE_MAX
    humidity_acceptable = ACCEPTABLE_HUMIDITY_MIN <= humidity <= ACCEPTABLE_HUMIDITY_MAX
    if temperature_preferred and humidity_preferred:
        return "COMFORTABLE", "WITHIN_PREFERRED_RANGES", "NO_ACTION_NEEDED"
    if not temperature_acceptable or not humidity_acceptable:
        if not temperature_acceptable and not humidity_acceptable:
            return "UNCOMFORTABLE", "TEMPERATURE_AND_HUMIDITY_OUTSIDE_ACCEPTABLE_RANGE", "ADJUST_TEMPERATURE_AND_HUMIDITY"
        if not temperature_acceptable:
            return "UNCOMFORTABLE", "TEMPERATURE_OUTSIDE_ACCEPTABLE_RANGE", "ADJUST_TEMPERATURE"
        return "UNCOMFORTABLE", "HUMIDITY_OUTSIDE_ACCEPTABLE_RANGE", "ADJUST_HUMIDITY"
    if not temperature_preferred and not humidity_preferred:
        return "ATTENTION", "TEMPERATURE_AND_HUMIDITY_NEED_ADJUSTMENT", "ADJUST_TEMPERATURE_AND_HUMIDITY"
    if not temperature_preferred:
        return "ATTENTION", "TEMPERATURE_OUTSIDE_PREFERRED_RANGE", "ADJUST_TEMPERATURE"
    return "ATTENTION", "HUMIDITY_OUTSIDE_PREFERRED_RANGE", "ADJUST_HUMIDITY"


def _create_missing_uncomfortable_alerts(session: Session, summaries: list[dict]) -> None:
    if not summaries:
        return
    building_ids = [summary["building"].building_id for summary in summaries]
    active = set(session.scalars(select(Alert.building_id).where(
        Alert.building_id.in_(building_ids), Alert.category == "COMFORT", Alert.status == "ACTIVE",
    )).all())
    for summary in summaries:
        building = summary["building"]
        if building.building_id in active:
            continue
        session.add(Alert(
            building_id=building.building_id,
            category="COMFORT",
            severity="WARNING",
            title="Uncomfortable building conditions detected",
            description=(
                f"Latest reading: {summary['latest_temperature']}°C and {summary['latest_humidity']}% humidity. "
                f"Reason: {summary['reason']}."
            ),
            status="ACTIVE",
        ))
