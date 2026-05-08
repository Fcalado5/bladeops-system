// ===========================================
// BLADEOPS — API Services
// ===========================================

import client from './client';

// ── AUTH ─────────────────────────────────────────────────────────────────
export const authAPI = {
  login:          (email, password)   => client.post('/auth/login', { email, password }),
  refresh:        (refreshToken)      => client.post('/auth/refresh', { refreshToken }),
  logout:         (refreshToken)      => client.post('/auth/logout', { refreshToken }),
  me:             ()                  => client.get('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    client.post('/auth/change-password', { currentPassword, newPassword }),
};

// ── PILOTS ────────────────────────────────────────────────────────────────
export const pilotsAPI = {
  list:   ()         => client.get('/pilots'),
  get:    (id)       => client.get(`/pilots/${id}`),
  create: (data)     => client.post('/pilots', data),
  update: (id, data) => client.put(`/pilots/${id}`, data),
  toggle: (id)       => client.patch(`/pilots/${id}/toggle`),
};

// ── AIRCRAFT ──────────────────────────────────────────────────────────────
export const aircraftAPI = {
  list:   ()         => client.get('/aircraft'),
  get:    (id)       => client.get(`/aircraft/${id}`),
  create: (data)     => client.post('/aircraft', data),
  update: (id, data) => client.put(`/aircraft/${id}`, data),
};

// ── DESTINATIONS ──────────────────────────────────────────────────────────
export const destinationsAPI = {
  list:             ()              => client.get('/destinations'),
  distance:         (from, to)      => client.get('/destinations/distance', { params: { from, to } }),
  create:           (data)          => client.post('/destinations', data),
  updateDistances:  (id, distances) => client.put(`/destinations/${id}/distances`, { distances }),
};

// ── DAY OPERATIONS ────────────────────────────────────────────────────────
export const dayOpsAPI = {
  list:   (params)           => client.get('/day-operations', { params }),
  get:    (id)               => client.get(`/day-operations/${id}`),
  create: (data)             => client.post('/day-operations', data),
  close:  (id, motorOffTime) => client.patch(`/day-operations/${id}/close`, { motorOffTime }),
  sign:   (id)               => client.patch(`/day-operations/${id}/sign`),
};

// ── FLIGHTS ───────────────────────────────────────────────────────────────
export const flightsAPI = {
  get:    (id)               => client.get(`/flights/${id}`),
  create: (data)             => client.post('/flights', data),
  arrive: (id, arrivalTime)  => client.patch(`/flights/${id}/arrive`, { arrivalTime }),
  update: (id, data)         => client.put(`/flights/${id}`, data),
};

// ── ALERTS ────────────────────────────────────────────────────────────────
export const alertsAPI = {
  list: () => client.get('/alerts'),
};

// ── EXPORT ────────────────────────────────────────────────────────────────
export const exportAPI = {
  pdf: (dayOpId) => client.get(`/export/pdf/${dayOpId}`, { responseType: 'blob' }),
};

// ── EDIT LOGS ─────────────────────────────────────────────────────────────
export const editLogsAPI = {
  list: (params) => client.get('/edit-logs', { params }),
};
