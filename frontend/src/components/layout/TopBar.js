import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const TITLES = {
  '/':               'Dashboard',
  '/day-operations': 'Day Operations',
  '/flights':        'Flights',
  '/pilots':         'Pilots',
  '/aircraft':       'Aircraft',
  '/destinations':   'Destinations',
  '/alerts':         'Alerts',
  '/reports':        'Reports',
};

export default function TopBar({ onMenuClick }) {
  const { pathname } = useLocation();
  const { user }     = useAuth();

  const base  = '/' + pathname.split('/')[1];
  const title = TITLES[base] || 'BladeOps';
  const now   = new Date().toLocaleDateString('pt-PT', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <header style={{
      height: 'var(--topbar-h)',
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 16,
      boxShadow: 'var(--shadow-sm)',
      position: 'sticky', top: 0, zIndex: 50,
      flexShrink: 0,
    }}>
      <button
        onClick={onMenuClick}
        style={{
          background: 'none', border: 'none', padding: '6px',
          borderRadius: 6, color: 'var(--text-sec)', fontSize: 16,
        }}
        aria-label="Toggle sidebar"
      >
        ☰
      </button>

      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{title}</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{now}</span>

        {/* Role badge */}
        <span style={{
          fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 600,
          background: user?.role === 'admin'
            ? 'var(--warning-bg)' : user?.role === 'pilot'
            ? 'var(--info-bg)' : 'var(--success-bg)',
          color: user?.role === 'admin'
            ? 'var(--warning)' : user?.role === 'pilot'
            ? 'var(--ocean-dark)' : 'var(--success)',
          border: `1px solid ${user?.role === 'admin'
            ? 'var(--warning-border)' : user?.role === 'pilot'
            ? 'var(--info-border)' : 'var(--success-border)'}`,
          textTransform: 'capitalize',
        }}>
          {user?.role}
        </span>

        <Link to="/alerts" style={{
          fontSize: 18, color: 'var(--text-sec)',
          padding: '4px 8px', borderRadius: 6,
        }}>
          🔔
        </Link>
      </div>
    </header>
  );
}
