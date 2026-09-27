/**
 * Offline fallback engines — computed, not asserted.
 *
 * Mirrors the live backend contracts against the bundled database dump for
 * static deployments (Vercel demo mode without VITE_API_URL). The forecast,
 * ML and planner engines are faithful TypeScript ports of the backend logic
 * so the deployed demo behaves like the real engine, with the same
 * "computed from data" guarantees and a synthetic-data marker.
 */
import dbDump from '../data/databaseDump.json';

// ---------------------------------------------------------------------------
// COA Goods-train forecast (port of backend/forecast_engine.py)
// ---------------------------------------------------------------------------

export const FORECAST_HORIZON_DAYS = 30;

function stableHash(...parts: (string | number)[]): number {
  const s = parts.join('|');
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    h1 = ((h1 ^ s.charCodeAt(i)) * 16777619) >>> 0;
    h2 = (h2 + s.charCodeAt(i) * (i + 1)) >>> 0;
  }
  return (h1 ^ h2) >>> 0;
}

function classifyDensity(count: number): string {
  if (count >= 18) return 'VERY_HIGH';
  if (count >= 12) return 'HIGH';
  if (count >= 6) return 'MEDIUM';
  return 'LOW';
}

function corridorBaseFreight(trackType: string, maxSpeed: number, distanceKm: number): number {
  let base = 6.0;
  const t = (trackType || '').toLowerCase();
  if (t.includes('quad')) base += 8.0;
  else if (t.includes('double')) base += 4.0;
  base += Math.min(6.0, Math.max(0, (maxSpeed || 100) - 100) / 15.0);
  base += Math.min(3.0, Math.max(0, (distanceKm || 25) - 25) / 40.0);
  return base;
}

interface ForecastRow {
  date: string;
  day_index: number;
  goods_trains_forecast: number;
  density: string;
  lull_pressure: number;
}

function forecastRows(
  corridorId: number, trackType: string, maxSpeed: number, distanceKm: number,
  startDate: Date, days: number,
): ForecastRow[] {
  const base = corridorBaseFreight(trackType, maxSpeed, distanceKm);
  const rows: ForecastRow[] = [];
  for (let d = 0; d < days; d++) {
    const day = new Date(startDate);
    day.setDate(day.getDate() + d);
    const iso = day.toISOString().slice(0, 10);
    const dow = day.getDay(); // 5=Fri 6=Sat 0=Sun
    const weekly = dow === 5 || dow === 6 || dow === 0 ? 1.15 : 1.0;
    const variation = 0.82 + (stableHash(corridorId, iso) % 37) / 100.0;
    const count = base * weekly * variation;
    rows.push({
      date: iso,
      day_index: d,
      goods_trains_forecast: Math.round(count * 10) / 10,
      density: classifyDensity(count),
      lull_pressure: Math.round(Math.min(1.0, count / 24.0) * 100) / 100,
    });
  }
  return rows;
}

export function offlineGoodsForecast(days: number, corridorId?: number) {
  const corridors = (dbDump.corridors as any[]).filter(c => !corridorId || c.id === corridorId);
  const today = new Date();
  const perCorridor: Record<string, ForecastRow[]> = {};
  const dailyTotals = Array.from({ length: days }, (_, d) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + d);
    return { date: dt.toISOString().slice(0, 10), goods_trains_forecast: 0.0 };
  });
  for (const c of corridors) {
    const rows = forecastRows(c.id, c.track_type, c.max_speed || 100, c.distance_km || 25, today, days);
    perCorridor[String(c.id)] = rows;
    rows.forEach((r, i) => { if (i < days) dailyTotals[i].goods_trains_forecast += r.goods_trains_forecast; });
  }
  dailyTotals.forEach(r => { r.goods_trains_forecast = Math.round(r.goods_trains_forecast * 10) / 10; });
  const total = dailyTotals.reduce((s, r) => s + r.goods_trains_forecast, 0);
  const avg = total / Math.max(1, dailyTotals.length);
  const dense = dailyTotals.filter(r => r.goods_trains_forecast >= 1.10 * avg);
  return {
    start_date: today.toISOString().slice(0, 10),
    days,
    daily_totals: dailyTotals,
    per_corridor: perCorridor,
    summary: {
      network_goods_trains_forecast: Math.round(total * 10) / 10,
      daily_average: Math.round(avg * 10) / 10,
      high_density_days: dense.length,
      high_density_dates: dense.map(r => r.date),
    },
    upstream_system: 'Control Office Application (COA) — freight path forecast',
    data_mode: 'synthetic-demonstration (offline fallback)',
  };
}

// ---------------------------------------------------------------------------
// ML failure-risk prioritization (port of backend/ml_prioritization.py)
// ---------------------------------------------------------------------------

const HEALTH_MAP: Record<string, number> = { HEALTHY: 0.0, UNDER_MAINTENANCE: 0.25, DEGRADED: 0.5, FAULTY: 1.0 };
const CRIT_MAP: Record<string, number> = { LOW: 0.2, MEDIUM: 0.5, HIGH: 0.8, CRITICAL: 1.0 };
const FEATURE_NAMES = ['health_status', 'age_factor', 'criticality', 'inspection_recency', 'open_requests', 'corridor_traffic'];
const LEARNING_RATE = 0.15;
const EPOCHS = 600;
const L2 = 0.002;
const PRIOR_LOGIT = -2.2;

const sigmoid = (z: number) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)));

function featureVector(a: any, trainsPerCorridor: Record<number, number>, openByAsset: Record<number, number>, today: Date) {
  const ageYears = Math.max(0, today.getFullYear() - Number(a.install_year || today.getFullYear()));
  const inspTime = new Date(String(a.last_inspected)).getTime();
  const inspDays = Math.max(0, Math.floor((today.getTime() - (isNaN(inspTime) ? Date.now() - 30 * 86400000 : inspTime)) / 86400000));
  return {
    health_status: HEALTH_MAP[String(a.status || 'HEALTHY').toUpperCase()] ?? 0.25,
    age_factor: Math.min(1, ageYears / 25),
    criticality: CRIT_MAP[String(a.criticality || 'MEDIUM').toUpperCase()] ?? 0.5,
    inspection_recency: Math.min(1, inspDays / 365),
    open_requests: Math.min(1, (openByAsset[a.id] || 0) / 3),
    corridor_traffic: Math.min(1, (trainsPerCorridor[a.corridor_id] || 0) / 40),
  };
}

export function offlineMlPrioritization() {
  const today = new Date();
  const assets = dbDump.assets as any[];
  const trainsPerCorridor: Record<number, number> = {};
  for (const t of dbDump.train_schedules as any[]) {
    trainsPerCorridor[t.corridor_id] = (trainsPerCorridor[t.corridor_id] || 0) + 1;
  }
  const openStatuses = new Set(['NEW', 'INSPECTED', 'AI_ANALYZED', 'APPROVED', 'IN_PROGRESS', 'DELAYED', 'REWORK']);
  const openByAsset: Record<number, number> = {};
  for (const r of dbDump.maintenance_requests as any[]) {
    if (openStatuses.has(r.status)) openByAsset[r.asset_id] = (openByAsset[r.asset_id] || 0) + 1;
  }

  const feats = assets.map(a => featureVector(a, trainsPerCorridor, openByAsset, today));
  const labels = assets.map(a =>
    (['FAULTY', 'DEGRADED'].includes(String(a.status || '').toUpperCase()) || (openByAsset[a.id] || 0) > 0 ? 1 : 0)
  );

  // Gradient descent — identical to the backend
  const w = new Array(FEATURE_NAMES.length).fill(0);
  const n = Math.max(1, feats.length);
  for (let e = 0; e < EPOCHS; e++) {
    const grads = new Array(FEATURE_NAMES.length).fill(0);
    for (let i = 0; i < feats.length; i++) {
      const z = PRIOR_LOGIT + FEATURE_NAMES.reduce((s, f, j) => s + w[j] * feats[i][f], 0);
      const p = sigmoid(z);
      const err = p - labels[i];
      FEATURE_NAMES.forEach((f, j) => { grads[j] += err * feats[i][f]; });
    }
    FEATURE_NAMES.forEach((f, j) => { w[j] -= LEARNING_RATE * (grads[j] / n + L2 * w[j]); });
  }

  const corridors = dbDump.corridors as any[];
  const departments = dbDump.departments as any[];
  const ranked = assets.map((a, i) => {
    const contribs = FEATURE_NAMES.map((f, j) => ({ feature: f, value: feats[i][f], weight: w[j], contribution: w[j] * feats[i][f] }));
    const z = PRIOR_LOGIT + contribs.reduce((s, c) => s + c.contribution, 0);
    contribs.sort((x, y) => Math.abs(y.contribution) - Math.abs(x.contribution));
    const corr = corridors.find(c => c.id === a.corridor_id);
    return {
      id: a.id,
      asset_id: a.asset_id,
      name: a.name,
      corridor_id: a.corridor_id,
      corridor_code: corr?.code,
      corridor_name: corr?.name,
      department_code: departments.find(d => d.id === a.department_id)?.code,
      p_failure: Math.round(sigmoid(z) * 10000) / 10000,
      risk_rank: 0,
      top_drivers: contribs.slice(0, 3).map(c => ({
        feature: c.feature,
        value: Math.round(c.value * 1000) / 1000,
        weight: Math.round(c.weight * 10000) / 10000,
        contribution: Math.round(c.contribution * 10000) / 10000,
      })),
      status: a.status,
      criticality: a.criticality,
    };
  }).sort((x, y) => y.p_failure - x.p_failure);
  ranked.forEach((r, i) => { r.risk_rank = i + 1; });

  return {
    model: {
      type: 'logistic_regression',
      trained_on: assets.length,
      positive_samples: labels.reduce((s, l) => s + l, 0),
      positive_rate: Math.round((labels.reduce((s, l) => s + l, 0) / Math.max(1, labels.length)) * 1000) / 1000,
      features: FEATURE_NAMES,
      weights: w.map(x => Math.round(x * 10000) / 10000),
      intercept_logit: PRIOR_LOGIT,
      epochs: EPOCHS,
      learning_rate: LEARNING_RATE,
      l2: L2,
      note: 'Trained by gradient descent on every request (offline fallback engine — bundled data).',
    },
    assets: ranked,
  };
}

// ---------------------------------------------------------------------------
// Multi-horizon planner (port of backend/horizon_planner.py)
// ---------------------------------------------------------------------------

const WINDOW_START = 60, WINDOW_END = 300, SETUP = 15, HANDBACK = 15;
const HEADROOM = 1.2, DENSE_LULL_MAX = 0.60, DENSE_PENALTY = 2.0, MIN_DELAY = 10;
const URGENCY: Record<string, number> = { CRITICAL: 1.0, HIGH: 0.75, MEDIUM: 0.45, LOW: 0.2 };

const toMin = (t: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

interface PlanJob {
  r: any;
  p: number;
  urgency: number;
  weight: number;
  duration: number;
  start?: number;
  end?: number;
  di?: number;
}

export function offlineMultiHorizonPlan(horizonDays: number, windowStart?: number, windowEnd?: number) {
  horizonDays = horizonDays >= 30 ? 30 : 7;
  const ws = windowStart ?? WINDOW_START;
  const we = windowEnd ?? WINDOW_END;
  const capacity = we - ws - SETUP - HANDBACK;
  const today = new Date();

  const corridors = dbDump.corridors as any[];
  const reqs = (dbDump.maintenance_requests as any[])
    .filter(r => ['NEW', 'INSPECTED', 'AI_ANALYZED', 'APPROVED'].includes(r.status));
  const trainsByCorridor: Record<number, any[]> = {};
  for (const t of dbDump.train_schedules as any[]) {
    (trainsByCorridor[t.corridor_id] = trainsByCorridor[t.corridor_id] || []).push(t);
  }
  const deptCode = (id: number) =>
    (dbDump.departments as any[]).find(d => d.id === id)?.code || '?';

  // ML weights (single run)
  const ml = offlineMlPrioritization();
  const pById = new Map<number, number>(ml.assets.map(a => [a.id, a.p_failure]));

  // Forecast per corridor
  const fcByCorridor: Record<number, ForecastRow[]> = {};
  for (const c of corridors) {
    fcByCorridor[c.id] = forecastRows(c.id, c.track_type, c.max_speed || 100, c.distance_km || 25, today, horizonDays);
  }

  // Manpower ceiling per department (documented: ~4h gang utilisation)
  const deptCeiling: Record<number, number> = {};
  for (const d of dbDump.departments as any[]) {
    deptCeiling[d.id] = Math.round((d.head_count || 50) * 0.25) * 60 * 4;
  }

  const dayLoad = new Map<string, number>();    // `${di}:${cid}` -> minutes used
  const dayDeptMin = new Map<string, number>(); // `${di}:${dept}` -> weighted minutes
  const dayJobs: Record<number, PlanJob[]> = {};
  for (let di = 0; di < horizonDays; di++) dayJobs[di] = [];
  const unscheduled: any[] = [];

  const jobs: PlanJob[] = reqs
    .map(r => {
      const p = pById.get(r.asset_id) ?? 0.05;
      const urgency = URGENCY[String(r.priority || 'MEDIUM').toUpperCase()] ?? 0.4;
      return {
        r, p, urgency,
        weight: 0.65 * p + 0.35 * urgency,
        duration: Math.round(Math.max(0.5, r.max_duration_hours || 2) * 60),
      };
    })
    .sort((a, b) => b.weight - a.weight);

  for (const job of jobs) {
    const cid = job.r.corridor_id;
    const candidates: Array<{ score: number; di: number }> = [];
    for (let di = 0; di < horizonDays; di++) {
      const used = dayLoad.get(`${di}:${cid}`) || 0;
      if (used + job.duration > capacity) continue;
      const fcRow = fcByCorridor[cid]?.[di];
      const dense = fcRow ? fcRow.lull_pressure > DENSE_LULL_MAX : false;
      if (dense && job.urgency < 1.0) continue;
      let score = di * 0.6 + used * 0.05 + (fcRow?.lull_pressure || 0) * 40 * DENSE_PENALTY - job.weight * 10;
      if (job.urgency >= 1.0) score -= 25;
      candidates.push({ score, di });
    }
    candidates.sort((a, b) => a.score - b.score);
    let placed = false;
    for (const { di } of candidates) {
      const usedMin = dayDeptMin.get(`${di}:${job.r.department_id}`) || 0;
      if (usedMin + job.duration * HEADROOM > (deptCeiling[job.r.department_id] || 0)) continue;
      const start = ws + SETUP + (dayLoad.get(`${di}:${cid}`) || 0);
      const end = start + job.duration;
      if (end > we - HANDBACK) continue;
      job.start = start;
      job.end = end;
      job.di = di;
      dayLoad.set(`${di}:${cid}`, (dayLoad.get(`${di}:${cid}`) || 0) + job.duration);
      dayDeptMin.set(`${di}:${job.r.department_id}`, usedMin + job.duration * HEADROOM);
      dayJobs[di].push(job);
      placed = true;
      break;
    }
    if (!placed) {
      unscheduled.push({
        problem_id: job.r.problem_id,
        reason: 'No feasible day within horizon (window capacity / freight-dense days / manpower ceiling)',
      });
    }
  }

  // Day cards: freight totals first, then relative density vs horizon mean
  const freightTotals = Array.from({ length: horizonDays }, (_, di) => {
    let gf = 0;
    for (const c of corridors) {
      const row = fcByCorridor[c.id]?.[di];
      if (row) gf += row.goods_trains_forecast;
    }
    return Math.round(gf * 10) / 10;
  });
  const mean = freightTotals.reduce((s, g) => s + g, 0) / Math.max(1, freightTotals.length);

  const corridorDaysUsed = new Map<string, number>();
  for (const job of jobs) {
    if (job.di === undefined) continue;
    const key = `${job.di}:${job.r.corridor_id}`;
    corridorDaysUsed.set(key, (corridorDaysUsed.get(key) || 0) + 1);
  }

  const dayCards = freightTotals.map((gf, di) => {
    const ratio = mean > 0 ? gf / mean : 1;
    const blocks = (dayJobs[di] || [])
      .map(job => {
        const cid = job.r.corridor_id;
        const corr = corridors.find(c => c.id === cid);
        const crossings = (trainsByCorridor[cid] || [])
          .map(t => toMin(t.departure_time))
          .filter((x): x is number => x !== null);
        const hits = crossings.filter(tm => !((job.end ?? 0) + 10 <= tm || (job.start ?? 0) >= tm + 10));
        return {
          problem_id: job.r.problem_id,
          work_description: String(job.r.work_description || '').slice(0, 90),
          priority: job.r.priority,
          department_code: deptCode(job.r.department_id),
          corridor_id: cid,
          corridor_code: corr?.code || String(cid),
          corridor_name: corr?.name || String(cid),
          start_time: hhmm(job.start ?? ws),
          end_time: hhmm(job.end ?? ws + job.duration),
          duration_minutes: job.duration,
          p_failure: Math.round(job.p * 1000) / 1000,
          job_weight: Math.round(job.weight * 1000) / 1000,
          trains_in_window: hits.length,
          train_delay_minutes: hits.length * MIN_DELAY,
        };
      })
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    return {
      date: (() => { const dt = new Date(today); dt.setDate(dt.getDate() + di); return dt.toISOString().slice(0, 10); })(),
      day_index: di,
      goods_forecast: gf,
      density: ratio >= 1.10 ? 'HIGH' : ratio <= 0.90 ? 'LOW' : 'MEDIUM',
      density_ratio: Math.round(ratio * 100) / 100,
      blocks,
    };
  });

  const planned = dayCards.reduce((s, d) => s + d.blocks.length, 0);
  const kpis = {
    requests_planned: planned,
    requests_unscheduled: unscheduled.length,
    corridor_day_blocks: corridorDaysUsed.size,
    block_reduction_percent: corridorDaysUsed.size > 0
      ? Math.round(100 * (1 - corridorDaysUsed.size / Math.max(1, planned)) * 10) / 10
      : 0,
    high_risk_jobs_scheduled: dayCards.reduce((s, d) => s + d.blocks.filter(b => b.p_failure >= 0.45).length, 0),
    high_risk_assets_network: ml.assets.filter(a => a.p_failure >= 0.45).length,
    estimated_train_delay_minutes: dayCards.reduce((s, d) => s + d.blocks.reduce((x, b) => x + b.train_delay_minutes, 0), 0),
    forecast_high_density_days: dayCards.filter(d => d.density === 'HIGH').length,
  };

  // Impact simulation (baseline vs optimized)
  const baselineDelay = dayCards.reduce((s, d) => s + d.blocks.reduce((x, b) => {
    const denseMult = d.density === 'HIGH' ? 1.25 : 1.0;
    return x + b.train_delay_minutes * denseMult + MIN_DELAY * denseMult;
  }, 0), 0);
  const optimizedDelay = dayCards.reduce((s, d) => s + d.blocks.reduce((x, b) => x + b.train_delay_minutes, 0), 0);
  const baselineBlocks = planned;
  const optimizedBlocks = corridorDaysUsed.size;
  const baselineAvail = 92.0;
  const optimizedAvail = Math.round(Math.min(99.5,
    baselineAvail + ((baselineDelay - optimizedDelay) / 60) * 0.08 + (baselineBlocks - optimizedBlocks) * 0.02) * 100) / 100;

  return {
    horizon_days: horizonDays,
    window: { start: hhmm(ws), end: hhmm(we) },
    days: dayCards,
    unscheduled: unscheduled.slice(0, 20),
    kpis,
    ml_model: ml.model,
    top_risk_assets: ml.assets.slice(0, 10),
    generated_at: new Date().toISOString(),
    engine: { type: 'offline fallback — bundled data', demo: true },
    impact_simulation: {
      baseline: {
        label: 'Decentralized manual planning (status quo)',
        blocks: baselineBlocks,
        train_delay_minutes: Math.round(baselineDelay * 10) / 10,
        asset_availability_percent: baselineAvail,
        assumptions: [
          'One block per request — no cross-department fusion',
          'Windows ignore timetable and freight forecast',
          'Forecast-dense days add 25% delay (freight surges)',
        ],
      },
      optimized: {
        label: 'TrackShield AI coordinated plan',
        blocks: optimizedBlocks,
        train_delay_minutes: Math.round(optimizedDelay * 10) / 10,
        asset_availability_percent: optimizedAvail,
        drivers: [
          'Cross-department block fusion on shared corridor-days',
          'Freight-forecast-aware day selection',
          'ML risk-weighted scheduling order',
        ],
      },
      delta: {
        blocks_saved: Math.max(0, baselineBlocks - optimizedBlocks),
        block_reduction_percent: optimizedBlocks > 0
          ? Math.round(100 * (1 - optimizedBlocks / Math.max(1, baselineBlocks)) * 10) / 10
          : 0,
        delay_minutes_saved: Math.round(Math.max(0, baselineDelay - optimizedDelay) * 10) / 10,
        availability_gain_percent: Math.round(Math.max(0, optimizedAvail - baselineAvail) * 100) / 100,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Master Gantt offline data (24h trains vs blocks per corridor)
// ---------------------------------------------------------------------------

export function offlineGantt(corridorId: number) {
  const corr = (dbDump.corridors as any[]).find(c => c.id === corridorId);
  if (!corr) return null;
  const rows: any[] = [];
  for (const t of (dbDump.train_schedules as any[]).filter(t => t.corridor_id === corridorId)) {
    const s = toMin(t.departure_time);
    if (s === null) continue;
    rows.push({
      kind: 'TRAIN', label: t.train_no, start_min: s, end_min: s + 8,
      train_no: t.train_no, priority: t.priority,
    });
  }
  for (const b of (dbDump.maintenance_blocks as any[]).filter(b => b.corridor_id === corridorId)) {
    const s = toMin(b.start_time);
    const e = toMin(b.end_time);
    if (s === null || e === null || e <= s) continue;
    rows.push({
      kind: b.status === 'AI_RECOMMENDED' ? 'AI_PROPOSED' : 'EXISTING_BLOCK',
      label: b.block_id, start_min: s, end_min: e,
      block_id: b.block_id, status: b.status, isolation_type: b.isolation_type || 'OHE Power Block',
      jobs: [],
    });
  }
  rows.sort((a, b) => a.start_min - b.start_min);
  return {
    corridor: { id: corr.id, code: corr.code, name: corr.name, track_type: corr.track_type, status: corr.status },
    rows,
    totals: {
      trains: rows.filter(r => r.kind === 'TRAIN').length,
      blocks: rows.filter(r => r.kind !== 'TRAIN').length,
      proposed: rows.filter(r => r.kind === 'AI_PROPOSED').length,
    },
  };
}

// ---------------------------------------------------------------------------
// Risk engine offline (mirrors /api/risk/assets + /api/risk/summary)
// ---------------------------------------------------------------------------

export function offlineRisk() {
  const ml = offlineMlPrioritization();
  const assets = ml.assets;
  return {
    assets: assets.slice(0, 120),
    summary: {
      total: assets.length,
      low: assets.filter(a => a.p_failure < 0.33).length,
      medium: assets.filter(a => a.p_failure >= 0.33 && a.p_failure < 0.66).length,
      high: assets.filter(a => a.p_failure >= 0.66).length,
      engine: 'offline fallback — bundled data',
    },
  };
}

// ---------------------------------------------------------------------------
// Audit timeline offline (best-effort from bundled rows; the dump carries no
// audit log, so the lifecycle is reconstructed from request fields)
// ---------------------------------------------------------------------------

export function offlineAuditTimeline(requestId: number) {
  const r = (dbDump.maintenance_requests as any[]).find(x => x.id === requestId);
  if (!r) return { events: [] };
  const events: any[] = [
    {
      timestamp: `${r.requested_date}T${r.requested_start_time}:00`,
      user: 'Department HOD',
      role: 'LOWER_HOD',
      action: 'CREATE_REQUEST',
      entity_type: 'MAINTENANCE_REQUEST',
      entity_id: r.problem_id,
      details: r.work_description,
    },
  ];
  if (r.status !== 'NEW') {
    events.push({
      timestamp: `${r.requested_date}T${r.requested_end_time}:00`,
      user: 'AI Planner',
      role: 'SYSTEM',
      action: 'RUN_CP_SAT_OPTIMIZER',
      entity_type: 'MAINTENANCE_REQUEST',
      entity_id: r.problem_id,
      details: 'Window scanned, plan recommended (offline fallback data).',
    });
  }
  return { events };
}

// ---------------------------------------------------------------------------
// Data fabric status offline
// ---------------------------------------------------------------------------

export function offlineDataFabric() {
  const adapters = [
    {
      key: 'train_schedule', name: 'Passenger & Freight Timetable Feed', direction: 'inbound',
      upstream_system: 'Centralized timetable management (COA)',
      frequency: 'daily snapshot + intraday amendments', health: 'SYNTHETIC',
    },
    {
      key: 'asset_condition', name: 'Asset Condition & Diagnostics Feed', direction: 'inbound',
      upstream_system: 'Asset health registers / wayside diagnostics',
      frequency: 'event-driven + weekly reconciliation', health: 'SYNTHETIC',
    },
    {
      key: 'possession_advisory', name: 'Possession Advisory Outbound', direction: 'outbound',
      upstream_system: 'Control Office Application (COA)',
      frequency: 'on block approval', health: 'SYNTHETIC',
    },
    {
      key: 'mcr_return', name: 'MCR Return Feed', direction: 'inbound',
      upstream_system: 'Departmental maintenance completion reports',
      frequency: 'on MCR submission', health: 'SYNTHETIC',
    },
  ];
  return { data_mode: 'synthetic-demonstration (offline fallback)', adapters };
}
