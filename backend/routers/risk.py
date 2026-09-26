"""
Asset Risk Engine.

Computes a transparent, deterministic risk score (0-100) for every trackside
asset from observable fields: age, health status, declared criticality,
inspection recency, and the volume/urgency of open maintenance requests.

Design notes:
- The scoring function is pure and explainable: every returned score carries a
  factor breakdown so planners (and auditors) can see WHY an asset is risky.
- No hard-coded health percentages: all numbers are derived from the database.
"""
import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.database import get_db
from backend.models import Asset, Corridor, Department, MaintenanceRequest
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/api/risk", tags=["Asset Risk Engine"])

# Weights sum to 1.0 — tune here, explanation follows automatically.
W_STATUS = 0.35
W_AGE = 0.25
W_CRITICALITY = 0.20
W_INSPECTION = 0.12
W_OPEN_WORK = 0.08

STATUS_SCORES = {"HEALTHY": 10.0, "DEGRADED": 55.0, "FAULTY": 90.0, "UNDER_MAINTENANCE": 40.0}
CRITICALITY_SCORES = {"CRITICAL": 90.0, "HIGH": 70.0, "MEDIUM": 45.0, "LOW": 20.0}

# Expected service life by asset family (years) — used for age wear scoring.
LIFE_BY_TYPE = {
    "OHE": 40, "TRACTION": 30, "SECTION": 30, "CONTACT": 30, "PANTOGRAPH": 20,
    "NEUTRAL": 35, "RETURN": 35, "OVERHEAD": 35, "POINT": 25, "DIGITAL": 20,
    "AUDIO": 20, "SIGNAL": 25, "SOLID": 20, "FAILSAFE": 25, "LEVEL": 30,
    "60KG/M": 50, "PSC": 45, "POINTS": 40, "BALLAST": 20, "RAIL": 50,
    "TRACK": 40, "MAJOR": 100, "24-CORE": 25, "VHF": 15, "EMERGENCY": 20,
    "PASSENGER": 12, "STATION": 20, "CLOCK": 15, "HOT": 15, "WHEEL": 15,
    "CARRIAGE": 30, "AIR": 25,
}

CURRENT_YEAR = 2026


def _age_score(install_year: int, asset_type: str) -> float:
    """Score 0-100 from age vs expected service life for the asset family."""
    age = max(0, CURRENT_YEAR - int(install_year or CURRENT_YEAR))
    life = 30
    token = (asset_type or "").split()[0].upper() if asset_type else ""
    for key, years in LIFE_BY_TYPE.items():
        if token.startswith(key):
            life = years
            break
    return min(100.0, (age / float(life)) * 100.0)


def _inspection_score(last_inspected: str) -> float:
    """Score rises the longer an asset has gone uninspected (days)."""
    try:
        inspected = datetime.date.fromisoformat(str(last_inspected))
        days = (datetime.date(2026, 9, 26) - inspected).days
    except (ValueError, TypeError):
        days = 365  # unknown inspection date = treated as one year stale
    return min(100.0, (days / 365.0) * 100.0)


def _open_work_stats(asset_id: int, all_requests: List[MaintenanceRequest]):
    open_statuses = {"NEW", "INSPECTED", "AI_ANALYZED", "APPROVED", "IN_PROGRESS", "DELAYED", "REWORK"}
    reqs = [r for r in all_requests if r.asset_id == asset_id]
    open_reqs = [r for r in reqs if r.status in open_statuses]
    urgent = [r for r in open_reqs if r.priority in ("CRITICAL", "HIGH")]
    # 0-100: 3+ open urgent jobs saturates the factor
    return min(100.0, len(urgent) * 33.0 + len(open_reqs) * 5.0)


def score_asset(asset: Asset, all_requests: List[MaintenanceRequest]) -> dict:
    factors = {
        "health_status": STATUS_SCORES.get(asset.status, 50.0),
        "age_wear": _age_score(asset.install_year, asset.asset_type),
        "criticality": CRITICALITY_SCORES.get(asset.criticality, 50.0),
        "inspection_recency": _inspection_score(asset.last_inspected),
        "open_urgent_work": _open_work_stats(asset.id, all_requests),
    }
    total = (
        factors["health_status"] * W_STATUS
        + factors["age_wear"] * W_AGE
        + factors["criticality"] * W_CRITICALITY
        + factors["inspection_recency"] * W_INSPECTION
        + factors["open_urgent_work"] * W_OPEN_WORK
    )
    score = round(min(100.0, max(0.0, total)), 1)
    return {
        "score": score,
        "band": "HIGH" if score >= 66 else ("MEDIUM" if score >= 40 else "LOW"),
        "factors": {
            k: {
                "value": round(v, 1),
                "weight": w,
                "contribution": round(v * w, 1),
            }
            for (k, v), w in zip(factors.items(), [W_STATUS, W_AGE, W_CRITICALITY, W_INSPECTION, W_OPEN_WORK])
        },
    }


def _risk_response(a: Asset, all_requests: List[MaintenanceRequest], dept, corr) -> dict:
    s = score_asset(a, all_requests)
    open_reqs = [r for r in all_requests if r.asset_id == a.id]
    return {
        "id": a.id,
        "asset_id": a.asset_id,
        "name": a.name,
        "asset_type": a.asset_type,
        "department_code": dept.code if dept else None,
        "corridor_code": corr.code if corr else None,
        "corridor_name": corr.name if corr else None,
        "status": a.status,
        "criticality": a.criticality,
        "install_year": a.install_year,
        "last_inspected": a.last_inspected,
        "open_request_count": len(open_reqs),
        "score": s["score"],
        "band": s["band"],
        "factors": s["factors"],
    }


@router.get("/assets")
def list_asset_risk(
    band: Optional[str] = None,
    department_code: Optional[str] = None,
    corridor_id: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Risk-ranked asset register with explainable factor breakdowns."""
    query = db.query(Asset)
    if corridor_id:
        query = query.filter(Asset.corridor_id == corridor_id)
    if department_code and department_code.upper() != "ALL":
        dept = db.query(Department).filter(Department.code == department_code.upper()).first()
        if not dept:
            raise HTTPException(status_code=404, detail="Department not found")
        query = query.filter(Asset.department_id == dept.id)

    assets = query.limit(500).all()
    all_requests = db.query(MaintenanceRequest).all()

    rows = [_risk_response(a, all_requests, a.department, a.corridor) for a in assets]
    rows.sort(key=lambda r: r["score"], reverse=True)

    if band and band.upper() != "ALL":
        rows = [r for r in rows if r["band"] == band.upper()]
    return rows[: max(1, min(limit, 500))]


@router.get("/summary")
def risk_summary(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Network-level risk distribution and the drivers behind it."""
    assets = db.query(Asset).all()
    all_requests = db.query(MaintenanceRequest).all()

    bands = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    total_score = 0.0
    by_department = {}
    top_assets = []

    for a in assets:
        s = score_asset(a, all_requests)
        bands[s["band"]] += 1
        total_score += s["score"]

        dcode = a.department.code if a.department else "UNKNOWN"
        agg = by_department.setdefault(dcode, {"count": 0, "score_sum": 0.0, "high": 0})
        agg["count"] += 1
        agg["score_sum"] += s["score"]
        if s["band"] == "HIGH":
            agg["high"] += 1

        top_assets.append((s["score"], a))

    n = len(assets) or 1
    top_assets.sort(key=lambda t: t[0], reverse=True)

    return {
        "total_assets": len(assets),
        "average_score": round(total_score / n, 1),
        "band_distribution": bands,
        "high_risk_share_percent": round(bands["HIGH"] / n * 100.0, 1),
        "by_department": [
            {
                "department_code": code,
                "asset_count": agg["count"],
                "average_score": round(agg["score_sum"] / agg["count"], 1),
                "high_risk_assets": agg["high"],
            }
            for code, agg in sorted(by_department.items(), key=lambda kv: kv[1]["score_sum"] / kv[1]["count"], reverse=True)
        ],
        "top_risk_assets": [
            {
                "asset_id": a.asset_id,
                "name": a.name,
                "corridor": a.corridor.name if a.corridor else None,
                "score": score,
                "band": "HIGH" if score >= 66 else ("MEDIUM" if score >= 40 else "LOW"),
            }
            for score, a in top_assets[:10]
        ],
        "weights": {
            "health_status": W_STATUS,
            "age_wear": W_AGE,
            "criticality": W_CRITICALITY,
            "inspection_recency": W_INSPECTION,
            "open_urgent_work": W_OPEN_WORK,
        },
    }


@router.get("/corridors")
def corridor_risk(
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Aggregate asset risk per corridor — where to send gangs first."""
    assets = db.query(Asset).all()
    all_requests = db.query(MaintenanceRequest).all()

    corridors: dict = {}
    for a in assets:
        if not a.corridor:
            continue
        c = corridors.setdefault(a.corridor.id, {"corridor": a.corridor, "scores": [], "open_reqs": 0})
        c["scores"].append(score_asset(a, all_requests)["score"])
        c["open_reqs"] += sum(1 for r in all_requests if r.asset_id == a.id and r.status in ("NEW", "INSPECTED", "AI_ANALYZED", "APPROVED", "IN_PROGRESS", "DELAYED", "REWORK"))

    rows = []
    for c in corridors.values():
        corr = c["corridor"]
        scores = c["scores"] or [0.0]
        avg = sum(scores) / len(scores)
        rows.append({
            "corridor_id": corr.id,
            "corridor_code": corr.code,
            "corridor_name": corr.name,
            "track_type": corr.track_type,
            "distance_km": corr.distance_km,
            "asset_count": len(scores),
            "average_asset_score": round(avg, 1),
            "peak_asset_score": round(max(scores), 1),
            "open_request_count": c["open_reqs"],
            "risk_band": "HIGH" if avg >= 66 else ("MEDIUM" if avg >= 40 else "LOW"),
        })

    rows.sort(key=lambda r: r["average_asset_score"], reverse=True)
    return rows[: max(1, min(limit, 200))]
