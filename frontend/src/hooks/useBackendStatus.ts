import { useEffect, useState } from 'react';
import api from '../api/client';

export type BackendStatus = 'checking' | 'online' | 'offline';

let cachedStatus: BackendStatus | null = null;
let cachedPromise: Promise<BackendStatus> | null = null;

/**
 * Detect once per page load whether a live FastAPI backend is answering.
 *
 * On a static-only deploy (Vercel SPA rewrite), GET /api/health returns
 * index.html with status 200 — so we check the payload shape, not the code:
 * a real backend answers with JSON { status: 'healthy', ... }.
 */
async function probeBackend(): Promise<BackendStatus> {
  if (cachedStatus) return cachedStatus;
  if (!cachedPromise) {
    cachedPromise = api
      .get('/health', { timeout: 4000 })
      .then((res) => {
        const ok =
          res.data &&
          typeof res.data === 'object' &&
          !Array.isArray(res.data) &&
          (res.data as { status?: string }).status === 'healthy';
        cachedStatus = ok ? 'online' : 'offline';
        return cachedStatus;
      })
      .catch(() => {
        cachedStatus = 'offline';
        return cachedStatus;
      });
  }
  return cachedPromise;
}

export const useBackendStatus = (): BackendStatus => {
  const [status, setStatus] = useState<BackendStatus>(cachedStatus ?? 'checking');

  useEffect(() => {
    if (cachedStatus) {
      setStatus(cachedStatus);
      return;
    }
    let cancelled = false;
    probeBackend().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
};
