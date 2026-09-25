"""Transparent, derived energy and prototype sustainability intelligence.

Forecast: the next reading is the latest consumption plus the average change
between the oldest and newest value in the six-reading display window. Cost and
carbon are estimates from that forecast using configurable demo constants.
"""
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Alert, Building, EnvironmentalReading

RECENT_AVERAGE_WINDOW = 5
HIGH_USAGE_THRESHOLD_PERCENT = Decimal("20")
TREND_THRESHOLD_PERCENT = Decimal("5")
FORECAST_WINDOW = RECENT_AVERAGE_WINDOW + 1


def _round(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _forecast(readings: list[EnvironmentalReading]) -> Decimal:
    """Project one next period using the average change across recent readings."""
    if len(readings) < 2:
        return _round(readings[-1].energy_consumption)
    change_per_period = (readings[-1].energy_consumption - readings[0].energy_consumption) / (len(readings) - 1)
    return _round(max(Decimal("0"), readings[-1].energy_consumption + change_per_period))


def building_energy_overview(session: Session) -> dict:
    buildings = session.scalars(select(Building).order_by(Building.building_id)).all()
    readings_by_building: dict[int, list[EnvironmentalReading]] = defaultdict(list)
    readings = session.scalars(select(EnvironmentalReading).order_by(
        EnvironmentalReading.building_id, EnvironmentalReading.recorded_at.desc(), EnvironmentalReading.reading_id.desc(),
    )).all()
    for reading in readings:
        readings_by_building[reading.building_id].append(reading)

    tariff = settings.energy_tariff_per_kwh
    factor = settings.energy_emission_factor_kg_per_kwh
    summaries, high_usage_buildings = [], []
    for building in buildings:
        building_readings = readings_by_building[building.building_id]
        if not building_readings:
            summaries.append({"building": building, "latest_consumption": None, "recent_average": None,
                "forecast_consumption": None, "estimated_cost": None, "estimated_carbon": None,
                "trend": "NO_DATA", "percentage_difference": None, "condition": None, "timestamp": None, "recent_readings": []})
            continue
        latest = building_readings[0]
        baseline_readings = building_readings[1:RECENT_AVERAGE_WINDOW + 1]
        baseline = sum((r.energy_consumption for r in baseline_readings), Decimal("0")) / len(baseline_readings) if baseline_readings else latest.energy_consumption
        difference = Decimal("0") if baseline == 0 else ((latest.energy_consumption - baseline) / baseline) * 100
        display_readings = list(reversed(building_readings[:FORECAST_WINDOW]))
        forecast = _forecast(display_readings)
        condition = "HIGH_USAGE" if baseline_readings and difference >= HIGH_USAGE_THRESHOLD_PERCENT else "NORMAL"
        trend = "UP" if difference >= TREND_THRESHOLD_PERCENT else "DOWN" if difference <= -TREND_THRESHOLD_PERCENT else "STABLE"
        summary = {"building": building, "latest_consumption": latest.energy_consumption, "recent_average": _round(baseline),
            "forecast_consumption": forecast, "estimated_cost": _round(forecast * tariff), "estimated_carbon": _round(forecast * factor),
            "trend": trend, "percentage_difference": float(_round(difference)), "condition": condition, "timestamp": latest.recorded_at,
            "recent_readings": [{"consumption": r.energy_consumption, "recorded_at": r.recorded_at} for r in display_readings]}
        summaries.append(summary)
        if condition == "HIGH_USAGE": high_usage_buildings.append(summary)
    _create_missing_high_usage_alerts(session, high_usage_buildings)
    available = [item for item in summaries if item["latest_consumption"] is not None]
    return {"buildings": summaries, "tariff_per_kwh": tariff, "emission_factor_kg_per_kwh": factor,
        "campus_totals": {"latest_consumption": _round(sum((item["latest_consumption"] for item in available), Decimal("0"))),
            "forecast_consumption": _round(sum((item["forecast_consumption"] for item in available), Decimal("0"))),
            "estimated_cost": _round(sum((item["estimated_cost"] for item in available), Decimal("0"))),
            "estimated_carbon": _round(sum((item["estimated_carbon"] for item in available), Decimal("0")))}}


def _create_missing_high_usage_alerts(session: Session, summaries: list[dict]) -> None:
    if not summaries: return
    building_ids = [summary["building"].building_id for summary in summaries]
    active = set(session.scalars(select(Alert.building_id).where(Alert.building_id.in_(building_ids), Alert.category == "ENERGY", Alert.status.in_(("ACTIVE", "ACKNOWLEDGED")))).all())
    for summary in summaries:
        building = summary["building"]
        if building.building_id in active: continue
        session.add(Alert(building_id=building.building_id, category="ENERGY", severity="WARNING", title="High energy usage detected", description=(f"Latest consumption is {summary['percentage_difference']:.2f}% above the average of the previous {RECENT_AVERAGE_WINDOW} readings (threshold: {HIGH_USAGE_THRESHOLD_PERCENT}%)."), status="ACTIVE"))


def building_energy_summaries(session: Session) -> list[dict]:
    """Compatibility helper for existing campus aggregation."""
    return building_energy_overview(session)["buildings"]
