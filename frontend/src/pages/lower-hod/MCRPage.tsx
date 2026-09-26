import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MaintenanceRequest, MCRReport } from '../../types';
import api from '../../api/client';
import { FALLBACK_REQUESTS } from '../../api/fallbackData';
import { BreadcrumbContext } from '../../components/layout/BreadcrumbContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  FileCheck,
  ShieldCheck,
  ArrowRight,
  UserCheck,
  Info,
  Layers
} from 'lucide-react';

export const MCRPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const prefillRequestId = searchParams.get('requestId');

  const [requests, setRequests] = useState<MaintenanceRequest[]>(FALLBACK_REQUESTS);
  const [submittedMCRs, setSubmittedMCRs] = useState<MCRReport[]>([]);
  const [selectedReqId, setSelectedReqId] = useState<number | ''>('');

  // MCR Form Fields
  const [actualWorkPerformed, setActualWorkPerformed] = useState('Replaced damaged porcelain insulator skirt on mast 24/18. Contact wire re-tensioned to 1000 daN. Resistance verified < 0.05 ohms.');
  const [workStatus, setWorkStatus] = useState('Completed');
  const [manpowerDeployed, setManpowerDeployed] = useState(6);
  const [resourcesUsed, setResourcesUsed] = useState('Tower Wagon TW-04, 5kV Megger Tester, High-Voltage Earthing Rods');
  const [actualStartTime, setActualStartTime] = useState('02:05 AM');
  const [actualCompletionTime, setActualCompletionTime] = useState('02:42 AM');
  const [actualDurationHours, setActualDurationHours] = useState(1.6);
  const [plannedCommitmentHours, setPlannedCommitmentHours] = useState(2.0);
  const [delayReason, setDelayReason] = useState('');
  const [safetyClearance, setSafetyClearance] = useState(true);
  const [assetRestored, setAssetRestored] = useState('YES');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Fetch requests ready for MCR
    api.get<MaintenanceRequest[]>('/requests', { params: { department_id: user?.department_id } })
      .then(res => {
        const data = res.data && Array.isArray(res.data) && res.data.length > 0 ? res.data : FALLBACK_REQUESTS;
        setRequests(data);
        if (prefillRequestId) {
          const matched = data.find(r => r.id === Number(prefillRequestId));
          if (matched) {
            setSelectedReqId(matched.id);
            setPlannedCommitmentHours(matched.max_duration_hours);
            if (matched.actual_start_time) setActualStartTime(matched.actual_start_time);
          }
        } else {
          const cand = data.find(r => ['IN_PROGRESS', 'APPROVED', 'DELAYED', 'NEW'].includes(r.status));
          if (cand) {
            setSelectedReqId(cand.id);
            setPlannedCommitmentHours(cand.max_duration_hours);
            if (cand.actual_start_time) setActualStartTime(cand.actual_start_time);
          }
        }
      }).catch(() => {
        setRequests(FALLBACK_REQUESTS);
        if (FALLBACK_REQUESTS.length > 0) {
          setSelectedReqId(FALLBACK_REQUESTS[0].id);
          setPlannedCommitmentHours(FALLBACK_REQUESTS[0].max_duration_hours);
        }
      });

    // Fetch existing MCRs
    api.get<MCRReport[]>('/mcr', { params: { department_id: user?.department_id } })
      .then(res => {
        if (res.data && Array.isArray(res.data)) setSubmittedMCRs(res.data);
      })
      .catch(() => {});
  }, [user?.department_id, prefillRequestId]);

  const selectedRequest = requests.find(r => r.id === selectedReqId);

  // Auto-calculated commitment
  const commitmentMet = actualDurationHours <= plannedCommitmentHours;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReqId) {
      alert('Please select an active maintenance request.');
      return;
    }

    if (!commitmentMet && !delayReason.trim()) {
      alert('Commitment window exceeded: Delay reason is mandatory.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/mcr', {
        request_id: selectedReqId,
        actual_work_performed: actualWorkPerformed,
        work_status: workStatus,
        manpower_deployed: manpowerDeployed,
        resources_used: resourcesUsed,
        actual_start_time: actualStartTime,
        actual_completion_time: actualCompletionTime,
        actual_duration_hours: actualDurationHours,
        planned_commitment_hours: plannedCommitmentHours,
        delay_reason: commitmentMet ? null : delayReason,
        safety_clearance: safetyClearance,
        asset_restored: assetRestored,
        supporting_docs: [
          { name: 'Before_Maintenance_Defect.jpg', size: '1.4 MB', type: 'image' },
          { name: 'After_Restoration_Photo.jpg', size: '1.9 MB', type: 'image' },
          { name: 'Field_Megger_Insulation_Test_Report.pdf', size: '640 KB', type: 'pdf' },
          { name: 'Safety_Grounding_Clearance_Slip.pdf', size: '420 KB', type: 'pdf' }
        ]
      });

      alert('MCR Submitted Successfully!\nStatus: Awaiting Higher HOD Verification.');
      // Refresh MCRs
      const mRes = await api.get<MCRReport[]>('/mcr', { params: { department_id: user?.department_id } });
      setSubmittedMCRs(mRes.data);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to submit MCR');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <BreadcrumbContext
        title="Maintenance Completion Report (MCR)"
        subpath="Submit Actual Completed Track Work for Higher HOD Verification"
      />

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900">
          Department Maintenance Completion Protocol
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Lower HOD reports field execution parameters. Final closure requires verification by Higher HOD.
        </p>
      </div>

      {/* Submission Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-base">New Maintenance Completion Report</h3>
          </div>
          <span className="text-xs font-mono text-slate-300">ID: MCR-2026-[AUTO]</span>
        </div>

        <div className="p-6 space-y-4">
          {/* Target Problem Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Maintenance Request to Complete *
            </label>
            <select
              value={selectedReqId}
              onChange={(e) => {
                const id = Number(e.target.value);
                setSelectedReqId(id);
                const r = requests.find(item => item.id === id);
                if (r) {
                  setPlannedCommitmentHours(r.max_duration_hours);
                  if (r.actual_start_time) setActualStartTime(r.actual_start_time);
                }
              }}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            >
              <option value="">-- Choose Assigned Request --</option>
              {requests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.problem_id} — {r.work_description.slice(0, 45)}... ({r.corridor_name || r.corridor_code}) [{r.status}]
                </option>
              ))}
            </select>
          </div>

          {selectedRequest && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block font-bold">Corridor:</span>
                <span className="font-semibold text-slate-800">{selectedRequest.corridor_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold">Asset:</span>
                <span className="font-semibold text-slate-800">{selectedRequest.asset_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold">Priority:</span>
                <span className="font-bold text-amber-700">{selectedRequest.priority}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Actual Work Performed & Technical Restoration *
            </label>
            <textarea
              rows={3}
              value={actualWorkPerformed}
              onChange={(e) => setActualWorkPerformed(e.target.value)}
              placeholder="Detail the technical actions taken, component replacements, torque values, and test measurements..."
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Work Status *
              </label>
              <select
                value={workStatus}
                onChange={(e) => setWorkStatus(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Completed">Completed</option>
                <option value="Partially Completed">Partially Completed</option>
                <option value="Not Completed">Not Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Manpower Deployed (Technicians) *
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={manpowerDeployed}
                onChange={(e) => setManpowerDeployed(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Resources & Machinery Used *
            </label>
            <input
              type="text"
              value={resourcesUsed}
              onChange={(e) => setResourcesUsed(e.target.value)}
              placeholder="e.g., Tower Wagon TW-04, Testing Equipment, Grounding Kit..."
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          {/* Timing & Commitment */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Actual Start Time *
              </label>
              <input
                type="text"
                value={actualStartTime}
                onChange={(e) => setActualStartTime(e.target.value)}
                placeholder="01:08 AM"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Actual Completion Time *
              </label>
              <input
                type="text"
                value={actualCompletionTime}
                onChange={(e) => setActualCompletionTime(e.target.value)}
                placeholder="02:42 AM"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Actual Duration (Hours) *
              </label>
              <input
                type="number"
                step="0.1"
                value={actualDurationHours}
                onChange={(e) => setActualDurationHours(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold"
                required
              />
            </div>
          </div>

          {/* Auto Commitment Calculation Display */}
          <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
            commitmentMet ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'
          }`}>
            <div className="flex items-center gap-2 font-bold">
              {commitmentMet ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
              <span>Planned Commitment: {plannedCommitmentHours}h | Actual Duration: {actualDurationHours}h</span>
            </div>
            <span className="font-extrabold px-2.5 py-0.5 rounded bg-white shadow-xs">
              Commitment Met? {commitmentMet ? '✓ YES' : '✗ NO'}
            </span>
          </div>

          {!commitmentMet && (
            <div>
              <label className="block text-xs font-bold text-red-700 uppercase tracking-wider mb-1">
                Delay Reason (Mandatory when Commitment Not Met) *
              </label>
              <textarea
                rows={2}
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                placeholder="Explain why the work exceeded the maximum duration commitment..."
                className="w-full px-3.5 py-2 rounded-lg border border-red-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={safetyClearance}
                  onChange={(e) => setSafetyClearance(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span>Safety Clearance Obtained & Certified</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Asset Restored to Service? *
              </label>
              <select
                value={assetRestored}
                onChange={(e) => setAssetRestored(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="YES">YES — Fully Functional</option>
                <option value="PARTIALLY">PARTIALLY — Speed Restriction Imposed</option>
                <option value="NO">NO — Faulty</option>
              </select>
            </div>
          </div>

          {/* Documents upload mockup */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-slate-400" />
              <span>Attached: 2 site photos, 1 dielectric megger log, 1 safety clearance slip.</span>
            </div>
            <span className="font-semibold text-emerald-700">4 Files Verified</span>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              <strong>Authority Notice:</strong> Lower HOD submits this report. Final verification and closure authority rests exclusively with the <strong>Higher HOD</strong>.
            </span>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">* Lower HOD does not have closure authority</span>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm"
          >
            {submitting ? 'Submitting...' : 'Submit MCR (Send to Higher HOD)'}
          </button>
        </div>
      </form>

      {/* Submitted MCRs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-600" />
            <h3 className="font-bold text-sm text-slate-900">Submitted Maintenance Completion Reports</h3>
          </div>
          <span className="text-xs text-slate-500">{submittedMCRs.length} Total</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">MCR ID</th>
                <th className="py-3 px-4">Problem ID</th>
                <th className="py-3 px-4">Corridor</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Commitment</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Verified By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {submittedMCRs.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{m.mcr_id}</td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-700">{m.problem_id}</td>
                  <td className="py-3 px-4 text-slate-600 truncate max-w-[180px]">{m.corridor_name}</td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-800">{m.actual_duration_hours}h</td>
                  <td className="py-3 px-4">
                    <span className={`font-bold ${m.commitment_met ? 'text-emerald-700' : 'text-red-700'}`}>
                      {m.commitment_met ? '✓ Met' : '✗ Delayed'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={m.verification_status} size="sm" />
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {m.verified_by_name || 'Pending Higher HOD'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
