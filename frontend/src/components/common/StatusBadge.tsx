import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status = 'NORMAL', size = 'md' }) => {
  const safeStatus = typeof status === 'string' ? status : String(status || 'NORMAL');
  const normalized = safeStatus.toUpperCase().replace(/\s+/g, '_');

  let style = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';

  if (['CRITICAL', 'FAULTY', 'REJECTED', 'DANGER'].includes(normalized)) {
    style = 'bg-red-50 text-red-700 border-red-200';
    dotColor = 'bg-red-500';
  } else if (['HIGH', 'WARNING', 'DELAYED', 'DEGRADED', 'REWORK'].includes(normalized)) {
    style = 'bg-amber-50 text-amber-800 border-amber-200';
    dotColor = 'bg-amber-500';
  } else if (['NORMAL', 'APPROVED', 'COMPLETED', 'VERIFIED', 'CLOSED', 'HEALTHY', 'SUCCESS'].includes(normalized)) {
    style = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    dotColor = 'bg-emerald-500';
  } else if (['IN_PROGRESS', 'AI_RECOMMENDED', 'ACTIVE', 'INSPECTED', 'INFO'].includes(normalized)) {
    style = 'bg-blue-50 text-blue-700 border-blue-200';
    dotColor = 'bg-blue-500';
  } else if (['MCR_SUBMITTED', 'PENDING', 'NEW'].includes(normalized)) {
    style = 'bg-cyan-50 text-cyan-800 border-cyan-200';
    dotColor = 'bg-cyan-500';
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border ${padding} ${style}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
      {safeStatus.replace(/_/g, ' ')}
    </span>
  );
};
