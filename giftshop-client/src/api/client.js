import axios from 'axios';

// Empty in development (Vite proxies /api). In production set VITE_API_URL=https://your-api.onrender.com
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true, // send the httpOnly refresh cookie
  timeout: 20000,
  headers: { 'X-Requested-With': 'XMLHttpRequest' }, // required by the API's CSRF check
});

// The access token lives only in memory (not localStorage), so injected scripts can't steal it from storage.
let accessToken = null;
export const setAccessToken = (token) => { accessToken = token; };
export const getAccessToken = () => accessToken;

let onSessionExpired = () => {};
export const setOnSessionExpired = (fn) => { onSessionExpired = fn; };

// Only one refresh runs at a time; every request that got a 401 waits for the same one.
let refreshing = null;
export function refreshSession() {
  if (!refreshing) {
    refreshing = api.post('/auth/refresh', null, { skipAuthRefresh: true })
      .then((res) => { setAccessToken(res.data.accessToken); return res.data; })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    const isAuthCall = config?.url?.startsWith('/auth/login') || config?.url?.startsWith('/auth/register');
    if (response?.status === 401 && config && !config.retried && !config.skipAuthRefresh && !isAuthCall && accessToken) {
      config.retried = true;
      try {
        await refreshSession();
        return api(config); // retry the original request with the new token
      } catch {
        setAccessToken(null);
        onSessionExpired();
      }
    }
    return Promise.reject(error);
  }
);

export function errorMessage(err) {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.';
  if (err?.message === 'Network Error') return 'Cannot reach the server. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}

// Field-level errors from the API's validation ({ field, message }[]) as an object
export function fieldErrors(err) {
  const details = err?.response?.data?.details || [];
  return Object.fromEntries(details.map((d) => [d.field.split('.').pop(), d.message]));
}

export const PLACEHOLDER_IMG = '/placeholder.svg';
export function imageUrl(src) {
  if (!src) return PLACEHOLDER_IMG;
  if (src.startsWith('/uploads/')) return `${API_BASE}${src}`;
  return src;
}

export default api;
