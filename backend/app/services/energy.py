"""Transparent, derived energy intelligence from environmental readings.

The latest reading is compared with the average of up to five readings directly
before it. A latest reading 20% or more above that baseline is HIGH_USAGE.
The small fixed window keeps the first version explainable and avoids storing
derived values that can be recalculated from the source readings.
"""
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Alert, Building, EnvironmentalReading

RECENT_AVERAGE_WINDOW = 5
HIGH_USAGE_THRESHOLD_PERCENT = Decimal("20")
TREND_THRESHOLD_PERCENT = Decimal("5")


def building_energy_summaries(session: Session) -> list[dict]:
    buildings = session.scalars(select(Building).order_by(Building.building_id)).all()
    readings_by_building: dict[int, list[EnvironmentalReading]] = defaultdict(list)
    readings = session.scalars(select(EnvironmentalReading).order_by(
        EnvironmentalReading.building_id,
        EnvironmentalReading.recorded_at.desc(),
        EnvironmentalReading.reading_id.desc(),
    )).all()
    for reading in readings:
        readings_by_building[reading.building_id].append(reading)

    summaries = []
    high_usage_buildings: list[dict] = []
    for building in buildings:
        building_readings = readings_by_building[building.building_id]
        if not building_readings:
            summaries.append({
                "building": building, "latest_consumption": None, "recent_average": None,
                "trend": "NO_DATA", "percentage_difference": None, "condition": None,
                "timestamp": None, "recent_readings": [],
            })
            continue

        latest = building_readings[0]
        baseline_readings = building_readings[1:RECENT_AVERAGE_WINDOW + 1]
        # With no earlier reading, use the only available value as a neutral
        # baseline. It cannot be marked high until a comparison exists.
        baseline = (
            sum((reading.energy_consumption for reading in baseline_readings), Decimal("0")) / len(baseline_readings)
            if baseline_readings else latest.energy_consumption
        )
        difference = Decimal("0") if baseline == 0 else ((latest.energy_consumption - baseline) / baseline) * 100
        rounded_difference = difference.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        condition = "HIGH_USAGE" if baseline_readings and difference >= HIGH_USAGE_THRESHOLD_PERCENT else "NORMAL"
        trend = "UP" if difference >= TREND_THRESHOLD_PERCENT else "DOWN" if difference <= -TREND_THRESHOLD_PERCENT else "STABLE"
        summary = {
            "building": building,
            "latest_consumption": latest.energy_consumption,
            "recent_average": baseline.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "trend": trend,
            "percentage_difference": float(rounded_difference),
            "condition": condition,
            "timestamp": latest.recorded_at,
            "recent_readings": [
                {"consumption": reading.energy_consumption, "recorded_at": reading.recorded_at}
                for reading in reversed(building_readings[:RECENT_AVERAGE_WINDOW + 1])
            ],
        }
        summaries.append(summary)
        if condition == "HIGH_USAGE":
            high_usage_buildings.append(summary)

    _create_missing_high_usage_alerts(session, high_usage_buildings)
    return summaries


def _create_missing_high_usage_alerts(session: Session, summaries: list[dict]) -> None:
    if not summaries:
        return
    building_ids = [summary["building"].building_id for summary in summaries]
    active = set(session.scalars(select(Alert.building_id).where(
        Alert.building_id.in_(building_ids), Alert.category == "ENERGY", Alert.status == "ACTIVE",
    )).all())
    for summary in summaries:
        building = summary["building"]
        if building.building_id in active:
            continue
        session.add(Alert(
            building_id=building.building_id,
            category="ENERGY",
            severity="WARNING",
            title="High energy usage detected",
            description=(
                f"Latest consumption is {summary['percentage_difference']:.2f}% above the average of the "
                f"previous {RECENT_AVERAGE_WINDOW} readings (threshold: {HIGH_USAGE_THRESHOLD_PERCENT}%)."
            ),
            status="ACTIVE",
        ))
