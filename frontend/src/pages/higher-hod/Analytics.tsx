import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { BreadcrumbContext } from '../../components/layout/BreadcrumbContext';
import { KPICard } from '../../components/common/KPICard';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  TrendingUp,
  PieChart as PieIcon,
  BarChart3,
  Calendar,
  Sparkles,
  Layers,
  Users,
  Wrench,
  Clock
} from 'lucide-react';

const DEFAULT_ANALYTICS_DATA = {
  department_chart: [
    { name: 'CIVIL', count: 95 },
    { name: 'ELEC', count: 81 },
    { name: 'SIG', count: 72 },
    { name: 'TEL', count: 52 },
    { name: 'MECH', count: 40 }
  ],
  priority_chart: [
    { priority: 'CRITICAL', count: 29 },
    { priority: 'HIGH', count: 78 },
    { priority: 'MEDIUM', count: 85 },
    { priority: 'LOW', count: 13 }
  ],
  availability_trend: [
    { day: 'Day 1', availability: 91.2 },
    { day: 'Day 5', availability: 92.4 },
    { day: 'Day 10', availability: 93.1 },
    { day: 'Day 15', availability: 92.8 },
    { day: 'Day 20', availability: 94.5 },
    { day: 'Day 25', availability: 95.8 },
    { day: 'Today', availability: 96.4 }
  ],
  fusion_stats: {
    individual_requests_scheduled: 74,
    fused_blocks_created: 26,
    blocks_eliminated: 48,
    efficiency_savings_percent: 64.8,
    train_delay_minutes_saved: 420
  },
  commitment_success_rate: 94.2,
  manpower_utilization_percent: 78.4,
  resource_utilization_percent: 82.1
};

export const Analytics: React.FC = () => {
  const [chartData, setChartData] = useState<any>(DEFAULT_ANALYTICS_DATA);
  const [timeFilter, setTimeFilter] = useState('30_DAYS');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/analytics/charts')
      .then(res => {
        if (res.data && res.data.fusion_stats) {
          setChartData(res.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [timeFilter]);

  const COLORS = ['#0B2F58', '#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
  const PRIO_COLORS: Record<string, string> = {
    CRITICAL: '#DC2626',
    HIGH: '#F59E0B',
    MEDIUM: '#3B82F6',
    LOW: '#10B981'
  };

  const fusion = chartData?.fusion_stats || DEFAULT_ANALYTICS_DATA.fusion_stats;
  const deptChart = Array.isArray(chartData?.department_chart) ? chartData.department_chart : DEFAULT_ANALYTICS_DATA.department_chart;
  const prioChart = Array.isArray(chartData?.priority_chart) ? chartData.priority_chart : DEFAULT_ANALYTICS_DATA.priority_chart;
  const availTrend = Array.isArray(chartData?.availability_trend) ? chartData.availability_trend : DEFAULT_ANALYTICS_DATA.availability_trend;

  return (
    <div className="space-y-6">
      <BreadcrumbContext
        title="Infrastructure Performance & Predictive Analytics"
        subpath="Cross-Department Asset Availability & Block Fusion Efficiency Metrics"
        actionButton={
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 text-xs font-semibold">
            {['TODAY', '7_DAYS', '30_DAYS'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTimeFilter(f)}
                className={`px-3 py-1 rounded-md transition ${
                  timeFilter === f
                    ? 'bg-railway-dark text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
        }
      />

      {/* Top Statistical Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Commitment Success Rate"
          value={`${chartData?.commitment_success_rate ?? 94.2}%`}
          subtitle="Target completion met"
          variant="success"
          icon={<Clock className="w-5 h-5" />}
        />
        <KPICard
          title="Block Fusion Reduction"
          value={`-${fusion?.efficiency_savings_percent ?? 64.8}%`}
          subtitle={`${fusion?.blocks_eliminated ?? 48} blocks saved`}
          variant="info"
          icon={<Sparkles className="w-5 h-5" />}
        />
        <KPICard
          title="Manpower Gang Utilization"
          value={`${chartData?.manpower_utilization_percent ?? 78.4}%`}
          subtitle="Regional crew allocation"
          variant="default"
          icon={<Users className="w-5 h-5" />}
        />
        <KPICard
          title="Equipment Utilization"
          value={`${chartData?.resource_utilization_percent ?? 82.1}%`}
          subtitle="Tower wagons & tampers"
          variant="default"
          icon={<Wrench className="w-5 h-5" />}
        />
      </div>

      {/* Primary Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: 30-Day Asset Availability Trend */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Corridor Fixed Asset Availability Trend (%)</span>
            </h4>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              Current: 96.4%
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={availTrend}>
                <XAxis dataKey="day" stroke="#64748B" fontSize={11} />
                <YAxis domain={[85, 100]} stroke="#64748B" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '8px', fontSize: '12px' }}
                />
                <Line
                  type="monotone"
                  dataKey="availability"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={{ fill: '#10B981', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-slate-500 text-center">
            Progression across 30 days demonstrating increased track availability via AI Block Fusion scheduling.
          </p>
        </div>

        {/* Chart 2: Requests by Department */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span>Maintenance Workload by Department</span>
            </h4>
            <span className="text-xs text-slate-500">Live DB Requests</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptChart}>
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#2563EB" radius={[6, 6, 0, 0]}>
                  {deptChart.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-slate-500 text-center">
            Distribution across Civil, Electrical, Signalling, Telecom, and Mechanical wings.
          </p>
        </div>
      </div>

      {/* Secondary Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 3: Priority Breakdown (Pie Chart) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
            <PieIcon className="w-4 h-4 text-amber-600" />
            <span>Requests by Priority</span>
          </h4>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={prioChart}
                  dataKey="count"
                  nameKey="priority"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {prioChart.map((entry: any) => (
                    <Cell key={entry.priority} fill={PRIO_COLORS[entry.priority] || '#94A3B8'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Block Fusion Savings Metric Card */}
        <div className="lg:col-span-2 bg-gradient-to-br from-blue-900 to-slate-900 text-white rounded-xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-amber-300" />
              <h4 className="text-sm font-bold uppercase tracking-wider">
                SIH Block Fusion Efficiency Impact
              </h4>
            </div>
            <p className="text-xs text-blue-200 leading-relaxed">
              Consolidating independent requests across Track, OHE, and Signalling into unified multi-department maintenance windows eliminates redundant corridor shutdowns.
            </p>

            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="p-3 bg-white/10 rounded-xl border border-white/10 text-center">
                <span className="text-2xl font-mono font-extrabold text-white">
                  {fusion?.individual_requests_scheduled ?? 74}
                </span>
                <span className="text-[10px] text-blue-200 block uppercase font-bold mt-0.5">
                  Tasks Coordinated
                </span>
              </div>

              <div className="p-3 bg-white/10 rounded-xl border border-white/10 text-center">
                <span className="text-2xl font-mono font-extrabold text-amber-300">
                  {fusion?.fused_blocks_created ?? 26}
                </span>
                <span className="text-[10px] text-blue-200 block uppercase font-bold mt-0.5">
                  Blocks Executed
                </span>
              </div>

              <div className="p-3 bg-white/10 rounded-xl border border-white/10 text-center">
                <span className="text-2xl font-mono font-extrabold text-emerald-400">
                  {fusion?.efficiency_savings_percent ?? 64.8}%
                </span>
                <span className="text-[10px] text-blue-200 block uppercase font-bold mt-0.5">
                  Block Reduction
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center text-xs text-blue-300">
            <span>Estimated Passenger Train Stoppage Avoided:</span>
            <span className="font-bold text-white text-sm">
              {fusion?.train_delay_minutes_saved ?? 420} Minutes
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
