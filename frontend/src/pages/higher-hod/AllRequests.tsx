import React, { useState, useEffect } from 'react';
import { MaintenanceRequest, Department } from '../../types';
import api from '../../api/client';
import { FALLBACK_DEPARTMENTS, FALLBACK_REQUESTS } from '../../api/fallbackData';
import { BreadcrumbContext } from '../../components/layout/BreadcrumbContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { RejectReasonModal } from '../../components/modals/RejectReasonModal';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ClipboardList,
  Check,
  XCircle,
  Clock,
  Filter,
  Bot,
  Layers,
  Search,
  Eye,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';

export const AllRequests: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deptParam = searchParams.get('department');
  const prioParam = searchParams.get('priority');

  const [requests, setRequests] = useState<MaintenanceRequest[]>(FALLBACK_REQUESTS);
  const [departments, setDepartments] = useState<Department[]>(FALLBACK_DEPARTMENTS);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDept, setSelectedDept] = useState<string>(deptParam || 'ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>(prioParam || 'ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Panels
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [targetReqForReject, setTargetReqForReject] = useState<MaintenanceRequest | null>(null);
  const [activeReqForAI, setActiveReqForAI] = useState<MaintenanceRequest | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const [rRes, dRes] = await Promise.all([
        api.get<MaintenanceRequest[]>('/requests', { params: { limit: 200 } }),
        api.get<Department[]>('/master/departments')
      ]);
      if (rRes.data && rRes.data.length > 0) setRequests(rRes.data);
      if (dRes.data && dRes.data.length > 0) setDepartments(dRes.data.filter(d => d.code !== 'ALL'));
      if (rRes.data && rRes.data.length > 0) {
        setActiveReqForAI(rRes.data[0]);
      }
    } catch {
      // Fallbacks already initialized
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      await api.post(`/requests/${id}/approve`);
      fetchRequests();
    } catch (err) {
      console.error(err);
      alert('Failed to approve request');
    }
  };

  const filtered = requests.filter((r) => {
    if (selectedDept !== 'ALL' && r.department_code !== selectedDept) return false;
    if (selectedPriority !== 'ALL' && r.priority !== selectedPriority) return false;
    if (selectedStatus !== 'ALL' && r.status !== selectedStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.problem_id.toLowerCase().includes(q) ||
        r.work_description.toLowerCase().includes(q) ||
        (r.corridor_name && r.corridor_name.toLowerCase().includes(q)) ||
        (r.asset_name && r.asset_name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <BreadcrumbContext
        title="All Department Maintenance Requests"
        subpath="Cross-Department Review, Prioritization & Higher HOD Approvals"
        actionButton={
          <button
            onClick={() => navigate('/higher/ai-planner')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Generate Plan with CP-SAT</span>
          </button>
        }
      />

      {/* Filter Ribbon */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Problem ID, corridor, or asset..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 font-semibold bg-white text-slate-700"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.code} value={d.code}>{d.name}</option>
            ))}
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 font-semibold bg-white text-slate-700"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 font-semibold bg-white text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">New</option>
            <option value="APPROVED">Approved</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DELAYED">Delayed</option>
            <option value="MCR_SUBMITTED">MCR Submitted</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Requests Table (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Maintenance Requests ({filtered.length})
            </span>
            <span className="text-xs text-slate-500">Click a row to inspect AI scoring panel</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">Problem ID</th>
                  <th className="py-3 px-3">Dept</th>
                  <th className="py-3 px-3">Corridor</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const isSelected = activeReqForAI?.id === r.id;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setActiveReqForAI(r)}
                      className={`cursor-pointer transition ${
                        isSelected ? 'bg-blue-50/80 border-l-4 border-l-blue-600' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">{r.problem_id}</td>
                      <td className="py-3 px-3 font-semibold text-slate-700">{r.department_code}</td>
                      <td className="py-3 px-3 text-slate-600 truncate max-w-[160px]">{r.corridor_name || r.corridor_code}</td>
                      <td className="py-3 px-3">
                        <StatusBadge status={r.priority} size="sm" />
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={r.status} size="sm" />
                      </td>
                      <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {['NEW', 'INSPECTED', 'AI_ANALYZED'].includes(r.status) && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApprove(r.id)}
                                className="p-1 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition"
                                title="Approve Request"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTargetReqForReject(r);
                                  setRejectModalOpen(true);
                                }}
                                className="p-1 rounded bg-red-100 hover:bg-red-200 text-red-800 transition"
                                title="Reject Request"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setActiveReqForAI(r)}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title="Inspect Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: AI Assessment & Decision Panel */}
        <div className="space-y-4">
          {activeReqForAI ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-sm text-slate-900">AI Assessment Panel</h3>
                </div>
                <span className="font-mono text-xs font-bold text-blue-700">{activeReqForAI.problem_id}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Work Description</span>
                <p className="text-xs font-bold text-slate-900 mt-0.5">{activeReqForAI.work_description}</p>
              </div>

              {/* AI Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">AI Recommended Priority</span>
                  <span className="font-bold text-red-600 text-sm">{activeReqForAI.ai_priority}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Asset Criticality</span>
                  <span className="font-bold text-slate-800 text-sm">{activeReqForAI.asset_criticality}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Train Impact</span>
                  <span className="font-bold text-amber-600 text-sm">{activeReqForAI.ai_train_impact}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Safety Risk</span>
                  <span className="font-bold text-red-600 text-sm">{activeReqForAI.safety_risk}</span>
                </div>
              </div>

              {/* Corridor & Logistics */}
              <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100 text-xs space-y-1.5 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Corridor:</span>
                  <span className="font-bold">{activeReqForAI.corridor_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Asset:</span>
                  <span className="font-bold">{activeReqForAI.asset_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Requested Window:</span>
                  <span className="font-mono font-bold">{activeReqForAI.requested_start_time} – {activeReqForAI.requested_end_time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Max Duration:</span>
                  <span className="font-bold">{activeReqForAI.max_duration_hours} Hours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Power Isolation:</span>
                  <span className="font-bold">{activeReqForAI.isolation_required ? 'Required (OHE Block)' : 'Not Required'}</span>
                </div>
              </div>

              {/* Higher HOD Decision Actions */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Higher HOD Direct Authority
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleApprove(activeReqForAI.id)}
                    className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve Request</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetReqForReject(activeReqForAI);
                      setRejectModalOpen(true);
                    }}
                    className="px-3 py-2 rounded-lg border border-red-300 hover:bg-red-50 text-red-700 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/higher/ai-planner')}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Include in AI CP-SAT Plan</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
              Select a request from the list to review AI assessment details.
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {targetReqForReject && (
        <RejectReasonModal
          isOpen={rejectModalOpen}
          onClose={() => setRejectModalOpen(false)}
          requestId={targetReqForReject.id}
          targetCode={targetReqForReject.problem_id}
          onSuccess={fetchRequests}
        />
      )}
    </div>
  );
};
