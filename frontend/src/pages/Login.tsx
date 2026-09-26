import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Train,
  Shield,
  Zap,
  Radio,
  Hammer,
  Wifi,
  Bot,
  CheckCircle2,
  Lock,
  User,
  ArrowRight
} from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [empId, setEmpId] = useState('hod001');
  const [password, setPassword] = useState('hod123');
  const [role, setRole] = useState('Higher HOD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const demoAccounts = [
    {
      emp_id: 'hod001',
      pw: 'hod123',
      name: 'Keval Rana',
      role: 'Higher HOD',
      dept: 'Head of All Departments',
      icon: <Shield className="w-4 h-4 text-blue-400" />
    },
    {
      emp_id: 'elec001',
      pw: 'elec123',
      name: 'Rahul Patel',
      role: 'Lower HOD',
      dept: 'Electrical Department (TRD)',
      icon: <Zap className="w-4 h-4 text-amber-400" />
    },
    {
      emp_id: 'sig001',
      pw: 'sig123',
      name: 'Amit Shah',
      role: 'Lower HOD',
      dept: 'Signal Department (SMMS)',
      icon: <Radio className="w-4 h-4 text-purple-400" />
    },
    {
      emp_id: 'civil001',
      pw: 'civil123',
      name: 'Rajesh Sharma',
      role: 'Lower HOD',
      dept: 'Civil Department (Track/TMS)',
      icon: <Hammer className="w-4 h-4 text-emerald-400" />
    },
    {
      emp_id: 'tel001',
      pw: 'tel123',
      name: 'Vikram Verma',
      role: 'Lower HOD',
      dept: 'Telecom Department',
      icon: <Wifi className="w-4 h-4 text-cyan-400" />
    },
  ];

  const handleSelectDemo = (acc: typeof demoAccounts[0]) => {
    setEmpId(acc.emp_id);
    setPassword(acc.pw);
    setRole(acc.role);
  };

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    if (newRole === 'Lower HOD' && empId === 'hod001') {
      setEmpId('elec001');
      setPassword('elec123');
    } else if (newRole === 'Higher HOD' && empId !== 'hod001') {
      setEmpId('hod001');
      setPassword('hod123');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const success = await login(empId, role);
      if (success) {
        if (role === 'Higher HOD' && empId === 'hod001') {
          navigate('/higher/dashboard');
        } else if (empId === 'hod001') {
          navigate('/higher/dashboard');
        } else {
          navigate('/lower/dashboard');
        }
      } else {
        setError('Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Login failed. Please check Employee ID.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col lg:flex-row">
      {/* Left side: Railway Control Room Branding */}
      <div className="lg:w-1/2 p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-railway-dark to-slate-950 text-white">
        {/* Subtle decorative grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#3B82F6_1px,transparent_1px)] [background-size:20px_20px] opacity-15"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
              <span className="text-2xl">🚆</span>
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Indian Railways</h1>
              <p className="text-xs text-blue-300 font-medium">Ministry of Railways • SIH 2026</p>
            </div>
          </div>

          <div className="mt-16 space-y-4 max-w-lg">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 uppercase tracking-wider">
              Control Office Application (COA) Integrated
            </span>
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight">
              AI-Powered Maintenance & Block Planning System
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Plan maintenance intelligently. Reduce multi-department conflicts. Maximize fixed asset availability across Indian Railways network corridors.
            </p>
          </div>
        </div>

        {/* Feature List */}
        <div className="relative z-10 my-10 space-y-3 max-w-md text-xs text-slate-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Integrates TMS, SMMS, TDMS maintenance defect feeds</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Mathematical CP-SAT optimizer for conflict-free night blocks</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Automated Block Fusion combining compatible jobs to reduce train stoppage</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Strict Human-in-the-Loop verification with Higher HOD authority</span>
          </div>
        </div>

        <div className="relative z-10 pt-6 border-t border-white/10 text-[11px] text-slate-400 flex justify-between">
          <span>Centre for Railway Information Systems (CRIS)</span>
          <span>Version 2.0.0</span>
        </div>
      </div>

      {/* Right side: Login Form */}
      <div className="lg:w-1/2 p-6 lg:p-16 flex items-center justify-center bg-slate-50">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center lg:text-left">
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Control Center Login
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Sign in with your official Indian Railways credentials or select a demo persona below.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Quick Demo Credentials Picker */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Quick 1-Click Demo Accounts
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.emp_id}
                  type="button"
                  onClick={() => handleSelectDemo(acc)}
                  className={`px-3 py-2 rounded-lg border text-left text-xs transition flex items-center justify-between ${
                    empId === acc.emp_id
                      ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="p-1 rounded bg-slate-800 text-white">{acc.icon}</span>
                    <div>
                      <span className="block font-bold leading-tight">{acc.name}</span>
                      <span className="text-[10px] text-slate-500">{acc.dept}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {acc.emp_id} / {acc.pw}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Employee ID *
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  placeholder="e.g. hod001, elec001"
                  className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Role *
              </label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-800"
              >
                <option value="Higher HOD">Higher HOD (Head of All Departments)</option>
                <option value="Lower HOD">Lower HOD (Department Specific)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-railway-dark hover:bg-railway-accent text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Authenticating...' : 'Access Maintenance Control Center'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
