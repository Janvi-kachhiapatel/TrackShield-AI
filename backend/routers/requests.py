import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.database import get_db
from backend.models import (
    MaintenanceRequest, Asset, Corridor, Department, User,
    Notification, AuditLog, WorkProgress
)
from backend.schemas import (
    RequestCreate, MaintenanceRequestResponse, StartWorkRequest,
    ProgressUpdateRequest, ReportDelayRequest, RejectRequest
)
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/api/requests", tags=["Maintenance Requests"])

def build_response(r: MaintenanceRequest) -> MaintenanceRequestResponse:
    return MaintenanceRequestResponse(
        id=r.id,
        problem_id=r.problem_id,
        department_id=r.department_id,
        department_code=r.department.code if r.department else None,
        department_name=r.department.name if r.department else None,
        corridor_id=r.corridor_id,
        corridor_code=r.corridor.code if r.corridor else None,
        corridor_name=r.corridor.name if r.corridor else None,
        from_station_id=r.from_station_id,
        from_station_name=r.from_station.name if r.from_station else None,
        to_station_id=r.to_station_id,
        to_station_name=r.to_station.name if r.to_station else None,
        asset_id=r.asset_id,
        asset_code=r.asset.asset_id if r.asset else None,
        asset_name=r.asset.name if r.asset else None,
        asset_criticality=r.asset_criticality,
        work_description=r.work_description,
        manpower_required=r.manpower_required,
        manpower_available=r.manpower_available,
        resources_required=r.resources_required,
        safety_risk=r.safety_risk,
        isolation_required=r.isolation_required,
        priority=r.priority,
        requested_date=r.requested_date,
        requested_start_time=r.requested_start_time,
        requested_end_time=r.requested_end_time,
        max_duration_hours=r.max_duration_hours,
        inspection_status=r.inspection_status,
        inspection_remarks=r.inspection_remarks,
        ai_priority=r.ai_priority,
        ai_safety_risk=r.ai_safety_risk,
        ai_estimated_duration=r.ai_estimated_duration,
        ai_train_impact=r.ai_train_impact,
        status=r.status,
        reported_by_name=r.reported_by.name if r.reported_by else None,
        actual_start_time=r.actual_start_time,
        progress_percent=r.progress_percent,
        delay_reason=r.delay_reason,
        delay_remarks=r.delay_remarks,
        reject_reason=r.reject_reason,
        rework_remarks=r.rework_remarks,
        created_at=r.created_at,
        updated_at=r.updated_at
    )

@router.get("", response_model=List[MaintenanceRequestResponse])
def get_requests(
    department_id: Optional[int] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    corridor_id: Optional[int] = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(MaintenanceRequest)
    
    # Enforce departmental isolation for Lower HOD unless explicitly Higher HOD or Admin
    if current_user.role == "LOWER_HOD" and current_user.department_id:
        query = query.filter(MaintenanceRequest.department_id == current_user.department_id)
    elif department_id:
        query = query.filter(MaintenanceRequest.department_id == department_id)
        
    if status and status != "ALL":
        query = query.filter(MaintenanceRequest.status == status)
    if priority:
        query = query.filter(MaintenanceRequest.priority == priority)
    if corridor_id:
        query = query.filter(MaintenanceRequest.corridor_id == corridor_id)
        
    requests = query.order_by(MaintenanceRequest.created_at.desc()).limit(limit).all()
    return [build_response(r) for r in requests]

@router.get("/{id}", response_model=MaintenanceRequestResponse)
def get_request(id: int, db: Session = Depends(get_db)):
    r = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Maintenance Request not found")
    return build_response(r)

@router.post("/ai-preview")
def get_ai_preview(data: dict):
    # Dynamic heuristic rule engine simulating AI neural assessment
    crit = data.get("asset_criticality", "MEDIUM")
    prio = data.get("priority", "MEDIUM")
    iso = data.get("isolation_required", False)
    duration = float(data.get("max_duration_hours", 2.0))
    
    ai_priority = "CRITICAL" if crit == "CRITICAL" or prio == "CRITICAL" else ("HIGH" if crit == "HIGH" or prio == "HIGH" else "MEDIUM")
    ai_safety_risk = "HIGH" if iso or crit == "HIGH" else "MEDIUM"
    ai_estimated_duration = round(duration * 1.0, 1)
    ai_train_impact = "HIGH" if crit == "CRITICAL" or duration > 3.0 else ("MEDIUM" if duration > 1.5 else "LOW")
    
    return {
        "ai_priority": ai_priority,
        "ai_safety_risk": ai_safety_risk,
        "ai_estimated_duration": f"{ai_estimated_duration} Hours",
        "ai_train_impact": ai_train_impact,
        "recommendation": "Submit for multi-department Block Fusion analysis. Recommended window: 02:00–04:00 AM."
    }

@router.post("", response_model=MaintenanceRequestResponse)
def create_request(
    payload: RequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Auto-generate unique Problem ID PR-2026-XXXXX
    count = db.query(MaintenanceRequest).count() + 1
    problem_id = f"PR-2026-{count:05d}"
    while db.query(MaintenanceRequest).filter(MaintenanceRequest.problem_id == problem_id).first():
        count += 1
        problem_id = f"PR-2026-{count:05d}"

    dept_id = current_user.department_id or 1
    
    # Calculate AI Initial Assessment
    ai_priority = "CRITICAL" if payload.priority == "CRITICAL" or payload.asset_criticality == "HIGH" else ("HIGH" if payload.priority == "HIGH" else "MEDIUM")
    ai_safety = "HIGH" if payload.isolation_required or payload.safety_risk == "HIGH" else "MEDIUM"
    ai_impact = "HIGH" if payload.priority == "CRITICAL" else ("MEDIUM" if payload.max_duration_hours > 2.0 else "LOW")

    new_req = MaintenanceRequest(
        problem_id=problem_id,
        department_id=dept_id,
        corridor_id=payload.corridor_id,
        from_station_id=payload.from_station_id,
        to_station_id=payload.to_station_id,
        asset_id=payload.asset_id,
        asset_criticality=payload.asset_criticality,
        work_description=payload.work_description,
        manpower_required=payload.manpower_required,
        manpower_available=payload.manpower_available,
        resources_required=payload.resources_required,
        safety_risk=payload.safety_risk,
        isolation_required=payload.isolation_required,
        priority=payload.priority,
        requested_date=payload.requested_date,
        requested_start_time=payload.requested_start_time,
        requested_end_time=payload.requested_end_time,
        max_duration_hours=payload.max_duration_hours,
        inspection_status=payload.inspection_status,
        inspection_remarks=payload.inspection_remarks,
        ai_priority=ai_priority,
        ai_safety_risk=ai_safety,
        ai_estimated_duration=payload.max_duration_hours,
        ai_train_impact=ai_impact,
        status="NEW",
        reported_by_user_id=current_user.id,
        progress_percent=0
    )
    db.add(new_req)
    db.flush()

    # Notify Higher HOD
    db.add(Notification(
        role="HIGHER_HOD",
        title=f"New Problem Reported: {problem_id}",
        message=f"{current_user.department.name if current_user.department else 'Department'} reported {payload.work_description[:50]}... on corridor.",
        alert_type="INFO",
        related_request_id=new_req.id
    ))

    # Audit log
    db.add(AuditLog(
        user_id=current_user.id,
        user_name=current_user.name,
        role=current_user.role,
        action="REPORT_PROBLEM",
        entity_type="REQUEST",
        entity_id=problem_id,
        details=f"Reported new problem: {payload.work_description[:80]}"
    ))

    db.commit()
    db.refresh(new_req)
    return build_response(new_req)

@router.post("/{id}/start", response_model=MaintenanceRequestResponse)
def start_work(
    id: int,
    payload: Optional[StartWorkRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    r = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Check department authority
    if current_user.role == "LOWER_HOD" and current_user.department_id != r.department_id:
        raise HTTPException(status_code=403, detail="Unauthorized to start another department's work")

    # Automatically record actual start time
    now_time = datetime.datetime.now().strftime("%I:%M %p")
    r.actual_start_time = payload.actual_start_time if (payload and payload.actual_start_time) else now_time
    r.status = "IN_PROGRESS"
    if r.progress_percent == 0:
        r.progress_percent = 25

    db.add(WorkProgress(
        request_id=r.id,
        progress_percent=r.progress_percent,
        status_update=f"Maintenance started at {r.actual_start_time}",
        updated_by_user_id=current_user.id
    ))

    db.add(AuditLog(
        user_id=current_user.id,
        user_name=current_user.name,
        role=current_user.role,
        action="START_WORK",
        entity_type="REQUEST",
        entity_id=r.problem_id,
        details=f"Maintenance work commenced at {r.actual_start_time}."
    ))

    db.commit()
    db.refresh(r)
    return build_response(r)

@router.post("/{id}/progress", response_model=MaintenanceRequestResponse)
def update_progress(
    id: int,
    payload: ProgressUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    r = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
        
    r.progress_percent = payload.progress_percent
    if payload.progress_percent == 100 and r.status == "IN_PROGRESS":
        # Ready for MCR submission
        pass

    db.add(WorkProgress(
        request_id=r.id,
        progress_percent=payload.progress_percent,
        status_update=payload.remarks or f"Progress updated to {payload.progress_percent}%",
        updated_by_user_id=current_user.id
    ))
    db.commit()
    db.refresh(r)
    return build_response(r)

@router.post("/{id}/delay", response_model=MaintenanceRequestResponse)
def report_delay(
    id: int,
    payload: ReportDelayRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    r = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
        
    r.status = "DELAYED"
    r.delay_reason = payload.delay_reason
    r.delay_remarks = payload.delay_remarks

    # Prompt: "Immediately notify Higher HOD"
    db.add(Notification(
        role="HIGHER_HOD",
        title=f"🚨 Maintenance Delay Reported: {r.problem_id}",
        message=f"{r.department.name} reported delay for {r.problem_id}. Reason: {payload.delay_reason}. Remarks: {payload.delay_remarks}",
        alert_type="WARNING",
        related_request_id=r.id
    ))

    db.add(AuditLog(
        user_id=current_user.id,
        user_name=current_user.name,
        role=current_user.role,
        action="REPORT_DELAY",
        entity_type="REQUEST",
        entity_id=r.problem_id,
        details=f"Delay reported: {payload.delay_reason} - {payload.delay_remarks}"
    ))

    db.commit()
    db.refresh(r)
    return build_response(r)

@router.post("/{id}/approve", response_model=MaintenanceRequestResponse)
def approve_request(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "HIGHER_HOD" and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only Higher HOD has authority to approve maintenance requests")
        
    r = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
        
    r.status = "APPROVED"

    # Notify Lower HOD
    db.add(Notification(
        role="LOWER_HOD",
        department_id=r.department_id,
        title=f"Maintenance Request Approved: {r.problem_id}",
        message=f"Higher HOD approved {r.problem_id} for corridor {r.corridor.name}.",
        alert_type="SUCCESS",
        related_request_id=r.id
    ))

    db.add(AuditLog(
        user_id=current_user.id,
        user_name=current_user.name,
        role=current_user.role,
        action="APPROVE_REQUEST",
        entity_type="REQUEST",
        entity_id=r.problem_id,
        details=f"Higher HOD approved request {r.problem_id}."
    ))

    db.commit()
    db.refresh(r)
    return build_response(r)

@router.post("/{id}/reject", response_model=MaintenanceRequestResponse)
def reject_request(
    id: int,
    payload: RejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "HIGHER_HOD" and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only Higher HOD has authority to reject maintenance requests")
        
    r = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
        
    r.status = "REJECTED"
    r.reject_reason = payload.reject_reason

    db.add(Notification(
        role="LOWER_HOD",
        department_id=r.department_id,
        title=f"Maintenance Request Rejected: {r.problem_id}",
        message=f"Request {r.problem_id} was rejected. Reason: {payload.reject_reason}",
        alert_type="CRITICAL",
        related_request_id=r.id
    ))

    db.add(AuditLog(
        user_id=current_user.id,
        user_name=current_user.name,
        role=current_user.role,
        action="REJECT_REQUEST",
        entity_type="REQUEST",
        entity_id=r.problem_id,
        details=f"Rejected request {r.problem_id}. Reason: {payload.reject_reason}"
    ))

    db.commit()
    db.refresh(r)
    return build_response(r)
