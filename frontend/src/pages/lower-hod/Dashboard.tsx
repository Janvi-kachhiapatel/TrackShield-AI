import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MaintenanceRequest, NotificationItem } from '../../types';
import api from '../../api/client';
import { FALLBACK_REQUESTS } from '../../api/fallbackData';
import { BreadcrumbContext } from '../../components/layout/BreadcrumbContext';
import { KPICard } from '../../components/common/KPICard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Clock,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  FileCheck,
  Calendar,
  ChevronRight,
  PlusCircle
} from 'lucide-react';

export const LowerHODDashboard: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MaintenanceRequest[]>(() => {
    const deptId = user?.department_id;
    if (deptId && deptId !== 6) {
      const filtered = FALLBACK_REQUESTS.filter(r => Number(r.department_id) === Number(deptId));
      return filtered.length > 0 ? filtered : FALLBACK_REQUESTS;
    }
    return FALLBACK_REQUESTS;
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user?.department_id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqRes, notifRes] = await Promise.all([
        api.get<MaintenanceRequest[]>('/requests', {
          params: { department_id: user?.department_id }
        }),
        api.get<NotificationItem[]>('/master/notifications', {
          params: { department_id: user?.department_id }
        })
      ]);
      if (reqRes.data && Array.isArray(reqRes.data)) setRequests(reqRes.data);
      if (notifRes.data && Array.isArray(notifRes.data)) setNotifications(notifRes.data);
    } catch (err) {
      console.error('Failed to load dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  // KPI calculations for this department
  const totalJobs = requests.length;
  const pending = requests.filter(r => ['NEW', 'INSPECTED', 'AI_ANALYZED'].includes(r.status)).length;
  const inProgress = requests.filter(r => r.status === 'IN_PROGRESS').length;
  const completed = requests.filter(r => ['VERIFIED', 'CLOSED'].includes(r.status)).length;
  const delayed = requests.filter(r => r.status === 'DELAYED').length;
  const critical = requests.filter(r => r.priority === 'CRITICAL' && r.status !== 'CLOSED').length;
  const mcrPending = requests.filter(r => r.status === 'MCR_SUBMITTED').length;
  const upcoming = requests.filter(r => r.status === 'APPROVED').length;

  const criticalProblems = requests.filter(r => r.priority === 'CRITICAL' && r.status !== 'CLOSED');
  const todayWork = requests.filter(r => ['APPROVED', 'IN_PROGRESS', 'DELAYED'].includes(r.status)).slice(0, 5);
  const recentRequests = requests.slice(0, 8);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="space-y-6">
      {/* Header Context */}
      <BreadcrumbContext
        title={`${getGreeting()}, ${user?.name ? user.name.split(' ')[0] : 'Officer'}`}
        subpath="Maintenance Overview & Operations"
        actionButton={
          <Link
            to="/lower/report"
            className="px-4 py-2 bg-railway-dark hover:bg-railway-accent text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Report New Problem</span>
          </Link>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <h3 className="text-sm font-bold text-slate-800">
          {user?.department_name || 'Department'} Maintenance Overview
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Active trackside defects, gang deployment status, and upcoming maintenance block schedules.
        </p>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Jobs"
          value={totalJobs}
          subtitle="All department requests"
          icon={<Briefcase className="w-5 h-5" />}
        />
        <KPICard
          title="Pending"
          value={pending}
          subtitle="Awaiting HOD approval"
          variant="info"
          icon={<Clock className="w-5 h-5" />}
        />
        <KPICard
          title="In Progress"
          value={inProgress}
          subtitle="Active on track"
          variant="info"
          icon={<PlayCircle className="w-5 h-5" />}
        />
        <KPICard
          title="Completed"
          value={completed}
          subtitle="Verified & closed"
          variant="success"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
      </div>

      {/* Secondary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Delayed Work"
          value={delayed}
          subtitle="Requires attention"
          variant="warning"
          icon={<AlertTriangle className="w-5 h-5" />}
        />
        <KPICard
          title="Critical Problems"
          value={critical}
          subtitle="High train impact"
          variant="critical"
          icon={<AlertOctagon className="w-5 h-5" />}
        />
        <KPICard
          title="MCR Pending"
          value={mcrPending}
          subtitle="Awaiting Higher HOD"
          variant="info"
          icon={<FileCheck className="w-5 h-5" />}
        />
        <KPICard
          title="Upcoming Work"
          value={upcoming}
          subtitle="Approved blocks ready"
          variant="default"
          icon={<Calendar className="w-5 h-5" />}
        />
      </div>

      {/* Critical Problems & Today's Work */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Critical Problems */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-red-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-red-600" />
              <h3 className="font-bold text-sm text-red-950">My Critical Problems</h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
              {criticalProblems.length} Urgent
            </span>
          </div>

          <div className="p-4 divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {criticalProblems.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                ✓ No critical safety violations reported in your department.
              </div>
            ) : (
              criticalProblems.map((r) => (
                <div key={r.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">{r.problem_id}</span>
                      <StatusBadge status={r.status} size="sm" />
                    </div>
                    <p className="text-xs font-semibold text-slate-800 mt-1 truncate">{r.work_description}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Corridor: {r.corridor_name || r.corridor_code} • Asset: {r.asset_name}
                    </p>
                  </div>
                  <Link
                    to="/lower/my-work"
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg shrink-0 transition"
                  >
                    View
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Today's Maintenance Schedule */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-blue-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-blue-950">Today's Maintenance Operations</h3>
            </div>
            <Link to="/lower/my-work" className="text-xs font-semibold text-blue-700 hover:underline flex items-center">
              View All <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>

          <div className="p-4 divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {todayWork.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No active blocks scheduled for today. Check upcoming requests.
              </div>
            ) : (
              todayWork.map((r) => (
                <div key={r.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">{r.problem_id}</span>
                      <StatusBadge status={r.status} size="sm" />
                      <span className="text-[10px] text-slate-400 font-mono">
                        {r.requested_start_time} – {r.requested_end_time}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 mt-1 truncate">{r.work_description}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {r.corridor_name} • Crew: {r.manpower_required} men
                    </p>
                  </div>
                  <Link
                    to="/lower/my-work"
                    className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg shrink-0 transition"
                  >
                    Manage
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Requests Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Recent Department Maintenance Requests</h3>
            <p className="text-xs text-slate-500">Track life-cycle state from initial inspection to final Higher HOD closure</p>
          </div>
          <Link
            to="/lower/my-work"
            className="text-xs font-semibold text-railway-700 hover:text-railway-900 flex items-center gap-1"
          >
            Open My Work Queue <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Problem ID</th>
                <th className="py-3 px-4">Asset</th>
                <th className="py-3 px-4">Corridor</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Requested Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentRequests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{r.problem_id}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{r.asset_name}</td>
                  <td className="py-3 px-4 text-slate-600 truncate max-w-[200px]">{r.corridor_name || r.corridor_code}</td>
                  <td className="py-3 px-4">
                    <StatusBadge status={r.priority} size="sm" />
                  </td>
                  <td className="py-3 px-4 text-slate-600 font-mono">{r.requested_date}</td>
                  <td className="py-3 px-4">
                    <StatusBadge status={r.status} size="sm" />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      to="/lower/my-work"
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
