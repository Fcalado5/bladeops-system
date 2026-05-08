// ===========================================
// BLADEOPS — Axios Client (WITH SILENT REFRESH)
// ===========================================

import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || '/api';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach access token ─────────────────────────────
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('bladeops_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Refresh logic (singleton — prevents multiple simultaneous refresh calls) ──
let isRefreshing  = false;
let failedQueue   = [];

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
}

// ── Response interceptor — silent refresh on 401 ─────────────────────────
client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    // Only try refresh on 401 and only once per request
    if (err.response?.status === 401 && !original._retry) {
      // Don't retry the refresh endpoint itself
      if (original.url?.includes('/auth/refresh') || original.url?.includes('/auth/login')) {
        forceLogout();
        return Promise.reject(err);
      }

      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return client(original);
        }).catch((e) => Promise.reject(e));
      }

      original._retry  = true;
      isRefreshing     = true;

      const refreshToken = localStorage.getItem('bladeops_refresh_token');

      if (!refreshToken) {
        forceLogout();
        return Promise.reject(err);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });

        // Save new tokens
        localStorage.setItem('bladeops_token',         data.token);
        localStorage.setItem('bladeops_refresh_token', data.refreshToken);

        // Update header for this request and all queued ones
        client.defaults.headers.common.Authorization = `Bearer ${data.token}`;
        original.headers.Authorization               = `Bearer ${data.token}`;
        processQueue(null, data.token);

        return client(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        forceLogout();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

function forceLogout() {
  localStorage.removeItem('bladeops_token');
  localStorage.removeItem('bladeops_refresh_token');
  localStorage.removeItem('bladeops_user');
  // Dispatch event so AuthContext can react
  window.dispatchEvent(new CustomEvent('bladeops:logout'));
}

export default client;
