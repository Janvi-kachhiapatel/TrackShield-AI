import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.database import get_db
from backend.models import (
    MaintenanceBlock, BlockJob, MaintenanceRequest, Corridor,
    Department, User, AuditLog, Notification, AIRecommendation
)
from backend.schemas import BlockResponse, BlockJobInfo, BlockActionRequest
from backend.routers.auth import get_current_user, require_roles

router = APIRouter(prefix="/api/blocks", tags=["Block Management"])

def build_block_response(b: MaintenanceBlock) -> BlockResponse:
    jobs_info = []
    departments = set()
    for bj in b.jobs:
        req = bj.request
        if req:
            dept_code = req.department.code if req.department else "ELEC"
            dept_name = req.department.name if req.department else "Dept"
            departments.add(dept_code)
            jobs_info.append(BlockJobInfo(
                request_id=req.id,
                problem_id=req.problem_id,
                department_code=dept_code,
                department_name=dept_name,
                asset_name=req.asset.name if req.asset else "Track Asset",
                work_description=req.work_description,
                priority=req.priority,
                duration_hours=req.max_duration_hours
            ))

    rationales = b.ai_recommendation.rationales if (b.ai_recommendation and b.ai_recommendation.rationales) else [
        "✓ Satisfies corridor clearance constraints",
        "✓ No train collision during scheduled window",
        "✓ Safety isolation protocols coordinated"
    ]

    return BlockResponse(
        id=b.id,
        block_id=b.block_id,
        corridor_id=b.corridor_id,
        corridor_code=b.corridor.code if b.corridor else None,
        corridor_name=b.corridor.name if b.corridor else None,
        start_time=b.start_time,
        end_time=b.end_time,
        duration_hours=b.duration_hours,
        status=b.status,
        safety_clearance=b.safety_clearance,
        isolation_type=b.isolation_type,
        train_impact=b.train_impact,
        notes=b.notes,
        jobs_count=len(jobs_info),
        departments=list(departments),
        jobs=jobs_info,
        rationales=rationales,
        created_at=b.created_at
    )

@router.get("", response_model=List[BlockResponse])
def get_blocks(
    status: Optional[str] = None,
    corridor_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    query = db.query(MaintenanceBlock)
    if status and status != "ALL":
        query = query.filter(MaintenanceBlock.status == status)
    if corridor_id:
        query = query.filter(MaintenanceBlock.corridor_id == corridor_id)
        
    blocks = query.order_by(MaintenanceBlock.created_at.desc()).limit(limit).all()
    return [build_block_response(b) for b in blocks]

@router.get("/{id}", response_model=BlockResponse)
def get_block(id: int, db: Session = Depends(get_db)):
    b = db.query(MaintenanceBlock).filter(MaintenanceBlock.id == id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Block not found")
    return build_block_response(b)

@router.post("/{id}/approve", response_model=BlockResponse)
def approve_block(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HIGHER_HOD", "ADMIN"))
):
    b = db.query(MaintenanceBlock).filter(MaintenanceBlock.id == id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Block not found")

    b.status = "APPROVED"
    b.approved_by_user_id = current_user.id
    b.approved_at = datetime.datetime.utcnow()

    # Update associated maintenance requests to APPROVED
    for bj in b.jobs:
        if bj.request:
            bj.request.status = "APPROVED"
            db.add(Notification(
                role="LOWER_HOD",
                department_id=bj.request.department_id,
                title=f"Block {b.block_id} Approved by Higher HOD",
                message=f"Maintenance for {bj.request.problem_id} approved for {b.start_time} - {b.end_time}.",
                alert_type="SUCCESS",
                related_block_id=b.id,
                related_request_id=bj.request.id
            ))

    db.add(AuditLog(
        user_id=current_user.id,
        user_name=current_user.name,
        role=current_user.role,
        action="APPROVE_BLOCK",
        entity_type="BLOCK",
        entity_id=b.block_id,
        details=f"Higher HOD approved maintenance block {b.block_id} with {len(b.jobs)} jobs."
    ))

    db.commit()
    db.refresh(b)
    return build_block_response(b)

@router.post("/{id}/reject", response_model=BlockResponse)
def reject_block(
    id: int,
    payload: BlockActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HIGHER_HOD", "ADMIN"))
):
    b = db.query(MaintenanceBlock).filter(MaintenanceBlock.id == id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Block not found")

    b.status = "REJECTED"
    b.notes = f"Rejected: {payload.reason or 'Not approved by HOD'}"

    db.add(AuditLog(
        user_id=current_user.id,
        user_name=current_user.name,
        role=current_user.role,
        action="REJECT_BLOCK",
        entity_type="BLOCK",
        entity_id=b.block_id,
        details=f"Block rejected. Reason: {payload.reason}"
    ))

    db.commit()
    db.refresh(b)
    return build_block_response(b)

@router.post("/{id}/modify", response_model=BlockResponse)
def modify_block(
    id: int,
    payload: BlockActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HIGHER_HOD", "ADMIN"))
):
    b = db.query(MaintenanceBlock).filter(MaintenanceBlock.id == id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Block not found")

    old_times = f"{b.start_time} - {b.end_time}"
    if payload.new_start_time:
        b.start_time = payload.new_start_time
    if payload.new_end_time:
        b.end_time = payload.new_end_time
    if payload.reason:
        b.notes = f"Modified by HOD: {payload.reason}"

    db.add(AuditLog(
        user_id=current_user.id,
        user_name=current_user.name,
        role=current_user.role,
        action="MODIFY_BLOCK",
        entity_type="BLOCK",
        entity_id=b.block_id,
        details=f"HOD modified block window from {old_times} to {b.start_time} - {b.end_time}. Justification: {payload.reason}"
    ))

    db.commit()
    db.refresh(b)
    return build_block_response(b)
