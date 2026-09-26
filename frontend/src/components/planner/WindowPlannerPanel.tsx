import React, { useState } from 'react';
import api from '../../api/client';
import {
  CalendarClock, Play, CheckCircle2, XCircle, AlertTriangle,
  Train, Boxes, Users, ShieldCheck, ChevronDown, ChevronUp,
} from 'lucide-react';

interface PlanRequest { id: number; problem_id: string; corridor_name?: string; corridor_code?: string; department_code?: string; priority: string; max_duration_hours: number; }

interface PlanWindow { start_time: string; end_time: string; train_conflicts: number; existing_block_conflicts: number; operational_impact: string; reasons?: string[]; reject_reasons?: string[]; train_nos?: string[]; }

interface PlanResult {
  selected: {
    start_time: string; end_time: string; duration_minutes: number;
    train_conflicts: number; resource_conflicts: number; manpower_conflicts: number;
    existing_block_conflicts: number; safety_constraints: string; operational_impact: string;
  } | null;
  candidate_count: number; feasible_count: number; rejected_count: number;
  feasible_windows: PlanWindow[];
  rejected_windows: PlanWindow[];
  why: string[];
}

const IMPACT_STYLE: Record<string, string> = {
  LOW: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  MEDIUM: 'text-amber-700 bg-amber-50 border-amber-200',
  HIGH: 'text-red-700 bg-red-50 border-red-200',
};

/** 24h timetable strip showing trains and the recommended window. */
const TimetableStrip: React.FC<{ plan: PlanResult }> = ({ plan }) => {
  const sel = plan.selected;
  const selStart = sel ? Number(sel.start_time.slice(0, 2)) * 60 + Number(sel.start_time.slice(3)) : -1;
  const selEnd = sel ? selStart + sel.duration_minutes : -1;
  const blocks = plan.feasible_windows.length + plan.rejected_windows.length > 0;

  return (
    <div className="space-y-1">
      {[0, 6, 12, 18].map((hour) => (
        <div key={hour} className="text-[9px] font-bold text-slate-400">
          {String(hour).padStart(2, '0')}:00
        </div>
      ))}
      {sel && (
        <div
          className="h-5 rounded bg-emerald-500/90 border border-emerald-600 flex items-center px-1.5"
          style={{ marginLeft: `${(selStart / 1440) * 100}%`, width: `${(sel.duration_minutes / 1440) * 100}%` }}
        >
          <span className="text-[9px] font-bold text-white whitespace-nowrap">
            MAINTENANCE {sel.start_time}–{sel.end_time}
          </span>
        </div>
      )}
      {sel && plan.rejected_windows
        .filter(w => (w.train_conflicts || 0) > 0)
        .slice(0, 3)
        .map((w, i) => {
          const ws = Number(w.start_time.slice(0, 2)) * 60 + Number(w.start_time.slice(3));
          return (
            <div
              key={i}
              className="h-3 rounded bg-red-400/70 border border-red-500"
              style={{ marginLeft: `${(ws / 1440) * 100}%`, width: `${((Number(w.end_time.slice(0, 2)) * 60 + Number(w.end_time.slice(3)) - ws) / 1440) * 100}%` }}
              title={`Train conflict: ${w.train_nos?.join(', ')}`}
            />
          );
        })}
      {!blocks && <div className="text-[10px] text-slate-400">No timetable data</div>}
    </div>
  );
};

export const WindowPlannerPanel: React.FC<{ requests: PlanRequest[] }> = ({ requests }) => {
  const [selectedId, setSelectedId] = useState<number | null>(requests[0]?.id ?? null);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(true);
  const [showRejected, setShowRejected] = useState(true);

  const plan = async () => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<PlanResult>('/ai/plan-request', { request_id: selectedId });
      setResult(res.data);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Planning failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const sel = result?.selected;

  return (
    <div className="bg-white rounded-xl border-2 border-indigo-200 shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
          <CalendarClock className="w-4 h-4 text-indigo-600" />
          Single-Request Window Planner
        </h4>
        <span className="text-[10px] font-bold text-slate-400 uppercase">30-min grid · 10-min clearance</span>
      </div>

      {/* Request selector + generate */}
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(Number(e.target.value))}
          className="flex-1 text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          {requests.map((r) => (
            <option key={r.id} value={r.id}>
              {r.problem_id} · {r.department_code} · {r.priority} · {r.max_duration_hours}h · {r.corridor_code || r.corridor_name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={plan}
          disabled={loading || !selectedId}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0"
        >
          <Play className="w-3.5 h-3.5" />
          <span>{loading ? 'Scanning windows...' : 'Generate Plan'}</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {sel ? (
            <>
              {/* SELECTED WINDOW — decision-grade stats */}
              <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-500 uppercase block">AI Recommended Block</span>
                    <span className="text-lg font-mono font-extrabold text-slate-900">
                      {sel.start_time} – {sel.end_time}
                    </span>
                    <span className="text-xs text-slate-500 ml-2">({sel.duration_minutes} min)</span>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${IMPACT_STYLE[sel.operational_impact]}`}>
                    Impact: {sel.operational_impact}
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                  {[
                    { icon: <Train className="w-3.5 h-3.5 mx-auto" />, label: 'Train Conflicts', value: sel.train_conflicts },
                    { icon: <Boxes className="w-3.5 h-3.5 mx-auto" />, label: 'Resource Conflicts', value: sel.resource_conflicts },
                    { icon: <Users className="w-3.5 h-3.5 mx-auto" />, label: 'Manpower Conflicts', value: sel.manpower_conflicts },
                    { icon: <Boxes className="w-3.5 h-3.5 mx-auto" />, label: 'Existing Blocks', value: sel.existing_block_conflicts },
                    { icon: <ShieldCheck className="w-3.5 h-3.5 mx-auto" />, label: 'Safety', value: sel.safety_constraints },
                  ].map((s, i) => (
                    <div key={i} className="p-2 rounded-lg bg-white border border-slate-200">
                      <span className="text-slate-500">{s.icon}</span>
                      <div className="font-bold text-slate-900">{s.value}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Timetable strip */}
                <TimetableStrip plan={result} />
              </div>

              {/* WHY THIS PLAN */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowWhy(!showWhy)}
                  className="flex items-center justify-between w-full text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5"
                >
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    WHY THIS PLAN? ({result.candidate_count} windows scanned)
                  </span>
                  {showWhy ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showWhy && (
                  <div className="space-y-1">
                    {result.why.map((wy, i) => (
                      <div key={i} className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-100 text-xs text-emerald-900 font-medium">{wy}</div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              No feasible maintenance window found. Reasons:
              <ul className="list-disc ml-4 mt-1 space-y-0.5">
                {Array.from(new Set(result.rejected_windows.flatMap(w => w.reject_reasons || []))).slice(0, 4).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Candidate windows */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Feasible Windows ({result.feasible_count})
              </div>
              <div className="space-y-1">
                {result.feasible_windows.slice(0, 5).map((w, i) => (
                  <div key={i} className={`flex items-center justify-between text-[11px] p-2 rounded-lg border ${IMPACT_STYLE[w.operational_impact]}`}>
                    <span className="font-mono font-bold">{w.start_time}–{w.end_time}</span>
                    <span className="font-bold">✓ {w.operational_impact} impact</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setShowRejected(!showRejected)}
                className="flex items-center justify-between w-full text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5"
              >
                <span className="flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                  Rejected Windows ({result.rejected_count})
                </span>
                {showRejected ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showRejected && (
                <div className="space-y-1">
                  {result.rejected_windows.slice(0, 5).map((w, i) => (
                    <div key={i} className="text-[11px] p-2 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-700">{w.start_time}–{w.end_time}</span>
                        <span className="text-red-600 font-bold">
                          {w.train_conflicts ? `🚆 ${w.train_conflicts}` : ''} {w.existing_block_conflicts ? `⛔ ${w.existing_block_conflicts}` : ''}
                        </span>
                      </div>
                      {(w.reasons || []).slice(0, 1).map((r, ri) => (
                        <div key={ri} className="text-red-700 mt-0.5">{r}</div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
