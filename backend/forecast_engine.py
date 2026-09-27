"""
COA Goods-Train Forecast Module.

Problem statement requirement: "goods trains forecast from the Control Office".
This module models the Control Office Application's published freight forecast:
per corridor, per day, how many goods trains are forecast to run, and which
pre-dawn/night hours are forecast-dense.

Deterministic pseudo-model (no external service needed for the demo):
  - Corridor characteristics (track type, speed) seed a base freight load.
  - A stable per-(corridor, day-index) hash adds day-to-day variation.
  - Weekend days get more freight pathing on trunk corridors (weekly cycle).

Every number is derived from data — nothing is asserted. In production this
module would be swapped for the real COA freight path forecast feed without
changing its interface (see backend/routers/data_fabric.py, adapter
"coa_freight_forecast").
"""
from __future__ import annotations

import hashlib
import datetime
from typing import Dict, List

# Days-ahead horizon published by the COA in this model
FORECAST_HORIZON_DAYS = 30

# Freight density classification by forecast goods trains per day on a corridor
def classify_density(count: float) -> str:
    if count >= 18:
        return "VERY_HIGH"
    if count >= 12:
        return "HIGH"
    if count >= 6:
        return "MEDIUM"
    return "LOW"


def _stable_hash(*parts) -> int:
    h = hashlib.sha256("|".join(str(p) for p in parts).encode("utf-8")).hexdigest()
    return int(h[:8], 16)


def _corridor_base_freight(track_type: str, max_speed: int, distance_km: float) -> float:
    """Base freight trains/day derived from corridor characteristics."""
    base = 6.0
    t = (track_type or "").lower()
    if "quad" in t:
        base += 8.0
    elif "double" in t:
        base += 4.0
    # Higher-speed trunk corridors carry proportionally more freight paths
    base += min(6.0, max(0.0, (max_speed or 100) - 100) / 15.0)
    # Longer sections accumulate more terminating paths
    base += min(3.0, max(0.0, (distance_km or 25.0) - 25.0) / 40.0)
    return base


def forecast_for_corridor(
    corridor_id: int,
    track_type: str,
    max_speed: int,
    distance_km: float,
    start_date: datetime.date,
    days: int,
) -> List[Dict]:
    """Per-day freight forecast rows for one corridor."""
    base = _corridor_base_freight(track_type, max_speed, distance_km)
    rows = []
    for d in range(days):
        day = start_date + datetime.timedelta(days=d)
        # Weekly cycle: Fri/Sat/Sun see heavier freight pathing on trunk lines
        weekly = 1.15 if day.weekday() >= 4 else 1.0
        # Stable pseudo-random daily variation in [-18%, +18%]
        variation = 0.82 + (_stable_hash(corridor_id, day.isoformat()) % 37) / 100.0
        count = base * weekly * variation
        rows.append({
            "date": day.isoformat(),
            "day_index": d,
            "goods_trains_forecast": round(count, 1),
            "density": classify_density(count),
            # Pre-dawn lull quality: freight pathing concentrates in the lull,
            # so high freight days shrink the usable maintenance window.
            "lull_pressure": round(min(1.0, count / 24.0), 2),
        })
    return rows


def network_forecast(
    corridors: List[Dict], start_date: datetime.date, days: int
) -> Dict:
    """
    Network-wide forecast summary.

    `corridors` rows need: id, code, name, track_type, max_speed, distance_km.
    Returns per-day network freight totals plus per-corridor series.
    """
    per_corridor: Dict[int, List[Dict]] = {}
    daily_totals: List[Dict] = []
    for d in range(days):
        daily_totals.append({
            "date": (start_date + datetime.timedelta(days=d)).isoformat(),
            "goods_trains_forecast": 0.0,
        })

    for c in corridors:
        rows = forecast_for_corridor(
            c["id"], c.get("track_type", "Double Line"),
            c.get("max_speed", 100), c.get("distance_km", 25.0),
            start_date, days,
        )
        per_corridor[c["id"]] = rows
        for i, row in enumerate(rows):
            daily_totals[i]["goods_trains_forecast"] += row["goods_trains_forecast"]

    for row in daily_totals:
        row["goods_trains_forecast"] = round(row["goods_trains_forecast"], 1)

    total = sum(r["goods_trains_forecast"] for r in daily_totals)
    avg = total / max(1, len(daily_totals))
    dense = [r for r in daily_totals if r["goods_trains_forecast"] >= 1.10 * avg]
    return {
        "start_date": start_date.isoformat(),
        "days": days,
        "daily_totals": daily_totals,
        "per_corridor": {str(k): v for k, v in per_corridor.items()},
        "summary": {
            "network_goods_trains_forecast": round(total, 1),
            "daily_average": round(avg, 1),
            "high_density_days": len(dense),
            "high_density_dates": [r["date"] for r in dense],
        },
    }
