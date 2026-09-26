import React, { useState } from 'react';
import { CloudOff, X } from 'lucide-react';
import { useBackendStatus } from '../../hooks/useBackendStatus';

const DISMISS_KEY = 'railway_demo_banner_dismissed';

/**
 * Transparently tells the user which mode they are in.
 *
 * Offline (static deploy): all data comes from the bundled synthetic
 * dataset in the browser; changes persist to localStorage only and reset
 * on cache clear. Online: the real FastAPI + CP-SAT engine is answering.
 */
export const DemoModeBanner: React.FC = () => {
  const status = useBackendStatus();
  const [dismissed, setDismissed] = useState<boolean>(
    () => sessionStorage.getItem(DISMISS_KEY) === '1'
  );

  if (status !== 'offline' || dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs px-4 py-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <CloudOff className="w-4 h-4 shrink-0 text-amber-600" />
        <span className="truncate">
          <strong>Offline demo mode</strong> — serving bundled synthetic data from your
          browser. Changes persist locally only. Connect the backend for live CP-SAT
          planning, risk scoring, and shared state.
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, '1');
          setDismissed(true);
        }}
        aria-label="Dismiss banner"
        className="p-1 rounded hover:bg-amber-100 transition shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
