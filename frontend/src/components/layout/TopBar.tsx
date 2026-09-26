import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { NotificationItem } from '../../types';
import api from '../../api/client';
import { Bell, ChevronDown, User as UserIcon, Shield, Zap, Radio, Hammer, Wifi, RefreshCw, LogOut, Settings, CheckCircle2 } from 'lucide-react';
import { RoleSwitchModal } from '../common/RoleSwitchModal';
import { NotificationDrawer } from '../common/NotificationDrawer';

export const TopBar: React.FC = () => {
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = () => {
    api.get<NotificationItem[]>('/master/notifications')
      .then(res => setNotifications(res.data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getDeptIcon = () => {
    if (!user) return <Shield className="w-4 h-4 text-blue-600" />;
    switch (user.department_code) {
      case 'ELEC': return <Zap className="w-4 h-4 text-amber-600" />;
      case 'SIG': return <Radio className="w-4 h-4 text-purple-600" />;
      case 'CIVIL': return <Hammer className="w-4 h-4 text-emerald-600" />;
      case 'TEL': return <Wifi className="w-4 h-4 text-cyan-600" />;
      default: return <Shield className="w-4 h-4 text-blue-600" />;
    }
  };

  const getRoleBadge = () => {
    if (user?.role === 'HIGHER_HOD') {
      return (
        <span className="text-[11px] font-bold tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200 uppercase">
          HIGHER HOD
        </span>
      );
    }
    if (user?.role === 'LOWER_HOD') {
      return (
        <span className="text-[11px] font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300 uppercase">
          LOWER HOD • {user.department_code || 'DEPT'}
        </span>
      );
    }
    return (
      <span className="text-[11px] font-bold tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 uppercase">
        ADMIN
      </span>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="px-6 py-2.5 flex items-center justify-between">
          {/* Left: Branding & Railway emblem */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-railway-dark flex items-center justify-center text-white shadow-sm border border-railway-800">
              <span className="text-xl">🚆</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">
                  Railway Maintenance Control Center
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  LIVE SYSTEM
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Indian Railways • AI-Powered Block Planning & Infrastructure Operations
              </p>
            </div>
          </div>

          {/* Right Section: System status, Notifications & Prominent User Identity */}
          <div className="flex items-center gap-4">
            {/* Live Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>COA & TMS Active</span>
            </div>

            {/* Notifications Button */}
            <button
              onClick={() => setNotifDrawerOpen(true)}
              className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition border border-slate-200"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* VERY IMPORTANT: TOP-RIGHT USER IDENTITY */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-3 p-1.5 pr-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition bg-white shadow-xs text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-railway-100 border border-railway-200 flex items-center justify-center text-railway-900 font-bold text-sm">
                  {user?.name ? user.name.split(' ').map(n => n[0]).join('') : 'IR'}
                </div>
                <div className="hidden sm:block">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900 leading-tight">
                      {user?.name || 'Officer'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {getRoleBadge()}
                  </div>
                </div>
              </button>

              {/* Profile Dropdown */}
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center font-bold text-sm">
                        {user?.name ? user.name.charAt(0) : 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{user?.name}</p>
                        <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 text-xs space-y-1 text-slate-600">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Authority Role:</span>
                        <span className="font-semibold text-slate-800">{user?.role?.replace('_', ' ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Department:</span>
                        <span className="font-semibold text-slate-800">{user?.department_name || 'All'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Employee ID:</span>
                        <span className="font-mono font-semibold text-slate-800 uppercase">{user?.emp_id}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Account Status:</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Active
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        setSwitchModalOpen(true);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-lg flex items-center gap-2 transition"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Change Account / Switch Role</span>
                    </button>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        alert(`Employee ID: ${user?.emp_id}\nRole: ${user?.role}\nDepartment: ${user?.department_name}\nZone: Northern Railway\nAuthentication: Active via IR-SingleSignOn`);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 transition"
                    >
                      <Settings className="w-4 h-4 text-slate-500" />
                      <span>Account Settings</span>
                    </button>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        logout();
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <RoleSwitchModal
        isOpen={switchModalOpen}
        onClose={() => setSwitchModalOpen(false)}
      />

      <NotificationDrawer
        isOpen={notifDrawerOpen}
        onClose={() => setNotifDrawerOpen(false)}
        notifications={notifications}
        onRefresh={fetchNotifs}
      />
    </>
  );
};
