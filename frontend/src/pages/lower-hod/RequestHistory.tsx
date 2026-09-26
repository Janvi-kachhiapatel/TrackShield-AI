import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MaintenanceRequest } from '../../types';
import api from '../../api/client';
import { FALLBACK_REQUESTS } from '../../api/fallbackData';
import { BreadcrumbContext } from '../../components/layout/BreadcrumbContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  History,
  Filter,
  CheckCircle2,
  Clock,
  ChevronRight,
  Eye,
  Calendar,
  Layers,
  X
} from 'lucide-react';

export const RequestHistory: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MaintenanceRequest[]>(() => {
    const deptId = user?.department_id;
    if (deptId && deptId !== 6) {
      const filtered = FALLBACK_REQUESTS.filter(r => Number(r.department_id) === Number(deptId));
      return filtered.length > 0 ? filtered : FALLBACK_REQUESTS;
    }
    return FALLBACK_REQUESTS;
  });
  const [loading, setLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected for full 9-stage timeline modal
  const [selectedReq, setSelectedReq] = useState<MaintenanceRequest | null>(null);

  useEffect(() => {
    setLoading(true);
    api.get<MaintenanceRequest[]>('/requests', {
      params: { department_id: user?.department_id, limit: 100 }
    }).then(res => {
      if (res.data && Array.isArray(res.data)) {
        setRequests(res.data);
      }
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.department_id]);

  const filteredRequests = requests.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && r.priority !== priorityFilter) return false;
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

  // 9-Stage Timeline Definition
  const timelineStages = [
    { key: 'REPORTED', label: 'Reported', desc: 'Lower HOD submitted defect report' },
    { key: 'INSPECTED', label: 'Inspected', desc: 'Track gang visual & gauge inspection completed' },
    { key: 'AI_ANALYZED', label: 'AI Analysed', desc: 'Priority, Safety, and Duration scored by AI' },
    { key: 'HOD_REVIEWED', label: 'Higher HOD Reviewed', desc: 'Prioritized & queued for block scheduling' },
    { key: 'SCHEDULED', label: 'Scheduled', desc: 'CP-SAT generated conflict-free block plan' },
    { key: 'WORK_STARTED', label: 'Work Started', desc: 'Actual start time stamped & gang deployed' },
    { key: 'MCR_SUBMITTED', label: 'MCR Submitted', desc: 'Field restoration report & test logs uploaded' },
    { key: 'VERIFIED', label: 'Verified', desc: 'Higher HOD reviewed safety & measurements' },
    { key: 'CLOSED', label: 'Closed', desc: 'Asset restored to operational availability' },
  ];

  const getStageIndex = (status: string) => {
    switch (status) {
      case 'NEW': return 0;
      case 'INSPECTED': return 1;
      case 'AI_ANALYZED': return 2;
      case 'APPROVED': return 4;
      case 'IN_PROGRESS':
      case 'DELAYED': return 5;
      case 'MCR_SUBMITTED': return 6;
      case 'VERIFIED': return 7;
      case 'CLOSED': return 8;
      case 'REWORK': return 6; // sent back for rework
      case 'REJECTED': return 3;
      default: return 0;
    }
  };

  return (
    <div className="space-y-6">
      <BreadcrumbContext
        title="Request History & Audit Timeline"
        subpath="Archival Records & Full 9-Stage Maintenance Timeline"
      />

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <input
            type="text"
            placeholder="Search by Problem ID, Asset, Corridor, or Description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-bold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">New</option>
              <option value="APPROVED">Approved</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DELAYED">Delayed</option>
              <option value="MCR_SUBMITTED">MCR Submitted</option>
              <option value="CLOSED">Closed</option>
              <option value="REWORK">Rework</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-bold">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-medium"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Problem ID</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Asset</th>
                <th className="py-3 px-4">Corridor</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Reported Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Audit Timeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedReq(r)}
                  className="hover:bg-blue-50/50 cursor-pointer transition"
                >
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{r.problem_id}</td>
                  <td className="py-3 px-4 font-medium text-slate-700">{r.department_name}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{r.asset_name}</td>
                  <td className="py-3 px-4 text-slate-600 truncate max-w-[180px]">{r.corridor_name || r.corridor_code}</td>
                  <td className="py-3 px-4">
                    <StatusBadge status={r.priority} size="sm" />
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-mono">{r.requested_date}</td>
                  <td className="py-3 px-4">
                    <StatusBadge status={r.status} size="sm" />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition"
                    >
                      View 9-Stage Flow
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 9-Stage Interactive Timeline Modal */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-blue-400">{selectedReq.problem_id}</span>
                  <StatusBadge status={selectedReq.status} size="sm" />
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {selectedReq.department_name} • {selectedReq.corridor_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedReq(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-700 uppercase tracking-wider block">Description:</span>
                <p className="text-slate-800 text-sm mt-0.5">{selectedReq.work_description}</p>
                <div className="mt-2 text-[11px] text-slate-500">
                  Asset: {selectedReq.asset_name} | Priority: {selectedReq.priority} | Scheduled: {selectedReq.requested_start_time}–{selectedReq.requested_end_time}
                </div>
              </div>

              {/* Complete 9-Stage Timeline */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">
                  Full 9-Stage Life Cycle Progression
                </h4>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {timelineStages.map((stage, idx) => {
                    const currentStageIdx = getStageIndex(selectedReq.status);
                    const isPassed = idx < currentStageIdx || selectedReq.status === 'CLOSED';
                    const isCurrent = idx === currentStageIdx && selectedReq.status !== 'CLOSED';

                    let circleClass = 'bg-slate-200 text-slate-500';
                    if (isPassed) circleClass = 'bg-emerald-600 text-white ring-4 ring-emerald-100';
                    else if (isCurrent) circleClass = 'bg-blue-600 text-white ring-4 ring-blue-100 animate-pulse';

                    return (
                      <div key={stage.key} className="relative flex items-start gap-3">
                        <div className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${circleClass}`}>
                          {isPassed ? '✓' : idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${isCurrent ? 'text-blue-900' : (isPassed ? 'text-slate-800' : 'text-slate-400')}`}>
                              {stage.label}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                                Current State
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{stage.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                onClick={() => setSelectedReq(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-semibold text-slate-700"
              >
                Close Audit Timeline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
