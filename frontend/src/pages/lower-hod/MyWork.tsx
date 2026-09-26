import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MaintenanceRequest, RequestStatus } from '../../types';
import api from '../../api/client';
import { FALLBACK_REQUESTS } from '../../api/fallbackData';
import { BreadcrumbContext } from '../../components/layout/BreadcrumbContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ReportDelayModal } from '../../components/modals/ReportDelayModal';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Calendar,
  Layers,
  Check,
  TrendingUp
} from 'lucide-react';

export const MyWork: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [requests, setRequests] = useState<MaintenanceRequest[]>(() => {
    const deptId = user?.department_id;
    if (deptId && deptId !== 6) {
      const filtered = FALLBACK_REQUESTS.filter(r => Number(r.department_id) === Number(deptId));
      return filtered.length > 0 ? filtered : FALLBACK_REQUESTS;
    }
    return FALLBACK_REQUESTS;
  });
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);

  // Modal states
  const [delayModalOpen, setDelayModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<MaintenanceRequest | null>(null);

  // Selected for full detail modal
  const [detailReq, setDetailReq] = useState<MaintenanceRequest | null>(null);

  const fetchWork = async () => {
    setLoading(true);
    try {
      const res = await api.get<MaintenanceRequest[]>('/requests', {
        params: { department_id: user?.department_id }
      });
      if (res.data && Array.isArray(res.data)) {
        setRequests(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWork();
  }, [user?.department_id]);

  const handleStartWork = async (id: number) => {
    try {
      await api.post(`/requests/${id}/start`);
      fetchWork();
    } catch (err) {
      console.error(err);
      alert('Failed to start work');
    }
  };

  const handleProgressChange = async (id: number, percent: number) => {
    try {
      await api.post(`/requests/${id}/progress`, {
        progress_percent: percent,
        remarks: `Progress updated on track by Lower HOD to ${percent}%`
      });
      fetchWork();
    } catch (err) {
      console.error(err);
      alert('Failed to update progress');
    }
  };

  const tabs = [
    'ALL',
    'PENDING',
    'APPROVED',
    'IN_PROGRESS',
    'DELAYED',
    'COMPLETED',
    'REWORK'
  ];

  const filteredRequests = requests.filter((r) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'PENDING') return ['NEW', 'INSPECTED', 'AI_ANALYZED'].includes(r.status);
    if (activeTab === 'COMPLETED') return ['MCR_SUBMITTED', 'VERIFIED', 'CLOSED'].includes(r.status);
    return r.status === activeTab;
  });

  return (
    <div className="space-y-6">
      <BreadcrumbContext
        title="My Maintenance Work"
        subpath="Assigned Maintenance Requests & Real-Time Track Execution"
      />

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs flex items-center gap-1.5 overflow-x-auto">
        {tabs.map((tab) => {
          const count = requests.filter((r) => {
            if (tab === 'ALL') return true;
            if (tab === 'PENDING') return ['NEW', 'INSPECTED', 'AI_ANALYZED'].includes(r.status);
            if (tab === 'COMPLETED') return ['MCR_SUBMITTED', 'VERIFIED', 'CLOSED'].includes(r.status);
            return r.status === tab;
          }).length;

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-railway-dark text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{tab.replace('_', ' ')}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === tab ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-700'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Work Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredRequests.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-xl border border-slate-200 p-8">
            <Layers className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No maintenance requests found in this tab</p>
            <p className="text-xs text-slate-400 mt-1">Select another filter tab or report a new problem.</p>
          </div>
        ) : (
          filteredRequests.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header: ID, Priority, Status */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900">{r.problem_id}</span>
                    <span className="text-xs text-slate-500 font-medium">({r.department_name})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={r.priority} size="sm" />
                    <StatusBadge status={r.status} size="sm" />
                  </div>
                </div>

                {/* Description & Asset */}
                <div className="mt-3">
                  <h4 className="text-sm font-bold text-slate-900">{r.work_description}</h4>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Corridor</span>
                      <span className="font-semibold text-slate-800">{r.corridor_name || r.corridor_code}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Asset</span>
                      <span className="font-semibold text-slate-800">{r.asset_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Scheduled Window</span>
                      <span className="font-semibold text-slate-800 font-mono">
                        {r.requested_start_time} – {r.requested_end_time} ({r.max_duration_hours}h)
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Actual Start Time</span>
                      <span className="font-semibold font-mono text-blue-700">
                        {r.actual_start_time || 'Not started yet'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Progress Bar if IN_PROGRESS */}
                {(r.status === 'IN_PROGRESS' || r.progress_percent > 0) && (
                  <div className="mt-4 p-3 bg-blue-50/60 border border-blue-100 rounded-lg">
                    <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                      <span className="text-blue-900 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                        Live Track Progress
                      </span>
                      <span className="font-bold text-blue-700">{r.progress_percent}%</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 transition-all duration-300 rounded-full"
                        style={{ width: `${r.progress_percent}%` }}
                      ></div>
                    </div>

                    {/* Interactive Step Slider Buttons */}
                    {r.status === 'IN_PROGRESS' && (
                      <div className="flex justify-between items-center gap-1 mt-2 text-[10px] font-bold">
                        {[0, 25, 50, 75, 100].map((stepVal) => (
                          <button
                            key={stepVal}
                            type="button"
                            onClick={() => handleProgressChange(r.id, stepVal)}
                            className={`px-2 py-0.5 rounded border transition ${
                              r.progress_percent === stepVal
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100'
                            }`}
                          >
                            {stepVal}%
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Delay reason display if delayed */}
                {r.status === 'DELAYED' && (
                  <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                    <span className="font-bold">Delayed:</span> {r.delay_reason} — {r.delay_remarks}
                  </div>
                )}

                {/* Rework instructions display if rework */}
                {r.status === 'REWORK' && (
                  <div className="mt-3 p-2.5 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900">
                    <span className="font-bold">Higher HOD Rework Order:</span> {r.rework_remarks || 'Inspection failed verification.'}
                  </div>
                )}
              </div>

              {/* Card Actions */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setDetailReq(r)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Details</span>
                </button>

                <div className="flex items-center gap-2">
                  {/* START WORK BUTTON */}
                  {r.status === 'APPROVED' && (
                    <button
                      type="button"
                      onClick={() => handleStartWork(r.id)}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>START WORK</span>
                    </button>
                  )}

                  {/* REPORT DELAY BUTTON */}
                  {['APPROVED', 'IN_PROGRESS'].includes(r.status) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReq(r);
                        setDelayModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>REPORT DELAY</span>
                    </button>
                  )}

                  {/* COMPLETE WORK (TRIGGERS MCR) */}
                  {(r.status === 'IN_PROGRESS' || r.status === 'DELAYED' || r.status === 'REWORK') && (
                    <button
                      type="button"
                      onClick={() => navigate(`/lower/mcr?requestId=${r.id}`)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>COMPLETE WORK</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delay Modal */}
      {selectedReq && (
        <ReportDelayModal
          isOpen={delayModalOpen}
          onClose={() => setDelayModalOpen(false)}
          requestId={selectedReq.id}
          problemId={selectedReq.problem_id}
          onSuccess={fetchWork}
        />
      )}

      {/* Detail Modal */}
      {detailReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">{detailReq.problem_id}</h3>
                <p className="text-xs text-slate-300">{detailReq.department_name}</p>
              </div>
              <button onClick={() => setDetailReq(null)} className="p-1 rounded text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <span className="font-bold text-slate-700 uppercase tracking-wider block">Description:</span>
                <p className="text-slate-800 text-sm mt-0.5">{detailReq.work_description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block font-bold">Corridor:</span>
                  <span className="font-semibold text-slate-800">{detailReq.corridor_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">Asset:</span>
                  <span className="font-semibold text-slate-800">{detailReq.asset_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">Safety Risk:</span>
                  <span className="font-semibold text-red-700">{detailReq.safety_risk}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">Isolation Needed:</span>
                  <span className="font-semibold text-slate-800">{detailReq.isolation_required ? 'YES (Power Block)' : 'NO'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">Manpower Deployed:</span>
                  <span className="font-semibold text-slate-800">{detailReq.manpower_required} Technicians</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">Equipment:</span>
                  <span className="font-semibold text-slate-800">{detailReq.resources_required}</span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-700 uppercase tracking-wider block">Field Inspection Remarks:</span>
                <p className="text-slate-600 mt-0.5">{detailReq.inspection_remarks || 'None recorded'}</p>
              </div>

              <div className="pt-2 text-right">
                <button
                  onClick={() => setDetailReq(null)}
                  className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 font-semibold text-slate-700"
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
