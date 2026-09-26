import React from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: 'default' | 'critical' | 'warning' | 'success' | 'info';
  onClick?: () => void;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon,
  variant = 'default',
  onClick
}) => {
  let borderStyle = 'border-slate-200 hover:border-slate-300';
  let iconBg = 'bg-slate-100 text-slate-700';

  if (variant === 'critical') {
    borderStyle = 'border-red-200 hover:border-red-300 bg-gradient-to-b from-red-50/30 to-transparent';
    iconBg = 'bg-red-100 text-red-700';
  } else if (variant === 'warning') {
    borderStyle = 'border-amber-200 hover:border-amber-300 bg-gradient-to-b from-amber-50/30 to-transparent';
    iconBg = 'bg-amber-100 text-amber-700';
  } else if (variant === 'success') {
    borderStyle = 'border-emerald-200 hover:border-emerald-300 bg-gradient-to-b from-emerald-50/30 to-transparent';
    iconBg = 'bg-emerald-100 text-emerald-700';
  } else if (variant === 'info') {
    borderStyle = 'border-blue-200 hover:border-blue-300 bg-gradient-to-b from-blue-50/30 to-transparent';
    iconBg = 'bg-blue-100 text-blue-700';
  }

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border p-4 shadow-sm transition-all duration-150 ${borderStyle} ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-2.5 rounded-lg ${iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};
