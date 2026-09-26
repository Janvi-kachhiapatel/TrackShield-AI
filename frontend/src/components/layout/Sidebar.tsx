import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  FilePlus,
  ClipboardList,
  Wrench,
  History,
  Bot,
  TrafficCone,
  AlertOctagon,
  CheckSquare,
  BarChart3,
  Database,
  Layers
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
  pulse?: boolean;
}

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const isHigherHOD = user?.role === 'HIGHER_HOD';
  const isAdmin = user?.role === 'ADMIN';

  const lowerHODNav: NavItem[] = [
    { name: 'Dashboard', path: '/lower/dashboard', icon: LayoutDashboard },
    { name: 'Report Problem', path: '/lower/report', icon: FilePlus },
    { name: 'My Work', path: '/lower/my-work', icon: ClipboardList },
    { name: 'MCR (Completion)', path: '/lower/mcr', icon: Wrench },
    { name: 'Request History', path: '/lower/history', icon: History },
  ];

  const higherHODNav: NavItem[] = [
    { name: 'Command Dashboard', path: '/higher/dashboard', icon: LayoutDashboard },
    { name: 'All Requests', path: '/higher/requests', icon: ClipboardList },
    { name: 'AI Block Planner', path: '/higher/ai-planner', icon: Bot, highlight: true },
    { name: 'Block Management', path: '/higher/blocks', icon: TrafficCone },
    { name: 'Live Operations', path: '/higher/live-ops', icon: AlertOctagon, pulse: true },
    { name: 'MCR Verification', path: '/higher/mcr-verify', icon: CheckSquare },
    { name: 'Analytics', path: '/higher/analytics', icon: BarChart3 },
    { name: 'Master Data', path: '/admin/master', icon: Database },
  ];


  const navItems = isHigherHOD ? higherHODNav : (isAdmin ? higherHODNav : lowerHODNav);

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-[calc(100vh-65px)] border-r border-slate-800">
      {/* Department Authority Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/60">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
          Authority Tier
        </p>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            {isHigherHOD ? 'HIGHER HOD' : (isAdmin ? 'SYSTEM ADMIN' : 'LOWER HOD')}
          </span>
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
        </div>
        <div className="mt-1 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-blue-300 truncate">
          [{user?.department_name ? user.department_name.toUpperCase() : 'ALL DEPARTMENTS'}]
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                } ${item.highlight ? 'border border-blue-500/40 bg-blue-950/20' : ''}`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${item.pulse ? 'text-red-400 animate-pulse' : ''}`} />
                <span>{item.name}</span>
              </div>
              {item.highlight && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                  CP-SAT
                </span>
              )}
              {item.pulse && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Control Room Footer Banner */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400">
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span>Section Control Office</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-0.5">
          Northern & Western Corridor Hub
        </p>
      </div>
    </aside>
  );
};
