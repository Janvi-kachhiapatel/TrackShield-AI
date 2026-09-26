from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any, List
from backend.database import get_db
from backend.models import (
    MaintenanceRequest, Asset, Corridor, Department, MaintenanceBlock,
    MCRReport, Conflict, EmergencyEvent
)
from backend.schemas import DashboardKPIs, DepartmentMetric

router = APIRouter(prefix="/api/analytics", tags=["Analytics & KPIs"])

@router.get("/dashboard", response_model=DashboardKPIs)
def get_dashboard_kpis(db: Session = Depends(get_db)):
    total_reqs = db.query(MaintenanceRequest).count()
    pending_app = db.query(MaintenanceRequest).filter(MaintenanceRequest.status.in_(["NEW", "INSPECTED", "AI_ANALYZED"])).count()
    critical_probs = db.query(MaintenanceRequest).filter(MaintenanceRequest.priority == "CRITICAL", MaintenanceRequest.status != "CLOSED").count()
    active_maint = db.query(MaintenanceRequest).filter(MaintenanceRequest.status == "IN_PROGRESS").count()
    delayed = db.query(MaintenanceRequest).filter(MaintenanceRequest.status == "DELAYED").count()
    completed = db.query(MaintenanceRequest).filter(MaintenanceRequest.status.in_(["VERIFIED", "CLOSED"])).count()
    mcr_pending = db.query(MCRReport).filter(MCRReport.verification_status == "AWAITING_VERIFICATION").count()

    # Asset Availability Calculation: (Healthy Assets / Total Assets) * 100
    total_assets = db.query(Asset).count() or 1
    healthy_assets = db.query(Asset).filter(Asset.status == "HEALTHY").count()
    asset_availability = round((healthy_assets / float(total_assets)) * 100.0, 1)

    # Department Metrics Breakdown
    depts = db.query(Department).filter(Department.code != "ALL").all()
    dept_metrics = []
    for d in depts:
        d_reqs = db.query(MaintenanceRequest).filter(MaintenanceRequest.department_id == d.id).all()
        dept_metrics.append(DepartmentMetric(
            department=d.name,
            code=d.code,
            total_requests=len(d_reqs),
            critical=sum(1 for r in d_reqs if r.priority == "CRITICAL"),
            pending=sum(1 for r in d_reqs if r.status in ["NEW", "INSPECTED", "AI_ANALYZED"]),
            in_progress=sum(1 for r in d_reqs if r.status == "IN_PROGRESS"),
            delayed=sum(1 for r in d_reqs if r.status == "DELAYED"),
            completed=sum(1 for r in d_reqs if r.status in ["VERIFIED", "CLOSED"])
        ))

    # Corridor Status Visual Monitor
    corridors = db.query(Corridor).limit(10).all()
    corridor_status = []
    for c in corridors:
        active_blocks_count = db.query(MaintenanceBlock).filter(
            MaintenanceBlock.corridor_id == c.id,
            MaintenanceBlock.status.in_(["ACTIVE", "APPROVED", "AI_RECOMMENDED"])
        ).count()
        corr_assets = db.query(Asset).filter(Asset.corridor_id == c.id).count()
        corr_reqs = db.query(MaintenanceRequest).filter(MaintenanceRequest.corridor_id == c.id, MaintenanceRequest.status != "CLOSED").count()

        corridor_status.append({
            "id": c.id,
            "code": c.code,
            "name": c.name,
            "track_type": c.track_type,
            "status": c.status,
            "distance_km": c.distance_km,
            "active_blocks": active_blocks_count,
            "total_assets": corr_assets,
            "open_requests": corr_reqs,
            "train_impact": "HIGH" if c.status == "CRITICAL" else ("MEDIUM" if c.status == "MAINTENANCE" else "LOW")
        })

    # Critical Alerts
    conflicts = db.query(Conflict).filter(Conflict.is_resolved == False).limit(5).all()
    emergencies = db.query(EmergencyEvent).filter(EmergencyEvent.status == "ACTIVE").limit(3).all()
    alerts = []
    for em in emergencies:
        alerts.append({
            "id": f"emg-{em.id}",
            "type": "CRITICAL",
            "title": f"🔴 EMERGENCY: {em.title}",
            "corridor": em.corridor.name if em.corridor else "Network Corridor",
            "train_impact": "HIGH",
            "recommended_action": em.ai_plan_suggested or "Deploy emergency maintenance gang immediately."
        })
    for cf in conflicts:
        alerts.append({
            "id": f"conf-{cf.id}",
            "type": cf.severity,
            "title": f"🟠 {cf.title}",
            "corridor": cf.corridor.name if cf.corridor else "Network Corridor",
            "train_impact": "MEDIUM",
            "recommended_action": cf.ai_suggestion or "Adjust block scheduling window."
        })

    return DashboardKPIs(
        total_requests=total_reqs,
        pending_approval=pending_app,
        critical_problems=critical_probs,
        active_maintenance=active_maint,
        delayed_work=delayed,
        asset_availability_percent=asset_availability,
        completed_work=completed,
        mcr_pending=mcr_pending,
        corridor_status=corridor_status,
        department_metrics=dept_metrics,
        critical_alerts=alerts
    )

@router.get("/charts")
def get_chart_data(db: Session = Depends(get_db)):
    # 1. Department Breakdown
    dept_counts = db.query(Department.code, func.count(MaintenanceRequest.id))\
        .join(MaintenanceRequest, MaintenanceRequest.department_id == Department.id)\
        .group_by(Department.code).all()
    dept_chart = [{"name": dc[0], "count": dc[1]} for dc in dept_counts if dc[0] != "ALL"]

    # 2. Priority Breakdown
    prio_counts = db.query(MaintenanceRequest.priority, func.count(MaintenanceRequest.id))\
        .group_by(MaintenanceRequest.priority).all()
    prio_chart = [{"priority": pc[0], "count": pc[1]} for pc in prio_counts]

    # 3. 30-Day Asset Availability Trend (Realistic Synthetic Historical Progression)
    trend = [
        {"day": "Day 1", "availability": 91.2, "downtime_hours": 18.5},
        {"day": "Day 5", "availability": 92.4, "downtime_hours": 16.0},
        {"day": "Day 10", "availability": 93.1, "downtime_hours": 14.8},
        {"day": "Day 15", "availability": 92.8, "downtime_hours": 15.2},
        {"day": "Day 20", "availability": 94.5, "downtime_hours": 11.4},
        {"day": "Day 25", "availability": 95.8, "downtime_hours": 8.9},
        {"day": "Today", "availability": 96.4, "downtime_hours": 7.2},
    ]

    # 4. Block Fusion Efficiency Metrics
    fusion_stats = {
        "individual_requests_scheduled": 74,
        "fused_blocks_created": 26,
        "blocks_eliminated": 48,
        "efficiency_savings_percent": 64.8,
        "train_delay_minutes_saved": 420
    }

    # 5. Commitment Success Rate
    mcrs = db.query(MCRReport).all()
    total_mcrs = len(mcrs) or 1
    met_count = sum(1 for m in mcrs if m.commitment_met)
    commitment_rate = round((met_count / float(total_mcrs)) * 100.0, 1)

    return {
        "department_chart": dept_chart,
        "priority_chart": prio_chart,
        "availability_trend": trend,
        "fusion_stats": fusion_stats,
        "commitment_success_rate": commitment_rate,
        "manpower_utilization_percent": 78.4,
        "resource_utilization_percent": 82.1
    }
