import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar open={sidebarOpen} />
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        marginLeft: sidebarOpen ? 'var(--sidebar-w)' : 0,
        transition: 'margin-left .25s ease',
      }}>
        <TopBar onMenuClick={() => setSidebarOpen(p => !p)} />
        <main style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px',
          background: 'var(--bg-surface)',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
