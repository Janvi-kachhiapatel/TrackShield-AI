import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from backend.database import Base

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, index=True, nullable=False) # ELEC, SIG, CIVIL, TEL, MECH, ALL
    name = Column(String(100), nullable=False)
    hod_name = Column(String(100), nullable=False)
    head_count = Column(Integer, default=50)
    icon = Column(String(50), default="Zap")

    users = relationship("User", back_populates="department")
    assets = relationship("Asset", back_populates="department")
    requests = relationship("MaintenanceRequest", back_populates="department")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    emp_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    email = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False) # HIGHER_HOD, LOWER_HOD, ADMIN
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    department = relationship("Department", back_populates="users")

class Station(Base):
    __tablename__ = "stations"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, index=True, nullable=False) # e.g. NDLS, CNB, BCT
    name = Column(String(100), nullable=False)
    division = Column(String(50), default="Delhi")
    zone = Column(String(50), default="Northern Railway")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

class Corridor(Base):
    __tablename__ = "corridors"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False) # e.g. NDLS-GZB
    name = Column(String(150), nullable=False)
    from_station_id = Column(Integer, ForeignKey("stations.id"), nullable=False)
    to_station_id = Column(Integer, ForeignKey("stations.id"), nullable=False)
    distance_km = Column(Float, default=25.0)
    track_type = Column(String(50), default="Double Line") # Single, Double Line, Quadruple
    max_speed = Column(Integer, default=130)
    status = Column(String(50), default="NORMAL") # NORMAL, MAINTENANCE, CRITICAL

    from_station = relationship("Station", foreign_keys=[from_station_id])
    to_station = relationship("Station", foreign_keys=[to_station_id])
    assets = relationship("Asset", back_populates="corridor")
    requests = relationship("MaintenanceRequest", back_populates="corridor")

class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. OHE-102, SIG-S102
    name = Column(String(150), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    corridor_id = Column(Integer, ForeignKey("corridors.id"), nullable=False)
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=True)
    asset_type = Column(String(100), nullable=False) # OHE Cantilever, Point Machine, Track Circuit, Rail Joint
    criticality = Column(String(20), default="MEDIUM") # HIGH, MEDIUM, LOW
    status = Column(String(50), default="HEALTHY") # HEALTHY, DEGRADED, FAULTY, UNDER_MAINTENANCE
    install_year = Column(Integer, default=2018)
    last_inspected = Column(String(50), default="2026-09-01")

    department = relationship("Department", back_populates="assets")
    corridor = relationship("Corridor", back_populates="assets")
    station = relationship("Station")

class Manpower(Base):
    __tablename__ = "manpower"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    gang_name = Column(String(100), nullable=False) # e.g. OHE Maintenance Gang 1
    crew_size = Column(Integer, default=6)
    skill_level = Column(String(50), default="Certified Technicians")
    available_count = Column(Integer, default=6)
    contact_person = Column(String(100), default="Supervisor")

    department = relationship("Department")

class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False) # Tower Wagon TW-04, Tamping Machine TM-12
    resource_type = Column(String(50), nullable=False) # TOWER_WAGON, TAMPING_MACHINE, CRANE, TEST_VAN
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    status = Column(String(50), default="AVAILABLE") # AVAILABLE, IN_USE, MAINTENANCE
    location_station_id = Column(Integer, ForeignKey("stations.id"), nullable=True)

    department = relationship("Department")
    station = relationship("Station")

class TrainSchedule(Base):
    __tablename__ = "train_schedules"

    id = Column(Integer, primary_key=True, index=True)
    train_no = Column(String(20), index=True, nullable=False) # e.g. 12951, 12009
    train_name = Column(String(100), nullable=False) # Mumbai Rajdhani, Shatabdi
    train_type = Column(String(50), default="SUPERFAST") # RAJDHANI, VANDE_BHARAT, SUPERFAST, GOODS, PASSENGER
    corridor_id = Column(Integer, ForeignKey("corridors.id"), nullable=False)
    departure_time = Column(String(20), nullable=False) # e.g. "02:15"
    arrival_time = Column(String(20), nullable=False) # e.g. "02:45"
    frequency = Column(String(50), default="Daily")
    priority = Column(String(20), default="HIGH")

    corridor = relationship("Corridor")

class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"

    id = Column(Integer, primary_key=True, index=True)
    problem_id = Column(String(50), unique=True, index=True, nullable=False) # PR-2026-00125
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    corridor_id = Column(Integer, ForeignKey("corridors.id"), nullable=False)
    from_station_id = Column(Integer, ForeignKey("stations.id"), nullable=True)
    to_station_id = Column(Integer, ForeignKey("stations.id"), nullable=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    asset_criticality = Column(String(20), default="MEDIUM")
    
    work_description = Column(Text, nullable=False)
    manpower_required = Column(Integer, default=4)
    manpower_available = Column(Integer, default=4)
    resources_required = Column(String(255), default="Standard Toolkit")
    safety_risk = Column(String(20), default="MEDIUM") # HIGH, MEDIUM, LOW
    isolation_required = Column(Boolean, default=False)
    
    priority = Column(String(20), default="MEDIUM") # CRITICAL, HIGH, MEDIUM, LOW
    requested_date = Column(String(50), nullable=False) # YYYY-MM-DD
    requested_start_time = Column(String(20), default="02:00")
    requested_end_time = Column(String(20), default="04:00")
    max_duration_hours = Column(Float, default=2.0)
    
    inspection_status = Column(String(50), default="INSPECTED")
    inspection_remarks = Column(Text, nullable=True)
    
    # AI Predictions
    ai_priority = Column(String(20), default="HIGH")
    ai_safety_risk = Column(String(20), default="MEDIUM")
    ai_estimated_duration = Column(Float, default=2.0)
    ai_train_impact = Column(String(20), default="LOW")
    
    # Status lifecycle: NEW, INSPECTED, AI_ANALYZED, APPROVED, REJECTED, IN_PROGRESS, DELAYED, MCR_SUBMITTED, VERIFIED, CLOSED, REWORK
    status = Column(String(50), default="NEW")
    
    reported_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actual_start_time = Column(String(30), nullable=True)
    progress_percent = Column(Integer, default=0)
    delay_reason = Column(String(100), nullable=True)
    delay_remarks = Column(Text, nullable=True)
    reject_reason = Column(Text, nullable=True)
    rework_remarks = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    department = relationship("Department", back_populates="requests")
    corridor = relationship("Corridor", back_populates="requests")
    asset = relationship("Asset")
    reported_by = relationship("User")
    from_station = relationship("Station", foreign_keys=[from_station_id])
    to_station = relationship("Station", foreign_keys=[to_station_id])
    mcr = relationship("MCRReport", back_populates="request", uselist=False)

class MaintenanceBlock(Base):
    __tablename__ = "maintenance_blocks"

    id = Column(Integer, primary_key=True, index=True)
    block_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. B-102
    corridor_id = Column(Integer, ForeignKey("corridors.id"), nullable=False)
    start_time = Column(String(30), nullable=False) # e.g. "02:30 AM" or ISO string
    end_time = Column(String(30), nullable=False) # e.g. "04:30 AM"
    duration_hours = Column(Float, default=2.0)
    
    # Status: PENDING, AI_RECOMMENDED, APPROVED, ACTIVE, COMPLETED, CANCELLED
    status = Column(String(50), default="AI_RECOMMENDED")
    safety_clearance = Column(Boolean, default=True)
    isolation_type = Column(String(100), default="OHE Power Block + Traffic Disconnection")
    train_impact = Column(String(20), default="LOW")
    notes = Column(Text, nullable=True)
    
    approved_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    corridor = relationship("Corridor")
    approved_by = relationship("User")
    jobs = relationship("BlockJob", back_populates="block", cascade="all, delete-orphan")
    ai_recommendation = relationship("AIRecommendation", back_populates="block", uselist=False)

class BlockJob(Base):
    __tablename__ = "block_jobs"

    id = Column(Integer, primary_key=True, index=True)
    block_id = Column(Integer, ForeignKey("maintenance_blocks.id"), nullable=False)
    request_id = Column(Integer, ForeignKey("maintenance_requests.id"), nullable=False)
    job_order = Column(Integer, default=1)

    block = relationship("MaintenanceBlock", back_populates="jobs")
    request = relationship("MaintenanceRequest")

class Conflict(Base):
    __tablename__ = "conflicts"

    id = Column(Integer, primary_key=True, index=True)
    # Types: TRAIN, CORRIDOR, TIME, MANPOWER, RESOURCE, SAFETY, ISOLATION, EXISTING_BLOCK
    conflict_type = Column(String(50), nullable=False)
    severity = Column(String(20), default="CRITICAL") # CRITICAL, WARNING, INFO
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    corridor_id = Column(Integer, ForeignKey("corridors.id"), nullable=True)
    block_id = Column(Integer, ForeignKey("maintenance_blocks.id"), nullable=True)
    request_id = Column(Integer, ForeignKey("maintenance_requests.id"), nullable=True)
    train_id = Column(Integer, ForeignKey("train_schedules.id"), nullable=True)
    ai_suggestion = Column(Text, nullable=True)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    corridor = relationship("Corridor")
    block = relationship("MaintenanceBlock")
    request = relationship("MaintenanceRequest")
    train = relationship("TrainSchedule")

class AIRecommendation(Base):
    __tablename__ = "ai_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    block_id = Column(Integer, ForeignKey("maintenance_blocks.id"), nullable=False)
    title = Column(String(150), nullable=False)
    rationales = Column(JSON, default=list) # Checklist e.g. ["No train conflict", "Combined 3 jobs", "Manpower available"]
    block_reduction_percent = Column(Float, default=66.0)
    train_delay_mitigation_minutes = Column(Integer, default=45)
    asset_availability_impact = Column(Float, default=94.2)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    block = relationship("MaintenanceBlock", back_populates="ai_recommendation")

class MCRReport(Base):
    __tablename__ = "mcr_reports"

    id = Column(Integer, primary_key=True, index=True)
    mcr_id = Column(String(50), unique=True, index=True, nullable=False) # MCR-2026-00045
    request_id = Column(Integer, ForeignKey("maintenance_requests.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    corridor_id = Column(Integer, ForeignKey("corridors.id"), nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    
    actual_work_performed = Column(Text, nullable=False)
    work_status = Column(String(50), default="Completed") # Completed, Partially Completed, Not Completed
    manpower_deployed = Column(Integer, default=5)
    resources_used = Column(String(255), default="Maintenance Vehicle, Testing Equipment")
    
    actual_start_time = Column(String(30), nullable=False)
    actual_completion_time = Column(String(30), nullable=False)
    actual_duration_hours = Column(Float, default=1.8)
    planned_commitment_hours = Column(Float, default=2.0)
    commitment_met = Column(Boolean, default=True)
    delay_reason = Column(String(255), nullable=True)
    
    safety_clearance = Column(Boolean, default=True)
    asset_restored = Column(String(20), default="YES") # YES, NO, PARTIALLY
    supporting_docs = Column(JSON, default=list) # List of image/doc metadata
    
    verified_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    # Verification status: AWAITING_VERIFICATION, VERIFIED, REWORK, PARTIAL, CLOSED
    verification_status = Column(String(50), default="AWAITING_VERIFICATION")
    rework_instructions = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    request = relationship("MaintenanceRequest", back_populates="mcr")
    department = relationship("Department")
    corridor = relationship("Corridor")
    asset = relationship("Asset")
    verified_by = relationship("User")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    role = Column(String(50), nullable=True) # HIGHER_HOD, LOWER_HOD, ALL
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    alert_type = Column(String(20), default="INFO") # INFO, WARNING, CRITICAL, SUCCESS
    is_read = Column(Boolean, default=False)
    related_request_id = Column(Integer, nullable=True)
    related_block_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name = Column(String(100), default="System")
    role = Column(String(50), default="SYSTEM")
    action = Column(String(100), nullable=False) # e.g. APPROVE_BLOCK, REJECT_REQUEST, SUBMIT_MCR
    entity_type = Column(String(50), nullable=False) # REQUEST, BLOCK, MCR, PLAN
    entity_id = Column(String(50), nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class EmergencyEvent(Base):
    __tablename__ = "emergency_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(50), unique=True, index=True, nullable=False)
    corridor_id = Column(Integer, ForeignKey("corridors.id"), nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True)
    train_id = Column(Integer, ForeignKey("train_schedules.id"), nullable=True)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String(20), default="CRITICAL")
    status = Column(String(50), default="ACTIVE") # ACTIVE, RESOLVED
    ai_plan_suggested = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    corridor = relationship("Corridor")
    asset = relationship("Asset")
    train = relationship("TrainSchedule")

class WorkProgress(Base):
    __tablename__ = "work_progress"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("maintenance_requests.id"), nullable=False)
    progress_percent = Column(Integer, default=0)
    status_update = Column(String(255), nullable=True)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    request = relationship("MaintenanceRequest")
