import axios from 'axios';
import { handleClientDatabaseFallback } from './clientDatabase';

const meta = import.meta as any;
const customUrl = meta.env?.VITE_API_URL || meta.env?.VITE_API_BASE_URL;

const api = axios.create({
  baseURL: customUrl || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 3500, // 3.5s timeout so static deployments without backend fall back quickly
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

    // Or if an API endpoint expected structured JSON but got a plain string or non-array for master/requests
    const isInvalidApiData =
      typeof response.data === 'string' &&
      (response.config?.url?.includes('/master/') ||
       response.config?.url?.includes('/requests') ||
       response.config?.url?.includes('/blocks') ||
       response.config?.url?.includes('/mcr') ||
       response.config?.url?.includes('/analytics') ||
       response.config?.url?.includes('/auth/'));

    if (isHtmlResponse || isInvalidApiData) {
      const fallbackResponse = handleClientDatabaseFallback(response.config);
      if (fallbackResponse) {
        console.info(`[Railway Database] Intercepted non-JSON response for ${response.config?.url}, served from bundled database.`);
        return fallbackResponse;
      }
    }

    return response;
  },
  async (error) => {
    // Only fall back to the bundled database when the backend is truly
    // unreachable (network error/timeout) or an SPA rewrite returned HTML.
    // Real backend rejections (401/403/400/404/500 JSON) must propagate so
    // auth failures and validation errors surface instead of being masked.
    const status = error.response?.status;
    const contentType: string = error.response?.headers?.['content-type'] || '';
    const isHtmlError = contentType.includes('text/html');
    const isNetworkError = !error.response;

    if (isNetworkError || isHtmlError) {
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
