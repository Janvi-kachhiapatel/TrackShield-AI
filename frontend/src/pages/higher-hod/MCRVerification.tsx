import React, { useState, useEffect } from 'react';
import { MCRReport } from '../../types';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { BreadcrumbContext } from '../../components/layout/BreadcrumbContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { MCRVerifyModal } from '../../components/modals/MCRVerifyModal';
import {
  FileCheck,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  Clock,
  Layers,
  FileText,
  ShieldCheck,
  Shield,
  RefreshCw
} from 'lucide-react';

export const MCRVerification: React.FC = () => {
  const { user, switchUser } = useAuth();
  const [mcrs, setMcrs] = useState<MCRReport[]>([]);
  const [activeTab, setActiveTab] = useState<string>('AWAITING_VERIFICATION');
  const [loading, setLoading] = useState(true);

  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [selectedMCR, setSelectedMCR] = useState<MCRReport | null>(null);

  const isHigherHOD = user?.role === 'HIGHER_HOD' || user?.role === 'ADMIN';

  const fetchMCRs = async () => {
    setLoading(true);
    try {
      const res = await api.get<MCRReport[]>('/mcr', { params: { limit: 50 } });
      setMcrs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMCRs();
  }, []);

  const tabs = [
    { key: 'AWAITING_VERIFICATION', label: 'Pending Verification' },
    { key: 'CLOSED', label: 'Verified & Closed' },
    { key: 'REWORK', label: 'Rework' },
    { key: 'PARTIAL', label: 'Partial' },
    { key: 'ALL', label: 'All MCRs' }
  ];

  const filteredMCRs = mcrs.filter((m) => {
    if (activeTab === 'ALL') return true;
    return m.verification_status === activeTab;
  });

  return (
    <div className="space-y-6">
      <BreadcrumbContext
        title="Maintenance Completion Verification (MCR)"
        subpath="Verification Authority & Quality Gate for Infrastructure Restorations"
      />

      {/* Role Authority Banner */}
      {!isHigherHOD && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Authority Notice:</span> You are currently signed in as{' '}
              <span className="font-semibold">{user?.name} ({user?.role})</span>. MCR Verification & Closure is reserved for Higher HOD (Keval Rana).
            </div>
          </div>
          <button
            type="button"
            onClick={() => switchUser('hod001')}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 transition shrink-0 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Switch to Keval Rana (Higher HOD)</span>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          {tabs.map((tab) => {
            const count = mcrs.filter((m) => {
              if (tab.key === 'ALL') return true;
              return m.verification_status === tab.key;
            }).length;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-railway-dark text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === tab.key ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={fetchMCRs}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 text-xs transition shrink-0"
          title="Refresh MCR list"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* MCR Cards */}
      <div className="space-y-4">
        {filteredMCRs.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
            No Maintenance Completion Reports in this verification queue.
          </div>
        ) : (
          filteredMCRs.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 transition-all space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-slate-900">{m.mcr_id}</span>
                  <span className="text-xs text-slate-500 font-mono">({m.problem_id})</span>
                  <span className="text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {m.department_name}
                  </span>
                </div>
                <StatusBadge status={m.verification_status} size="sm" />
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Actual Work Performed:</span>
                <p className="text-xs font-semibold text-slate-800 mt-0.5 leading-relaxed">
                  {m.actual_work_performed}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">Corridor Section</span>
                  <span className="font-semibold text-slate-800">{m.corridor_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">Asset</span>
                  <span className="font-semibold text-slate-800">{m.asset_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">Duration vs Target</span>
                  <span className="font-mono font-bold text-blue-700">
                    {m.actual_duration_hours}h / {m.planned_commitment_hours}h
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">Commitment Met?</span>
                  <span className={`font-bold ${m.commitment_met ? 'text-emerald-700' : 'text-red-700'}`}>
                    {m.commitment_met ? '✓ Met' : '✗ Overdue'}
                  </span>
                </div>
              </div>

              {m.delay_reason && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                  <span className="font-bold">Delay Justification:</span> {m.delay_reason}
                </div>
              )}

              {m.rework_instructions && (
                <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900">
                  <span className="font-bold">Higher HOD Rework Remarks:</span> {m.rework_instructions}
                </div>
              )}

              {/* Verified By / Actions */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-500">
                  {m.verified_by_name ? (
                    <span className="text-emerald-700 font-semibold">
                      Verified by {m.verified_by_name}
                    </span>
                  ) : (
                    <span>Awaiting Higher HOD Verification</span>
                  )}
                </div>

                {m.verification_status === 'AWAITING_VERIFICATION' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMCR(m);
                      setVerifyModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify & Close / Rework</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {selectedMCR && (
        <MCRVerifyModal
          isOpen={verifyModalOpen}
          onClose={() => setVerifyModalOpen(false)}
          mcr={selectedMCR}
          onSuccess={fetchMCRs}
        />
      )}
    </div>
  );
};
