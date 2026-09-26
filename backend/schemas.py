from typing import List, Optional, Any, Dict
from pydantic import BaseModel
from datetime import datetime

# --- Auth ---
class LoginRequest(BaseModel):
    emp_id: str
    password: str
    role: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    emp_id: str
    name: str
    email: str
    role: str
    department_id: Optional[int] = None
    department_code: Optional[str] = None
    department_name: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# --- Master Data ---
class DepartmentResponse(BaseModel):
    id: int
    code: str
    name: str
    hod_name: str
    head_count: int
    icon: str

    class Config:
        from_attributes = True

class StationResponse(BaseModel):
    id: int
    code: str
    name: str
    division: str
    zone: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    class Config:
        from_attributes = True

class CorridorResponse(BaseModel):
    id: int
    code: str
    name: str
    from_station_id: int
    to_station_id: int
    from_station_name: Optional[str] = None
    to_station_name: Optional[str] = None
    distance_km: float
    track_type: str
    max_speed: int
    status: str

    class Config:
        from_attributes = True

class AssetResponse(BaseModel):
    id: int
    asset_id: str
    name: str
    department_id: int
    corridor_id: int
    corridor_code: Optional[str] = None
    asset_type: str
    criticality: str
    status: str
    install_year: int
    last_inspected: str

    class Config:
        from_attributes = True

class TrainScheduleResponse(BaseModel):
    id: int
    train_no: str
    train_name: str
    train_type: str
    corridor_id: int
    corridor_name: Optional[str] = None
    departure_time: str
    arrival_time: str
    frequency: str
    priority: str

    class Config:
        from_attributes = True

# --- Maintenance Requests ---
class RequestCreate(BaseModel):
    corridor_id: int
    from_station_id: Optional[int] = None
    to_station_id: Optional[int] = None
    asset_id: int
    asset_criticality: str = "MEDIUM"
    work_description: str
    manpower_required: int = 4
    manpower_available: int = 4
    resources_required: str = "Standard Maintenance Toolkit"
    safety_risk: str = "MEDIUM"
    isolation_required: bool = False
    priority: str = "HIGH"
    requested_date: str
    requested_start_time: str = "02:00"
    requested_end_time: str = "04:00"
    max_duration_hours: float = 2.0
    inspection_status: str = "INSPECTED"
    inspection_remarks: Optional[str] = None

class StartWorkRequest(BaseModel):
    actual_start_time: Optional[str] = None

class ProgressUpdateRequest(BaseModel):
    progress_percent: int
    remarks: Optional[str] = None

class ReportDelayRequest(BaseModel):
    delay_reason: str
    delay_remarks: str

class RejectRequest(BaseModel):
    reject_reason: str

class MaintenanceRequestResponse(BaseModel):
    id: int
    problem_id: str
    department_id: int
    department_code: Optional[str] = None
    department_name: Optional[str] = None
    corridor_id: int
    corridor_code: Optional[str] = None
    corridor_name: Optional[str] = None
    from_station_id: Optional[int] = None
    from_station_name: Optional[str] = None
    to_station_id: Optional[int] = None
    to_station_name: Optional[str] = None
    asset_id: int
    asset_code: Optional[str] = None
    asset_name: Optional[str] = None
    asset_criticality: str
    work_description: str
    manpower_required: int
    manpower_available: int
    resources_required: str
    safety_risk: str
    isolation_required: bool
    priority: str
    requested_date: str
    requested_start_time: str
    requested_end_time: str
    max_duration_hours: float
    inspection_status: str
    inspection_remarks: Optional[str] = None
    ai_priority: str
    ai_safety_risk: str
    ai_estimated_duration: float
    ai_train_impact: str
    status: str
    reported_by_name: Optional[str] = None
    actual_start_time: Optional[str] = None
    progress_percent: int
    delay_reason: Optional[str] = None
    delay_remarks: Optional[str] = None
    reject_reason: Optional[str] = None
    rework_remarks: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- AI & Conflicts ---
class ConflictResponse(BaseModel):
    id: int
    conflict_type: str
    severity: str
    title: str
    description: str
    corridor_id: Optional[int] = None
    corridor_name: Optional[str] = None
    block_id: Optional[int] = None
    request_id: Optional[int] = None
    train_id: Optional[int] = None
    ai_suggestion: Optional[str] = None
    is_resolved: bool
    created_at: datetime

    class Config:
        from_attributes = True

class BlockJobInfo(BaseModel):
    request_id: int
    problem_id: str
    department_code: str
    department_name: str
    asset_name: str
    work_description: str
    priority: str
    duration_hours: float

class BlockResponse(BaseModel):
    id: int
    block_id: str
    corridor_id: int
    corridor_code: Optional[str] = None
    corridor_name: Optional[str] = None
    start_time: str
    end_time: str
    duration_hours: float
    status: str
    safety_clearance: bool
    isolation_type: str
    train_impact: str
    notes: Optional[str] = None
    jobs_count: int = 0
    departments: List[str] = []
    jobs: List[BlockJobInfo] = []
    rationales: List[str] = []
    created_at: datetime

    class Config:
        from_attributes = True

class BlockActionRequest(BaseModel):
    reason: Optional[str] = None
    new_start_time: Optional[str] = None
    new_end_time: Optional[str] = None

class GeneratePlanRequest(BaseModel):
    target_date: Optional[str] = None
    horizon_days: int = 7
    allow_block_fusion: bool = True
    priority_filter: Optional[str] = None

class GeneratePlanResponse(BaseModel):
    success: bool
    status: str
    total_requests: int
    scheduled_requests: int
    unscheduled_requests: int
    blocks_created: int
    conflicts_detected: int
    estimated_asset_availability: float
    train_impact: str
    block_reduction_percent: float
    blocks: List[BlockResponse]
    conflicts: List[ConflictResponse]
    fusion_opportunities_count: int

# --- MCR ---
class MCRCreate(BaseModel):
    request_id: int
    actual_work_performed: str
    work_status: str = "Completed"
    manpower_deployed: int
    resources_used: str
    actual_start_time: str
    actual_completion_time: str
    actual_duration_hours: float
    planned_commitment_hours: float
    delay_reason: Optional[str] = None
    safety_clearance: bool = True
    asset_restored: str = "YES"
    supporting_docs: Optional[List[Dict[str, Any]]] = None

class MCRVerifyRequest(BaseModel):
    action: str # CLOSE, REWORK, PARTIAL
    rework_instructions: Optional[str] = None
    remarks: Optional[str] = None

class MCRResponse(BaseModel):
    id: int
    mcr_id: str
    request_id: int
    problem_id: str
    department_id: int
    department_name: str
    corridor_name: str
    asset_name: str
    actual_work_performed: str
    work_status: str
    manpower_deployed: int
    resources_used: str
    actual_start_time: str
    actual_completion_time: str
    actual_duration_hours: float
    planned_commitment_hours: float
    commitment_met: bool
    delay_reason: Optional[str] = None
    safety_clearance: bool
    asset_restored: str
    supporting_docs: List[Any] = []
    verification_status: str
    verified_by_name: Optional[str] = None
    rework_instructions: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- Live Operations ---
class EmergencySimulateRequest(BaseModel):
    corridor_id: int
    asset_id: Optional[int] = None
    event_type: str # SIGNAL_FAILURE, OHE_BREAKDOWN, RAIL_FRACTURE, TRAIN_DELAY
    title: str
    description: str

# --- Analytics ---
class DepartmentMetric(BaseModel):
    department: str
    code: str
    total_requests: int
    critical: int
    pending: int
    in_progress: int
    delayed: int
    completed: int

class DashboardKPIs(BaseModel):
    total_requests: int
    pending_approval: int
    critical_problems: int
    active_maintenance: int
    delayed_work: int
    asset_availability_percent: float
    completed_work: int
    mcr_pending: int
    corridor_status: List[Dict[str, Any]]
    department_metrics: List[DepartmentMetric]
    critical_alerts: List[Dict[str, Any]]
