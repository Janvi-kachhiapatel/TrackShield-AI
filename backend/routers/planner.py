"""
Single-request planning + audit timeline endpoints.

POST /api/ai/plan-request  — evaluate candidate maintenance windows for one
request against live timetable, blocks, manpower and resources. Uses
window_planner.evaluate_windows; every number in the response is computed.

GET /api/audit/timeline    — end-to-end lifecycle for a maintenance request
and/or its associated block, assembled from the real AuditLog rows written
by every workflow action (request create/start/delay, planner runs, fusion
apply, block approve/reject/modify, MCR submit/verify/rework).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from backend.database import get_db
from backend.models import (
    MaintenanceRequest, MaintenanceBlock, BlockJob, TrainSchedule,
    Resource, Manpower, AuditLog
)
from backend.routers.auth import get_current_user
from backend.window_planner import PlanContext, evaluate_windows

router = APIRouter(prefix="/api", tags=["Planner & Audit Timeline"])

LIVE_BLOCK_STATUSES = ["AI_RECOMMENDED", "APPROVED", "ACTIVE"]


@router.post("/ai/plan-request")
def plan_single_request(
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    request_id = payload.get("request_id")
    if not request_id:
        raise HTTPException(status_code=400, detail="request_id is required")

    req = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    duration = int(float(payload.get("duration_minutes") or req.max_duration_hours * 60))
    if duration <= 0 or duration > 12 * 60:
        raise HTTPException(status_code=400, detail="duration_minutes must be between 1 and 720")

    timetable = [
        {"train_no": t.train_no, "departure_time": t.departure_time, "priority": t.priority, "train_type": t.train_type}
        for t in db.query(TrainSchedule).filter(TrainSchedule.corridor_id == req.corridor_id).all()
    ]

    # Existing LIVE blocks on this corridor (exclude the request's own future block).
    own_block_ids = {
        bj.block_id for bj in db.query(BlockJob).filter(BlockJob.request_id == req.id).all()
    }
    existing_blocks = []
    for b in (
        db.query(MaintenanceBlock)
        .filter(MaintenanceBlock.corridor_id == req.corridor_id)
        .filter(MaintenanceBlock.status.in_(LIVE_BLOCK_STATUSES))
        .all()
    ):
        if b.id in own_block_ids and b.status == "AI_RECOMMENDED" and req.status in ("APPROVED",):
            continue  # its own recommended block should not block its own plan
        s = _to_min(b.start_time)
        e = _to_min(b.end_time)
        if s is not None and e is not None and e > s:
            existing_blocks.append({"block_id": b.block_id, "start_min": s, "end_min": e, "status": b.status})

    ceiling_rows = (
        db.query(Manpower).filter(Manpower.department_id == req.department_id).all()
        if req.department_id else []
    )
    dept_ceiling = sum(max(0, m.available_count) for m in ceiling_rows)

    available_resources = (
        db.query(Resource)
        .filter(Resource.department_id == req.department_id, Resource.status == "AVAILABLE")
        .count()
        if req.department_id else 0
    )

    ctx = PlanContext(
        corridor_id=req.corridor_id,
        duration_minutes=duration,
        priority=req.priority,
        isolation_required=req.isolation_required,
        manpower_required=int(req.manpower_required),
        timetable=timetable,
        existing_blocks=existing_blocks,
        dept_manpower_ceiling=dept_ceiling,
        available_resources=available_resources,
    )

    result = evaluate_windows(ctx)

    return {
        "request": {
            "id": req.id,
            "problem_id": req.problem_id,
            "corridor_id": req.corridor_id,
            "corridor_name": req.corridor.name if req.corridor else None,
            "department_code": req.department.code if req.department else None,
            "asset_name": req.asset.name if req.asset else None,
            "priority": req.priority,
            "duration_minutes": duration,
        },
        "planning_engine": {
            "type": "deterministic candidate-window scan (30-min grid) with train/blocks/manpower/resource constraints",
            "buffer_minutes": 10,
            "grid_minutes": 30,
        },
        **result,
    }


def _to_min(hhmm: str):
    try:
        parts = str(hhmm).replace(" AM", "").replace(" PM", "").strip().split(":")
        h, m = int(parts[0]), int(parts[1])
        return h * 60 + m
    except (ValueError, IndexError, AttributeError):
        return None


@router.get("/audit/timeline")
def audit_timeline(
    request_id: Optional[int] = None,
    block_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Unified lifecycle timeline across a maintenance request and every block
    that carries it, plus its MCR. Built exclusively from real AuditLog rows.
    """
    events = []

    if block_id:
        blk = db.query(MaintenanceBlock).filter(MaintenanceBlock.block_id == block_id).first()
        if blk:
            events += _rows(db, "BLOCK", blk.block_id)
            for bj in blk.jobs:
                if bj.request:
                    events += _rows(db, "REQUEST", bj.request.problem_id)
                    if bj.request.mcr:
                        events += _rows(db, "MCR", bj.request.mcr.mcr_id)
    elif request_id:
        req = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == request_id).first()
        if not req:
            raise HTTPException(status_code=404, detail="Request not found")
        events += _rows(db, "REQUEST", req.problem_id)
        if req.mcr:
            events += _rows(db, "MCR", req.mcr.mcr_id)
        block_jobs = db.query(BlockJob).filter(BlockJob.request_id == req.id).all()
        for bj in block_jobs:
            blk = db.query(MaintenanceBlock).filter(MaintenanceBlock.id == bj.block_id).first()
            if blk:
                events += _rows(db, "BLOCK", blk.block_id)
    else:
        raise HTTPException(status_code=400, detail="Provide request_id or block_id")

    # De-duplicate identical (action, entity, timestamp) rows that appear via
    # both the block and request paths, then sort chronologically.
    seen = set()
    unique = []
    for ev in sorted(events, key=lambda e: e["timestamp"]):
        key = (ev["action"], ev["entity_type"], ev["entity_id"], ev["timestamp"])
        if key not in seen:
            seen.add(key)
            unique.append(ev)

    return {
        "count": len(unique),
        "events": unique,
        "note": "Timeline assembled from real audit rows written by each workflow action.",
    }


def _rows(db: Session, entity_type: str, entity_id: str):
    rows = (
        db.query(AuditLog)
        .filter(AuditLog.entity_type == entity_type, AuditLog.entity_id == entity_id)
        .order_by(AuditLog.timestamp.asc())
        .all()
    )
    return [
        {
            "timestamp": r.timestamp.isoformat(),
            "user": r.user_name,
            "role": r.role,
            "action": r.action,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "details": r.details,
        }
        for r in rows
    ]
