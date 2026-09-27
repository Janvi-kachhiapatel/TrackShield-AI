import axios from 'axios';
import { handleClientDatabaseFallback } from './clientDatabase';

const meta = import.meta as any;
const customUrl = meta.env?.VITE_API_URL || meta.env?.VITE_API_BASE_URL;

const api = axios.create({
  baseURL: customUrl || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  // Static demo mode (no custom backend) falls back fast; a real backend gets
  // a generous timeout because Render free-tier instances cold-start after
  // 15 minutes idle and can take 30-60s to wake on the first request.
  timeout: customUrl ? 60000 : 3500,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('railway_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Automatically serve complete bundled database when deployed without backend, on SPA 404 redirects, or on network errors
api.interceptors.response.use(
  (response) => {
    // If response returned HTML text (e.g. Vercel/Netlify SPA catch-all rewrites sending index.html with status 200)
    const isHtmlResponse =
      typeof response.data === 'string' &&
      (response.data.trim().startsWith('<') ||
       response.data.includes('<!DOCTYPE') ||
       response.data.includes('<!doctype') ||
       response.data.includes('<html'));

    if (isHtmlResponse) {
      // The SPA catch-all rewrite answered a /api/* request with index.html.
      // Never let an HTML string masquerade as API data — that crashes data
      // consumers expecting objects (e.g. gantt/risk panels reading .corridor).
      const fallbackResponse = handleClientDatabaseFallback(response.config);
      if (fallbackResponse) {
        console.info(`[Railway Database] Intercepted HTML-for-API response for ${response.config?.url}, served from bundled database.`);
        return fallbackResponse;
      }
      return Promise.reject(new Error(`Non-JSON response for ${response.config?.url} (static host has no backend)`));
    }

    return response;
  },
  async (error) => {
    // Fall back to the bundled database only when a real backend clearly is
    // NOT answering: network failure/timeout, an SPA rewrite returned HTML,
    // or the static host rejected the HTTP method (405 — e.g. POST to a
    // static-only deployment). Real backend rejections (401/403/400/404/500
    // JSON) must propagate so auth failures and validation errors surface.
    const status = error.response?.status;
    const contentType: string = error.response?.headers?.['content-type'] || '';
    const dataIsHtml = typeof error.response?.data === 'string' &&
      (String(error.response.data).trim().startsWith('<') || String(error.response.data).includes('<!DOCTYPE'));
    const isHtmlError = contentType.includes('text/html') || dataIsHtml;
    const isNetworkError = !error.response;
    const isMethodNotAllowed = status === 405;
    // A real FastAPI backend ALWAYS answers /api/* with JSON — even its errors
    // carry {"detail": ...}. Any string body from an API call means the static
    // host answered instead (SPA rewrite, dev-proxy 500, plain-text 404 page).
    // Treat every non-JSON error body as "backend absent" and fall back.
    const dataIsNonJsonString = typeof error.response?.data === 'string';

    if (isNetworkError || isHtmlError || isMethodNotAllowed || dataIsNonJsonString) {
      try {
        const fallbackResponse = handleClientDatabaseFallback(error.config);
        if (fallbackResponse) {
          console.info(`[Railway Database] Served ${error.config?.url} from bundled client database.`);
          return fallbackResponse;
        }
      } catch (fallbackErr) {
        console.warn('[Railway Database] Fallback resolution error:', fallbackErr);
      }
    }

    // Surface backend auth failures clearly for session handling.
    if (status === 401) {
      localStorage.removeItem('railway_token');
      localStorage.removeItem('railway_user');
    }

    return Promise.reject(error);
  }
);

export default api;
