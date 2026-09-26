"""
Data Fabric — Integration & Interoperability Layer.

Railways do not run greenfield systems: any planning tool must interoperate
with existing control-office infrastructure (FOIS, coaching/freight controls,
SCADA/traction SCADA, TMS). This router exposes adapter endpoints that
describe, in a machine-readable way, how TrackShield AI exchanges data with
those systems.

In the SIH demonstration every adapter runs against synthetic data and labels
itself as such. Each adapter declares:
  - the upstream system it models,
  - the interface direction (inbound/outbound),
  - the payload schema (field, type, unit, source of truth),
  - the current synthetic sample and its health.

A future production deployment swaps the `_sample_*` payloads for real
connectors (SFTP drop files, REST, or message bus) without changing the
contract published here — that is the point of declaring it.
"""
import datetime
import os
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict
from backend.database import get_db
from backend.models import (
    TrainSchedule, Corridor, Asset, MaintenanceBlock, MaintenanceRequest
)
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/api/data-fabric", tags=["Data Fabric & Integration"])

DEMO_MODE = os.getenv("DEMO_MODE", "true").strip().lower() == "true"


def _demo_guard():
    """Every adapter response carries an explicit synthetic-data marker."""
    return {
        "data_mode": "synthetic-demonstration" if DEMO_MODE else "live-connector",
        "generated_at": datetime.datetime.utcnow().isoformat(),
    }


# ---------------------------------------------------------------------------
# Adapter registry: the published contracts
# ---------------------------------------------------------------------------

ADAPTERS: Dict[str, dict] = {
    "train_schedule": {
        "name": "Passenger & Freight Timetable Feed",
        "upstream_system": "Centralized timetable management (models the FOIS/coaching control interface)",
        "direction": "inbound",
        "frequency": "daily snapshot + intraday amendments",
        "transport": "REST pull (SFTP drop in production deployments)",
        "description": "Timetable entries used by the CP-SAT planner as moving conflict constraints.",
        "produces": [
            {"field": "train_no", "type": "string", "unit": None, "source": "upstream timetable"},
            {"field": "train_type", "type": "enum", "unit": "RAJDHANI|VANDE_BHARAT|SUPERFAST|GOODS|PASSENGER", "source": "upstream timetable"},
            {"field": "corridor", "type": "reference", "unit": "corridor code", "source": "upstream timetable"},
            {"field": "departure_time", "type": "time", "unit": "HH:MM", "source": "upstream timetable"},
            {"field": "arrival_time", "type": "time", "unit": "HH:MM", "source": "upstream timetable"},
            {"field": "priority", "type": "enum", "unit": "HIGH|MEDIUM|LOW", "source": "upstream timetable"},
        ],
    },
    "asset_condition": {
        "name": "Asset Condition & Diagnostics Feed",
        "upstream_system": "Asset health registers and wayside diagnostics (models SCADA/datalogger exports)",
        "direction": "inbound",
        "frequency": "event-driven + weekly reconciliation",
        "transport": "REST push (message bus in production deployments)",
        "description": "Asset master, health status and inspection recency feeding the risk engine.",
        "produces": [
            {"field": "asset_id", "type": "string", "unit": None, "source": "asset register"},
            {"field": "status", "type": "enum", "unit": "HEALTHY|DEGRADED|FAULTY|UNDER_MAINTENANCE", "source": "diagnostics"},
            {"field": "criticality", "type": "enum", "unit": "CRITICAL|HIGH|MEDIUM|LOW", "source": "asset register"},
            {"field": "install_year", "type": "integer", "unit": "year", "source": "asset register"},
            {"field": "last_inspected", "type": "date", "unit": "YYYY-MM-DD", "source": "inspection records"},
        ],
    },
    "possession_plan": {
        "name": "Possession / Block Advisory Feed",
        "upstream_system": "Section controller advisory (models the control-office block register)",
        "direction": "outbound",
        "frequency": "on plan approval + on amendment",
        "transport": "REST push with acknowledgement (signed webhook in production deployments)",
        "description": "Approved maintenance blocks exported for the section controller's working timetable.",
        "produces": [
            {"field": "block_id", "type": "string", "unit": None, "source": "TrackShield planner"},
            {"field": "corridor", "type": "reference", "unit": "corridor code", "source": "TrackShield planner"},
            {"field": "start_time", "type": "time", "unit": "HH:MM", "source": "CP-SAT solver output"},
            {"field": "end_time", "type": "time", "unit": "HH:MM", "source": "CP-SAT solver output"},
            {"field": "isolation_type", "type": "string", "unit": None, "source": "safety rules"},
            {"field": "jobs", "type": "array", "unit": "problem_id list", "source": "consolidated requests"},
            {"field": "approval", "type": "object", "unit": "approver + timestamp", "source": "human sign-off (never auto)"},
        ],
    },
    "work_completion": {
        "name": "Work Completion (MCR) Return Feed",
        "upstream_system": "Field execution reporting (models paper MCR flow, digitized)",
        "direction": "inbound",
        "frequency": "on submission",
        "transport": "REST push from field app",
        "description": "Actuals from completed work that close the loop for analytics and asset status.",
        "produces": [
            {"field": "mcr_id", "type": "string", "unit": None, "source": "field app"},
            {"field": "work_status", "type": "enum", "unit": "Completed|Partially Completed|Not Completed", "source": "field app"},
            {"field": "actual_duration_hours", "type": "float", "unit": "hours", "source": "field app"},
            {"field": "commitment_met", "type": "boolean", "unit": None, "source": "derived"},
            {"field": "asset_restored", "type": "enum", "unit": "YES|NO|PARTIALLY", "source": "field app"},
        ],
    },
}


# ---------------------------------------------------------------------------
# Synthetic sample payloads drawn from the seeded database
# ---------------------------------------------------------------------------

def _sample_train_schedule(db: Session):
    trains = db.query(TrainSchedule).limit(5).all()
    return [
        {
            "train_no": t.train_no,
            "train_name": t.train_name,
            "train_type": t.train_type,
            "corridor": t.corridor.code if t.corridor else None,
            "departure_time": t.departure_time,
            "arrival_time": t.arrival_time,
            "priority": t.priority,
        }
        for t in trains
    ]


def _sample_asset_condition(db: Session):
    assets = db.query(Asset).limit(5).all()
    return [
        {
            "asset_id": a.asset_id,
            "name": a.name,
            "status": a.status,
            "criticality": a.criticality,
            "install_year": a.install_year,
            "last_inspected": a.last_inspected,
        }
        for a in assets
    ]


def _sample_possession_plan(db: Session):
    blocks = db.query(MaintenanceBlock).limit(3).all()
    out = []
    for b in blocks:
        out.append({
            "block_id": b.block_id,
            "corridor": b.corridor.code if b.corridor else None,
            "start_time": b.start_time,
            "end_time": b.end_time,
            "isolation_type": b.isolation_type,
            "jobs": [bj.request.problem_id for bj in b.jobs if bj.request],
            "approval": {
                "approved_by": b.approved_by.name if b.approved_by else None,
                "approved_at": b.approved_at.isoformat() if b.approved_at else None,
            },
        })
    return out


def _sample_work_completion(db: Session):
    reqs = (
        db.query(MaintenanceRequest)
        .filter(MaintenanceRequest.status.in_(["MCR_SUBMITTED", "VERIFIED", "CLOSED"]))
        .limit(3)
        .all()
    )
    return [
        {
            "problem_id": r.problem_id,
            "status": r.status,
            "planned_hours": r.max_duration_hours,
            "progress_percent": r.progress_percent,
        }
        for r in reqs
    ]


_SAMPLE_BUILDERS = {
    "train_schedule": _sample_train_schedule,
    "asset_condition": _sample_asset_condition,
    "possession_plan": _sample_possession_plan,
    "work_completion": _sample_work_completion,
}


@router.get("/adapters")
def list_adapters():
    """The published integration contracts — the interoperability surface."""
    return {
        "platform": "TrackShield AI Data Fabric",
        "adapter_count": len(ADAPTERS),
        "adapters": [
            {"key": key, **spec} for key, spec in ADAPTERS.items()
        ],
        **_demo_guard(),
    }


@router.get("/adapters/{key}/sample")
def adapter_sample(key: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Live sample for one adapter, generated from the (synthetic) database."""
    if key not in ADAPTERS:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Unknown adapter '{key}'")

    spec = ADAPTERS[key]
    sample = _SAMPLE_BUILDERS[key](db)
    return {
        "adapter": key,
        "name": spec["name"],
        "upstream_system": spec["upstream_system"],
        "direction": spec["direction"],
        "contract": spec["produces"],
        "record_count": len(sample),
        "sample": sample,
        "health": {
            "status": "healthy",
            "mode": "synthetic",
            "note": "Synthetic demonstration feed. In production this endpoint proxies the real upstream system.",
        },
        **_demo_guard(),
    }


@router.get("/status")
def integration_status(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """At-a-glance health board for all declared interfaces."""
    counts = {
        "train_schedule": db.query(TrainSchedule).count(),
        "asset_condition": db.query(Asset).count(),
        "possession_plan": db.query(MaintenanceBlock).count(),
        "work_completion": db.query(MaintenanceRequest).count(),
    }
    return {
        "interfaces": [
            {
                "key": key,
                "name": ADAPTERS[key]["name"],
                "direction": ADAPTERS[key]["direction"],
                "records_available": counts.get(key, 0),
                "status": "operational",
            }
            for key in ADAPTERS
        ],
        **_demo_guard(),
    }
