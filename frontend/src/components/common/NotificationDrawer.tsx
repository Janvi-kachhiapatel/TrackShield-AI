import React from 'react';
import { NotificationItem } from '../../types';
import { Bell, CheckCircle2, AlertTriangle, AlertOctagon, Info, X } from 'lucide-react';
import api from '../../api/client';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onRefresh: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onRefresh
}) => {
  if (!isOpen) return null;

  const markAsRead = async (id: number) => {
    try {
      await api.post(`/master/notifications/${id}/read`);
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'CRITICAL':
        return <AlertOctagon className="w-4 h-4 text-red-600" />;
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'SUCCESS':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-sm">Railway Operations Notifications</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">
              {notifications.filter(n => !n.is_read).length}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Bell className="w-10 h-10 mx-auto opacity-30 mb-2" />
              <p className="text-sm">No new notifications</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => markAsRead(n.id)}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  n.is_read
                    ? 'bg-white border-slate-200 text-slate-600'
                    : 'bg-blue-50/40 border-blue-200 text-slate-900 font-medium'
                } hover:border-slate-300 cursor-pointer`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">{getIcon(n.alert_type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold">{n.title}</p>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-2 font-mono">
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-slate-200 bg-slate-50 text-center">
          <button
            onClick={onClose}
            className="text-xs text-slate-600 hover:text-slate-900 font-medium"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
