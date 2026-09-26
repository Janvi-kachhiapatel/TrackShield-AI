import React, { useState, useEffect } from 'react';
import { MCRReport } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2, RotateCcw, AlertTriangle, X, Shield, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../../api/client';

interface MCRVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  mcr: MCRReport | null;
  onSuccess: () => void;
}

export const MCRVerifyModal: React.FC<MCRVerifyModalProps> = ({
  isOpen,
  onClose,
  mcr,
  onSuccess
}) => {
  const { user, switchUser } = useAuth();
  const [action, setAction] = useState<'CLOSE' | 'REWORK' | 'PARTIAL'>('CLOSE');
  const [reworkInstructions, setReworkInstructions] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reset states when modal opens with a new MCR
  useEffect(() => {
    if (isOpen) {
      setAction('CLOSE');
      setReworkInstructions('');
      setRemarks('');
      setErrorMsg(null);
      setSuccessMsg(null);
      setSubmitting(false);
    }
  }, [isOpen, mcr?.id]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen || !mcr) return null;

  const isHigherHOD = user?.role === 'HIGHER_HOD' || user?.role === 'ADMIN';

  const handleVerify = async () => {
    if (action === 'REWORK' && !reworkInstructions.trim()) {
      setErrorMsg('Rework instructions are mandatory when sending an MCR back.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Server-side role check enforces authority; the signed bearer token
      // identifies the caller. No manual Authorization header is injected here.
      await api.post(`/mcr/${mcr.id}/verify`, {
        action,
        rework_instructions: reworkInstructions,
        remarks: remarks.trim() || (action === 'CLOSE' ? 'Verified on track inspection console, all clearances signed.' : '')
      });

      setSuccessMsg(
        action === 'CLOSE'
          ? `✓ MCR ${mcr.mcr_id} successfully verified & closed! Asset restored to HEALTHY.`
          : (action === 'REWORK'
            ? `⚠️ MCR ${mcr.mcr_id} returned to Lower HOD for rework.`
            : `ℹ️ MCR ${mcr.mcr_id} marked as partially completed.`)
      );

      // Brief pause to display success banner before closing modal
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 900);
    } catch (err: any) {
      console.error('Verification error:', err);
      const detail = err.response?.data?.detail || err.message || 'Verification submission failed. Please try again.';
      setErrorMsg(detail);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Verify MCR: {mcr.mcr_id}</h3>
              <p className="text-xs text-slate-300">
                {mcr.department_name} • {mcr.problem_id} • {mcr.corridor_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Authority Indicator */}
          <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-700 shrink-0" />
              <div>
                <span className="font-bold">Verification Authority:</span>{' '}
                <span>Keval Rana (Higher HOD / Chief Operating Manager)</span>
              </div>
            </div>
            {!isHigherHOD && (
              <button
                type="button"
                onClick={() => switchUser('hod001')}
                className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] flex items-center gap-1 transition shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Switch to Keval Rana</span>
              </button>
            )}
          </div>

          {/* Success Banner */}
          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">Error:</span> {errorMsg}
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-red-500 hover:text-red-700 text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Summary Box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div>
              <span className="font-bold text-slate-700">Actual Work Performed:</span>
              <p className="text-slate-600 mt-0.5">{mcr.actual_work_performed}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
              <div>
                <span className="text-slate-500">Duration:</span>{' '}
                <span className="font-bold">{mcr.actual_duration_hours} hrs</span> (Commitment: {mcr.planned_commitment_hours} hrs)
              </div>
              <div>
                <span className="text-slate-500">Commitment Met:</span>{' '}
                <span className={`font-bold ${mcr.commitment_met ? 'text-emerald-700' : 'text-red-700'}`}>
                  {mcr.commitment_met ? '✓ YES' : '✗ NO'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Safety Clearance:</span>{' '}
                <span className="font-bold text-emerald-700">{mcr.safety_clearance ? '✓ Cleared' : 'Pending'}</span>
              </div>
              <div>
                <span className="text-slate-500">Asset Restored:</span>{' '}
                <span className="font-bold text-emerald-700">{mcr.asset_restored}</span>
              </div>
            </div>
          </div>

          {/* Verification Decision Radios */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Higher HOD Verification Decision *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAction('CLOSE')}
                className={`p-3 rounded-xl border text-center font-bold text-xs flex flex-col items-center gap-1.5 transition ${
                  action === 'CLOSE'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>CLOSE REQUEST</span>
                <span className="text-[10px] font-normal text-slate-500">Mark complete & restore asset</span>
              </button>

              <button
                type="button"
                onClick={() => setAction('REWORK')}
                className={`p-3 rounded-xl border text-center font-bold text-xs flex flex-col items-center gap-1.5 transition ${
                  action === 'REWORK'
                    ? 'border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <RotateCcw className="w-5 h-5 text-amber-600" />
                <span>SEND FOR REWORK</span>
                <span className="text-[10px] font-normal text-slate-500">Requires correction</span>
              </button>

              <button
                type="button"
                onClick={() => setAction('PARTIAL')}
                className={`p-3 rounded-xl border text-center font-bold text-xs flex flex-col items-center gap-1.5 transition ${
                  action === 'PARTIAL'
                    ? 'border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <AlertTriangle className="w-5 h-5 text-blue-600" />
                <span>MARK PARTIAL</span>
                <span className="text-[10px] font-normal text-slate-500">Partial work accepted</span>
              </button>
            </div>
          </div>

          {action === 'REWORK' && (
            <div>
              <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-1.5">
                Mandatory Rework Instructions for Lower HOD *
              </label>
              <textarea
                rows={3}
                value={reworkInstructions}
                onChange={(e) => setReworkInstructions(e.target.value)}
                placeholder="Specify what inspections, torques, tests, or documentation failed and must be redone..."
                className="w-full px-3.5 py-2 rounded-lg border border-amber-300 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Verification Remarks (Optional)
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g., Verified on track inspection console, all clearances signed."
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || !!successMsg}
              onClick={handleVerify}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold text-white transition flex items-center gap-2 shadow-sm ${
                action === 'CLOSE'
                  ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                  : (action === 'REWORK' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700')
              } ${submitting ? 'opacity-80 cursor-wait' : ''}`}
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{action === 'CLOSE' ? 'Confirm: CLOSE REQUEST' : (action === 'REWORK' ? 'Confirm: SEND FOR REWORK' : 'Confirm: MARK PARTIAL')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

