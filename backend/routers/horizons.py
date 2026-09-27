"""
Multi-Horizon Planning API — the scored SIH requirements surface.

  GET  /api/plans/weekly            — 7-day optimized block plan
  GET  /api/plans/monthly           — 30-day optimized block plan
  GET  /api/plans?horizon_days=7|30 — parameterized variant
  GET  /api/forecast/goods          — COA goods-train forecast (network + per corridor)
  GET  /api/ml/risk-prioritization  — trained ML model card + ranked assets
  GET  /api/impact/simulation       — baseline vs optimized impact comparison
"""
import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.models import Corridor
from backend.routers.auth import get_current_user
from backend.horizon_planner import generate_multi_horizon_plan, collect_ml_assets
from backend.forecast_engine import network_forecast, FORECAST_HORIZON_DAYS
from backend.ml_prioritization import prioritize_assets

router = APIRouter(prefix="/api", tags=["Multi-Horizon Planning"])


@router.get("/plans/weekly")
def get_weekly_plan(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return generate_multi_horizon_plan(db, horizon_days=7)


@router.get("/plans/monthly")
def get_monthly_plan(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return generate_multi_horizon_plan(db, horizon_days=30)


@router.get("/plans")
def get_plan(
    horizon_days: int = Query(7, ge=1, le=30),
    window_start: Optional[int] = Query(None, ge=0, le=1439),
    window_end: Optional[int] = Query(None, ge=1, le=1440),
    with_baseline: bool = Query(True),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Parameterized plan — also the what-if engine: pass window_start/window_end
    to re-optimize with a different maintenance window (e.g. 2h instead of 4h)."""
    return generate_multi_horizon_plan(
        db,
        horizon_days=horizon_days,
        window_start=window_start,
        window_end=window_end,
        with_baseline=with_baseline,
    )


@router.get("/forecast/goods")
def get_goods_forecast(
    days: int = Query(7, ge=1, le=FORECAST_HORIZON_DAYS),
    corridor_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    corridors = db.query(Corridor).all()
    if corridor_id:
        corridors = [c for c in corridors if c.id == corridor_id]
    rows = [
        {
            "id": c.id, "code": c.code, "name": c.name,
            "track_type": c.track_type, "max_speed": c.max_speed or 100,
            "distance_km": c.distance_km or 25.0,
        }
        for c in corridors
    ]
    fc = network_forecast(rows, datetime.date.today(), days)
    fc["upstream_system"] = "Control Office Application (COA) — freight path forecast"
    fc["data_mode"] = "synthetic-demonstration"
    return fc


@router.get("/ml/risk-prioritization")
def get_ml_prioritization(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    assets = collect_ml_assets(db)
    result = prioritize_assets(assets)
    result["usage"] = (
        "P(failure) weights each job in the multi-horizon planner objective; "
        "top drivers per asset give the explainability trail."
    )
    return result


@router.get("/impact/simulation")
def get_impact_simulation(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    plan = generate_multi_horizon_plan(db, horizon_days=7, with_baseline=True)
    return plan["impact_simulation"]
