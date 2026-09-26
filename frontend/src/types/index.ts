export type UserRole = 'HIGHER_HOD' | 'LOWER_HOD' | 'ADMIN';

export interface User {
  id: number;
  emp_id: string;
  name: string;
  email: string;
  role: UserRole;
  department_id?: number | null;
  department_code?: string | null;
  department_name?: string | null;
  is_active: boolean;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  hod_name: string;
  head_count: number;
  icon: string;
}

export interface Station {
  id: number;
  code: string;
  name: string;
  division: string;
  zone: string;
  latitude?: number;
  longitude?: number;
}

export interface Corridor {
  id: number;
  code: string;
  name: string;
  from_station_id: number;
  to_station_id: number;
  from_station_name?: string;
  to_station_name?: string;
  distance_km: number;
  track_type: string;
  max_speed: number;
  status: 'NORMAL' | 'MAINTENANCE' | 'CRITICAL';
}

export interface Asset {
  id: number;
  asset_id: string;
  name: string;
  department_id: number;
  corridor_id: number;
  corridor_code?: string;
  asset_type: string;
  criticality: 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL';
  status: 'HEALTHY' | 'DEGRADED' | 'FAULTY' | 'UNDER_MAINTENANCE';
  install_year: number;
  last_inspected: string;
}

export interface TrainSchedule {
  id: number;
  train_no: string;
  train_name: string;
  train_type: string;
  corridor_id: number;
  corridor_name?: string;
  departure_time: string;
  arrival_time: string;
  frequency: string;
  priority: string;
}

export type RequestStatus = 
  | 'NEW' 
  | 'INSPECTED' 
  | 'AI_ANALYZED' 
  | 'APPROVED' 
  | 'REJECTED' 
  | 'IN_PROGRESS' 
  | 'DELAYED' 
  | 'MCR_SUBMITTED' 
  | 'VERIFIED' 
  | 'CLOSED' 
  | 'REWORK';

export interface MaintenanceRequest {
  id: number;
  problem_id: string;
  department_id: number;
  department_code?: string;
  department_name?: string;
  corridor_id: number;
  corridor_code?: string;
  corridor_name?: string;
  from_station_id?: number;
  from_station_name?: string;
  to_station_id?: number;
  to_station_name?: string;
  asset_id: number;
  asset_code?: string;
  asset_name?: string;
  asset_criticality: string;
  work_description: string;
  manpower_required: number;
  manpower_available: number;
  resources_required: string;
  safety_risk: string;
  isolation_required: boolean;
  priority: string;
  requested_date: string;
  requested_start_time: string;
  requested_end_time: string;
  max_duration_hours: number;
  inspection_status: string;
  inspection_remarks?: string;
  ai_priority: string;
  ai_safety_risk: string;
  ai_estimated_duration: number;
  ai_train_impact: string;
  status: RequestStatus;
  reported_by_name?: string;
  actual_start_time?: string;
  progress_percent: number;
  delay_reason?: string;
  delay_remarks?: string;
  reject_reason?: string;
  rework_remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface BlockJobInfo {
  request_id: number;
  problem_id: string;
  department_code: string;
  department_name: string;
  asset_name: string;
  work_description: string;
  priority: string;
  duration_hours: number;
}

export interface MaintenanceBlock {
  id: number;
  block_id: string;
  corridor_id: number;
  corridor_code?: string;
  corridor_name?: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  status: 'PENDING' | 'AI_RECOMMENDED' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  safety_clearance: boolean;
  isolation_type: string;
  train_impact: string;
  notes?: string;
  jobs_count: number;
  departments: string[];
  jobs: BlockJobInfo[];
  rationales: string[];
  created_at: string;
}

export interface Conflict {
  id: number;
  conflict_type: 'TRAIN' | 'CORRIDOR' | 'TIME' | 'MANPOWER' | 'RESOURCE' | 'SAFETY' | 'ISOLATION' | 'EXISTING_BLOCK';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  corridor_id?: number;
  corridor_name?: string;
  block_id?: number;
  request_id?: number;
  train_id?: number;
  ai_suggestion?: string;
  is_resolved: boolean;
  created_at: string;
}

export interface MCRReport {
  id: number;
  mcr_id: string;
  request_id: number;
  problem_id: string;
  department_id: number;
  department_name: string;
  corridor_name: string;
  asset_name: string;
  actual_work_performed: string;
  work_status: string;
  manpower_deployed: number;
  resources_used: string;
  actual_start_time: string;
  actual_completion_time: string;
  actual_duration_hours: number;
  planned_commitment_hours: number;
  commitment_met: boolean;
  delay_reason?: string;
  safety_clearance: boolean;
  asset_restored: string;
  supporting_docs: any[];
  verification_status: 'AWAITING_VERIFICATION' | 'VERIFIED' | 'REWORK' | 'PARTIAL' | 'CLOSED';
  verified_by_name?: string;
  rework_instructions?: string;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  alert_type: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
  is_read: boolean;
  department_id?: number;
  related_request_id?: number;
  related_block_id?: number;
  created_at: string;
}

export interface AuditLogItem {
  id: number;
  user_name: string;
  role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: string;
  timestamp: string;
}

export interface DepartmentMetric {
  department: string;
  code: string;
  total_requests: number;
  critical: number;
  pending: number;
  in_progress: number;
  delayed: number;
  completed: number;
}

export interface DashboardKPIs {
  total_requests: number;
  pending_approval: number;
  critical_problems: number;
  active_maintenance: number;
  delayed_work: number;
  asset_availability_percent: number;
  completed_work: number;
  mcr_pending: number;
  corridor_status: Array<{
    id: number;
    code: string;
    name: string;
    track_type: string;
    status: 'NORMAL' | 'MAINTENANCE' | 'CRITICAL';
    distance_km: number;
    active_blocks: number;
    total_assets: number;
    open_requests: number;
    train_impact: string;
  }>;
  department_metrics: DepartmentMetric[];
  critical_alerts: Array<{
    id: string;
    type: string;
    title: string;
    corridor: string;
    train_impact: string;
    recommended_action: string;
  }>;
}
