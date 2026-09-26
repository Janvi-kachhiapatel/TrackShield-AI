import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { BreadcrumbContext } from '../../components/layout/BreadcrumbContext';
import { Station, Corridor, Asset, TrainSchedule, AuditLogItem } from '../../types';
import {
  Database,
  Train,
  Wrench,
  Layers,
  Activity,
  History,
  Shield,
  Server
} from 'lucide-react';

export const MasterData: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'STATIONS' | 'CORRIDORS' | 'ASSETS' | 'TRAINS' | 'AUDIT'>('STATIONS');
  const [stations, setStations] = useState<Station[]>([]);
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [trains, setTrains] = useState<TrainSchedule[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<Station[]>('/master/stations?limit=70'),
      api.get<Corridor[]>('/master/corridors?limit=50'),
      api.get<Asset[]>('/master/assets?limit=50'),
      api.get<TrainSchedule[]>('/master/trains?limit=50'),
      api.get<AuditLogItem[]>('/master/audit-logs?limit=50')
    ]).then(([sRes, cRes, aRes, tRes, lRes]) => {
      setStations(sRes.data);
      setCorridors(cRes.data);
      setAssets(aRes.data);
      setTrains(tRes.data);
      setAuditLogs(lRes.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <BreadcrumbContext
        title="Master Infrastructure & System Data"
        subpath="Centralized Railway Master Assets, Stations, Corridors & Audit Logs"
      />

      {/* System Health Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-100 text-blue-700">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">FastAPI Server</span>
            <span className="font-bold text-slate-900 text-sm">Online (:8000)</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">AI Solver Engine</span>
            <span className="font-bold text-slate-900 text-sm">OR-Tools CP-SAT</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-100 text-purple-700">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Storage Layer</span>
            <span className="font-bold text-slate-900 text-sm">PostgreSQL / SQLite</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-100 text-amber-700">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">RBAC Security</span>
            <span className="font-bold text-slate-900 text-sm">Role Enforced</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs flex items-center gap-2">
        {[
          { key: 'STATIONS', label: `Stations (${stations.length})` },
          { key: 'CORRIDORS', label: `Corridors (${corridors.length})` },
          { key: 'ASSETS', label: `Fixed Assets (${assets.length})` },
          { key: 'TRAINS', label: `Train Schedules (${trains.length})` },
          { key: 'AUDIT', label: `Audit Logs (${auditLogs.length})` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === t.key
                ? 'bg-railway-dark text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'STATIONS' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Station Name</th>
                  <th className="py-3 px-4">Division</th>
                  <th className="py-3 px-4">Railway Zone</th>
                  <th className="py-3 px-4">Latitude / Longitude</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stations.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.code}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{s.name}</td>
                    <td className="py-3 px-4 text-slate-600">{s.division}</td>
                    <td className="py-3 px-4 text-slate-600">{s.zone}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono">{s.latitude?.toFixed(4)}, {s.longitude?.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'CORRIDORS' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Corridor Name</th>
                  <th className="py-3 px-4">Track Type</th>
                  <th className="py-3 px-4">Distance</th>
                  <th className="py-3 px-4">Max Speed</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {corridors.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{c.code}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{c.name}</td>
                    <td className="py-3 px-4 text-slate-600">{c.track_type}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">{c.distance_km} km</td>
                    <td className="py-3 px-4 font-mono text-slate-700">{c.max_speed} km/h</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        c.status === 'CRITICAL' ? 'bg-red-100 text-red-700' : (c.status === 'MAINTENANCE' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')
                      }`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'ASSETS' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Asset ID</th>
                  <th className="py-3 px-4">Asset Name</th>
                  <th className="py-3 px-4">Asset Type</th>
                  <th className="py-3 px-4">Corridor</th>
                  <th className="py-3 px-4">Criticality</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Inspected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{a.asset_id}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{a.name}</td>
                    <td className="py-3 px-4 text-slate-600">{a.asset_type}</td>
                    <td className="py-3 px-4 text-slate-600">{a.corridor_code}</td>
                    <td className="py-3 px-4 font-bold text-amber-700">{a.criticality}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        a.status === 'HEALTHY' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">{a.last_inspected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'TRAINS' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Train No</th>
                  <th className="py-3 px-4">Train Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Corridor</th>
                  <th className="py-3 px-4">Departure – Arrival</th>
                  <th className="py-3 px-4">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trains.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{t.train_no}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{t.train_name}</td>
                    <td className="py-3 px-4 text-blue-700 font-bold">{t.train_type}</td>
                    <td className="py-3 px-4 text-slate-600">{t.corridor_name}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">{t.departure_time} – {t.arrival_time}</td>
                    <td className="py-3 px-4 font-bold text-amber-700">{t.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'AUDIT' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Officer / User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-slate-500">{new Date(l.timestamp).toLocaleTimeString()}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{l.user_name}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{l.role}</td>
                    <td className="py-3 px-4 font-bold text-blue-800">{l.action}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">{l.entity_id}</td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{l.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
