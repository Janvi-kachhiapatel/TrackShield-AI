import React, { useState, useEffect } from 'react';
import { MaintenanceBlock } from '../../types';
import api from '../../api/client';
import { BreadcrumbContext } from '../../components/layout/BreadcrumbContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { RejectReasonModal } from '../../components/modals/RejectReasonModal';
import {
  TrafficCone,
  Check,
  XCircle,
  Sliders,
  GitMerge,
  Split,
  Layers,
  Clock,
  Shield,
  Train
} from 'lucide-react';

export const BlockManagement: React.FC = () => {
  const [blocks, setBlocks] = useState<MaintenanceBlock[]>([]);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [targetBlockId, setTargetBlockId] = useState<number | null>(null);

  const fetchBlocks = async () => {
    setLoading(true);
    try {
      const res = await api.get<MaintenanceBlock[]>('/blocks', { params: { limit: 50 } });
      setBlocks(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlocks();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      await api.post(`/blocks/${id}/approve`);
      alert('Block Approved and Broadcasted to Lower HODs!');
      fetchBlocks();
    } catch (err) {
      console.error(err);
      alert('Failed to approve block');
    }
  };

  const tabs = [
    'ALL',
    'AI_RECOMMENDED',
    'APPROVED',
    'ACTIVE',
    'COMPLETED',
    'PENDING',
    'CANCELLED'
  ];

  const filteredBlocks = blocks.filter((b) => {
    if (activeTab === 'ALL') return true;
    return b.status === activeTab;
  });

  return (
    <div className="space-y-6">
      <BreadcrumbContext
        title="Corridor Maintenance Block Management"
        subpath="Block Lifecycle Oversight, Merging, Splitting & Operational Authorization"
      />

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs flex items-center gap-1.5 overflow-x-auto">
        {tabs.map((tab) => {
          const count = blocks.filter((b) => {
            if (tab === 'ALL') return true;
            return b.status === tab;
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

      {/* Blocks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredBlocks.map((b) => (
          <div
            key={b.id}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-extrabold text-blue-900">{b.block_id}</span>
                  <span className="text-xs text-slate-500 font-semibold">({b.jobs_count} Combined Jobs)</span>
                </div>
                <StatusBadge status={b.status} size="sm" />
              </div>

              <div className="mt-3 space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Corridor Section</span>
                  <span className="font-bold text-slate-900 text-sm">{b.corridor_name || b.corridor_code}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Window</span>
                    <span className="font-mono font-bold text-blue-700">{b.start_time} – {b.end_time}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Duration</span>
                    <span className="font-bold text-slate-800">{b.duration_hours} Hours</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Departments Involved</span>
                    <span className="font-semibold text-slate-800">{b.departments?.join(' + ') || 'Electrical'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Train Impact</span>
                    <span className="font-bold text-emerald-700">{b.train_impact}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                  <span className="font-bold text-slate-700 block">Isolation:</span> {b.isolation_type}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => alert(`Merge Block ${b.block_id}:\nSelect adjacent corridor block to merge.`)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1 transition"
                  title="Merge Blocks"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  <span>Merge</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert(`Split Block ${b.block_id}:\nSplits multi-department job into separate slots.`)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1 transition"
                  title="Split Block"
                >
                  <Split className="w-3.5 h-3.5" />
                  <span>Split</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {['AI_RECOMMENDED', 'PENDING'].includes(b.status) && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetBlockId(b.id);
                        setRejectModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-red-300 hover:bg-red-50 text-red-700 text-xs font-bold transition flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(b.id)}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve Block</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {targetBlockId && (
        <RejectReasonModal
          isOpen={rejectModalOpen}
          onClose={() => setRejectModalOpen(false)}
          blockId={targetBlockId}
          targetCode={`Block #${targetBlockId}`}
          onSuccess={fetchBlocks}
        />
      )}
    </div>
  );
};
