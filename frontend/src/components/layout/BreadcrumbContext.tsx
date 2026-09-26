import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ChevronRight, Compass } from 'lucide-react';

interface BreadcrumbContextProps {
  title: string;
  subpath: string;
  actionButton?: React.ReactNode;
}

export const BreadcrumbContext: React.FC<BreadcrumbContextProps> = ({
  title,
  subpath,
  actionButton
}) => {
  const { user } = useAuth();

  const getRootContext = () => {
    if (user?.role === 'HIGHER_HOD') {
      return 'Head of All Departments';
    }
    if (user?.role === 'LOWER_HOD') {
      return `${user.department_name || 'Department'}`;
    }
    return 'System Administration';
  };

  return (
    <div className="mb-6 bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Compass className="w-3.5 h-3.5 text-railway-600" />
          <span className="text-slate-700 font-semibold">{getRootContext()}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-railway-700 font-semibold">{subpath}</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
          {title}
        </h2>
      </div>

      {actionButton && (
        <div className="flex items-center gap-2">
          {actionButton}
        </div>
      )}
    </div>
  );
};
