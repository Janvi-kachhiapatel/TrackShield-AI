from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.database import get_db
from backend.models import (
    Department, Station, Corridor, Asset, TrainSchedule,
    Manpower, Resource, Notification, AuditLog, User
)
from backend.schemas import (
    DepartmentResponse, StationResponse, CorridorResponse,
    AssetResponse, TrainScheduleResponse
)

router = APIRouter(prefix="/api/master", tags=["Master Data"])

@router.get("/departments", response_model=List[DepartmentResponse])
def get_departments(db: Session = Depends(get_db)):
    return db.query(Department).all()

@router.get("/stations", response_model=List[StationResponse])
def get_stations(limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Station).limit(limit).all()

@router.get("/corridors", response_model=List[CorridorResponse])
def get_corridors(limit: int = 200, db: Session = Depends(get_db)):
    corrs = db.query(Corridor).limit(limit).all()
    res = []
    for c in corrs:
        res.append(CorridorResponse(
            id=c.id,
            code=c.code,
            name=c.name,
            from_station_id=c.from_station_id,
            to_station_id=c.to_station_id,
            from_station_name=c.from_station.name if c.from_station else None,
            to_station_name=c.to_station.name if c.to_station else None,
            distance_km=c.distance_km,
            track_type=c.track_type,
            max_speed=c.max_speed,
            status=c.status
        ))
    return res

@router.get("/assets", response_model=List[AssetResponse])
def get_assets(
    department_id: Optional[str] = None,
    corridor_id: Optional[str] = None,
    limit: int = 400,
    db: Session = Depends(get_db)
):
    query = db.query(Asset)

    # Safely parse department_id
    if department_id and str(department_id).strip().lower() not in ("undefined", "null", "all", "none", ""):
        try:
            dept_int = int(department_id)
            # Department 6 is "Head of All Departments" (Higher HOD), so do not filter out assets
            if dept_int > 0 and dept_int != 6:
                query = query.filter(Asset.department_id == dept_int)
        except ValueError:
            pass

    # Safely parse corridor_id
    if corridor_id and str(corridor_id).strip().lower() not in ("undefined", "null", "all", "none", ""):
        try:
            corr_int = int(corridor_id)
            if corr_int > 0:
                query = query.filter(Asset.corridor_id == corr_int)
        except ValueError:
            pass

    assets = query.limit(limit).all()

    # Fallback to returning assets if specific filter yielded 0
    if not assets and department_id:
        assets = db.query(Asset).limit(limit).all()

    res = []
    for a in assets:
        res.append(AssetResponse(
            id=a.id,
            asset_id=a.asset_id,
            name=a.name,
            department_id=a.department_id,
            corridor_id=a.corridor_id,
            corridor_code=a.corridor.code if a.corridor else None,
            asset_type=a.asset_type,
            criticality=a.criticality,
            status=a.status,
            install_year=a.install_year,
            last_inspected=a.last_inspected
        ))
    return res

@router.get("/trains", response_model=List[TrainScheduleResponse])
def get_trains(
    corridor_id: Optional[int] = None,
    limit: int = 500,
    db: Session = Depends(get_db)
):
    query = db.query(TrainSchedule)
    if corridor_id:
        query = query.filter(TrainSchedule.corridor_id == corridor_id)
    trains = query.limit(limit).all()
    res = []
    for t in trains:
        res.append(TrainScheduleResponse(
            id=t.id,
            train_no=t.train_no,
            train_name=t.train_name,
            train_type=t.train_type,
            corridor_id=t.corridor_id,
            corridor_name=t.corridor.name if t.corridor else None,
            departure_time=t.departure_time,
            arrival_time=t.arrival_time,
            frequency=t.frequency,
            priority=t.priority
        ))
    return res

@router.get("/notifications")
def get_notifications(
    department_id: Optional[int] = None,
    role: Optional[str] = None,
    limit: int = 30,
    db: Session = Depends(get_db)
):
    query = db.query(Notification).order_by(Notification.created_at.desc())
    if department_id:
        query = query.filter((Notification.department_id == department_id) | (Notification.department_id == None))
    notifs = query.limit(limit).all()
    return [{
        "id": n.id,
        "title": n.title,
        "message": n.message,
        "alert_type": n.alert_type,
        "is_read": n.is_read,
        "department_id": n.department_id,
        "related_request_id": n.related_request_id,
        "related_block_id": n.related_block_id,
        "created_at": n.created_at.isoformat()
    } for n in notifs]

@router.post("/notifications/{id}/read")
def mark_notification_read(id: int, db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == id).first()
    if n:
        n.is_read = True
        db.commit()
    return {"success": True}

@router.get("/audit-logs")
def get_audit_logs(limit: int = 50, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return [{
        "id": l.id,
        "user_name": l.user_name,
        "role": l.role,
        "action": l.action,
        "entity_type": l.entity_type,
        "entity_id": l.entity_id,
        "details": l.details,
        "timestamp": l.timestamp.isoformat()
    } for l in logs]
