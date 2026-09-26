import React, { useState } from 'react';
import { Clock, AlertTriangle, X } from 'lucide-react';
import api from '../../api/client';

interface ReportDelayModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: number;
  problemId: string;
  onSuccess: () => void;
}

export const ReportDelayModal: React.FC<ReportDelayModalProps> = ({
  isOpen,
  onClose,
  requestId,
  problemId,
  onSuccess
}) => {
  const [reason, setReason] = useState('Equipment failure');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const delayReasons = [
    'Manpower shortage',
    'Resource unavailable',
    'Equipment failure',
    'Safety issue',
    'Unexpected asset damage',
    'Train operation',
    'Weather',
    'Other'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarks.trim()) {
      alert('Delay remarks are mandatory to notify the Higher HOD.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/requests/${requestId}/delay`, {
        delay_reason: reason,
        delay_remarks: remarks
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to report delay');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-100" />
            <h3 className="font-bold text-base">Report Maintenance Delay ({problemId})</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-amber-100 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
            <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
            <span>
              Submitting this report immediately marks the job as <strong>DELAYED</strong> and dispatches an alert to the <strong>Higher HOD</strong>.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason for Delay *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              {delayReasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Delay Remarks & Details *
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Specify the cause of the delay, current on-site conditions, and estimated time recovery..."
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              required
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition flex items-center gap-2"
            >
              {submitting ? 'Submitting...' : 'Submit & Notify Higher HOD'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
