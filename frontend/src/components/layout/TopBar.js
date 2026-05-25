import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const T = {
  bg:     '#060d18',
  border: 'rgba(0,168,255,0.1)',
  blue:   '#00aaff',
  cyan:   '#00ccff',
  green:  '#00e07a',
  amber:  '#ffb300',
  teal:   '#00ddc8',
  text:   '#d0e8f8',     // brilhante
  textHi: '#ffffff',
  textSec:'#80c0d8',     // antes #3a5878 — muito mais visível
  textMut:'#4a8aaa',     // antes #1e3a54 — visível
};

const TITLES = {
  '/':               { label:'Dashboard',      sub:'Operations Overview' },
  '/day-operations': { label:'Day Operations', sub:'Angola Offshore · Active Ops' },
  '/flights':        { label:'Flight Log',     sub:'Historical Records' },
  '/pilots':         { label:'Crew',           sub:'Pilot & Copilot Management' },
  '/aircraft':       { label:'Fleet',          sub:'Aircraft Registry' },
  '/destinations':   { label:'Destinations',   sub:'Offshore Locations' },
  '/alerts':         { label:'Alerts',         sub:'Operational Notifications' },
  '/reports':        { label:'Reports',        sub:'Analytics & Reports' },
};

function UTCClock() {
  const [t,setT]=useState(new Date());
  useEffect(()=>{const i=setInterval(()=>setT(new Date()),1000);return()=>clearInterval(i);},[]);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 9px', background:'rgba(0,0,0,0.3)', borderRadius:5, border:`1px solid ${T.border}` }}>
      <span style={{ fontSize:7.5, color:T.textSec, fontWeight:700, letterSpacing:'.16em' }}>UTC</span>
      <span style={{ fontSize:12, fontFamily:'monospace', color:'#00ccff', fontWeight:700, letterSpacing:'.1em' }}>{t.toUTCString().slice(17,25)}</span>
    </div>
  );
}

export default function TopBar({ onMenuClick, isMobile }) {
  const { pathname } = useLocation();
  const { user }     = useAuth();

  const base     = '/' + pathname.split('/')[1];
  const pageInfo = TITLES[base] || { label:'BladeOps', sub:'Aviation Ops' };
  const roleColor = user?.role==='admin' ? T.amber : user?.role==='pilot' ? T.cyan : T.green;
  const roleLabel = user?.role==='admin' ? 'ADMIN' : user?.role==='pilot' ? 'PILOT' : 'COPILOT';

  return (
    <header style={{ height:'var(--topbar-h)', background:T.bg, borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', padding:isMobile?'0 12px':'0 16px', gap:isMobile?8:12, position:'sticky', top:0, zIndex:50, flexShrink:0, boxShadow:'0 1px 0 rgba(0,0,0,0.4)' }}>

      {/* Hamburger */}
      <button onClick={onMenuClick} style={{ background:'none', border:`1px solid ${T.border}`, padding:'6px 8px', borderRadius:7, color:T.text, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', minWidth:34, minHeight:34, flexShrink:0 }} aria-label="Menu">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <rect y="1"  width="14" height="1.5" rx=".75"/>
          <rect y="6"  width="10" height="1.5" rx=".75"/>
          <rect y="11" width="14" height="1.5" rx=".75"/>
        </svg>
      </button>

      {/* Page title */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:isMobile?13:14, fontWeight:700, color:'#ffffff', lineHeight:1.2, letterSpacing:'.01em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {pageInfo.label}
        </div>
        {!isMobile && pageInfo.sub && (
          <div style={{ fontSize:9, color:T.textSec, letterSpacing:'.1em', textTransform:'uppercase', marginTop:1 }}>
            {pageInfo.sub}
          </div>
        )}
      </div>

      {/* Right */}
      <div style={{ display:'flex', alignItems:'center', gap:isMobile?8:10, flexShrink:0 }}>

        {/* Sys status — desktop only */}
        {!isMobile && (
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:9, letterSpacing:'.08em' }}>
            <span style={{ color:T.green, fontWeight:700 }}>● SYS OK</span>
            <span style={{ color:T.textMut }}>|</span>
            <span style={{ color:T.teal, fontWeight:600 }}>VMC · CAVOK</span>
          </div>
        )}

        {/* UTC clock */}
        {!isMobile && <UTCClock/>}

        {/* Role badge */}
        <div style={{ padding:'3px 9px', borderRadius:99, fontSize:9, fontWeight:800, letterSpacing:'.1em', border:`1px solid ${roleColor}50`, background:`${roleColor}15`, color:roleColor, whiteSpace:'nowrap' }}>
          {isMobile ? (user?.name?.split(' ')[0]||roleLabel) : roleLabel}
        </div>

        {/* Alerts */}
        <Link to="/alerts" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:34, height:34, borderRadius:7, border:`1px solid ${T.border}`, background:'rgba(0,0,0,0.2)', color:T.text, textDecoration:'none', flexShrink:0 }} aria-label="Alerts">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a5 5 0 0 0-5 5v3L1.5 11h13L13 9V6a5 5 0 0 0-5-5zm-1.5 12.5a1.5 1.5 0 0 0 3 0z"/>
          </svg>
        </Link>
      </div>
    </header>
  );
}