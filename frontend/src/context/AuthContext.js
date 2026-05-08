// ===========================================
// BLADEOPS — Auth Context (WITH REFRESH TOKEN)
// ===========================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bladeops_user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('bladeops_token'));
  const [loading, setLoading] = useState(false);

  // Listen for forced logout events from Axios interceptor
  useEffect(() => {
    const handleForceLogout = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('bladeops:logout', handleForceLogout);
    return () => window.removeEventListener('bladeops:logout', handleForceLogout);
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const { data } = await authAPI.login(email, password);

      // Store both tokens
      localStorage.setItem('bladeops_token',         data.token);
      localStorage.setItem('bladeops_refresh_token', data.refreshToken);
      localStorage.setItem('bladeops_user',          JSON.stringify(data.user));

      setToken(data.token);
      setUser(data.user);

      return { ok: true, docWarnings: data.docWarnings };
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || 'Login failed' };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('bladeops_refresh_token');
      if (refreshToken) {
        // Revoke refresh token on server (fire and forget)
        await authAPI.logout(refreshToken).catch(() => {});
      }
    } finally {
      localStorage.removeItem('bladeops_token');
      localStorage.removeItem('bladeops_refresh_token');
      localStorage.removeItem('bladeops_user');
      setToken(null);
      setUser(null);
    }
  }, []);

  const isAdmin   = user?.role === 'admin';
  const isPilot   = user?.role === 'pilot';
  const isCopilot = user?.role === 'copilot';

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin, isPilot, isCopilot }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
