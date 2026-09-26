import React, { useEffect, useMemo, useState } from 'react';
import api from '../../api/client';
import { GanttChartSquare, Train, Wrench, Filter } from 'lucide-react';

interface GanttRow {
  kind: 'TRAIN' | 'EXISTING_BLOCK' | 'AI_PROPOSED';
  label: string;
  start_min: number;
  end_min: number;
  train_no?: string;
  priority?: string;
  block_id?: string;
  status?: string;
  isolation_type?: string;
  jobs?: Array<{ problem_id: string; department_code: string }>;
}

interface GanttData {
  corridor: { id: number; code: string; name: string; track_type: string; status: string };
  rows: GanttRow[];
  totals: { trains: number; blocks: number; proposed: number };
}

const HOUR_WIDTH = 52; // px per hour; container scrolls horizontally

const KIND_STYLE: Record<string, { bar: string; chip: string; icon: React.ReactNode }> = {
  TRAIN: { bar: 'bg-blue-500/85 border-blue-600', chip: 'bg-blue-100 text-blue-800 border-blue-200', icon: <Train className="w-3 h-3" /> },
  EXISTING_BLOCK: { bar: 'bg-slate-500/80 border-slate-600', chip: 'bg-slate-100 text-slate-700 border-slate-200', icon: <Wrench className="w-3 h-3" /> },
  AI_PROPOSED: { bar: 'bg-emerald-500/85 border-emerald-600', chip: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <Wrench className="w-3 h-3" /> },
};

export const MasterGantt: React.FC = () => {
  const [corridors, setCorridors] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [corridorId, setCorridorId] = useState<number | null>(null);
  const [data, setData] = useState<GanttData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTrains, setShowTrains] = useState(true);
  const [showBlocks, setShowBlocks] = useState(true);
  const [hover, setHover] = useState<GanttRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Array<{ id: number; code: string; name: string }>>('/master/corridors', { params: { limit: 60 } })
      .then((res) => {
        if (cancelled) return;
        const list = (res.data || []).filter((c) => c && c.id);
        setCorridors(list);
        if (list.length > 0) setCorridorId((prev) => prev ?? list[0].id);
      })
      .catch(() => {
        if (!cancelled) setError('Corridor list unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!corridorId) return;
    let cancelled = false;
    setData(null);
    api
      .get<GanttData>(`/gantt/corridor/${corridorId}`)
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch(() => {
        if (!cancelled) setError('Gantt data unavailable (backend required for live view)');
      });
    return () => {
      cancelled = true;
    };
  }, [corridorId]);

  const trains = useMemo(
    () => (data?.rows || []).filter((r) => r.kind === 'TRAIN' && showTrains),
    [data, showTrains]
  );
  const blocks = useMemo(
    () => (data?.rows || []).filter((r) => r.kind !== 'TRAIN' && showBlocks),
    [data, showBlocks]
  );

  const pos = (min: number) => `${(min / 1440) * 100 * (1440 / HOUR_WIDTH / (1440 / HOUR_WIDTH))}%`;
  const pct = (min: number) => `${(Math.min(Math.max(min, 0), 1440) / 1440) * 100}%`;

  const lane = (rows: GanttRow[]) => {
    // Simple lane packing: a row goes into the first lane where it fits.
    const lanes: GanttRow[][] = [];
    for (const r of rows) {
      let placed = false;
      for (const lane of lanes) {
        if (lane.every((x) => r.start_min >= x.end_min || r.end_min <= x.start_min)) {
          lane.push(r);
          placed = true;
          break;
        }
      }
      if (!placed) lanes.push([r]);
    }
    return lanes;
  };

  const trainLanes = lane(trains);
  const blockLanes = lane(blocks);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GanttChartSquare className="w-4 h-4 text-slate-700" />
          <h3 className="font-bold text-sm text-slate-900">Master Corridor Gantt — 24h Planning Timeline</h3>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setShowTrains(!showTrains)}
            className={`px-2 py-1 rounded border transition ${showTrains ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
          >
            🚆 Trains
          </button>
          <button
            type="button"
            onClick={() => setShowBlocks(!showBlocks)}
            className={`px-2 py-1 rounded border transition ${showBlocks ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
          >
            🔧 Blocks
          </button>
          <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
          <select
            value={corridorId ?? ''}
            onChange={(e) => setCorridorId(Number(e.target.value))}
            className="text-[11px] border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none"
          >
            {corridors.map((c) => (
              <option key={c.id} value={c.id}>{c.code}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-4 pt-2 text-[11px] text-slate-500">
        {data
          ? `${data.corridor.name} · ${data.totals.trains} trains · ${data.totals.blocks} maintenance blocks (${data.totals.proposed} AI-proposed)`
          : 'Loading…'}
      </div>

      {error && <div className="mx-4 mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">{error}</div>}

      <div className="overflow-x-auto px-4 pb-4 pt-2">
        <div style={{ minWidth: HOUR_WIDTH * 24 }}>
          {/* Hour ruler */}
          <div className="relative h-5 border-b border-slate-200 mb-1">
            {Array.from({ length: 24 }).map((_, h) => (
              <div
                key={h}
                className="absolute top-0 text-[9px] font-bold text-slate-400"
                style={{ left: `${(h / 24) * 100}%` }}
              >
                {String(h).padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* Train lanes */}
          {showTrains &&
            trainLanes.map((laneRows, li) => (
              <div key={`t-${li}`} className="relative h-6 mb-1 bg-blue-50/30 rounded">
                {laneRows.map((r, ri) => {
                  const left = pct(r.start_min);
                  const width = `calc(${pct(r.end_min - r.start_min)} - 2px)`;
                  return (
                    <div
                      key={ri}
                      className={`absolute h-4 top-1 rounded border ${KIND_STYLE[r.kind].bar} cursor-pointer hover:brightness-110`}
                      style={{ left, width }}
                      onMouseEnter={() => setHover(r)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <span className="text-[8px] font-bold text-white px-1 truncate block leading-4">{r.label}</span>
                    </div>
                  );
                })}
              </div>
            ))}

          {/* Separator */}
          {showTrains && showBlocks && (
            <div className="border-t border-dashed border-slate-300 my-1.5" />
          )}

          {/* Block lanes */}
          {showBlocks &&
            blockLanes.map((laneRows, li) => (
              <div key={`b-${li}`} className="relative h-6 mb-1 bg-emerald-50/30 rounded">
                {laneRows.map((r, ri) => {
                  const left = pct(r.start_min);
                  const width = `calc(${pct(r.end_min - r.start_min)} - 2px)`;
                  return (
                    <div
                      key={ri}
                      className={`absolute h-4 top-1 rounded border ${KIND_STYLE[r.kind].bar} cursor-pointer hover:brightness-110`}
                      style={{ left, width }}
                      onMouseEnter={() => setHover(r)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <span className="text-[8px] font-bold text-white px-1 truncate block leading-4">{r.label}</span>
                    </div>
                  );
                })}
              </div>
            ))}

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3 text-[10px] font-bold text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-blue-500 inline-block" /> TRAIN</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-slate-500 inline-block" /> EXISTING / APPROVED BLOCK</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-emerald-500 inline-block" /> AI PROPOSED BLOCK</span>
          </div>
        </div>
      </div>

      {/* Hover detail card */}
      {hover && (
        <div className="mx-4 mb-3 p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${KIND_STYLE[hover.kind].chip}`}>
              {hover.kind.replace('_', ' ')}
            </span>
            <span className="font-bold text-slate-800">{hover.label}</span>
            <span className="font-mono text-slate-500">
              {String(Math.floor(hover.start_min / 60) % 24).padStart(2, '0')}:{String(hover.start_min % 60).padStart(2, '0')}
              {' – '}
              {String(Math.floor(hover.end_min / 60) % 24).padStart(2, '0')}:{String(hover.end_min % 60).padStart(2, '0')}
            </span>
          </div>
          {hover.kind === 'TRAIN' && (
            <p className="text-slate-600">Priority: <strong>{hover.priority}</strong> — maintenance must keep a 10-minute clearance from this movement.</p>
          )}
          {hover.kind !== 'TRAIN' && (
            <p className="text-slate-600">
              Status: <strong>{hover.status}</strong> · Isolation: {hover.isolation_type}
              {hover.jobs && hover.jobs.length > 0 && (
                <> · Jobs: {hover.jobs.map((j) => `${j.problem_id} (${j.department_code})`).join(', ')}</>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
