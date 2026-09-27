import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { BreadcrumbContext } from '../../components/layout/BreadcrumbContext';
import {
  BarChart3, TrendingUp, Clock, Layers, Gauge, AlertTriangle,
  CheckCircle2, RefreshCw, Info,
} from 'lucide-react';

interface ImpactSide {
  label: string;
  blocks: number;
  train_delay_minutes: number;
  asset_availability_percent: number;
  assumptions?: string[];
  drivers?: string[];
}

interface ImpactResponse {
  baseline: ImpactSide;
  optimized: ImpactSide;
  delta: {
    blocks_saved: number;
    block_reduction_percent: number;
    delay_minutes_saved: number;
    availability_gain_percent: number;
  };
}

interface ForecastSummary {
  summary: {
    network_goods_trains_forecast: number;
    daily_average: number;
    high_density_days: number;
  };
  daily_totals: Array<{ date: string; goods_trains_forecast: number }>;
}

const DELAY_HOURS = (min: number) => Math.round((min / 60) * 10) / 10;

export const ImpactSimulator: React.FC = () => {
  const [impact, setImpact] = useState<ImpactResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [impRes, fcRes] = await Promise.all([
        api.get<ImpactResponse>('/impact/simulation'),
        api.get<ForecastSummary>('/forecast/goods', { params: { days: 7 } }),
      ]);
      if (impRes.data && typeof impRes.data === 'object' && impRes.data.baseline && impRes.data.delta) {
        setImpact(impRes.data);
      } else {
        throw new Error('bad impact shape');
      }
      if (fcRes.data && typeof fcRes.data === 'object' && fcRes.data.summary) {
        setForecast(fcRes.data);
      }
    } catch (e) {
      setError('Simulation unavailable — backend or offline engine required.');
      setImpact(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const bar = (value: number, max: number, color: string) => (
    <div className="h-6 rounded-lg bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-lg ${color}`} style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} />
    </div>
  );

  const maxBlocks = impact ? Math.max(impact.baseline.blocks, impact.optimized.blocks) : 1;
  const maxDelay = impact ? Math.max(impact.baseline.train_delay_minutes, impact.optimized.train_delay_minutes) : 1;
  const maxAvail = 100;

  const fcMax = forecast ? Math.max(1, ...forecast.daily_totals.map(d => d.goods_trains_forecast)) : 1;

  return (
    <div className="space-y-5">
      <BreadcrumbContext
        title="Impact Simulator — Baseline vs AI-Optimized"
        subpath="Quantified savings of coordinated planning vs today's decentralized process"
        actionButton={
          <button
            type="button"
            onClick={fetchAll}
            disabled={loading}
            className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-run</span>
          </button>
        }
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {impact && (
        <>
          {/* Delta KPI cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-emerald-200 p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                <Layers className="w-3 h-3" /> Blocks eliminated
              </div>
              <div className="text-2xl font-extrabold text-emerald-600">{impact.delta.blocks_saved}</div>
              <div className="text-[11px] text-slate-500">−{impact.delta.block_reduction_percent}% corridor occupations</div>
            </div>
            <div className="bg-white rounded-xl border border-emerald-200 p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                <Clock className="w-3 h-3" /> Train delay saved
              </div>
              <div className="text-2xl font-extrabold text-emerald-600">
                {DELAY_HOURS(impact.delta.delay_minutes_saved)}h
              </div>
              <div className="text-[11px] text-slate-500">{Math.round(impact.delta.delay_minutes_saved)} train-minutes / week</div>
            </div>
            <div className="bg-white rounded-xl border border-emerald-200 p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                <Gauge className="w-3 h-3" /> Availability gain
              </div>
              <div className="text-2xl font-extrabold text-emerald-600">+{impact.delta.availability_gain_percent}%</div>
              <div className="text-[11px] text-slate-500">asset uptime for train operations</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                <BarChart3 className="w-3 h-3" />&nbsp;Forecast consulted
              </div>
              <div className="text-2xl font-extrabold text-slate-900">
                {forecast ? forecast.summary.network_goods_trains_forecast : '—'}
              </div>
              <div className="text-[11px] text-slate-500">
                goods trains / 7d {forecast ? `· ${forecast.summary.high_density_days} dense days` : ''}
              </div>
            </div>
          </div>

          {/* Side-by-side comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Baseline */}
            <div className="bg-white rounded-xl border border-red-200 p-5 space-y-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-700 bg-red-50 border border-red-200 rounded px-2 py-0.5">
                  Baseline
                </span>
                <h4 className="font-extrabold text-slate-900 mt-1.5">{impact.baseline.label}</h4>
              </div>
              {[
                { label: 'Blocks / week', value: impact.baseline.blocks, max: maxBlocks, bar: 'bg-red-400', fmt: (v: number) => String(v) },
                { label: 'Train delay', value: impact.baseline.train_delay_minutes, max: maxDelay, bar: 'bg-red-400', fmt: (v: number) => `${DELAY_HOURS(v)}h` },
                { label: 'Asset availability', value: impact.baseline.asset_availability_percent, max: maxAvail, bar: 'bg-red-400', fmt: (v: number) => `${v}%` },
              ].map(({ label, value, max, bar: b, fmt }) => (
                <div key={label}>
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                    <span>{label}</span><span className="font-mono">{fmt(value)}</span>
                  </div>
                  {bar(value, max, b)}
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100">
                <div className="text-[10px] font-extrabold text-slate-400 uppercase mb-1 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Model assumptions
                </div>
                <ul className="space-y-1">
                  {(impact.baseline.assumptions || []).map((a, i) => (
                    <li key={i} className="text-[11px] text-slate-600 flex gap-1.5">
                      <span className="text-red-400">•</span> {a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Optimized */}
            <div className="bg-white rounded-xl border-2 border-emerald-500 p-5 space-y-4 shadow-sm">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                  TrackShield AI
                </span>
                <h4 className="font-extrabold text-slate-900 mt-1.5">{impact.optimized.label}</h4>
              </div>
              {[
                { label: 'Blocks / week', value: impact.optimized.blocks, max: maxBlocks, bar: 'bg-emerald-500', fmt: (v: number) => String(v) },
                { label: 'Train delay', value: impact.optimized.train_delay_minutes, max: maxDelay, bar: 'bg-emerald-500', fmt: (v: number) => `${DELAY_HOURS(v)}h` },
                { label: 'Asset availability', value: impact.optimized.asset_availability_percent, max: maxAvail, bar: 'bg-emerald-500', fmt: (v: number) => `${v}%` },
              ].map(({ label, value, max, bar: b, fmt }) => (
                <div key={label}>
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                    <span>{label}</span><span className="font-mono">{fmt(value)}</span>
                  </div>
                  {bar(value, max, b)}
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100">
                <div className="text-[10px] font-extrabold text-slate-400 uppercase mb-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Optimization drivers
                </div>
                <ul className="space-y-1">
                  {(impact.optimized.drivers || []).map((a, i) => (
                    <li key={i} className="text-[11px] text-slate-600 flex gap-1.5">
                      <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" /> {a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Freight forecast strip */}
          {forecast && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-slate-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  COA Goods-Train Forecast — next 7 days (network)
                </h4>
              </div>
              <div className="flex items-end gap-2 h-24">
                {forecast.daily_totals.map(d => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[9px] font-bold text-slate-500">{Math.round(d.goods_trains_forecast)}</div>
                    <div
                      className="w-full rounded-t bg-blue-400/80"
                      style={{ height: `${(d.goods_trains_forecast / fcMax) * 70}px` }}
                      title={`${d.date}: ${d.goods_trains_forecast} goods trains forecast`}
                    />
                    <div className="text-[9px] text-slate-400">{d.date.slice(5)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
