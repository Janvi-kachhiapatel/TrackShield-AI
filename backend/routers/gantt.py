"""
Master Gantt data endpoint.

Aggregates everything needed to render one corridor's (or the network's)
24-hour planning picture: train movements, live maintenance blocks, and
AI-proposed blocks. All rows are computed from the database; nothing is
fabricated client-side.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from backend.database import get_db
from backend.models import TrainSchedule, MaintenanceBlock, BlockJob, Corridor
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/api/gantt", tags=["Master Gantt"])


def _to_min(hhmm: str):
    try:
        clean = str(hhmm).replace(" AM", "").replace(" PM", "").strip()
        h, m = map(int, clean.split(":"))
        return h * 60 + m
    except (ValueError, AttributeError):
        return None


@router.get("/corridor/{corridor_id}")
def gantt_corridor(
    corridor_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    24-hour rows for one corridor:
      - train movements (departure -> arrival, clamped to the day)
      - existing live maintenance blocks
      - AI-proposed blocks
    Each row carries precomputed start/end minutes so the frontend Gantt
    only positions rectangles — all logic lives here.
    """
    corr = db.query(Corridor).filter(Corridor.id == corridor_id).first()
    if not corr:
        raise HTTPException(status_code=404, detail="Corridor not found")

    train_rows = []
    for t in db.query(TrainSchedule).filter(TrainSchedule.corridor_id == corridor_id).all():
        dep = _to_min(t.departure_time)
        arr = _to_min(t.arrival_time)
        if dep is None or arr is None:
            continue
        if arr <= dep:
            arr += 24 * 60  # overnight train
        train_rows.append({
            "kind": "TRAIN",
            "label": f"{t.train_no} {t.train_type.replace('_', ' ').title()}",
            "train_no": t.train_no,
            "priority": t.priority,
            "start_min": dep,
            "end_min": arr,
        })

    block_rows = []
    for b in (
        db.query(MaintenanceBlock)
        .filter(MaintenanceBlock.corridor_id == corridor_id)
        .filter(MaintenanceBlock.status.in_(["AI_RECOMMENDED", "APPROVED", "ACTIVE"]))
        .all()
    ):
        s = _to_min(b.start_time)
        e = _to_min(b.end_time)
        if s is None or e is None:
            continue
        jobs = [
            {
                "problem_id": bj.request.problem_id,
                "department_code": bj.request.department.code if bj.request.department else "?",
            }
            for bj in b.jobs
        ]
        block_rows.append({
            "kind": "AI_PROPOSED" if b.status == "AI_RECOMMENDED" else "EXISTING_BLOCK",
            "label": f"{b.block_id} ({len(jobs)} job{'s' if len(jobs) != 1 else ''})",
            "block_id": b.block_id,
            "status": b.status,
            "isolation_type": b.isolation_type,
            "start_min": s,
            "end_min": e,
            "jobs": jobs,
        })

    train_rows.sort(key=lambda r: r["start_min"])
    block_rows.sort(key=lambda r: r["start_min"])

    return {
        "corridor": {
            "id": corr.id,
            "code": corr.code,
            "name": corr.name,
            "track_type": corr.track_type,
            "status": corr.status,
        },
        "rows": train_rows + block_rows,
        "totals": {
            "trains": len(train_rows),
            "blocks": len(block_rows),
            "proposed": sum(1 for r in block_rows if r["kind"] == "AI_PROPOSED"),
        },
        "day_minutes": 1440,
    }
