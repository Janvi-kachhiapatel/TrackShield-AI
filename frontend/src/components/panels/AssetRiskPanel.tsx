import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { ShieldAlert, Activity, ChevronDown, ChevronUp } from 'lucide-react';

interface RiskFactor {
  value: number;
  weight: number;
  contribution: number;
}

interface TopRiskAsset {
  asset_id: string;
  name: string;
  corridor: string | null;
  score: number;
  band: string;
}

interface RiskSummary {
  total_assets: number;
  average_score: number;
  band_distribution: { HIGH: number; MEDIUM: number; LOW: number };
  high_risk_share_percent: number;
  by_department: Array<{
    department_code: string;
    asset_count: number;
    average_score: number;
    high_risk_assets: number;
  }>;
  top_risk_assets: TopRiskAsset[];
  weights: Record<string, number>;
}

const BAND_STYLES: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700 border-red-200',
  MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
  LOW: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const FACTOR_LABELS: Record<string, string> = {
  health_status: 'Health status',
  age_wear: 'Age vs service life',
  criticality: 'Declared criticality',
  inspection_recency: 'Inspection recency',
  open_urgent_work: 'Open urgent work',
};

/**
 * Asset Risk Intelligence panel for the Higher HOD command dashboard.
 * Data comes from the explainable risk engine (GET /api/risk/summary):
 * every score is a weighted sum of observable factors, so judges can see
 * WHY an asset is flagged — no black-box numbers.
 */
export const AssetRiskPanel: React.FC = () => {
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<RiskSummary>('/risk/summary')
      .then((res) => {
        // Static deployments without a backend serve HTML; guard non-object data.
        if (!cancelled && res.data && typeof res.data === 'object' && res.data.band_distribution) {
          setSummary(res.data);
        } else if (!cancelled) {
          setError('Risk engine requires the backend (unavailable in static demo mode)');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Risk engine unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-600" />
          <span>Asset Risk Intelligence</span>
        </h3>
        <p className="text-xs text-slate-500 mt-2">{error}</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-500 mt-2">Computing asset risk scores…</p>
      </div>
    );
  }

  const total = summary.total_assets || 1;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <span>Asset Risk Intelligence</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Explainable 0–100 risk scores across {summary.total_assets} assets — weighted factors, no black-box numbers.
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-slate-900">{summary.average_score}</div>
          <div className="text-[10px] font-bold uppercase text-slate-400">Network avg</div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Band distribution bar */}
        <div>
          <div className="flex h-6 rounded-lg overflow-hidden border border-slate-200">
            {(['HIGH', 'MEDIUM', 'LOW'] as const).map((band) => {
              const count = summary.band_distribution[band];
              const pct = (count / total) * 100;
              const color =
                band === 'HIGH' ? 'bg-red-500' : band === 'MEDIUM' ? 'bg-amber-400' : 'bg-emerald-500';
              if (pct === 0) return null;
              return (
                <div
                  key={band}
                  className={`${color} flex items-center justify-center text-[10px] font-bold text-white`}
                  style={{ width: `${pct}%` }}
                  title={`${band}: ${count} assets (${pct.toFixed(1)}%)`}
                >
                  {pct >= 8 ? `${count}` : ''}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] font-bold text-slate-500">
            <span className="text-red-600">HIGH RISK: {summary.band_distribution.HIGH}</span>
            <span className="text-amber-600">MEDIUM: {summary.band_distribution.MEDIUM}</span>
            <span className="text-emerald-600">LOW: {summary.band_distribution.LOW}</span>
            <span className="text-slate-400">{summary.high_risk_share_percent}% high-risk share</span>
          </div>
        </div>

        {/* Per-department risk */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {summary.by_department.map((d) => (
            <div key={d.department_code} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
              <div className="text-[10px] font-bold text-slate-500 uppercase">{d.department_code}</div>
              <div className="text-sm font-bold text-slate-900">{d.average_score}</div>
              <div className="text-[10px] text-slate-500">
                {d.high_risk_assets} high / {d.asset_count} assets
              </div>
            </div>
          ))}
        </div>

        {/* Top risk assets with expandable factor breakdown */}
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            Top Risk Assets — click for factor breakdown
          </div>
          <div className="space-y-1.5">
            {summary.top_risk_assets.slice(0, 5).map((a) => (
              <div key={a.asset_id} className="rounded-lg border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === a.asset_id ? null : a.asset_id)}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${BAND_STYLES[a.band]}`}>
                      {a.score}
                    </span>
                    <span className="text-xs font-bold text-slate-800 truncate">{a.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-500 font-mono">{a.corridor || '—'}</span>
                    {expanded === a.asset_id ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </button>
                {expanded === a.asset_id && (
                  <FactorBreakdown assetId={a.asset_id} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Fetches the single-asset factor breakdown from GET /api/risk/assets
 * (filtered client-side by asset_id) and renders the weighted contributions.
 */
const FactorBreakdown: React.FC<{ assetId: string }> = ({ assetId }) => {
  const [factors, setFactors] = useState<Record<string, RiskFactor> | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Array<{ asset_id: string; factors: Record<string, RiskFactor> }>>('/risk/assets', {
        params: { limit: 500 },
      })
      .then((res) => {
        if (cancelled) return;
        const row = res.data.find((r) => r.asset_id === assetId);
        setFactors(row?.factors ?? {});
      })
      .catch(() => {
        if (!cancelled) setFactors({});
      });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return (
    <div className="px-3 pb-3 pt-1 bg-slate-50 border-t border-slate-200">
      {!factors ? (
        <p className="text-[10px] text-slate-400 py-1.5">Loading factors…</p>
      ) : (
        <div className="space-y-1 pt-1.5">
          {Object.entries(factors).map(([key, f]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-600 w-36 shrink-0">
                {FACTOR_LABELS[key] || key}
              </span>
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${Math.min(100, f.value)}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-slate-700 w-20 text-right">
                {f.value} × {f.weight}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
