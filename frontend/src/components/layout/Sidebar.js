import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const S = {
  bg:        '#040b14',
  surface:   '#070e1a',
  border:    'rgba(0,168,255,0.1)',
  borderHi:  'rgba(0,168,255,0.25)',
  blue:      '#00aaff',
  cyan:      '#00ccff',
  green:     '#00e07a',
  amber:     '#ffb300',
  text:      '#d0e8f8',     // muito mais brilhante
  textHi:    '#ffffff',     // branco puro
  textMuted: '#90c0d8',     // antes #6f8eaa — visível
  textFaint: '#4a8aaa',     // antes #2d4a62 — visível
};

const ICON = {
  dash: <svg viewBox="0 0 18 18" width="15" height="15" fill="currentColor"><rect x="1" y="1" width="7" height="7" rx="1.5" opacity=".8"/><rect x="10" y="1" width="7" height="7" rx="1.5"/><rect x="1" y="10" width="7" height="7" rx="1.5"/><rect x="10" y="10" width="7" height="7" rx="1.5" opacity=".8"/></svg>,
  ops:  <svg viewBox="0 0 18 18" width="15" height="15" fill="currentColor"><rect x="1" y="2" width="16" height="2" rx="1"/><rect x="1" y="7" width="11" height="2" rx="1" opacity=".7"/><rect x="1" y="12" width="14" height="2" rx="1" opacity=".5"/><circle cx="15" cy="13" r="2.5"/></svg>,
  flt:  <svg viewBox="0 0 18 18" width="15" height="15" fill="currentColor"><path d="M9 2c-.5 0-.8.4-.6.8l1.4 3.5-6.3 1.5c-.5.1-.5.8 0 1l2.5 1-2.5 5.7c-.2.5.4.9.8.6l3.5-2.5 1 1.9c.2.4.8.4 1 0l1-1.9 3.5 2.5c.4.3 1-.1.8-.6L13 9.8l2.5-1c.5-.2.5-.9 0-1L9.2 6.3l1.4-3.5c.2-.4-.1-.8-.6-.8z"/></svg>,
  crew: <svg viewBox="0 0 18 18" width="15" height="15" fill="currentColor"><circle cx="7" cy="6" r="2.8"/><path d="M1 15.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" opacity=".8"/><circle cx="14" cy="6" r="2.2" opacity=".7"/><path d="M13 14c0-2.2 1.3-3.8 3.5-3.8" opacity=".5"/></svg>,
  acft: <svg viewBox="0 0 18 18" width="15" height="15" fill="currentColor"><ellipse cx="9" cy="4.5" rx="7" ry="2"/><rect x="8" y="4.5" width="2" height="3" rx="1"/><ellipse cx="9" cy="9" rx="4" ry="1.8"/><path d="M5 9 Q1.5 10.5 0 13l3.5.5Q6.5 11.5 8 10.5z"/><path d="M13 9 Q16.5 10.5 18 13l-3.5.5Q12 11 10 10.5z" opacity=".8"/><rect x="8" y="10.5" width="2" height="4" rx="1"/></svg>,
  dest: <svg viewBox="0 0 18 18" width="15" height="15" fill="currentColor"><path d="M9 1a5 5 0 0 0-5 5c0 4 5 11 5 11s5-7 5-11a5 5 0 0 0-5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>,
  alrt: <svg viewBox="0 0 18 18" width="15" height="15" fill="currentColor"><path d="M9 1.5a5.5 5.5 0 0 0-5.5 5.5v3L2 12.5h14L14 10V7A5.5 5.5 0 0 0 9 1.5zm-1.5 14a1.5 1.5 0 0 0 3 0z"/></svg>,
  rpt:  <svg viewBox="0 0 18 18" width="15" height="15" fill="currentColor"><path d="M3 2h8l4 4v10H3V2z" fillOpacity=".25"/><path d="M11 2v4h4"/><line x1="6" y1="8.5" x2="12" y2="8.5" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round"/><line x1="6" y1="11" x2="12" y2="11" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round"/><line x1="6" y1="13.5" x2="10" y2="13.5" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round"/></svg>,
};

const NAV = [
  { to:'/',               label:'Dashboard',      icon:'dash', roles:['admin','pilot','copilot'] },
  { to:'/day-operations', label:'Day Operations', icon:'ops',  roles:['admin','pilot','copilot'] },
  { to:'/flights',        label:'Flights',        icon:'flt',  roles:['admin','pilot','copilot'] },
  { to:'/pilots',         label:'Crew',           icon:'crew', roles:['admin','pilot','copilot'] },
  { to:'/aircraft',       label:'Fleet',          icon:'acft', roles:['admin'] },
  { to:'/destinations',   label:'Destinations',   icon:'dest', roles:['admin','pilot','copilot'] },
  { to:'/alerts',         label:'Alerts',         icon:'alrt', roles:['admin','pilot','copilot'] },
  { to:'/reports',        label:'Reports',        icon:'rpt',  roles:['admin'] },
];

const GROUPS = [
  { label:'Operations', items:['/','/day-operations','/flights'] },
  { label:'Resources',  items:['/pilots','/aircraft','/destinations'] },
  { label:'System',     items:['/alerts','/reports'] },
];

const CSS = `
.sb-item { transition:background .12s,color .12s,border-color .12s; text-decoration:none; }
.sb-item:hover { background:rgba(0,168,255,0.08)!important; color:#ffffff!important; }
.sb-item:hover svg { opacity:1!important; }
.sb-out  { transition:all .13s; cursor:pointer; }
.sb-out:hover { background:rgba(255,255,255,0.07)!important; color:#d0e8f8!important; }
.sb-grp  { font-size:8px; font-weight:700; color:${S.textFaint}; text-transform:uppercase; letter-spacing:0.2em; padding:12px 14px 4px; user-select:none; }
`;

export default function Sidebar({ open, onClose, isMobile }) {
  const { user, logout } = useAuth();
  const items      = NAV.filter(n => n.roles.includes(user?.role));
  const roleColor  = user?.role==='admin' ? S.amber : user?.role==='pilot' ? S.cyan : S.green;

  return (
    <>
      <style>{CSS}</style>
      <aside style={{ position:'fixed', top:0, left:0, height:'100vh', width:'var(--sidebar-w)', background:S.bg, borderRight:`1px solid ${S.border}`, display:'flex', flexDirection:'column', transform:open?'translateX(0)':'translateX(-100%)', transition:'transform .22s cubic-bezier(.4,0,.2,1)', zIndex:100, boxShadow:'3px 0 28px rgba(0,0,0,0.5)', willChange:'transform' }}>

        {/* Brand */}
        <div style={{ padding:'16px 14px', borderBottom:`1px solid ${S.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:9, background:'rgba(0,168,255,0.12)', border:'1px solid rgba(0,168,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="20" height="20" viewBox="0 0 60 60" fill="none">
                <ellipse cx="30" cy="11" rx="24" ry="4" fill="#00ccff" opacity=".9"/>
                <rect x="28.5" y="11" width="3" height="9" rx="1.5" fill="#00ccff"/>
                <ellipse cx="30" cy="28" rx="12" ry="5" fill="#00ccff"/>
                <path d="M18 28 Q10 31 5 36 L12 36 Q17.5 32 23.5 30Z" fill="#00ccff"/>
                <path d="M42 28 Q50 31 55 36 L48 36 Q42.5 32 36.5 30Z" fill="#00ccff" opacity=".8"/>
                <rect x="28.5" y="33" width="3" height="13" rx="1.5" fill="#00ccff"/>
                <ellipse cx="27" cy="47" rx="4" ry="2" fill="#00ccff" opacity=".4"/>
                <ellipse cx="33" cy="47" rx="4" ry="2" fill="#00ccff" opacity=".4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:'#ffffff', letterSpacing:'.01em', lineHeight:1.3 }}>BladeOps</div>
              <div style={{ fontSize:7.5, color:S.textFaint, letterSpacing:'.22em', textTransform:'uppercase' }}>Aviation OCC</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:`1px solid ${S.border}`, color:S.textMuted, borderRadius:6, width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, cursor:'pointer', flexShrink:0 }}>✕</button>
        </div>

        {/* Sector strip */}
        <div style={{ padding:'7px 14px', background:'rgba(0,0,0,0.25)', borderBottom:`1px solid ${S.border}`, flexShrink:0 }}>
          <div style={{ fontSize:7.5, color:S.textFaint, letterSpacing:'.18em', textTransform:'uppercase', marginBottom:2 }}>Active Sector</div>
          <div style={{ fontSize:9.5, color:'#60c0e0', fontWeight:700, letterSpacing:'.04em' }}>ANGOLA OFFSHORE · LUANDA FIR</div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, overflowY:'auto', padding:'4px 8px 8px' }}>
          {GROUPS.map(group => {
            const gi = items.filter(i => group.items.includes(i.to));
            if (!gi.length) return null;
            return (
              <div key={group.label}>
                <div className="sb-grp">{group.label}</div>
                {gi.map(({ to, label, icon }) => (
                  <NavLink key={to} to={to} end={to==='/'} onClick={()=>isMobile&&onClose&&onClose()}
                    className="sb-item"
                    style={({ isActive }) => ({
                      display:'flex', alignItems:'center', gap:9,
                      padding:'10px 10px', borderRadius:7, marginBottom:1,
                      fontSize:12.5, fontWeight:isActive?700:400,
                      color:isActive?'#ffffff':S.text,
                      background:isActive?'rgba(0,168,255,0.12)':'transparent',
                      borderLeft:`2px solid ${isActive?S.cyan:'transparent'}`,
                    })}>
                    <span style={{ width:18, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, opacity:0.8 }}>
                      {ICON[icon]}
                    </span>
                    {label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        {/* System status */}
        <div style={{ padding:'7px 12px', borderTop:`1px solid ${S.border}`, background:'rgba(0,0,0,0.2)', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:9 }}>
            <span style={{ color:S.green, fontWeight:700 }}>● ONLINE</span>
            <span style={{ color:S.textMuted }}>VMC · CAVOK</span>
            <span style={{ color:S.blue }}>FIR OK</span>
          </div>
        </div>

        {/* User */}
        <div style={{ padding:'10px 12px', borderTop:`1px solid ${S.border}`, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', background:'rgba(0,0,0,0.3)', borderRadius:8, border:`1px solid ${S.border}`, marginBottom:8 }}>
            <div style={{ width:30, height:30, borderRadius:7, background:`${roleColor}20`, border:`1px solid ${roleColor}45`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <span style={{ fontSize:9, fontWeight:800, color:roleColor }}>
                {user?.role==='admin'?'ADM':user?.role==='pilot'?'PLT':'COP'}
              </span>
            </div>
            <div style={{ overflow:'hidden', flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#ffffff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.name}</div>
              <div style={{ fontSize:8.5, color:S.textMuted, textTransform:'uppercase', letterSpacing:'.1em', marginTop:1 }}>{user?.role}</div>
            </div>
          </div>
          <button onClick={logout} className="sb-out"
            style={{ width:'100%', padding:'8px 10px', borderRadius:7, border:`1px solid ${S.border}`, background:'transparent', color:S.textMuted, fontSize:11.5, fontWeight:500, display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M6 2H2v12h4M11 5l3 3-3 3M14 8H6"/></svg>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}