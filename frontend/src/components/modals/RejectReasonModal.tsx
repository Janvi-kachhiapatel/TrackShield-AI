import React, { useState } from 'react';
import { XCircle, X } from 'lucide-react';
import api from '../../api/client';

interface RejectReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId?: number;
  blockId?: number;
  targetCode: string;
  onSuccess: () => void;
}

export const RejectReasonModal: React.FC<RejectReasonModalProps> = ({
  isOpen,
  onClose,
  requestId,
  blockId,
  targetCode,
  onSuccess
}) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('A clear operational rejection reason is mandatory.');
      return;
    }

    setSubmitting(true);
    try {
      if (requestId) {
        await api.post(`/requests/${requestId}/reject`, { reject_reason: reason });
      } else if (blockId) {
        await api.post(`/blocks/${blockId}/reject`, { reason });
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to reject item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-red-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-100" />
            <h3 className="font-bold text-base">Reject {targetCode}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-red-100 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600">
            Higher HOD authority requires recording an official reason in the audit logs. The relevant department will be formally notified.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Why are you rejecting this request? *
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Conflict with scheduled Vande Bharat movement; re-submit with 03:30 AM window..."
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
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
              className="px-5 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition flex items-center gap-2"
            >
              {submitting ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
