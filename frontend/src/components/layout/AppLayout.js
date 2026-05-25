import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar  from './TopBar';

function useWindowWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h, { passive: true });
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

export default function AppLayout() {
  const w       = useWindowWidth();
  const isMobile = w <= 768;
  const isTablet = w <= 1024 && w > 768;
  const location = useLocation();

  // Desktop: always open. Mobile/tablet: closed by default
  const [open, setOpen] = useState(w > 768);

  // Close sidebar on route change (mobile only)
  useEffect(() => {
    if (isMobile) setOpen(false);
  }, [location.pathname, isMobile]);

  // Sync on resize
  useEffect(() => {
    if (w > 768 && !open) setOpen(true);
    if (w <= 768 && open && isMobile) setOpen(false);
  }, [w]);

  const toggle = useCallback(() => setOpen(p => !p), []);
  const close  = useCallback(() => setOpen(false), []);

  const sidebarW  = 'var(--sidebar-w)';
  const marginLeft = (!isMobile && open) ? sidebarW : 0;

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#040911' }}>

      {/* Mobile overlay */}
      {open && isMobile && (
        <div
          className="sidebar-overlay"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <Sidebar open={open} onClose={close} isMobile={isMobile} isTablet={isTablet}/>

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        marginLeft,
        transition: 'margin-left .22s cubic-bezier(.4,0,.2,1)',
        minWidth: 0, // prevent flex overflow
      }}>
        <TopBar
          onMenuClick={toggle}
          sidebarOpen={open}
          isMobile={isMobile}
        />

        <main
          className="main-content"
          style={{
            flex: 1,
            overflow: 'auto',
            padding: isMobile ? '14px' : isTablet ? '16px' : '20px',
            background: '#04080f',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}