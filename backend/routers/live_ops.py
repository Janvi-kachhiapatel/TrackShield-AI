import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.database import get_db
from backend.models import (
    EmergencyEvent, Corridor, Asset, TrainSchedule, MaintenanceBlock,
    MaintenanceRequest, Conflict, User, AuditLog, Notification
)
from backend.schemas import EmergencySimulateRequest
from backend.routers.auth import get_current_user, require_roles

router = APIRouter(prefix="/api/live", tags=["Live Operations & Emergency Re-planning"])

@router.get("/events")
def get_emergency_events(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(EmergencyEvent)
    if status:
        query = query.filter(EmergencyEvent.status == status)
    events = query.order_by(EmergencyEvent.created_at.desc()).all()
    return [{
        "id": e.id,
        "event_id": e.event_id,
        "corridor_id": e.corridor_id,
        "corridor_name": e.corridor.name if e.corridor else "Corridor",
        "asset_id": e.asset_id,
        "asset_name": e.asset.name if e.asset else "N/A",
        "title": e.title,
        "description": e.description,
        "severity": e.severity,
        "status": e.status,
        "ai_plan_suggested": e.ai_plan_suggested,
        "created_at": e.created_at.isoformat()
    } for e in events]

@router.post("/simulate")
def simulate_incident(
    payload: EmergencySimulateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    corr = db.query(Corridor).filter(Corridor.id == payload.corridor_id).first()
    if not corr:
        raise HTTPException(status_code=404, detail="Corridor not found")

    count = db.query(EmergencyEvent).count() + 1
    event_id = f"EMG-2026-{count:03d}"

    ai_plan = (
        f"AI Re-planning Proposal: Immediately inject 45-minute emergency maintenance block for {corr.name}. "
        f"Re-route Freight trains 70123/70456 via loop lines. Shift scheduled passenger blocks by +30 minutes."
    )

    ev = EmergencyEvent(
        event_id=event_id,
        corridor_id=corr.id,
        asset_id=payload.asset_id,
        title=payload.title,
        description=payload.description,
        severity="CRITICAL",
        status="ACTIVE",
        ai_plan_suggested=ai_plan
    )
    db.add(ev)

    # Mark corridor as CRITICAL
    corr.status = "CRITICAL"

    # Add critical alert notification
    db.add(Notification(
        role="HIGHER_HOD",
        title=f"🔴 EMERGENCY INCIDENT: {payload.title}",
        message=f"Live incident on corridor {corr.name}: {payload.description}",
        alert_type="CRITICAL"
    ))

    db.add(AuditLog(
        user_id=current_user.id,
        user_name=current_user.name,
        role=current_user.role,
        action="SIMULATE_INCIDENT",
        entity_type="EMERGENCY",
        entity_id=event_id,
        details=f"Live operations incident simulated: {payload.title}"
    ))

    db.commit()
    return {
        "success": True,
        "event_id": event_id,
        "status": "INCIDENT_ACTIVE",
        "ai_recommendation": ai_plan
    }

@router.post("/reoptimize-schedule")
def reoptimize_live_schedule(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HIGHER_HOD", "ADMIN"))
):
    ev = db.query(EmergencyEvent).filter(EmergencyEvent.event_id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    # Mark resolved with Higher HOD sign-off
    ev.status = "RESOLVED"
    if ev.corridor:
        ev.corridor.status = "MAINTENANCE"

    # Create adjusted block
    new_blk = MaintenanceBlock(
        block_id=f"EB-EMG-{ev.id:03d}",
        corridor_id=ev.corridor_id,
        start_time="02:15 AM",
        end_time="03:45 AM",
        duration_hours=1.5,
        status="APPROVED",
        safety_clearance=True,
        isolation_type="Emergency Traffic & Traction Shutoff",
        train_impact="LOW",
        notes=f"Emergency maintenance block authorized by Higher HOD for event {ev.event_id}.",
        approved_by_user_id=current_user.id,
        approved_at=datetime.datetime.utcnow()
    )
    db.add(new_blk)

    db.add(AuditLog(
        user_id=current_user.id,
        user_name=current_user.name,
        role=current_user.role,
        action="APPROVE_REOPTIMIZED_PLAN",
        entity_type="LIVE_OPS",
        entity_id=ev.event_id,
        details=f"Higher HOD approved emergency re-planned block {new_blk.block_id}."
    ))

    db.commit()
    return {
        "success": True,
        "message": f"Emergency re-optimized plan approved. Block {new_blk.block_id} created.",
        "block_id": new_blk.block_id
    }
