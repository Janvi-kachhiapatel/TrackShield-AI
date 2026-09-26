import dbDump from '../data/databaseDump.json';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { MaintenanceRequest, MCRReport, MaintenanceBlock } from '../types';

// Persistent client-side storage keys
const STORAGE_REQUESTS_KEY = 'railway_client_requests';
const STORAGE_MCR_KEY = 'railway_client_mcr';
const STORAGE_BLOCKS_KEY = 'railway_client_blocks';

// Initialize mutable store from localStorage or bundled JSON
const getStoredRequests = (): MaintenanceRequest[] => {
  try {
    const saved = localStorage.getItem(STORAGE_REQUESTS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return (dbDump.maintenance_requests || []) as unknown as MaintenanceRequest[];
};

const saveRequests = (reqs: MaintenanceRequest[]) => {
  try {
    localStorage.setItem(STORAGE_REQUESTS_KEY, JSON.stringify(reqs));
  } catch {}
};

const getStoredMCRs = (): MCRReport[] => {
  try {
    const saved = localStorage.getItem(STORAGE_MCR_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return (dbDump.mcr_reports || []) as unknown as MCRReport[];
};

const saveMCRs = (mcrs: MCRReport[]) => {
  try {
    localStorage.setItem(STORAGE_MCR_KEY, JSON.stringify(mcrs));
  } catch {}
};

const STORAGE_EVENTS_KEY = 'railway_client_events';

const DEFAULT_EMERGENCY_EVENTS = [
  {
    id: 1,
    event_id: 'EMG-2026-001',
    corridor_id: 1,
    corridor_name: 'New Delhi → Ghaziabad Junction',
    asset_id: 101,
    asset_name: 'Electric Point Machine Point 101A/B',
    title: 'Point Machine 101 Detection Failure',
    description: 'Point machine 101 micro-switch clearance out of tolerance. Emergency S&T gang dispatched.',
    severity: 'CRITICAL',
    status: 'ACTIVE',
    ai_plan_suggested: 'AI Re-planning Proposal: Immediately inject 45-minute emergency maintenance block for New Delhi → Ghaziabad Junction. Re-route Express trains via Line 2.',
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    event_id: 'EMG-2026-002',
    corridor_id: 2,
    corridor_name: 'Ghaziabad Junction → Aligarh Junction',
    asset_id: 211,
    asset_name: 'Hot Axle Box Detection Sensor (HABD) #211',
    title: 'HABD Thermal Alarm Km 74',
    description: 'Thermal bearing sensor flagged 85°C on trailing wagon axle. Speed caution 30 km/h enforced.',
    severity: 'HIGH',
    status: 'ACTIVE',
    ai_plan_suggested: 'Hold Freight 70124 at loop line for physical inspection. Re-optimize schedule window by +20 minutes.',
    created_at: new Date(Date.now() - 3600000).toISOString()
  }
];

const getStoredEmergencyEvents = (): any[] => {
  try {
    const saved = localStorage.getItem(STORAGE_EVENTS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_EMERGENCY_EVENTS;
};

const saveEmergencyEvents = (events: any[]) => {
  try {
    localStorage.setItem(STORAGE_EVENTS_KEY, JSON.stringify(events));
  } catch {}
};

const getStoredBlocks = (): MaintenanceBlock[] => {
  try {
    const saved = localStorage.getItem(STORAGE_BLOCKS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return (dbDump.maintenance_blocks || []) as unknown as MaintenanceBlock[];
};

const saveBlocks = (blocks: MaintenanceBlock[]) => {
  try {
    localStorage.setItem(STORAGE_BLOCKS_KEY, JSON.stringify(blocks));
  } catch {}
};

export const handleClientDatabaseFallback = (config?: AxiosRequestConfig): AxiosResponse | null => {
  if (!config || !config.url) return null;

  let rawUrl = config.url;
  try {
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      const parsed = new URL(rawUrl);
      rawUrl = parsed.pathname + parsed.search;
    }
  } catch {}

  const url = rawUrl.replace(/^\/?api\/?/, '/');
  const method = (config.method || 'get').toLowerCase();
  const params: Record<string, any> = { ...(config.params || {}) };

  // Parse URL query params if present in URL
  const [pathname, queryString] = url.split('?');
  const queryParams = new URLSearchParams(queryString || '');
  for (const [key, value] of queryParams.entries()) {
    if (!params[key]) params[key] = value;
  }

  const makeResponse = (data: any, status = 200): AxiosResponse => ({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: (config || {}) as any,
  });

  // --- 1. Master Data Endpoints ---
  if (pathname === '/master/corridors' || pathname === 'master/corridors') {
    const limit = Number(params.limit) || 200;
    return makeResponse(dbDump.corridors.slice(0, limit));
  }

  if (pathname === '/master/assets' || pathname === 'master/assets') {
    let assets = [...dbDump.assets];
    const deptId = params.department_id ? String(params.department_id).trim().toLowerCase() : null;
    const corrId = params.corridor_id ? String(params.corridor_id).trim().toLowerCase() : null;

    if (deptId && !['undefined', 'null', 'all', 'none', ''].includes(deptId)) {
      const dNum = Number(deptId);
      if (dNum > 0 && dNum !== 6) {
        assets = assets.filter(a => Number(a.department_id) === dNum);
      }
    }

    if (corrId && !['undefined', 'null', 'all', 'none', ''].includes(corrId)) {
      const cNum = Number(corrId);
      if (cNum > 0) {
        const corrMatched = assets.filter(a => Number(a.corridor_id) === cNum);
        if (corrMatched.length > 0) assets = corrMatched;
      }
    }

    const limit = Number(params.limit) || 400;
    return makeResponse(assets.slice(0, limit));
  }

  if (pathname === '/master/departments' || pathname === 'master/departments') {
    return makeResponse(dbDump.departments);
  }

  if (pathname === '/master/stations' || pathname === 'master/stations') {
    const limit = Number(params.limit) || 100;
    return makeResponse(dbDump.stations.slice(0, limit));
  }

  if (pathname === '/master/trains' || pathname === 'master/trains') {
    const limit = Number(params.limit) || 100;
    return makeResponse(dbDump.train_schedules.slice(0, limit));
  }

  if (pathname === '/master/notifications' || pathname === 'master/notifications') {
    return makeResponse(dbDump.notifications);
  }

  if (pathname === '/master/audit-logs' || pathname === 'master/audit-logs') {
    return makeResponse([]);
  }

  // --- 2. Maintenance Requests Endpoints ---
  if ((pathname === '/requests' || pathname === 'requests') && method === 'get') {
    let reqs = getStoredRequests();
    const deptId = params.department_id ? Number(params.department_id) : null;
    const status = params.status;
    const priority = params.priority;
    const corridorId = params.corridor_id ? Number(params.corridor_id) : null;

    if (deptId && deptId !== 6) {
      reqs = reqs.filter(r => Number(r.department_id) === deptId);
    }
    if (status && status !== 'ALL') {
      reqs = reqs.filter(r => r.status === status);
    }
    if (priority && priority !== 'ALL') {
      reqs = reqs.filter(r => r.priority === priority);
    }
    if (corridorId) {
      reqs = reqs.filter(r => Number(r.corridor_id) === corridorId);
    }

    const limit = Number(params.limit) || 200;
    return makeResponse(reqs.slice(0, limit));
  }

  if (pathname.match(/^\/requests\/\d+$/) && method === 'get') {
    const id = Number(pathname.split('/')[2]);
    const reqs = getStoredRequests();
    const found = reqs.find(r => r.id === id) || reqs[0];
    return makeResponse(found);
  }

  if ((pathname === '/requests' || pathname === 'requests') && method === 'post') {
    const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
    const reqs = getStoredRequests();
    const newId = reqs.length > 0 ? Math.max(...reqs.map(r => r.id)) + 1 : 1;
    const padNum = String(newId).padStart(5, '0');
    
    // Find corridor and asset names
    const corr = dbDump.corridors.find(c => c.id === body.corridor_id);
    const asset = dbDump.assets.find(a => a.id === body.asset_id);
    const dept = dbDump.departments.find(d => d.id === (asset?.department_id || 1));

    const newReq: MaintenanceRequest = {
      id: newId,
      problem_id: `PR-2026-${padNum}`,
      department_id: dept?.id || 1,
      department_code: dept?.code || 'ELEC',
      department_name: dept?.name || 'Electrical Department',
      corridor_id: body.corridor_id || 1,
      corridor_code: corr?.code || 'NDLS-GZB',
      corridor_name: corr?.name || 'New Delhi → Ghaziabad',
      from_station_id: corr?.from_station_id,
      to_station_id: corr?.to_station_id,
      from_station_name: (corr as any)?.from_station_name,
      to_station_name: (corr as any)?.to_station_name,
      asset_id: body.asset_id || 1,
      asset_code: asset?.asset_id || 'ASSET-001',
      asset_name: asset?.name || 'Infrastructure Asset',
      asset_criticality: body.asset_criticality || 'HIGH',
      work_description: body.work_description || 'Track defect reported by Lower HOD.',
      manpower_required: body.manpower_required || 4,
      manpower_available: body.manpower_available || 4,
      resources_required: body.resources_required || 'Standard Maintenance Toolkit',
      safety_risk: body.safety_risk || 'HIGH',
      isolation_required: Boolean(body.isolation_required),
      priority: body.priority || 'HIGH',
      requested_date: body.requested_date || new Date().toISOString().split('T')[0],
      requested_start_time: body.requested_start_time || '02:00',
      requested_end_time: body.requested_end_time || '04:00',
      max_duration_hours: body.max_duration_hours || 2.0,
      inspection_status: body.inspection_status || 'INSPECTED',
      inspection_remarks: body.inspection_remarks || 'Inspection verified by Lower HOD.',
      ai_priority: 'HIGH',
      ai_safety_risk: 'MEDIUM',
      ai_estimated_duration: body.max_duration_hours || 2.0,
      ai_train_impact: 'LOW',
      status: 'NEW',
      progress_percent: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    reqs.unshift(newReq);
    saveRequests(reqs);
    return makeResponse(newReq, 201);
  }

  if (pathname.includes('/approve') && pathname.includes('/requests/')) {
    const id = Number(pathname.split('/')[2]);
    const reqs = getStoredRequests();
    const target = reqs.find(r => r.id === id);
    if (target) {
      target.status = 'APPROVED';
      target.updated_at = new Date().toISOString();
      saveRequests(reqs);
    }
    return makeResponse({ message: 'Request approved successfully' });
  }

  if (pathname.includes('/start') && pathname.includes('/requests/')) {
    const id = Number(pathname.split('/')[2]);
    const reqs = getStoredRequests();
    const target = reqs.find(r => r.id === id);
    if (target) {
      target.status = 'IN_PROGRESS';
      target.actual_start_time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      target.updated_at = new Date().toISOString();
      saveRequests(reqs);
    }
    return makeResponse({ message: 'Work started' });
  }

  if (pathname.includes('/progress') && pathname.includes('/requests/')) {
    const id = Number(pathname.split('/')[2]);
    const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
    const reqs = getStoredRequests();
    const target = reqs.find(r => r.id === id);
    if (target) {
      target.progress_percent = body.progress_percent || 50;
      target.updated_at = new Date().toISOString();
      saveRequests(reqs);
    }
    return makeResponse({ message: 'Progress updated' });
  }

  if (pathname.includes('/delay') && pathname.includes('/requests/')) {
    const id = Number(pathname.split('/')[2]);
    const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
    const reqs = getStoredRequests();
    const target = reqs.find(r => r.id === id);
    if (target) {
      target.status = 'DELAYED';
      (target as any).delay_reason = body.delay_reason || 'Field delay reported';
      (target as any).delay_remarks = body.delay_remarks || '';
      target.updated_at = new Date().toISOString();
      saveRequests(reqs);
    }
    return makeResponse({ message: 'Delay reported successfully' });
  }

  if (pathname.includes('/reject') && pathname.includes('/requests/')) {
    const id = Number(pathname.split('/')[2]);
    const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
    const reqs = getStoredRequests();
    const target = reqs.find(r => r.id === id);
    if (target) {
      target.status = 'REJECTED';
      (target as any).reject_reason = body.reject_reason || 'Rejected by Higher HOD';
      target.updated_at = new Date().toISOString();
      saveRequests(reqs);
    }
    return makeResponse({ message: 'Request rejected' });
  }

  if (pathname.includes('/rework') && pathname.includes('/requests/')) {
    const id = Number(pathname.split('/')[2]);
    const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
    const reqs = getStoredRequests();
    const target = reqs.find(r => r.id === id);
    if (target) {
      target.status = 'REWORK';
      (target as any).rework_remarks = body.rework_remarks || 'Returned for rework';
      target.updated_at = new Date().toISOString();
      saveRequests(reqs);
    }
    return makeResponse({ message: 'Request sent for rework' });
  }

  if (pathname === '/requests/ai-preview' || pathname === 'requests/ai-preview') {
    const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
    const crit = body.asset_criticality || 'HIGH';
    return makeResponse({
      ai_priority: crit === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      ai_safety_risk: body.isolation_required ? 'HIGH' : 'MEDIUM',
      ai_estimated_duration: `${body.max_duration_hours || 2.0} Hours`,
      ai_train_impact: crit === 'CRITICAL' ? 'MEDIUM' : 'LOW',
      recommendation: 'Integrated Block Fusion optimization ready. Slot: 02:00–04:00 AM.'
    });
  }

  // --- 3. Maintenance Blocks Endpoints ---
  if ((pathname === '/blocks' || pathname === 'blocks') && method === 'get') {
    const blocks = getStoredBlocks();
    const limit = Number(params.limit) || 80;
    return makeResponse(blocks.slice(0, limit));
  }

  if (pathname.includes('/approve') && pathname.includes('/blocks/')) {
    const id = Number(pathname.split('/')[2]);
    const blocks = getStoredBlocks();
    const target = blocks.find(b => b.id === id);
    if (target) {
      target.status = 'APPROVED';
      saveBlocks(blocks);
    }
    return makeResponse({ message: 'Block approved' });
  }

  if (pathname.includes('/reject') && pathname.includes('/blocks/')) {
    const id = Number(pathname.split('/')[2]);
    const blocks = getStoredBlocks();
    const target = blocks.find(b => b.id === id);
    if (target) {
      target.status = 'CANCELLED';
      saveBlocks(blocks);
    }
    return makeResponse({ message: 'Block rejected' });
  }

  // --- 4. MCR Completion Endpoints ---
  if ((pathname === '/mcr' || pathname === 'mcr') && method === 'get') {
    const mcrs = getStoredMCRs();
    return makeResponse(mcrs);
  }

  if ((pathname === '/mcr' || pathname === 'mcr') && method === 'post') {
    const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
    const mcrs = getStoredMCRs();
    const reqs = getStoredRequests();
    const target = reqs.find(r => r.id === body.request_id);

    const newMCR: MCRReport = {
      id: mcrs.length + 1,
      mcr_id: `MCR-2026-${String(mcrs.length + 1).padStart(4, '0')}`,
      request_id: body.request_id,
      problem_id: target?.problem_id || `PR-2026-${body.request_id || 1}`,
      department_id: target?.department_id || 1,
      department_name: target?.department_name || 'Electrical Department',
      corridor_name: target?.corridor_name || 'NDLS-GZB Corridor',
      asset_name: target?.asset_name || 'Railway Fixed Asset',
      actual_work_performed: body.actual_work_performed || 'Maintenance work completed and track re-opened.',
      work_status: body.work_status || 'Completed',
      manpower_deployed: body.manpower_deployed || 6,
      resources_used: body.resources_used || 'Standard Machinery & Test Tools',
      actual_start_time: body.actual_start_time || '02:00 AM',
      actual_completion_time: body.actual_completion_time || '03:45 AM',
      actual_duration_hours: body.actual_duration_hours || 1.75,
      planned_commitment_hours: body.planned_commitment_hours || 2.0,
      commitment_met: body.actual_duration_hours <= body.planned_commitment_hours,
      delay_reason: body.delay_reason || '',
      safety_clearance: Boolean(body.safety_clearance),
      asset_restored: body.asset_restored || 'YES',
      supporting_docs: [],
      verification_status: 'AWAITING_VERIFICATION',
      created_at: new Date().toISOString()
    };
    mcrs.unshift(newMCR);
    saveMCRs(mcrs);

    // Update corresponding request
    if (target) {
      target.status = 'MCR_SUBMITTED';
      saveRequests(reqs);
    }

    return makeResponse(newMCR, 201);
  }

  if (pathname.includes('/verify') && pathname.includes('/mcr/')) {
    const id = Number(pathname.split('/')[2]);
    const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
    const mcrs = getStoredMCRs();
    const targetMcr = mcrs.find(m => m.id === id);
    if (targetMcr) {
      targetMcr.verification_status = 'VERIFIED';
      saveMCRs(mcrs);

      const reqs = getStoredRequests();
      const targetReq = reqs.find(r => r.id === targetMcr.request_id);
      if (targetReq) {
        targetReq.status = 'VERIFIED';
        targetReq.updated_at = new Date().toISOString();
        saveRequests(reqs);
      }
    }
    return makeResponse({ message: 'MCR verified successfully' });
  }

  // --- 5. AI Optimizer Endpoints ---
  if (pathname === '/ai/conflicts' || pathname === 'ai/conflicts') {
    return makeResponse(dbDump.conflicts || []);
  }

  if (pathname === '/ai/fusion-opportunities' || pathname === 'ai/fusion-opportunities') {
    return makeResponse([
      {
        id: 1,
        corridor_code: 'NDLS-GZB',
        corridor_name: 'New Delhi → Ghaziabad Junction',
        compatible_departments: ['Electrical (TRD)', 'Signalling (SMMS)', 'Civil (TMS)'],
        estimated_combined_window: '02:00 – 04:00 AM (2.0 Hrs)',
        jobs_bundled: 3,
        train_impact_reduction_percent: 66,
        safety_isolation: 'Single Traction Disconnection + S&T Route Release'
      },
      {
        id: 2,
        corridor_code: 'GZB-ALJN',
        corridor_name: 'Ghaziabad Junction → Aligarh Junction',
        compatible_departments: ['Civil (TMS)', 'Telecommunications'],
        estimated_combined_window: '01:30 – 03:30 AM (2.0 Hrs)',
        jobs_bundled: 2,
        train_impact_reduction_percent: 50,
        safety_isolation: 'Adjacent Track Speed Caution 30 km/h'
      }
    ]);
  }

  if (pathname === '/ai/generate-plan' || pathname === 'ai/generate-plan') {
    return makeResponse({
      status: 'SUCCESS',
      solver: 'Google OR-Tools CP-SAT Integer Optimizer',
      total_requests_analyzed: 205,
      blocks_synthesized: 14,
      conflicts_resolved: 4,
      train_punctuality_preserved_percent: 98.4
    });
  }

  // --- 6. Analytics & Live Operations ---
  if (pathname === '/analytics/dashboard' || pathname === 'analytics/dashboard') {
    const reqs = getStoredRequests();
    const blocks = getStoredBlocks();
    const assets = (dbDump.assets || []) as any[];
    const corridors = (dbDump.corridors || []) as any[];
    const depts = (dbDump.departments || []).filter((d: any) => d.code !== 'ALL');

    const total_requests = reqs.length;
    const pending_approval = reqs.filter(r => ['NEW', 'INSPECTED', 'AI_ANALYZED'].includes(r.status)).length;
    const critical_problems = reqs.filter(r => r.priority === 'CRITICAL' && r.status !== 'CLOSED').length;
    const active_maintenance = reqs.filter(r => r.status === 'IN_PROGRESS').length;
    const delayed_work = reqs.filter(r => r.status === 'DELAYED').length;
    const completed_work = reqs.filter(r => ['VERIFIED', 'CLOSED'].includes(r.status)).length;
    const mcr_pending = reqs.filter(r => r.status === 'MCR_SUBMITTED').length;

    const healthy_assets = assets.filter(a => a.status === 'HEALTHY').length;
    const asset_availability_percent = assets.length > 0 ? Math.round((healthy_assets / assets.length) * 1000) / 10 : 98.4;

    const department_metrics = depts.map((d: any) => {
      const dReqs = reqs.filter(r => r.department_id === d.id);
      return {
        department: d.name,
        code: d.code,
        total_requests: dReqs.length,
        critical: dReqs.filter(r => r.priority === 'CRITICAL').length,
        pending: dReqs.filter(r => ['NEW', 'INSPECTED', 'AI_ANALYZED'].includes(r.status)).length,
        in_progress: dReqs.filter(r => r.status === 'IN_PROGRESS').length,
        delayed: dReqs.filter(r => r.status === 'DELAYED').length,
        completed: dReqs.filter(r => ['VERIFIED', 'CLOSED'].includes(r.status)).length
      };
    });

    const corridor_status = corridors.slice(0, 10).map((c: any) => {
      const active_blocks = blocks.filter(b => b.corridor_id === c.id && ['ACTIVE', 'APPROVED', 'AI_RECOMMENDED'].includes(b.status)).length;
      const corr_assets = assets.filter(a => a.corridor_id === c.id).length;
      const open_requests = reqs.filter(r => r.corridor_id === c.id && r.status !== 'CLOSED').length;
      return {
        id: c.id,
        code: c.code,
        name: c.name,
        track_type: c.track_type,
        status: (c.status || 'NORMAL') as any,
        distance_km: c.distance_km,
        active_blocks,
        total_assets: corr_assets,
        open_requests,
        train_impact: c.status === 'CRITICAL' ? 'HIGH' : (c.status === 'MAINTENANCE' ? 'MEDIUM' : 'LOW')
      };
    });

    const critical_alerts = [
      {
        id: 'emg-1',
        type: 'CRITICAL',
        title: '🔴 EMERGENCY: Point Machine S-102 Jammed',
        corridor: 'New Delhi → Ghaziabad Junction',
        train_impact: 'HIGH',
        recommended_action: 'Deploy emergency S&T maintenance gang immediately.'
      },
      {
        id: 'conf-1',
        type: 'HIGH',
        title: '🟠 Track & OHE Multi-Department Window Alignment Needed',
        corridor: 'Ghaziabad Junction → Aligarh Junction',
        train_impact: 'MEDIUM',
        recommended_action: 'Adjust block scheduling window using AI Block Planner.'
      }
    ];

    return makeResponse({
      total_requests,
      pending_approval,
      critical_problems,
      active_maintenance,
      delayed_work,
      asset_availability_percent,
      completed_work,
      mcr_pending,
      corridor_status,
      department_metrics,
      critical_alerts
    });
  }

  if (pathname === '/analytics/charts' || pathname === 'analytics/charts') {
    const reqs = getStoredRequests();

    const deptCodes = ['CIVIL', 'ELEC', 'SIG', 'TEL', 'MECH'];
    const department_chart = deptCodes.map(code => ({
      name: code,
      count: reqs.filter(r => (r.department_code || '').toUpperCase() === code).length || 20
    }));

    const priorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const priority_chart = priorities.map(prio => ({
      priority: prio,
      count: reqs.filter(r => r.priority === prio).length || 10
    }));

    const trend = [
      { day: 'Day 1', availability: 91.2, downtime_hours: 18.5 },
      { day: 'Day 5', availability: 92.4, downtime_hours: 16.0 },
      { day: 'Day 10', availability: 93.1, downtime_hours: 14.8 },
      { day: 'Day 15', availability: 92.8, downtime_hours: 15.2 },
      { day: 'Day 20', availability: 94.5, downtime_hours: 11.4 },
      { day: 'Day 25', availability: 95.8, downtime_hours: 8.9 },
      { day: 'Today', availability: 96.4, downtime_hours: 7.2 }
    ];

    const fusion_stats = {
      individual_requests_scheduled: 74,
      fused_blocks_created: 26,
      blocks_eliminated: 48,
      efficiency_savings_percent: 64.8,
      train_delay_minutes_saved: 420
    };

    const mcrs = getStoredMCRs();
    const metCount = mcrs.filter(m => m.commitment_met).length;
    const commitment_rate = mcrs.length > 0 ? Math.round((metCount / mcrs.length) * 1000) / 10 : 94.2;

    return makeResponse({
      department_chart,
      priority_chart,
      availability_trend: trend,
      fusion_stats,
      commitment_success_rate: commitment_rate,
      manpower_utilization_percent: 78.4,
      resource_utilization_percent: 82.1
    });
  }

  if (pathname === '/live/events' || pathname === 'live/events') {
    const savedEvents = getStoredEmergencyEvents();
    return makeResponse(savedEvents);
  }

  if (pathname === '/live/simulate' || pathname === 'live/simulate') {
    const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
    const corr = (dbDump.corridors || []).find((c: any) => c.id === body.corridor_id) || dbDump.corridors[0];
    const asset = (dbDump.assets || []).find((a: any) => a.id === body.asset_id) || dbDump.assets[0];

    const events = getStoredEmergencyEvents();
    const newEvent = {
      id: events.length + 1,
      event_id: `EMG-2026-${String(events.length + 1).padStart(3, '0')}`,
      corridor_id: corr.id,
      corridor_name: corr.name,
      asset_id: asset?.id || 1,
      asset_name: asset?.name || 'Trackside Asset',
      title: body.title || 'Track Point Obstruction Simulated',
      description: body.description || 'Emergency inspection gang dispatched to site.',
      severity: 'CRITICAL',
      status: 'ACTIVE',
      ai_plan_suggested: `AI Re-planning Proposal: Immediately inject 45-minute emergency maintenance block for ${corr.name}. Shift scheduled passenger blocks by +30 minutes.`,
      created_at: new Date().toISOString()
    };
    events.unshift(newEvent);
    saveEmergencyEvents(events);

    return makeResponse(newEvent, 201);
  }

  if (pathname.includes('/live/reoptimize-schedule')) {
    return makeResponse({
      message: 'Schedule successfully re-optimized and train timetable dynamically adjusted.',
      status: 'REOPTIMIZED',
      conflicts_avoided: 2
    });
  }

  if (pathname.includes('/read') && pathname.includes('/master/notifications/')) {
    return makeResponse({ message: 'Notification marked as read' });
  }

  // --- 7. Auth Endpoints ---
  if (pathname === '/auth/login' || pathname === 'auth/login') {
    const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
    const empId = (body.emp_id || 'hod001').toLowerCase();
    const user = dbDump.users.find(u => u.emp_id.toLowerCase() === empId) || dbDump.users[0];
    return makeResponse({
      access_token: user.emp_id,
      token_type: 'bearer',
      user
    });
  }

  if (pathname === '/auth/me' || pathname === 'auth/me') {
    const token = localStorage.getItem('railway_token') || 'hod001';
    const user = dbDump.users.find(u => u.emp_id.toLowerCase() === token.toLowerCase()) || dbDump.users[0];
    return makeResponse(user);
  }

  return null;
};
