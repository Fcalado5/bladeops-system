import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to: '/',                label: 'Dashboard',       icon: '⬛', roles: ['admin','pilot','copilot'] },
  { to: '/day-operations',  label: 'Day Operations',  icon: '📋', roles: ['admin','pilot','copilot'] },
  { to: '/flights',         label: 'Flights',         icon: '✈️', roles: ['admin','pilot','copilot'] },
  { to: '/pilots',          label: 'Pilots',          icon: '👤', roles: ['admin','pilot','copilot'] },
  { to: '/aircraft',        label: 'Aircraft',        icon: '🚁', roles: ['admin'] },
  { to: '/destinations',    label: 'Destinations',    icon: '📍', roles: ['admin','pilot','copilot'] },
  { to: '/alerts',          label: 'Alerts',          icon: '🔔', roles: ['admin','pilot','copilot'] },
  { to: '/reports',         label: 'Reports',         icon: '📄', roles: ['admin'] },
];

export default function Sidebar({ open }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const items = NAV.filter(n => n.roles.includes(user?.role));

  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, height: '100vh',
      width: 'var(--sidebar-w)',
      background: 'linear-gradient(180deg, var(--ocean-darkest) 0%, var(--ocean-dark) 100%)',
      display: 'flex', flexDirection: 'column',
      transform: open ? 'translateX(0)' : 'translateX(-100%)',
      transition: 'transform .25s ease',
      zIndex: 100, boxShadow: 'var(--shadow-lg)',
    }}>
      {/* Brand */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid rgba(255,255,255,.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M4 22L14 4L24 22" stroke="#90E0EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 22L14 13L19 22" stroke="rgba(144,224,239,.45)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 25H26" stroke="#90E0EF" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: .3 }}>
               Blade
            </div>
            <div style={{ fontSize: 9, color: 'var(--ocean-light)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
             Ops
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {items.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 8,
              marginBottom: 2,
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#fff' : 'rgba(255,255,255,.65)',
              background: isActive
                ? 'rgba(144,224,239,.15)'
                : 'transparent',
              borderLeft: isActive ? '3px solid var(--ocean-light)' : '3px solid transparent',
              transition: 'all .15s',
              textDecoration: 'none',
            })}
          >
            <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div style={{
        padding: '12px 14px',
        borderTop: '1px solid rgba(255,255,255,.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(144,224,239,.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: 'var(--ocean-light)',
          }}>
            {user?.initials || '?'}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>
              {user?.name?.split(' ')[0]}
            </div>
            <div style={{ fontSize: 10, color: 'var(--ocean-light)', textTransform: 'capitalize' }}>
              {user?.role}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          style={{
            width: '100%', padding: '7px 12px', borderRadius: 7,
            border: '1px solid rgba(255,255,255,.2)',
            background: 'rgba(255,255,255,.06)',
            color: 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: 500,
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
