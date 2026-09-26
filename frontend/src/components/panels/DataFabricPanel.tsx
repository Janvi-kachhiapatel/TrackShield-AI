import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { Network, ArrowDownToLine, ArrowUpFromLine, CheckCircle2 } from 'lucide-react';

interface AdapterSummary {
  key: string;
  name: string;
  direction: string;
  records_available: number;
  status: string;
}

interface StatusResponse {
  interfaces: AdapterSummary[];
  data_mode: string;
}

interface AdapterContract {
  key: string;
  name: string;
  upstream_system: string;
  direction: string;
  frequency: string;
  transport: string;
  description: string;
  produces: Array<{ field: string; type: string; unit: string | null; source: string }>;
}

const DIRECTION_ICON: Record<string, React.ReactNode> = {
  inbound: <ArrowDownToLine className="w-3.5 h-3.5 text-blue-600" />,
  outbound: <ArrowUpFromLine className="w-3.5 h-3.5 text-emerald-600" />,
};

/**
 * Data Fabric / Integration panel for the Higher HOD command dashboard.
 * Shows the published interoperability contracts (GET /api/data-fabric/status):
 * what flows in from railway systems (timetable, asset condition), what flows
 * out to control offices (possession advisories), and what returns (MCRs).
 */
export const DataFabricPanel: React.FC = () => {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [contracts, setContracts] = useState<Record<string, AdapterContract>>({});
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<StatusResponse>('/data-fabric/status')
      .then((res) => {
        if (cancelled) return;
        // Static deployments without a backend serve HTML; guard non-object data.
        if (res.data && typeof res.data === 'object' && Array.isArray(res.data.interfaces)) {
          setStatus(res.data);
          // Load full contracts lazily for the detail views.
          return api.get<{ adapters: AdapterContract[] }>('/data-fabric/adapters');
        }
        setError('Integration layer requires the backend (unavailable in static demo mode)');
        return undefined;
      })
      .then((res) => {
        if (!res || cancelled) return;
        if (res.data && typeof res.data === 'object' && Array.isArray(res.data.adapters)) {
          const map: Record<string, AdapterContract> = {};
          for (const a of res.data.adapters) map[a.key] = a;
          setContracts(map);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Integration layer unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Network className="w-4 h-4 text-blue-600" />
          <span>Integration & Data Fabric</span>
        </h3>
        <p className="text-xs text-slate-500 mt-2">{error}</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-500 mt-2">Loading interface status…</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Network className="w-4 h-4 text-blue-600" />
            <span>Integration & Data Fabric</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Machine-readable interfaces to existing railway systems — timetable in, possession advisories out.
          </p>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
          {status.data_mode}
        </span>
      </div>

      <div className="p-4 space-y-2">
        {status.interfaces.map((itf) => {
          const contract = contracts[itf.key];
          const isOpen = expanded === itf.key;
          return (
            <div key={itf.key} className="rounded-lg border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : itf.key)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-50 transition text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {DIRECTION_ICON[itf.direction] || <Network className="w-3.5 h-3.5 text-slate-400" />}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">{itf.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {itf.direction === 'inbound' ? 'Inbound feed' : 'Outbound advisory'} · {itf.records_available.toLocaleString()} records
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                    <CheckCircle2 className="w-3 h-3" />
                    {itf.status}
                  </span>
                </div>
              </button>

              {isOpen && contract && (
                <div className="px-3.5 pb-3 pt-1 bg-slate-50 border-t border-slate-200 space-y-2">
                  <p className="text-[11px] text-slate-600">{contract.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-2 rounded bg-white border border-slate-200">
                      <span className="font-bold text-slate-500 block">Upstream</span>
                      <span className="text-slate-700">{contract.upstream_system}</span>
                    </div>
                    <div className="p-2 rounded bg-white border border-slate-200">
                      <span className="font-bold text-slate-500 block">Transport / cadence</span>
                      <span className="text-slate-700">{contract.transport} · {contract.frequency}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Contract fields</span>
                    <div className="flex flex-wrap gap-1">
                      {contract.produces.map((p) => (
                        <span
                          key={p.field}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-slate-700"
                          title={`type: ${p.type}${p.unit ? ` · unit: ${p.unit}` : ''} · source: ${p.source}`}
                        >
                          {p.field}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
