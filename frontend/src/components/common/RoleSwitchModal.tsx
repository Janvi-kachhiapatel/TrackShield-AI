import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, Zap, Radio, Hammer, Wifi, Settings, CheckCircle2, X } from 'lucide-react';

interface RoleSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoleSwitchModal: React.FC<RoleSwitchModalProps> = ({ isOpen, onClose }) => {
  const { user, switchUser } = useAuth();

  if (!isOpen) return null;

  const accounts = [
    {
      emp_id: 'hod001',
      name: 'Keval Rana',
      role: 'HIGHER HOD',
      dept: 'Head of All Departments',
      color: 'border-blue-500 bg-blue-50/40 text-blue-900',
      badge: 'bg-blue-600 text-white',
      icon: <Shield className="w-5 h-5 text-blue-700" />,
      desc: 'Full approval authority, cross-department coordination, AI Block Planner, and MCR verification.'
    },
    {
      emp_id: 'elec001',
      name: 'Rahul Patel',
      role: 'LOWER HOD',
      dept: 'Electrical Department (TRD / OHE)',
      color: 'border-amber-400 bg-amber-50/40 text-amber-900',
      badge: 'bg-amber-600 text-white',
      icon: <Zap className="w-5 h-5 text-amber-600" />,
      desc: 'Manages OHE catenary, insulators, power isolation requests, and electrical MCRs.'
    },
    {
      emp_id: 'sig001',
      name: 'Amit Shah',
      role: 'LOWER HOD',
      dept: 'Signalling Department (SMMS)',
      color: 'border-purple-400 bg-purple-50/40 text-purple-900',
      badge: 'bg-purple-600 text-white',
      icon: <Radio className="w-5 h-5 text-purple-600" />,
      desc: 'Inspects point machines, track circuits, signals, and interlockings.'
    },
    {
      emp_id: 'civil001',
      name: 'Rajesh Sharma',
      role: 'LOWER HOD',
      dept: 'Civil Engineering (TMS - Track)',
      color: 'border-emerald-400 bg-emerald-50/40 text-emerald-900',
      badge: 'bg-emerald-600 text-white',
      icon: <Hammer className="w-5 h-5 text-emerald-600" />,
      desc: 'Tracks, turnouts, rail fractures, deep screening, and tamping blocks.'
    },
    {
      emp_id: 'tel001',
      name: 'Vikram Verma',
      role: 'LOWER HOD',
      dept: 'Telecommunications',
      color: 'border-cyan-400 bg-cyan-50/40 text-cyan-900',
      badge: 'bg-cyan-600 text-white',
      icon: <Wifi className="w-5 h-5 text-cyan-600" />,
      desc: 'OFC fiber optic cables, VHF wireless, control communications, and passenger info systems.'
    },
    {
      emp_id: 'admin001',
      name: 'System Administrator',
      role: 'ADMIN',
      dept: 'CRIS / Indian Railways Operations',
      color: 'border-slate-400 bg-slate-100 text-slate-900',
      badge: 'bg-slate-700 text-white',
      icon: <Settings className="w-5 h-5 text-slate-700" />,
      desc: 'Station master records, corridor mappings, train timetables, and audit history.'
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span>Switch Railway Persona / Demo Role</span>
            </h3>
            <p className="text-xs text-slate-300">
              Select an official account to experience role-specific UI, authorities, and permissions.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[75vh] overflow-y-auto">
          {accounts.map((acc) => {
            const isCurrent = user?.emp_id === acc.emp_id;
            return (
              <div
                key={acc.emp_id}
                onClick={async () => {
                  await switchUser(acc.emp_id);
                  onClose();
                }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-150 relative ${
                  isCurrent ? `${acc.color} ring-2 ring-blue-500` : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {isCurrent && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 text-xs font-semibold text-blue-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Active</span>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-white shadow-sm border border-slate-200">
                    {acc.icon}
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-slate-900">{acc.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${acc.badge}`}>
                        {acc.role}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-700 mt-0.5 truncate">{acc.dept}</p>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{acc.desc}</p>
                    <div className="mt-2 text-[10px] font-mono text-slate-400">ID: {acc.emp_id}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>* All state updates seamlessly synchronize through PostgreSQL / SQLite.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 font-medium rounded-lg text-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
