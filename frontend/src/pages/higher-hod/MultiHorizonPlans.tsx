import React, { useEffect, useMemo, useState } from 'react';
import api from '../../api/client';
import { BreadcrumbContext } from '../../components/layout/BreadcrumbContext';
import {
  CalendarRange, Train, Brain, Download, RefreshCw, AlertTriangle,
  TrendingUp, ChevronDown, ChevronUp, Gauge, SlidersHorizontal,
} from 'lucide-react';

interface PlanBlock {
  problem_id: string;
  work_description: string;
  priority: string;
  department_code: string;
  corridor_id: number;
  corridor_code: string;
  corridor_name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  p_failure: number;
  job_weight: number;
  trains_in_window: number;
  train_delay_minutes: number;
}

interface PlanDay {
  date: string;
  day_index: number;
  goods_forecast: number;
  density: string;
  density_ratio?: number;
  blocks: PlanBlock[];
}

interface PlanResponse {
  horizon_days: number;
  window: { start: string; end: string };
  days: PlanDay[];
  unscheduled: Array<{ problem_id: string; reason: string }>;
  kpis: {
    requests_planned: number;
    requests_unscheduled: number;
    corridor_day_blocks: number;
    block_reduction_percent: number;
    high_risk_jobs_scheduled: number;
    high_risk_assets_network: number;
    estimated_train_delay_minutes: number;
    forecast_high_density_days: number;
  };
  ml_model: {
    type: string;
    trained_on: number;
    features: string[];
    weights: number[];
    positive_rate?: number;
    note?: string;
  };
  top_risk_assets: Array<{
    asset_id: string; name: string; corridor_code?: string;
    p_failure: number; risk_rank: number; top_drivers?: Array<{ feature: string; contribution: number }>;
  }>;
  impact_simulation?: any;
  engine?: { type: string; demo?: boolean };
}

const DENSITY_STYLE: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800 border-red-200',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-200',
  LOW: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const PRIORITY_DOT: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-blue-500',
  LOW: 'bg-slate-400',
};

/** Max forecast in the current plan, for bar scaling. */
const maxForecast = (days: PlanDay[]) =>
  Math.max(1, ...days.map(d => d.goods_forecast));

export const MultiHorizonPlans: React.FC = () => {
  const [horizon, setHorizon] = useState<7 | 30>(7);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windowStart, setWindowStart] = useState(60);  // minutes from midnight
  const [windowEnd, setWindowEnd] = useState(300);
  const [whatIfDirty, setWhatIfDirty] = useState(false);
  const [expandedDay, setExpandedDay] = useState<number | null>(0);
  const [offline, setOffline] = useState(false);

  const fetchPlan = async (h: number, ws?: number, we?: number) => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { horizon_days: h };
      if (ws !== undefined && we !== undefined) {
        params.window_start = ws;
        params.window_end = we;
      }
      const res = await api.get<PlanResponse>('/plans', { params });
      const data = res.data;
      if (!data || typeof data !== 'object' || !Array.isArray(data.days)) {
        throw new Error('bad plan shape');
      }
      setPlan(data);
      setOffline(Boolean(data.engine?.demo));
    } catch (e) {
      setError('Planner unavailable — try regenerating.');
      setPlan(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan(horizon);
    setWhatIfDirty(false);
  }, [horizon]);

  const applyWhatIf = () => {
    if (windowEnd - windowStart < 60) {
      alert('The maintenance window must be at least 60 minutes.');
      return;
    }
    fetchPlan(horizon, windowStart, windowEnd);
    setWhatIfDirty(false);
  };

  const resetWhatIf = () => {
    setWindowStart(60);
    setWindowEnd(300);
    fetchPlan(horizon);
    setWhatIfDirty(false);
  };

  const fmtHM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  const exportCsv = () => {
    if (!plan) return;
    const rows: string[] = [
      'date,day_index,corridor_code,corridor_name,problem_id,department,priority,start_time,end_time,duration_minutes,p_failure,trains_in_window,forecast_goods_trains,day_density',
    ];
    for (const d of plan.days) {
      for (const b of d.blocks) {
        rows.push([
          d.date, d.day_index, b.corridor_code, `"${b.corridor_name}"`, b.problem_id,
          b.department_code, b.priority, b.start_time, b.end_time, b.duration_minutes,
          b.p_failure, b.trains_in_window, d.goods_forecast, d.density,
        ].join(','));
      }
      if (d.blocks.length === 0) {
        rows.push([d.date, d.day_index, '', '', '', '', '', '', '', 0, '', 0, d.goods_forecast, d.density].join(','));
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trackshield_${horizon === 7 ? 'weekly' : 'monthly'}_block_plan_${plan.days[0]?.date || ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalBlocks = plan ? plan.days.reduce((s, d) => s + d.blocks.length, 0) : 0;
  const dayCard = (d: PlanDay) => {
    const open = expandedDay === d.day_index;
    return (
      <div key={d.day_index} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <button
          type="button"
          onClick={() => setExpandedDay(open ? null : d.day_index)}
          className="w-full px-4 py-3 flex flex-wrap items-center gap-3 hover:bg-slate-50 transition text-left"
        >
          <div className="w-28 shrink-0">
            <div className="text-xs font-extrabold text-slate-900">{d.date.slice(5)}</div>
            <div className="text-[10px] text-slate-400 uppercase">Day {d.day_index + 1}</div>
          </div>
          {/* forecast bar */}
          <div className="flex-1 min-w-[140px]">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-0.5">
              <span className="flex items-center gap-1"><Train className="w-3 h-3" /> Goods forecast</span>
              <span>{d.goods_forecast}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${d.density === 'HIGH' ? 'bg-red-400' : d.density === 'LOW' ? 'bg-emerald-400' : 'bg-amber-400'}`}
                style={{ width: `${(d.goods_forecast / maxForecast(plan?.days || [])) * 100}%` }}
              />
            </div>
          </div>
          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${DENSITY_STYLE[d.density] || DENSITY_STYLE.MEDIUM}`}>
            {d.density}
          </span>
          <div className="text-xs font-bold text-slate-700 w-20 text-right">
            {d.blocks.length} block{d.blocks.length === 1 ? '' : 's'}
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {open && (
          <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 space-y-1.5">
            {d.blocks.length === 0 && (
              <p className="text-xs text-slate-500 py-1">No blocks scheduled — corridor capacity reserved for forecast freight surges.</p>
            )}
            {d.blocks.map((b, i) => (
              <div key={`${b.problem_id}-${i}`} className="flex flex-wrap items-center gap-2 text-xs bg-white border border-slate-200 rounded-lg px-3 py-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[b.priority] || 'bg-slate-400'}`} />
                <span className="font-mono font-bold text-slate-900 w-28 shrink-0">{b.problem_id}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-900">{b.department_code}</span>
                <span className="font-semibold text-slate-700 flex-1 min-w-[160px] truncate">{b.corridor_code} — {b.work_description}</span>
                <span className="font-mono text-slate-800 font-bold">{b.start_time}–{b.end_time}</span>
                <span className="text-[10px] text-slate-500 font-mono">P(fail) {b.p_failure.toFixed(2)}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${b.trains_in_window === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {b.trains_in_window === 0 ? '0 train conflicts' : `${b.trains_in_window} trains · ${b.train_delay_minutes}m delay`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <BreadcrumbContext
        title="Multi-Horizon Block Plans"
        subpath="Weekly & Monthly Plans · Freight-Forecast-Aware · ML Risk-Weighted"
      />

      {/* Horizon toggle + actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setHorizon(7)}
              className={`px-4 py-2 text-xs font-extrabold transition ${horizon === 7 ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              WEEKLY (7 DAYS)
            </button>
            <button
              type="button"
              onClick={() => setHorizon(30)}
              className={`px-4 py-2 text-xs font-extrabold transition ${horizon === 30 ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              MONTHLY (30 DAYS)
            </button>
          </div>
          {offline && (
            <span className="text-[10px] font-bold px-2 py-1 rounded bg-amber-100 text-amber-800 border border-amber-200">
              OFFLINE ENGINE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchPlan(horizon)}
            disabled={loading}
            className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-optimize</span>
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!plan || totalBlocks === 0}
            className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV (control office)</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* KPI band */}
      {plan && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: 'Jobs planned', value: plan.kpis.requests_planned, icon: CalendarRange },
            { label: 'Corridor-day blocks', value: plan.kpis.corridor_day_blocks, icon: Gauge },
            { label: 'Block reduction', value: `${plan.kpis.block_reduction_percent}%`, icon: TrendingUp },
            { label: 'High-risk jobs first', value: plan.kpis.high_risk_jobs_scheduled, icon: Brain },
            { label: 'Freight-dense days', value: plan.kpis.forecast_high_density_days, icon: Train },
            { label: 'Est. train delay', value: `${Math.round(plan.kpis.estimated_train_delay_minutes / 60)}h`, icon: Train },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                <Icon className="w-3 h-3" /> {label}
              </div>
              <div className="text-xl font-extrabold text-slate-900">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* What-if simulator */}
      {plan && (
        <div className="bg-white rounded-xl border border-indigo-200 p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <div className="text-[10px] font-extrabold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3" /> What-if: maintenance window
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <select
                  value={windowStart}
                  onChange={(e) => { setWindowStart(Number(e.target.value)); setWhatIfDirty(true); }}
                  className="border border-slate-300 rounded px-2 py-1.5 text-xs"
                >
                  {Array.from({ length: 24 }).map((_, h) => (
                    <option key={h} value={h * 60}>{fmtHM(h * 60)}</option>
                  ))}
                </select>
                <span>to</span>
                <select
                  value={windowEnd}
                  onChange={(e) => { setWindowEnd(Number(e.target.value)); setWhatIfDirty(true); }}
                  className="border border-slate-300 rounded px-2 py-1.5 text-xs"
                >
                  {Array.from({ length: 24 }).map((_, h) => (
                    <option key={h} value={(h + 1) * 60}>{fmtHM((h + 1) * 60)}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={applyWhatIf}
              disabled={loading || !whatIfDirty}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold transition"
            >
              {loading ? 'Re-optimizing…' : 'Re-run plan'}
            </button>
            <button
              type="button"
              onClick={resetWhatIf}
              disabled={loading || (!whatIfDirty && windowStart === 60 && windowEnd === 300)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold disabled:opacity-50"
            >
              Reset (01:00–05:00)
            </button>
            <p className="text-[11px] text-slate-500 flex-1 min-w-[200px]">
              Shrink the window to 2h and watch jobs defer to later days or drop to unscheduled —
              the trade-off between track access and freight protection, live.
            </p>
          </div>
        </div>
      )}

      {/* ML model card */}
      {plan && (
        <div className="bg-white rounded-xl border border-violet-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-violet-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">ML Prioritization Model (live)</h4>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-200">
              {plan.ml_model.type}
            </span>
            <span className="text-[11px] text-slate-500">
              trained on {plan.ml_model.trained_on} assets · weights [{plan.ml_model.weights.slice(0, 3).map(w => w.toFixed(2)).join(', ')}…]
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
            {(plan.top_risk_assets || []).slice(0, 5).map(a => (
              <div key={a.asset_id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900">{a.asset_id}</span>
                  <span className="text-[10px] font-extrabold text-red-700">#{a.risk_rank}</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate">{a.corridor_code || '—'} · {a.name}</div>
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.round(a.p_failure * 100)}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700">{(a.p_failure * 100).toFixed(0)}%</span>
                </div>
                {a.top_drivers?.[0] && (
                  <div className="text-[9px] text-slate-400 mt-1 truncate">driver: {a.top_drivers[0].feature}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day-by-day plan */}
      {plan && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {horizon === 7 ? 'Weekly' : 'Monthly'} Plan — {plan.window.start} to {plan.window.end} window
            </h4>
            {plan.unscheduled.length > 0 && (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                {plan.unscheduled.length} job(s) deferred — capacity constrained
              </span>
            )}
          </div>
          {plan.days.map(dayCard)}
        </div>
      )}
    </div>
  );
};
