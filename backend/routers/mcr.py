import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.database import get_db
from backend.models import (
    MCRReport, MaintenanceRequest, Asset, Department, Corridor,
    User, AuditLog, Notification
)
from backend.schemas import MCRCreate, MCRResponse, MCRVerifyRequest
from backend.routers.auth import get_current_user, require_roles

router = APIRouter(prefix="/api/mcr", tags=["Maintenance Completion Reports"])

def build_mcr_response(m: MCRReport) -> MCRResponse:
    return MCRResponse(
        id=m.id,
        mcr_id=m.mcr_id,
        request_id=m.request_id,
        problem_id=m.request.problem_id if m.request else "PR-UNKNOWN",
        department_id=m.department_id,
        department_name=m.department.name if m.department else "Department",
        corridor_name=m.corridor.name if m.corridor else "Corridor",
        asset_name=m.asset.name if m.asset else "Asset",
        actual_work_performed=m.actual_work_performed,
        work_status=m.work_status,
        manpower_deployed=m.manpower_deployed,
        resources_used=m.resources_used,
        actual_start_time=m.actual_start_time,
        actual_completion_time=m.actual_completion_time,
        actual_duration_hours=m.actual_duration_hours,
        planned_commitment_hours=m.planned_commitment_hours,
        commitment_met=m.commitment_met,
        delay_reason=m.delay_reason,
        safety_clearance=m.safety_clearance,
        asset_restored=m.asset_restored,
        supporting_docs=m.supporting_docs or [],
        verification_status=m.verification_status,
        verified_by_name=m.verified_by.name if m.verified_by else None,
        rework_instructions=m.rework_instructions,
        created_at=m.created_at
    )

@router.get("", response_model=List[MCRResponse])
def get_mcrs(
    department_id: Optional[int] = None,
    verification_status: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(MCRReport)
    if current_user.role == "LOWER_HOD" and current_user.department_id:
        query = query.filter(MCRReport.department_id == current_user.department_id)
    elif department_id:
        query = query.filter(MCRReport.department_id == department_id)

    if verification_status and verification_status != "ALL":
        query = query.filter(MCRReport.verification_status == verification_status)

    mcrs = query.order_by(MCRReport.created_at.desc()).limit(limit).all()
    return [build_mcr_response(m) for m in mcrs]

@router.get("/{id}", response_model=MCRResponse)
def get_mcr(id: str, db: Session = Depends(get_db)):
    if str(id).isdigit():
        m = db.query(MCRReport).filter(MCRReport.id == int(id)).first()
    else:
        m = db.query(MCRReport).filter(MCRReport.mcr_id == str(id)).first()
    if not m:
        raise HTTPException(status_code=404, detail="MCR not found")
    return build_mcr_response(m)

@router.post("", response_model=MCRResponse)
def submit_mcr(
    payload: MCRCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    req = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == payload.request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Maintenance Request not found")

    # Generate MCR ID
    count = db.query(MCRReport).count() + 1
    mcr_id = f"MCR-2026-{count:05d}"
    while db.query(MCRReport).filter(MCRReport.mcr_id == mcr_id).first():
        count += 1
        mcr_id = f"MCR-2026-{count:05d}"

    # Calculate commitment met
    commitment_met = payload.actual_duration_hours <= payload.planned_commitment_hours
    if not commitment_met and not payload.delay_reason:
        # Prompt requirement: reason is mandatory if commitment was not met
        raise HTTPException(status_code=400, detail="Commitment not met: Delay reason is mandatory")

    new_mcr = MCRReport(
        mcr_id=mcr_id,
        request_id=req.id,
        department_id=req.department_id,
        corridor_id=req.corridor_id,
        asset_id=req.asset_id,
        actual_work_performed=payload.actual_work_performed,
        work_status=payload.work_status,
        manpower_deployed=payload.manpower_deployed,
        resources_used=payload.resources_used,
        actual_start_time=payload.actual_start_time,
        actual_completion_time=payload.actual_completion_time,
        actual_duration_hours=payload.actual_duration_hours,
        planned_commitment_hours=payload.planned_commitment_hours,
        commitment_met=commitment_met,
        delay_reason=payload.delay_reason,
        safety_clearance=payload.safety_clearance,
        asset_restored=payload.asset_restored,
        supporting_docs=payload.supporting_docs or [
            {"name": "Site_Inspection_Report.pdf", "size": "850 KB", "type": "pdf"},
            {"name": "Post_Maintenance_Track_Photo.jpg", "size": "1.8 MB", "type": "image"}
        ],
        verification_status="AWAITING_VERIFICATION"
    )
    db.add(new_mcr)

    # Transition request status to MCR_SUBMITTED
    req.status = "MCR_SUBMITTED"
    req.progress_percent = 100

    # Notify Higher HOD
    db.add(Notification(
        role="HIGHER_HOD",
        title=f"MCR Submitted: {mcr_id}",
        message=f"{req.department.name} submitted MCR for {req.problem_id}. Awaiting verification.",
        alert_type="INFO",
        related_request_id=req.id
    ))

    # Audit log
    db.add(AuditLog(
        user_id=current_user.id,
        user_name=current_user.name,
        role=current_user.role,
        action="SUBMIT_MCR",
        entity_type="MCR",
        entity_id=mcr_id,
        details=f"Lower HOD submitted MCR for {req.problem_id}. Actual duration: {payload.actual_duration_hours}h. Commitment met: {commitment_met}"
    ))

    db.commit()
    db.refresh(new_mcr)
    return build_mcr_response(new_mcr)

@router.post("/{id}/verify", response_model=MCRResponse)
def verify_mcr(
    id: str,
    payload: MCRVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("HIGHER_HOD", "ADMIN"))
):
    if str(id).isdigit():
        m = db.query(MCRReport).filter(MCRReport.id == int(id)).first()
    else:
        m = db.query(MCRReport).filter(MCRReport.mcr_id == str(id)).first()

    if not m:
        raise HTTPException(status_code=404, detail="MCR not found")

    # Verification authority: HIGHER_HOD/ADMIN only, enforced by require_roles.
    # The signature on record is the authenticated caller — never a proxy user.
    verifying_user = current_user

    action = payload.action.upper()
    req = m.request

    if action == "CLOSE":
        m.verification_status = "CLOSED"
        if req:
            req.status = "CLOSED"
            if req.asset:
                req.asset.status = "HEALTHY"

        db.add(Notification(
            role="LOWER_HOD",
            department_id=m.department_id,
            title=f"Maintenance Verified & Closed: {m.mcr_id}",
            message=f"Higher HOD ({verifying_user.name}) verified MCR {m.mcr_id} for {req.problem_id if req else 'request'}. Work successfully closed.",
            alert_type="SUCCESS",
            related_request_id=req.id if req else None
        ))

        db.add(AuditLog(
            user_id=verifying_user.id,
            user_name=verifying_user.name,
            role=verifying_user.role,
            action="CLOSE_MCR",
            entity_type="MCR",
            entity_id=m.mcr_id,
            details=f"Higher HOD ({verifying_user.name}) verified and closed maintenance record {m.mcr_id}. Remarks: {payload.remarks or 'Approved and restored to service'}"
        ))

    elif action == "REWORK":
        if not payload.rework_instructions:
            raise HTTPException(status_code=400, detail="Mandatory rework instructions required")
        m.verification_status = "REWORK"
        m.rework_instructions = payload.rework_instructions
        if req:
            req.status = "REWORK"
            req.rework_remarks = payload.rework_instructions

        db.add(Notification(
            role="LOWER_HOD",
            department_id=m.department_id,
            title=f"⚠️ Rework Required: {m.mcr_id}",
            message=f"Higher HOD requested rework for {req.problem_id if req else 'request'}: {payload.rework_instructions}",
            alert_type="WARNING",
            related_request_id=req.id if req else None
        ))

        db.add(AuditLog(
            user_id=verifying_user.id,
            user_name=verifying_user.name,
            role=verifying_user.role,
            action="SEND_REWORK_MCR",
            entity_type="MCR",
            entity_id=m.mcr_id,
            details=f"MCR sent for rework: {payload.rework_instructions}"
        ))

    elif action == "PARTIAL":
        m.verification_status = "PARTIAL"
        if req:
            req.status = "IN_PROGRESS"
            req.progress_percent = 75

        db.add(AuditLog(
            user_id=verifying_user.id,
            user_name=verifying_user.name,
            role=verifying_user.role,
            action="MARK_PARTIAL_MCR",
            entity_type="MCR",
            entity_id=m.mcr_id,
            details=f"Higher HOD marked MCR as partially completed: {payload.remarks}"
        ))

    m.verified_by_user_id = verifying_user.id
    m.verified_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(m)
    return build_mcr_response(m)
