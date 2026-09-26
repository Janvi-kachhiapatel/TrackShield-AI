import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { History } from 'lucide-react';

interface TimelineEvent {
  timestamp: string;
  user: string;
  role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: string;
}

const ACTION_STYLE: Record<string, { color: string; label: string }> = {
  CREATE_REQUEST: { color: 'bg-blue-500', label: 'Problem Reported' },
  REPORT_DELAY: { color: 'bg-amber-500', label: 'Delay Reported' },
  START_WORK: { color: 'bg-indigo-500', label: 'Maintenance Started' },
  RUN_CP_SAT_OPTIMIZER: { color: 'bg-violet-500', label: 'AI Plan Generated' },
  APPLY_AI_FUSION: { color: 'bg-fuchsia-500', label: 'AI Fusion Applied' },
  APPROVE_BLOCK: { color: 'bg-emerald-500', label: 'Block Approved' },
  REJECT_BLOCK: { color: 'bg-red-500', label: 'Block Rejected' },
  MODIFY_BLOCK: { color: 'bg-sky-500', label: 'Block Modified' },
  SUBMIT_MCR: { color: 'bg-teal-500', label: 'MCR Submitted' },
  CLOSE_MCR: { color: 'bg-emerald-600', label: 'MCR Verified & Closed' },
  SEND_REWORK_MCR: { color: 'bg-orange-500', label: 'MCR Sent for Rework' },
};

/**
 * End-to-end lifecycle timeline for one maintenance request (+ its blocks
 * and MCR), rendered from the real audit log via GET /api/audit/timeline.
 */
export const AuditTimeline: React.FC<{ requestId: number | null }> = ({ requestId }) => {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    setEvents(null);
    setError(null);
    api
      .get<{ events: TimelineEvent[] }>('/audit/timeline', { params: { request_id: requestId } })
      .then((res) => {
        if (!cancelled) setEvents(res.data.events || []);
      })
      .catch(() => {
        if (!cancelled) setError('Timeline unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  if (!requestId) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-3">
        <History className="w-4 h-4 text-slate-500" />
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Audit Timeline — Full Lifecycle
        </h4>
      </div>

      {error && <p className="text-xs text-slate-500">{error}</p>}
      {!error && events === null && <p className="text-xs text-slate-500 py-2">Loading timeline…</p>}
      {events !== null && events.length === 0 && (
        <p className="text-xs text-slate-500 py-2">No audit events recorded for this request yet.</p>
      )}

      {events && events.length > 0 && (
        <ol className="relative border-l-2 border-slate-200 ml-2 space-y-3">
          {events.map((ev, i) => {
            const style = ACTION_STYLE[ev.action] || { color: 'bg-slate-400', label: ev.action };
            return (
              <li key={i} className="ml-4">
                <span className={`absolute -left-[7px] w-3 h-3 rounded-full ${style.color} border-2 border-white`} />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-slate-800">
                    {ev.timestamp.slice(0, 16).replace('T', ' ')}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                    {style.label}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {ev.entity_type} {ev.entity_id}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {ev.details || '—'} · <span className="font-semibold text-slate-700">{ev.user}</span> ({ev.role})
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
