import React, { useState, useEffect } from 'react';
import { DashboardKPIs, DepartmentMetric } from '../../types';
import api from '../../api/client';
import { BreadcrumbContext } from '../../components/layout/BreadcrumbContext';
import { KPICard } from '../../components/common/KPICard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { AssetRiskPanel } from '../../components/panels/AssetRiskPanel';
import { DataFabricPanel } from '../../components/panels/DataFabricPanel';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Clock,
  AlertOctagon,
  PlayCircle,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  FileCheck,
  Bot,
  Layers,
  ArrowRight,
  Filter,
  Train,
  Check
} from 'lucide-react';

export const CommandDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string | null>(null);
  const [selectedCorridorModal, setSelectedCorridorModal] = useState<any | null>(null);

  const fetchDashboard = async () => {
    try {
      const res = await api.get<DashboardKPIs>('/analytics/dashboard');
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs font-semibold text-slate-500">Loading Command Center Telemetry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Context */}
      <BreadcrumbContext
        title="Railway Maintenance Command Center"
        subpath="Command Dashboard & Multi-Department Corridor Operations"
        actionButton={
          <div className="flex items-center gap-2">
            <Link
              to="/higher/ai-planner"
              className="px-4 py-2 bg-railway-dark hover:bg-railway-accent text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition"
            >
              <Bot className="w-4 h-4 text-blue-300" />
              <span>Launch AI Block Planner</span>
            </Link>
          </div>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Network Operations & Infrastructure Oversight
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor maintenance, assets, blocks and operational risks across all departments in real time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-semibold text-slate-700">Real-Time Database Sync</span>
        </div>
      </div>

      {/* TOP KPIs — Sourced directly from PostgreSQL / API */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KPICard
          title="Total Requests"
          value={data.total_requests}
          subtitle="All 5 departments"
          icon={<Layers className="w-4 h-4" />}
        />
        <KPICard
          title="Pending Approval"
          value={data.pending_approval}
          subtitle="Awaiting HOD action"
          variant="info"
          icon={<Clock className="w-4 h-4" />}
          onClick={() => navigate('/higher/requests?status=NEW')}
        />
        <KPICard
          title="Critical Problems"
          value={data.critical_problems}
          subtitle="High train impact"
          variant="critical"
          icon={<AlertOctagon className="w-4 h-4" />}
          onClick={() => navigate('/higher/requests?priority=CRITICAL')}
        />
        <KPICard
          title="Active Maintenance"
          value={data.active_maintenance}
          subtitle="Gangs on track"
          variant="info"
          icon={<PlayCircle className="w-4 h-4" />}
        />
        <KPICard
          title="Delayed Work"
          value={data.delayed_work}
          subtitle="Requires attention"
          variant="warning"
          icon={<AlertTriangle className="w-4 h-4" />}
        />
        <KPICard
          title="Asset Availability"
          value={`${data.asset_availability_percent}%`}
          subtitle="Target: 95.0%"
          variant="success"
          icon={<TrendingUp className="w-4 h-4" />}
        />
      </div>

      {/* ASSET RISK & INTEGRATION INTELLIGENCE */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AssetRiskPanel />
        <DataFabricPanel />
      </div>

      {/* CRITICAL ALERTS & AI RECOMMENDATION SECTION */}
      <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-gradient-to-r from-red-600 to-red-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-red-100 animate-bounce" />
            <h3 className="font-bold text-sm tracking-wide">
              Priority Operational Alerts & Active Conflicts
            </h3>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/20 text-white">
            {data.critical_alerts.length} Items Require Action
          </span>
        </div>

        <div className="p-4 space-y-3">
          {data.critical_alerts.map((alert) => (
            <div
              key={alert.id}
              className="p-4 rounded-xl border border-red-200 bg-red-50/40 flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-red-950">{alert.title}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-600 text-white uppercase">
                    Train Impact: {alert.train_impact}
                  </span>
                </div>
                <p className="text-xs text-slate-700">
                  Corridor Section: <strong>{alert.corridor}</strong>
                </p>
                <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-1">
                  <Bot className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    <strong>AI Recommendation:</strong> {alert.recommended_action}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => navigate('/higher/ai-planner')}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Review AI Recommendation</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CORRIDOR STATUS VISUAL MONITOR */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Train className="w-4 h-4 text-railway-700" />
              <span>Corridor Status Visual Monitor</span>
            </h3>
            <p className="text-xs text-slate-500">
              Visual section tracker across Delhi–Prayagraj–Howrah & Western trunks. Click corridor to inspect live assets and train impact.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-medium">Auto-updating</span>
        </div>

        {/* Interactive Track Section Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {data.corridor_status.map((c) => {
            let statusBadge = 'bg-emerald-50 text-emerald-800 border-emerald-200';
            let dot = 'bg-emerald-500';
            if (c.status === 'CRITICAL') {
              statusBadge = 'bg-red-50 text-red-800 border-red-200 animate-pulse';
              dot = 'bg-red-500';
            } else if (c.status === 'MAINTENANCE') {
              statusBadge = 'bg-amber-50 text-amber-800 border-amber-200';
              dot = 'bg-amber-500';
            }

            return (
              <div
                key={c.id}
                onClick={() => setSelectedCorridorModal(c)}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-slate-900">{c.code}</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${statusBadge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>
                    {c.status}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-800 mt-1 truncate">{c.name}</p>
                <div className="mt-2 text-[11px] text-slate-500 flex justify-between border-t border-slate-200 pt-2">
                  <span>{c.track_type}</span>
                  <span className="font-semibold text-slate-700">{c.open_requests} Open Jobs</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DEPARTMENT OVERVIEW MATRIX — One-Click Filtering */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              Department Operations & Work Matrix
            </h3>
            <p className="text-xs text-slate-500">
              Click any department row to view all associated requests
            </p>
          </div>
          {selectedDeptFilter && (
            <button
              onClick={() => setSelectedDeptFilter(null)}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Clear Filter
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4 text-center">Total Requests</th>
                <th className="py-3 px-4 text-center">Critical</th>
                <th className="py-3 px-4 text-center">Pending</th>
                <th className="py-3 px-4 text-center">In Progress</th>
                <th className="py-3 px-4 text-center">Delayed</th>
                <th className="py-3 px-4 text-center">Completed</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.department_metrics.map((dm) => (
                <tr
                  key={dm.code}
                  onClick={() => navigate(`/higher/requests?department=${dm.code}`)}
                  className="hover:bg-blue-50/60 transition cursor-pointer"
                >
                  <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    <span>{dm.department}</span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-600">{dm.code}</td>
                  <td className="py-3.5 px-4 text-center font-bold text-slate-900">{dm.total_requests}</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded font-bold ${dm.critical > 0 ? 'bg-red-100 text-red-700' : 'text-slate-400'}`}>
                      {dm.critical}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-semibold text-blue-700">{dm.pending}</td>
                  <td className="py-3.5 px-4 text-center font-semibold text-slate-800">{dm.in_progress}</td>
                  <td className="py-3.5 px-4 text-center font-semibold text-amber-700">{dm.delayed}</td>
                  <td className="py-3.5 px-4 text-center font-semibold text-emerald-700">{dm.completed}</td>
                  <td className="py-3.5 px-4 text-right">
                    <span className="text-xs font-semibold text-blue-600 hover:underline flex items-center justify-end gap-1">
                      Filter <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Corridor Inspection Modal */}
      {selectedCorridorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">{selectedCorridorModal.code} — {selectedCorridorModal.name}</h3>
                <p className="text-xs text-slate-300">Detailed Section Telemetry & Block Availability</p>
              </div>
              <button onClick={() => setSelectedCorridorModal(null)} className="p-1 text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block font-bold">Track Type:</span>
                  <span className="font-semibold text-slate-800">{selectedCorridorModal.track_type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">Length:</span>
                  <span className="font-semibold text-slate-800">{selectedCorridorModal.distance_km} km</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">Operational Status:</span>
                  <StatusBadge status={selectedCorridorModal.status} size="sm" />
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">Train Impact:</span>
                  <span className="font-bold text-red-700">{selectedCorridorModal.train_impact}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">Total Fixed Assets:</span>
                  <span className="font-bold text-slate-900">{selectedCorridorModal.total_assets} Assets</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">Open Defect Reports:</span>
                  <span className="font-bold text-blue-700">{selectedCorridorModal.open_requests} Requests</span>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/60 text-slate-700">
                <span className="font-bold block text-blue-950 mb-1">AI Corridor Assessment:</span>
                This section qualifies for <strong>Block Fusion</strong>. Multiple multi-department jobs can be scheduled in the 02:00–04:00 AM window with zero train schedule conflicts.
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const cid = selectedCorridorModal.id;
                    setSelectedCorridorModal(null);
                    navigate(`/higher/requests?corridorId=${cid}`);
                  }}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  View Corridor Requests
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCorridorModal(null)}
                  className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 font-semibold text-slate-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
