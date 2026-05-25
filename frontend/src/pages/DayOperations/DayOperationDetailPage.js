import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dayOpsAPI, flightsAPI, destinationsAPI, tripsAPI, exportAPI } from '../../api';
import { useFetch } from '../../hooks/useFetch';
import { useAlert } from '../../context/AlertContext';
import { useAuth } from '../../context/AuthContext';
import { EmptyState } from '../../components/ui';

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtMin(m) {
  if (!m && m !== 0) return '—';
  const h = Math.floor(m/60), mn = m%60;
  return h > 0 ? `${h}h ${String(mn).padStart(2,'0')}m` : `${mn}m`;
}
function fmtSec(s) {
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sc = s%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'00')}`;
}
function calcBlockMin(on, off) {
  if (!on || !off) return 0;
  const [h1,m1] = on.slice(0,5).split(':').map(Number);
  const [h2,m2] = off.slice(0,5).split(':').map(Number);
  return Math.max(0,(h2*60+m2)-(h1*60+m1));
}
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function secondsSince(hhmmss) {
  if (!hhmmss) return 0;
  const parts = hhmmss.slice(0,8).split(':').map(Number);
  const now = new Date(), start = new Date();
  start.setHours(parts[0]||0, parts[1]||0, parts[2]||0, 0);
  return Math.max(0, Math.floor((now - start) / 1000));
}

// ── Design tokens ─────────────────────────────────────────────────────────
const D = {
  bg:        '#070f1c',
  surface:   '#0c1a2e',
  surface2:  '#102238',
  surface3:  '#142844',
  border:    'rgba(0,180,255,0.12)',
  borderHi:  'rgba(0,180,255,0.32)',
  blue:      '#00b4ff',
  blueGlow:  'rgba(0,180,255,0.18)',
  cyan:      '#00e5ff',
  green:     '#00e676',
  greenGlow: 'rgba(0,230,118,0.15)',
  amber:     '#ffc107',
  amberGlow: 'rgba(255,193,7,0.15)',
  red:       '#ff4444',
  redGlow:   'rgba(255,68,68,0.15)',
  teal:      '#00ddc8',
  text:      '#d4ebff',
  textSec:   '#80c0d8',
  textMuted: '#50909c',
  white:     '#ffffff',
};

const M = {
  surface:  '#0c1a2e',
  surface2: '#102238',
  surface3: '#142844',
  border:   'rgba(0,180,255,0.14)',
  blue:     '#00b4ff',
  green:    '#00e676',
  amber:    '#ffc107',
  red:      '#ff4444',
  text:     '#d4ebff',
  textSec:  '#80c0d8',
  textMut:  '#50909c',
};

const CSS = `
@keyframes pulseGreen { 0%,100%{box-shadow:0 0 0 0 rgba(0,230,118,0.4)}50%{box-shadow:0 0 0 8px rgba(0,230,118,0)} }
@keyframes pulseAmber { 0%,100%{box-shadow:0 0 0 0 rgba(255,193,7,0.4)}50%{box-shadow:0 0 0 8px rgba(255,193,7,0)} }
@keyframes pulseBlue  { 0%,100%{box-shadow:0 0 0 0 rgba(0,180,255,0.4)}50%{box-shadow:0 0 0 8px rgba(0,180,255,0)} }
@keyframes spin       { to{transform:rotate(360deg)} }
@keyframes fadein     { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none} }
.occ-row:hover td { background:rgba(0,180,255,0.05)!important; }
.occ-btn { transition:all .13s; font-family:inherit; }
.occ-btn:hover { opacity:.82; transform:translateY(-1px); }
.tab-content { animation:fadein .2s ease; }
`;

// ── Live Timer ─────────────────────────────────────────────────────────────
function LiveTimer({ startTime, label, color, glow }) {
  const [elapsed, setElapsed] = useState(() => secondsSince(startTime));
  useEffect(() => {
    const t = setInterval(() => setElapsed(secondsSince(startTime)), 1000);
    return () => clearInterval(t);
  }, [startTime]);
  return (
    <div style={{ flex:'1 1 170px', minWidth:155, background:D.surface2, borderRadius:12, border:`1px solid ${color}40`, boxShadow:`0 0 18px ${glow}`, padding:'13px 16px' }}>
      <div style={{ fontSize:9.5, color:D.textSec, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:32, fontWeight:900, color, fontFamily:'monospace', letterSpacing:'.06em', fontVariantNumeric:'tabular-nums' }}>
        {fmtSec(elapsed)}
      </div>
    </div>
  );
}

// ── Payload bar ────────────────────────────────────────────────────────────
function PayloadBar({ available, paxWeight, cargoWeight }) {
  const used=paxWeight+cargoWeight;
  const paxPct=available>0?Math.min((paxWeight/available)*100,100):0;
  const cargoPct=available>0?Math.min((cargoWeight/available)*100,100-paxPct):0;
  const free=Math.max(0,available-used), over=used>available;
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
        <span style={{ fontSize:9.5, color:D.textSec, textTransform:'uppercase', letterSpacing:'.06em' }}>Payload Distribution</span>
        <span style={{ fontWeight:700, color:over?D.red:D.green, fontSize:11 }}>
          {over?`⚠ OVERLOAD +${(used-available).toLocaleString()} lbs`:`${free.toLocaleString()} lbs available`}
        </span>
      </div>
      <div style={{ height:7, borderRadius:99, background:'#0a1628', overflow:'hidden', display:'flex', border:`1px solid ${D.border}` }}>
        <div style={{ width:`${paxPct}%`, background:'linear-gradient(90deg,#0080ff,#00b4ff)', transition:'width .5s' }}/>
        <div style={{ width:`${cargoPct}%`, background:'linear-gradient(90deg,#e68000,#ffc107)', transition:'width .5s' }}/>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:14, marginTop:7, fontSize:10, color:D.textSec }}>
        <span><span style={{ display:'inline-block',width:8,height:8,borderRadius:2,background:'#00b4ff',marginRight:5,verticalAlign:'middle' }}/>PAX {paxWeight.toLocaleString()} lbs</span>
        <span><span style={{ display:'inline-block',width:8,height:8,borderRadius:2,background:'#ffc107',marginRight:5,verticalAlign:'middle' }}/>Cargo {cargoWeight.toLocaleString()} lbs</span>
        <span><span style={{ display:'inline-block',width:8,height:8,borderRadius:2,background:'#0a1628',border:'1px solid #1a3a5a',marginRight:5,verticalAlign:'middle' }}/>Free {free.toLocaleString()} lbs</span>
        <span style={{ marginLeft:'auto', color:D.textMuted }}>Max {available.toLocaleString()} lbs</span>
      </div>
    </div>
  );
}

// ── Tab bar ────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display:'flex', gap:2, padding:'0 18px', borderBottom:`1px solid ${D.border}`, background:D.surface }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} className="occ-btn"
          style={{
            padding:'12px 16px', border:'none', borderBottom:`2px solid ${active===t.id?D.blue:'transparent'}`,
            background:'none', color:active===t.id?D.blue:D.textSec,
            fontSize:12, fontWeight:active===t.id?700:500, cursor:'pointer',
            letterSpacing:'.04em', display:'flex', alignItems:'center', gap:6,
            transition:'color .15s,border-color .15s',
          }}>
          {t.icon && <span style={{ fontSize:14 }}>{t.icon}</span>}
          {t.label}
          {t.badge!=null && (
            <span style={{ fontSize:9, padding:'1px 6px', borderRadius:99,
              background:active===t.id?`${D.blue}25`:`${D.textSec}18`,
              color:active===t.id?D.blue:D.textSec, fontWeight:700 }}>
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Stat row (for Overview) ────────────────────────────────────────────────
function StatRow({ label, value, color, border }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:border?`1px solid ${D.border}`:'none' }}>
      <span style={{ fontSize:12, color:D.textSec }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:700, color:color||D.text }}>{value}</span>
    </div>
  );
}

// ── Empty tab state ────────────────────────────────────────────────────────
function EmptyTab({ icon, title, sub, action }) {
  return (
    <div style={{ padding:'48px 20px', textAlign:'center' }}>
      <div style={{ fontSize:36, marginBottom:12 }}>{icon}</div>
      <div style={{ fontSize:15, fontWeight:700, color:D.text, marginBottom:6 }}>{title}</div>
      {sub&&<div style={{ fontSize:12, color:D.textSec, marginBottom:action?20:0, lineHeight:1.6 }}>{sub}</div>}
      {action}
    </div>
  );
}

// ── Modal primitives ───────────────────────────────────────────────────────
function DarkModal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null;
  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.78)', backdropFilter:'blur(5px)' }}/>
      <div style={{ position:'relative', background:M.surface, border:`1px solid ${M.blue}35`, borderRadius:16, width:'100%', maxWidth:wide?540:420, maxHeight:'90vh', overflow:'auto', boxShadow:'0 0 80px rgba(0,0,0,0.7)' }}>
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${M.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:M.surface, zIndex:1 }}>
          <span style={{ fontSize:15, fontWeight:700, color:M.text }}>{title}</span>
          <button onClick={onClose} className="occ-btn" style={{ background:'none', border:`1px solid ${M.border}`, color:M.textSec, fontSize:15, borderRadius:7, width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
        <div style={{ padding:'18px 20px' }}>{children}</div>
        {footer&&<div style={{ padding:'12px 20px', borderTop:`1px solid ${M.border}`, display:'flex', justifyContent:'flex-end', gap:8, position:'sticky', bottom:0, background:M.surface }}>{footer}</div>}
      </div>
    </div>
  );
}
function DarkInput({ type='text', value, onChange, placeholder, min, autoFocus }) {
  return <input type={type} value={value} onChange={onChange} placeholder={placeholder} min={min} autoFocus={autoFocus} style={{ width:'100%', padding:'10px 13px', background:M.surface3, color:M.text, border:`1px solid ${M.border}`, borderRadius:8, fontSize:13, outline:'none', marginBottom:12, boxSizing:'border-box', fontFamily:'inherit' }}/>;
}
function DarkSelect({ value, onChange, children }) {
  return <select value={value} onChange={onChange} style={{ width:'100%', padding:'10px 13px', background:M.surface3, color:M.text, border:`1px solid ${M.border}`, borderRadius:8, fontSize:13, outline:'none', marginBottom:12, boxSizing:'border-box', fontFamily:'inherit' }}>{children}</select>;
}
function Label({ children }) {
  return <div style={{ fontSize:10, color:M.textSec, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6, fontWeight:700 }}>{children}</div>;
}
function Grid2({ children }) {
  return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:2 }}>{children}</div>;
}
function SectionBox({ children, color, title }) {
  return (
    <div style={{ border:`1px solid ${color}30`, borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
      <div style={{ fontSize:10, color, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>{title}</div>
      {children}
    </div>
  );
}
function InfoBanner({ children, color }) {
  return <div style={{ background:`${color}10`, border:`1px solid ${color}30`, borderRadius:8, padding:'9px 12px', marginBottom:14, fontSize:11.5, color, lineHeight:1.5 }}>{children}</div>;
}
function MRow({ children, style }) {
  return <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5, ...style }}>{children}</div>;
}
function PrimaryBtn({ children, color, onClick, disabled }) {
  return <button onClick={onClick} disabled={disabled} className="occ-btn" style={{ padding:'9px 20px', borderRadius:8, background:color, color:'#000', fontSize:13, fontWeight:800, cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.4:1, border:'none' }}>{children}</button>;
}
function GhostBtn({ children, onClick }) {
  return <button onClick={onClick} className="occ-btn" style={{ padding:'9px 16px', borderRadius:8, background:'none', color:M.textSec, fontSize:13, cursor:'pointer', border:`1px solid ${M.border}` }}>{children}</button>;
}
function Btn({ children, color, onClick, disabled }) {
  return <button onClick={onClick} disabled={disabled} className="occ-btn" style={{ padding:'7px 13px', borderRadius:8, border:`1px solid ${color}45`, background:`${color}15`, color, fontSize:12, fontWeight:600, cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.4:1, letterSpacing:'.02em', whiteSpace:'nowrap' }}>{children}</button>;
}

// ═══════════════════════════════════════════════════════════════════════════
export default function DayOperationDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { isAdmin }                 = useAuth();
  const { success, error: showErr } = useAlert();

  const [activeTab, setActiveTab] = useState('overview');
  const [refreshKey, setRefreshKey] = useState(0);
  const [firstLoad,  setFirstLoad]  = useState(true);

  const { data, loading } = useFetch(() => dayOpsAPI.get(id), [id, refreshKey]);
  const { data: destsData } = useFetch(() => destinationsAPI.list());
  const dests = Array.isArray(destsData) ? destsData : (destsData?.destinations || destsData?.data || []);

  useEffect(() => { if (data && firstLoad) setFirstLoad(false); }, [data]);

  // Modal states
  const [rotorOnModal,  setRotorOnModal]  = useState(false);
  const [rotorOffModal, setRotorOffModal] = useState(false);
  const [partirModal,   setPartirModal]   = useState(false);
  const [chegarModal,   setChegarModal]   = useState(false);
  const [editModal,     setEditModal]     = useState(false);
  const [closeModal,    setCloseModal]    = useState(false);
  const [fuelModal,     setFuelModal]     = useState(false);
  const [editLeg,       setEditLeg]       = useState(null);

  const [rotorOnTime,  setRotorOnTime]  = useState(nowTime);
  const [rotorOffTime, setRotorOffTime] = useState(nowTime);
  const [fuelAdded,    setFuelAdded]    = useState('');
  const [fuelNotes,    setFuelNotes]    = useState('');

  const [pF, setPF] = useState({ fromDestId:'', toDestId:'', passengersOnBoard:'0', passengersWeightLbs:'0', cargoOnLbs:'0', notes:'' });
  const [cF, setCF] = useState({ fuelRemainingAfter:'', passengersDrop:'0', passengersPickup:'0', passengersPickupWeightLbs:'0', cargoOffLbs:'0' });
  const [eF, setEF] = useState({ passengersOnBoard:'', passengersWeightLbs:'', passengersDrop:'', passengersPickup:'', cargoOnLbs:'', cargoOffLbs:'', fuelRemainingAfter:'', departureTime:'', arrivalTime:'', notes:'', editReason:'' });

  const dayOp   = data?.dayOperation || {};
  const trips   = data?.trips        || [];
  const legs    = data?.flights      || [];
  const uplifts = data?.uplifts      || [];

  const activeTrip = trips.find(t => !t.rotor_off_time);
  const activeLeg  = legs.find(f => !f.arrival_time);
  const isOpen     = dayOp.status === 'open';
  const canClose   = isOpen && !activeTrip && trips.length > 0;
  const canReopen  = isAdmin && dayOp.status === 'closed' && (dayOp.total_block_minutes||0) < 480;

  const lastFuel      = dayOp.current_fuel_lbs > 0 ? dayOp.current_fuel_lbs : ([...legs].reverse().find(f => f.fuel_remaining_after > 0)?.fuel_remaining_after || (dayOp.initial_fuel_lbs||0));
  const totalUplift   = uplifts.reduce((a,u) => a + (u.uplift_lbs||0), 0);
  const totalBurn     = Math.max(0, (dayOp.initial_fuel_lbs||0) + totalUplift - lastFuel);
  const lastDoneLeg   = [...legs].reverse().find(f => f.arrival_time);
  const paxNext       = lastDoneLeg ? Math.max(0,(lastDoneLeg.passengers_on_board||0)-(lastDoneLeg.passengers_drop||0)+(lastDoneLeg.passengers_pickup||0)) : 0;
  const paxWtNext     = lastDoneLeg?.passengers_weight_after_lbs || 0;

  const mtow=dayOp.mtow_lbs||0, oew=dayOp.operating_weight_lbs||0, crew=dayOp.crew_weight_lbs||0;
  const payloadTotal  = Math.max(0, mtow-oew-crew-lastFuel);
  const curPaxWt      = activeLeg ? (activeLeg.passengers_weight_lbs||0) : paxWtNext;
  const curCargo      = Math.max(0, legs.reduce((a,f) => a+(f.cargo_on_lbs||0)-(f.cargo_off_lbs||0), 0));
  const payloadFree   = Math.max(0, payloadTotal-curPaxWt-curCargo);

  const pPaxWt        = parseInt(pF.passengersWeightLbs||0);
  const pCargoWt      = parseInt(pF.cargoOnLbs||0);
  const pPayFree      = payloadTotal-pPaxWt-pCargoWt;

  const blockMin      = trips.reduce((a,t) => a+(t.block_minutes||0), 0);
  const fuelPct       = dayOp.initial_fuel_lbs > 0 ? Math.min(100,(lastFuel/dayOp.initial_fuel_lbs)*100) : 0;
  const burnPreview   = cF.fuelRemainingAfter && activeLeg ? lastFuel - parseInt(cF.fuelRemainingAfter||0) : null;

  const actPaxCnt     = activeLeg?.passengers_on_board || 1;
  const actPaxWt      = activeLeg?.passengers_weight_lbs || 0;
  const avgPax        = actPaxWt > 0 ? Math.round(actPaxWt/Math.max(1,actPaxCnt)) : 0;
  const dropWtPrev    = parseInt(cF.passengersDrop||0) * avgPax;
  const pickupWt      = parseInt(cF.passengersPickupWeightLbs||0);
  const remPaxWt      = Math.max(0, actPaxWt-dropWtPrev+pickupWt);

  const anyModal = rotorOnModal||rotorOffModal||partirModal||chegarModal||editModal||closeModal||fuelModal;

  useEffect(() => {
    if (anyModal) return;
    const t = setInterval(() => setRefreshKey(k => k+1), 5000);
    return () => clearInterval(t);
  }, [anyModal]);

  // Auto-switch to TRIPS tab when rotor ON is completed and no trips yet
  useEffect(() => {
    if (trips.length > 0 && activeTab === 'overview' && activeLeg) setActiveTab('legs');
  }, [activeLeg]);

  const openPartirModal = () => {
    setPF({ fromDestId:lastDoneLeg?.to_dest_id||'', toDestId:'', passengersOnBoard:String(paxNext), passengersWeightLbs:String(paxWtNext), cargoOnLbs:'0', notes:'' });
    setPartirModal(true);
  };
  const openEditModal = (leg) => {
    setEditLeg(leg);
    setEF({ passengersOnBoard:String(leg.passengers_on_board||0), passengersWeightLbs:String(leg.passengers_weight_lbs||0), passengersDrop:String(leg.passengers_drop||0), passengersPickup:String(leg.passengers_pickup||0), cargoOnLbs:String(leg.cargo_on_lbs||0), cargoOffLbs:String(leg.cargo_off_lbs||0), fuelRemainingAfter:String(leg.fuel_remaining_after||''), departureTime:leg.departure_time?.slice(0,5)||'', arrivalTime:leg.arrival_time?.slice(0,5)||'', notes:leg.notes||'', editReason:'' });
    setEditModal(true);
  };

  const hRon    = useCallback(async () => { try { await tripsAPI.rotorOn(id,rotorOnTime); success('Rotor ON ✅'); setRotorOnModal(false); window.location.reload(); } catch(e) { showErr(e.response?.data?.error||'Error'); }}, [id,rotorOnTime,success,showErr]);
  const hRoff   = useCallback(async () => { if(!activeTrip)return; try { await tripsAPI.rotorOff(activeTrip.id,rotorOffTime); success('Rotor OFF ✅'); setRotorOffModal(false); window.location.reload(); } catch(e) { showErr(e.response?.data?.error||'Error'); }}, [activeTrip,rotorOffTime,success,showErr]);
  const hDep    = useCallback(async () => {
    if(!pF.fromDestId||!pF.toDestId){ showErr('Origin and destination required'); return; }
    if(pPayFree<0){ showErr(`Overload by ${Math.abs(pPayFree).toLocaleString()} lbs`); return; }
    try { await flightsAPI.create({ dayOpId:id, tripId:activeTrip?.id, fromDestId:pF.fromDestId, toDestId:pF.toDestId, passengersOnBoard:parseInt(pF.passengersOnBoard)||0, passengersWeightLbs:parseInt(pF.passengersWeightLbs)||0, cargoOnLbs:parseInt(pF.cargoOnLbs)||0, notes:pF.notes }); success('Flight started ✅'); setPartirModal(false); window.location.reload(); } catch(e) { showErr(e.response?.data?.error||'Error'); }
  }, [pF,pPayFree,id,activeTrip,success,showErr]);
  const hArr    = useCallback(async () => {
    if(!activeLeg)return;
    if(!cF.fuelRemainingAfter){ showErr('Fuel remaining required'); return; }
    try { await flightsAPI.arrive(activeLeg.id, { fuelRemainingAfter:parseInt(cF.fuelRemainingAfter)||0, passengersDrop:parseInt(cF.passengersDrop)||0, passengersPickup:parseInt(cF.passengersPickup)||0, passengersPickupWeightLbs:parseInt(cF.passengersPickupWeightLbs)||0, cargoOffLbs:parseInt(cF.cargoOffLbs)||0 }); success('Arrival registered ✅'); setChegarModal(false); window.location.reload(); } catch(e) { showErr(e.response?.data?.error||'Error'); }
  }, [activeLeg,cF,success,showErr]);
  const hEdit   = useCallback(async () => {
    if(!editLeg)return;
    if(!eF.editReason?.trim()){ showErr('Edit reason required'); return; }
    try { await flightsAPI.update(editLeg.id, { passengersOnBoard:parseInt(eF.passengersOnBoard)||0, passengersWeightLbs:parseInt(eF.passengersWeightLbs)||0, passengersDrop:parseInt(eF.passengersDrop)||0, passengersPickup:parseInt(eF.passengersPickup)||0, cargoOnLbs:parseInt(eF.cargoOnLbs)||0, cargoOffLbs:parseInt(eF.cargoOffLbs)||0, fuelRemainingAfter:parseInt(eF.fuelRemainingAfter)||0, departureTime:eF.departureTime||undefined, arrivalTime:eF.arrivalTime||undefined, notes:eF.notes, editReason:eF.editReason.trim() }); success('Updated ✅'); setEditModal(false); window.location.reload(); } catch(e) { showErr(e.response?.data?.error||'Error'); }
  }, [editLeg,eF,success,showErr]);
  const hFuel   = useCallback(async () => {
    if(!fuelAdded||parseInt(fuelAdded)<=0){ showErr('Invalid quantity'); return; }
    try { await dayOpsAPI.addFuel(id, { fuelAddedLbs:parseInt(fuelAdded), tripId:activeTrip?.id||null, notes:fuelNotes||null }); success('Uplift registered ✅'); setFuelModal(false); setFuelAdded(''); setFuelNotes(''); window.location.reload(); } catch(e) { showErr(e.response?.data?.error||'Error'); }
  }, [id,fuelAdded,fuelNotes,activeTrip,success,showErr]);
  const hClose  = useCallback(async () => { try { await dayOpsAPI.close(id,{motorOffTime:nowTime()}); success('Closed ✅'); setCloseModal(false); window.location.reload(); } catch(e) { showErr(e.response?.data?.error||'Error'); }}, [id,success,showErr]);
  const hReopen = useCallback(async () => { try { await dayOpsAPI.reopen(id); success('Reopened ✅'); window.location.reload(); } catch(e) { showErr(e.response?.data?.error||'Error'); }}, [id,success,showErr]);
  const hPDF    = useCallback(async () => {
    try { const r=await exportAPI.pdf(id); const url=window.URL.createObjectURL(new Blob([r.data],{type:'application/pdf'})); const a=document.createElement('a'); a.href=url; a.setAttribute('download',`techlog-${dayOp.aircraft_reg}-${new Date(dayOp.date).toLocaleDateString('en-GB').replace(/\//g,'-')}.pdf`); document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url); } catch(err) { showErr('PDF error'); }
  }, [id,dayOp,showErr]);

  if (loading && firstLoad) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:D.bg, flexDirection:'column', gap:14 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:42, height:42, border:`3px solid ${D.blue}30`, borderTop:`3px solid ${D.blue}`, borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
      <div style={{ color:D.textSec, fontSize:11, letterSpacing:'.14em', textTransform:'uppercase' }}>Loading Operation</div>
    </div>
  );
  if (!dayOp.id) return <EmptyState icon="❌" title="Operation not found"/>;

  const pf=(k,v)=>setPF(f=>({...f,[k]:v}));
  const cf=(k,v)=>setCF(f=>({...f,[k]:v}));
  const ef=(k,v)=>setEF(f=>({...f,[k]:v}));

  const totalPax  = legs.reduce((a,f) => a+(f.passengers_drop||0), 0);
  const totalCargo= legs.reduce((a,f) => a+(f.cargo_on_lbs||0), 0);

  const stt = activeLeg
    ? { label:'FLIGHT IN PROGRESS', color:D.blue,    glow:D.blueGlow,  pulse:'pulseBlue'  }
    : activeTrip
    ? { label:'ENGINE RUNNING',     color:D.amber,   glow:D.amberGlow, pulse:'pulseAmber' }
    : { label:'STANDBY',            color:D.textSec, glow:'transparent', pulse:null };

  const TABS = [
    { id:'overview', label:'Overview',  icon:'📊', badge:null },
    { id:'trips',    label:'Trips',     icon:'🚁', badge:trips.length||null },
    { id:'legs',     label:'Legs',      icon:'✈️', badge:legs.length||null },
    { id:'fuel',     label:'Fuel',      icon:'⛽', badge:uplifts.length||null },
  ];

  return (
    <div style={{ background:D.bg, minHeight:'100vh', paddingBottom:40, fontFamily:"'Inter',-apple-system,sans-serif" }}>
      <style>{CSS}</style>

      {/* ── TOP NAV ─────────────────────────────────────────────── */}
      <div style={{ background:D.surface, borderBottom:`1px solid ${D.border}`, padding:'0 18px', display:'flex', alignItems:'center', justifyContent:'space-between', height:54, position:'sticky', top:0, zIndex:100, gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
          <button onClick={() => navigate('/day-operations')} className="occ-btn"
            style={{ background:'none', border:`1px solid ${D.border}`, color:D.textSec, cursor:'pointer', fontSize:12, padding:'5px 10px', borderRadius:6 }}>
            ← Back
          </button>
          <div style={{ width:1, height:28, background:D.border, flexShrink:0 }}/>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:800, color:D.white, letterSpacing:'.02em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{dayOp.aircraft_reg}</div>
            <div style={{ fontSize:10, color:D.textSec }}>{dayOp.aircraft_type} · {new Date(dayOp.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>
          </div>
          <div style={{ fontSize:10.5, color:D.textSec, whiteSpace:'nowrap', display:'flex', gap:5 }}>
            <span style={{ color:D.text, fontWeight:600 }}>{dayOp.commander_name}</span>
            <span style={{ color:D.textMuted }}>·</span>
            <span style={{ color:D.text, fontWeight:600 }}>{dayOp.copilot_name}</span>
          </div>
        </div>

        <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
          <div style={{ padding:'3px 8px', borderRadius:99, fontSize:9, fontWeight:700, letterSpacing:'.08em', border:'1px solid',
            ...(dayOp.status==='open'?{color:D.green,borderColor:D.green+'55',background:D.greenGlow}
              :dayOp.status==='closed'?{color:D.amber,borderColor:D.amber+'55',background:D.amberGlow}
              :{color:D.blue,borderColor:D.blue+'55',background:D.blueGlow}) }}>
            {(dayOp.status||'').toUpperCase()}
          </div>
          {isOpen&&!activeTrip&&<Btn color={D.green} onClick={()=>{setRotorOnTime(nowTime());setRotorOnModal(true);}}>🟢 Rotor ON</Btn>}
          {isOpen&&activeTrip&&activeLeg&&<Btn color={D.blue} onClick={()=>{setCF({fuelRemainingAfter:'',passengersDrop:'0',passengersPickup:'0',passengersPickupWeightLbs:'0',cargoOffLbs:'0'});setChegarModal(true);}}>🛬 Arrival</Btn>}
          {isOpen&&activeTrip&&!activeLeg&&<>
            <Btn color={D.blue} onClick={openPartirModal}>✈️ Start Flight</Btn>
            <Btn color={D.textSec} onClick={()=>{setFuelAdded('');setFuelNotes('');setFuelModal(true);}}>⛽ Uplift</Btn>
            <Btn color={D.amber} onClick={()=>{setRotorOffTime(nowTime());setRotorOffModal(true);}}>🔴 Rotor OFF</Btn>
          </>}
          {canClose&&<Btn color={D.red} onClick={()=>setCloseModal(true)}>Close Day</Btn>}
          {canReopen&&<Btn color={D.textSec} onClick={hReopen}>🔓 Reopen</Btn>}
          <Btn color={D.textSec} onClick={hPDF}>📄 PDF</Btn>
        </div>
      </div>

      {/* ── STATUS HERO — sempre visível ──────────────────────── */}
      <div style={{ background:D.surface, borderBottom:`1px solid ${D.border}`, boxShadow:activeTrip?`0 4px 40px ${stt.glow}`:'none' }}>

        {/* Status + payload */}
        <div style={{ padding:'18px 20px', borderBottom:`1px solid ${D.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {stt.pulse&&<div style={{ width:11, height:11, borderRadius:'50%', background:stt.color, animation:`${stt.pulse} 2s infinite`, flexShrink:0 }}/>}
            <div>
              <div style={{ fontSize:26, fontWeight:900, color:stt.color, letterSpacing:'.01em', lineHeight:1 }}>{stt.label}</div>
              <div style={{ fontSize:12, color:D.textSec, marginTop:4 }}>
                {activeLeg
                  ? `${dests.find(d=>d.id===activeLeg.from_dest_id)?.name||'—'} → ${dests.find(d=>d.id===activeLeg.to_dest_id)?.name||'—'} · Leg #${activeLeg.flight_number}`
                  : activeTrip ? `Trip #${activeTrip.trip_number} · ${activeTrip.leg_count||0} leg(s) completed`
                  : 'Angola Offshore · Waiting for Rotor ON'}
              </div>
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:9.5, color:D.textSec, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:3 }}>Payload Available</div>
            <div style={{ fontSize:32, fontWeight:900, color:payloadFree>0?D.green:D.red, fontVariantNumeric:'tabular-nums', lineHeight:1 }}>
              {payloadFree.toLocaleString()} <span style={{ fontSize:14, fontWeight:500, color:D.textSec }}>lbs</span>
            </div>
          </div>
        </div>

        {/* Payload bar */}
        <div style={{ padding:'12px 20px', borderBottom:`1px solid ${D.border}` }}>
          <PayloadBar available={payloadTotal} paxWeight={curPaxWt} cargoWeight={curCargo}/>
        </div>

        {/* 5 metrics strip */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(115px,1fr))', gap:1, background:D.border }}>
          {[
            { label:'Fuel',         value:`${lastFuel.toLocaleString()}`,   unit:'lbs', color:fuelPct<20?D.red:fuelPct<40?D.amber:D.green, icon:'⛽' },
            { label:'PAX',          value:activeLeg?(activeLeg.passengers_on_board||0):paxNext, unit:'pax', color:D.blue, icon:'👥' },
            { label:'PAX Weight',   value:`${curPaxWt.toLocaleString()}`,   unit:'lbs', color:D.text, icon:'⚖️' },
            { label:'Cargo',        value:`${curCargo.toLocaleString()}`,   unit:'lbs', color:D.amber, icon:'📦' },
            { label:'Block Time',   value:fmtMin(blockMin), unit:'', color:blockMin>420?D.red:blockMin>360?D.amber:D.text, icon:'⏱' },
          ].map(m => (
            <div key={m.label} style={{ background:D.surface2, padding:'11px 14px' }}>
              <div style={{ fontSize:9, color:D.textSec, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{m.icon} {m.label}</div>
              <div style={{ fontSize:20, fontWeight:800, color:m.color, fontVariantNumeric:'tabular-nums' }}>
                {m.value} <span style={{ fontSize:9.5, color:D.textMuted, fontWeight:400 }}>{m.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Timers */}
        {activeTrip&&(
          <div style={{ padding:'12px 18px', display:'flex', gap:10, flexWrap:'wrap', borderTop:`1px solid ${D.border}` }}>
            <LiveTimer startTime={activeTrip.rotor_on_time} label={`Trip #${activeTrip.trip_number} — Engine ON`} color={D.amber} glow={D.amberGlow}/>
            {activeLeg&&<LiveTimer startTime={activeLeg.departure_time} label={`Leg #${activeLeg.flight_number} — Flight Time`} color={D.blue} glow={D.blueGlow}/>}
          </div>
        )}

        {/* 8h warning */}
        {blockMin>420&&(
          <div style={{ padding:'9px 18px', background:'rgba(255,68,68,0.08)', borderTop:`1px solid ${D.red}35`, fontSize:12, color:D.red, fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
            ⚠ {fmtMin(blockMin)} flown — {Math.max(0,480-blockMin)>0?`${fmtMin(Math.max(0,480-blockMin))} remaining`:'DUTY LIMIT REACHED'}
          </div>
        )}

        {/* ── TAB BAR ───────────────────────────────────────────── */}
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab}/>
      </div>

      {/* ── TAB CONTENT ─────────────────────────────────────────── */}
      <div style={{ maxWidth:1400, margin:'0 auto', padding:'16px 16px 0' }}>

        {/* ════ OVERVIEW TAB ════════════════════════════════════ */}
        {activeTab==='overview'&&(
          <div className="tab-content">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>

              {/* Daily totals */}
              <div style={{ background:D.surface, borderRadius:14, border:`1px solid ${D.border}`, overflow:'hidden' }}>
                <div style={{ padding:'13px 18px', borderBottom:`1px solid ${D.border}`, display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:3, height:14, borderRadius:1, background:D.blue }}/>
                  <span style={{ fontSize:12, fontWeight:700, color:D.white, textTransform:'uppercase', letterSpacing:'.06em' }}>Daily Totals</span>
                </div>
                <div style={{ padding:'6px 18px 14px' }}>
                  <StatRow label="Block Time"    value={fmtMin(blockMin)} border/>
                  <StatRow label="Trips"         value={`${trips.length} (${trips.filter(t=>t.rotor_off_time).length} completed)`} border/>
                  <StatRow label="Legs"          value={`${legs.filter(f=>f.arrival_time).length} / ${legs.length} completed`} border/>
                  <StatRow label="PAX Transported" value={String(totalPax)}  color={D.blue} border/>
                  <StatRow label="Cargo Loaded"  value={`${totalCargo.toLocaleString()} lbs`} color={D.amber} border/>
                  <StatRow label="Fuel Burned"   value={`${totalBurn.toLocaleString()} lbs`} color={D.red} border/>
                  <StatRow label="Fuel Remaining" value={`${lastFuel.toLocaleString()} lbs`} color={D.green} border={false}/>
                  {totalUplift>0&&<StatRow label="Total Uplift" value={`+${totalUplift.toLocaleString()} lbs`} color={D.teal} border={false}/>}
                </div>
              </div>

              {/* Aircraft + Crew */}
              <div style={{ background:D.surface, borderRadius:14, border:`1px solid ${D.border}`, overflow:'hidden' }}>
                <div style={{ padding:'13px 18px', borderBottom:`1px solid ${D.border}`, display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:3, height:14, borderRadius:1, background:D.amber }}/>
                  <span style={{ fontSize:12, fontWeight:700, color:D.white, textTransform:'uppercase', letterSpacing:'.06em' }}>Operation Details</span>
                </div>
                <div style={{ padding:'6px 18px 14px' }}>
                  <StatRow label="Aircraft"     value={`${dayOp.aircraft_reg} · ${dayOp.aircraft_type}`} color={D.cyan} border/>
                  <StatRow label="Commander"    value={dayOp.commander_name||'—'} border/>
                  <StatRow label="Copilot"      value={dayOp.copilot_name||'—'} border/>
                  <StatRow label="Date"         value={new Date(dayOp.date).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})} border/>
                  <StatRow label="MTOW"         value={`${(dayOp.mtow_lbs||0).toLocaleString()} lbs`} border/>
                  <StatRow label="Initial Fuel" value={`${(dayOp.initial_fuel_lbs||0).toLocaleString()} lbs`} border/>
                  <StatRow label="Payload Max"  value={`${payloadTotal.toLocaleString()} lbs`} color={D.green} border={false}/>
                </div>
              </div>
            </div>

            {/* Quick actions when no active ops */}
            {isOpen&&!activeTrip&&(
              <div style={{ marginTop:14, background:D.surface, borderRadius:14, border:`1px solid ${D.green}25`, padding:'20px', textAlign:'center' }}>
                <div style={{ fontSize:13, color:D.textSec, marginBottom:14 }}>Ready to start operations — press Rotor ON to begin Trip #{trips.length+1}</div>
                <Btn color={D.green} onClick={()=>{setRotorOnTime(nowTime());setRotorOnModal(true);}}>🟢 Start Trip — Rotor ON</Btn>
              </div>
            )}
            {isOpen&&activeTrip&&!activeLeg&&(
              <div style={{ marginTop:14, background:D.surface, borderRadius:14, border:`1px solid ${D.blue}25`, padding:'20px', textAlign:'center' }}>
                <div style={{ fontSize:13, color:D.textSec, marginBottom:14 }}>Engine running · Trip #{activeTrip.trip_number} · Ready to depart</div>
                <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
                  <Btn color={D.blue} onClick={openPartirModal}>✈️ Start Flight</Btn>
                  <Btn color={D.textSec} onClick={()=>{setFuelAdded('');setFuelNotes('');setFuelModal(true);}}>⛽ Add Uplift</Btn>
                  <Btn color={D.amber} onClick={()=>{setRotorOffTime(nowTime());setRotorOffModal(true);}}>🔴 Rotor OFF</Btn>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ TRIPS TAB ═══════════════════════════════════════ */}
        {activeTab==='trips'&&(
          <div className="tab-content" style={{ background:D.surface, borderRadius:14, border:`1px solid ${D.border}`, overflow:'hidden' }}>
            {trips.length===0
              ?<EmptyTab icon="🚁" title="No trips yet" sub={isOpen?'Press Rotor ON to start the first trip':'No trips recorded for this operation'}
                  action={isOpen&&<Btn color={D.green} onClick={()=>{setRotorOnTime(nowTime());setRotorOnModal(true);}}>🟢 Rotor ON</Btn>}/>
              :<div style={{ overflowX:'auto' }}>
                 <table style={{ width:'100%', minWidth:500, borderCollapse:'collapse', fontSize:12 }}>
                   <thead><tr style={{ background:D.surface3 }}>
                     {['Trip','Rotor ON','Rotor OFF','Block Time','Legs','PAX','Fuel Burn'].map(h=>(
                       <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:9.5, color:D.textSec, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', borderBottom:`1px solid ${D.border}`, whiteSpace:'nowrap' }}>{h}</th>
                     ))}
                   </tr></thead>
                   <tbody>
                     {trips.map((t,i)=>(
                       <tr key={t.id} className="occ-row" style={{ borderBottom:`1px solid ${D.border}`, background:i%2===0?'transparent':D.surface2 }}>
                         <td style={{ padding:'11px 14px', color:D.blue, fontWeight:700 }}>#{t.trip_number}</td>
                         <td style={{ padding:'11px 14px', color:D.text, fontFamily:'monospace' }}>{t.rotor_on_time?.slice(0,5)||'—'}</td>
                         <td style={{ padding:'11px 14px' }}>
                           {t.rotor_off_time
                             ?<span style={{ color:D.text, fontFamily:'monospace' }}>{t.rotor_off_time.slice(0,5)}</span>
                             :<span style={{ color:D.amber, fontSize:9.5, fontWeight:700, padding:'2px 8px', borderRadius:99, border:`1px solid ${D.amber}45`, background:D.amberGlow }}>ACTIVE</span>}
                         </td>
                         <td style={{ padding:'11px 14px', color:D.text }}>{t.block_minutes?fmtMin(t.block_minutes):'—'}</td>
                         <td style={{ padding:'11px 14px', color:D.text }}>{t.leg_count||0}</td>
                         <td style={{ padding:'11px 14px', color:D.blue, fontWeight:600 }}>{t.trip_pax||0}</td>
                         <td style={{ padding:'11px 14px', color:D.red }}>{t.trip_fuel_burn?`${parseInt(t.trip_fuel_burn).toLocaleString()} lbs`:'—'}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>}
          </div>
        )}

        {/* ════ LEGS TAB ════════════════════════════════════════ */}
        {activeTab==='legs'&&(
          <div className="tab-content" style={{ background:D.surface, borderRadius:14, border:`1px solid ${D.border}`, overflow:'hidden' }}>
            {legs.length===0
              ?<EmptyTab icon="✈️" title="No legs registered" sub={isOpen&&activeTrip?'Press Start Flight to begin the first leg':'Start a trip first by pressing Rotor ON'}
                  action={isOpen&&activeTrip&&!activeLeg&&<Btn color={D.blue} onClick={openPartirModal}>✈️ Start Flight</Btn>}/>
              :<div style={{ overflowX:'auto' }}>
                 <table style={{ width:'100%', minWidth:800, borderCollapse:'collapse', fontSize:11 }}>
                   <thead><tr style={{ background:D.surface3 }}>
                     {['#','From','To','Dep','Arr','Dur','PAX','PAX Wt','Off','On','Rem Wt','Cargo On','Cargo Off','Fuel Rem','Fuel Burn',''].map(h=>(
                       <th key={h} style={{ padding:'8px 11px', textAlign:'left', fontSize:9, color:D.textSec, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', borderBottom:`1px solid ${D.border}`, whiteSpace:'nowrap' }}>{h}</th>
                     ))}
                   </tr></thead>
                   <tbody>
                     {legs.map((f,i)=>(
                       <tr key={f.id} className="occ-row" style={{ borderBottom:`1px solid ${D.border}`, background:i%2===0?'transparent':D.surface2 }}>
                         <td style={{ padding:'9px 11px', color:D.textSec, fontWeight:600 }}>{f.flight_number}</td>
                         <td style={{ padding:'9px 11px', color:D.text, whiteSpace:'nowrap' }}>{f.from_name||'—'}</td>
                         <td style={{ padding:'9px 11px', color:D.text, whiteSpace:'nowrap' }}>{f.to_name||'—'}</td>
                         <td style={{ padding:'9px 11px', color:D.text, fontFamily:'monospace' }}>{f.departure_time?f.departure_time.slice(0,5):'—'}</td>
                         <td style={{ padding:'9px 11px' }}>
                           {f.arrival_time
                             ?<span style={{ color:D.text, fontFamily:'monospace' }}>{f.arrival_time.slice(0,5)}</span>
                             :<span style={{ color:D.blue, fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:99, border:`1px solid ${D.blue}45`, background:D.blueGlow }}>IN FLIGHT</span>}
                         </td>
                         <td style={{ padding:'9px 11px', color:D.text }}>{f.duration_minutes?fmtMin(f.duration_minutes):'—'}</td>
                         <td style={{ padding:'9px 11px', color:D.blue, fontWeight:600 }}>{f.passengers_on_board||0}</td>
                         <td style={{ padding:'9px 11px', color:D.text }}>{f.passengers_weight_lbs?`${f.passengers_weight_lbs} lbs`:'—'}</td>
                         <td style={{ padding:'9px 11px', color:D.red }}>{f.passengers_drop||0}</td>
                         <td style={{ padding:'9px 11px', color:D.green }}>{f.passengers_pickup||0}</td>
                         <td style={{ padding:'9px 11px', color:D.text }}>{f.passengers_weight_after_lbs?`${f.passengers_weight_after_lbs} lbs`:'—'}</td>
                         <td style={{ padding:'9px 11px', color:D.amber, fontWeight:600 }}>{f.cargo_on_lbs?`${f.cargo_on_lbs} lbs`:'—'}</td>
                         <td style={{ padding:'9px 11px', color:D.textSec }}>{f.cargo_off_lbs?`${f.cargo_off_lbs} lbs`:'—'}</td>
                         <td style={{ padding:'9px 11px', color:D.green, fontWeight:600 }}>{f.fuel_remaining_after?`${Number(f.fuel_remaining_after).toLocaleString()} lbs`:'—'}</td>
                         <td style={{ padding:'9px 11px', color:D.red, fontWeight:600 }}>{f.fuel_burn_lbs?`${Number(f.fuel_burn_lbs).toLocaleString()} lbs`:'—'}</td>
                         <td style={{ padding:'9px 11px' }}>
                           <button onClick={e=>{e.stopPropagation();openEditModal(f);}} className="occ-btn" style={{ background:'none', border:`1px solid ${D.border}`, color:D.textSec, borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:10 }}>✏️</button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>}
          </div>
        )}

        {/* ════ FUEL TAB ════════════════════════════════════════ */}
        {activeTab==='fuel'&&(
          <div className="tab-content">

            {/* Fuel summary cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10, marginBottom:14 }}>
              {[
                { label:'Initial Fuel',     value:`${(dayOp.initial_fuel_lbs||0).toLocaleString()}`, unit:'lbs', color:D.textSec },
                { label:'Total Uplift',     value:`+${totalUplift.toLocaleString()}`,                 unit:'lbs', color:totalUplift>0?D.teal:D.textSec },
                { label:'Total Burned',     value:`${totalBurn.toLocaleString()}`,                    unit:'lbs', color:D.red },
                { label:'Current Onboard',  value:`${lastFuel.toLocaleString()}`,                     unit:'lbs', color:fuelPct<20?D.red:fuelPct<40?D.amber:D.green },
              ].map(m=>(
                <div key={m.label} style={{ background:D.surface, borderRadius:11, border:`1px solid ${D.border}`, padding:'14px 16px' }}>
                  <div style={{ fontSize:9.5, color:D.textSec, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>{m.label}</div>
                  <div style={{ fontSize:22, fontWeight:800, color:m.color, fontVariantNumeric:'tabular-nums' }}>
                    {m.value} <span style={{ fontSize:10, color:D.textMuted, fontWeight:400 }}>{m.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Add uplift button */}
            {isOpen&&activeTrip&&(
              <div style={{ marginBottom:14, display:'flex', justifyContent:'flex-end' }}>
                <Btn color={D.green} onClick={()=>{setFuelAdded('');setFuelNotes('');setFuelModal(true);}}>⛽ Register Uplift</Btn>
              </div>
            )}

            {/* Uplifts table */}
            <div style={{ background:D.surface, borderRadius:14, border:`1px solid ${D.border}`, overflow:'hidden' }}>
              <div style={{ padding:'13px 18px', borderBottom:`1px solid ${D.border}`, display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:3, height:14, borderRadius:1, background:D.green }}/>
                <span style={{ fontSize:12, fontWeight:700, color:D.white, textTransform:'uppercase', letterSpacing:'.06em' }}>Uplift History</span>
                {totalUplift>0&&<span style={{ fontSize:9.5, color:D.teal, fontWeight:700 }}>+{totalUplift.toLocaleString()} lbs total</span>}
              </div>
              {uplifts.length===0
                ?<EmptyTab icon="⛽" title="No uplifts recorded" sub="Use the Register Uplift button when refuelling"/>
                :<div style={{ overflowX:'auto' }}>
                   <table style={{ width:'100%', minWidth:400, borderCollapse:'collapse', fontSize:12 }}>
                     <thead><tr style={{ background:D.surface3 }}>
                       {['Time','Trip','Before','Added','After','Notes'].map(h=>(
                         <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:9.5, color:D.textSec, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', borderBottom:`1px solid ${D.border}` }}>{h}</th>
                       ))}
                     </tr></thead>
                     <tbody>
                       {uplifts.map((u,i)=>(
                         <tr key={u.id} className="occ-row" style={{ borderBottom:`1px solid ${D.border}`, background:i%2===0?'transparent':D.surface2 }}>
                           <td style={{ padding:'10px 14px', color:D.text, fontFamily:'monospace' }}>{u.uplift_time?.slice(0,5)||'—'}</td>
                           <td style={{ padding:'10px 14px', color:D.textSec }}>{u.trip_number?`#${u.trip_number}`:'—'}</td>
                           <td style={{ padding:'10px 14px', color:D.textSec }}>{(u.fuel_before_lbs||0).toLocaleString()} lbs</td>
                           <td style={{ padding:'10px 14px', color:D.green, fontWeight:700 }}>+{(u.uplift_lbs||0).toLocaleString()} lbs</td>
                           <td style={{ padding:'10px 14px', color:D.text, fontWeight:600 }}>{(u.fuel_after_lbs||0).toLocaleString()} lbs</td>
                           <td style={{ padding:'10px 14px', color:D.textSec }}>{u.notes||'—'}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>}
            </div>

            {/* Per-trip fuel breakdown */}
            {trips.length>0&&(
              <div style={{ background:D.surface, borderRadius:14, border:`1px solid ${D.border}`, overflow:'hidden', marginTop:14 }}>
                <div style={{ padding:'13px 18px', borderBottom:`1px solid ${D.border}`, display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:3, height:14, borderRadius:1, background:D.amber }}/>
                  <span style={{ fontSize:12, fontWeight:700, color:D.white, textTransform:'uppercase', letterSpacing:'.06em' }}>Fuel by Trip</span>
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', minWidth:350, borderCollapse:'collapse', fontSize:12 }}>
                    <thead><tr style={{ background:D.surface3 }}>
                      {['Trip','Legs','Fuel Burn','PAX'].map(h=>(
                        <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:9.5, color:D.textSec, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', borderBottom:`1px solid ${D.border}` }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {trips.map((t,i)=>(
                        <tr key={t.id} className="occ-row" style={{ borderBottom:`1px solid ${D.border}`, background:i%2===0?'transparent':D.surface2 }}>
                          <td style={{ padding:'10px 14px', color:D.blue, fontWeight:700 }}>#{t.trip_number}</td>
                          <td style={{ padding:'10px 14px', color:D.text }}>{t.leg_count||0}</td>
                          <td style={{ padding:'10px 14px', color:D.red, fontWeight:600 }}>{t.trip_fuel_burn?`${parseInt(t.trip_fuel_burn).toLocaleString()} lbs`:'—'}</td>
                          <td style={{ padding:'10px 14px', color:D.blue }}>{t.trip_pax||0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ═══════════════════ MODALS ══════════════════════════════ */}

      <DarkModal open={rotorOnModal} onClose={()=>setRotorOnModal(false)} title="🟢 Rotor ON"
        footer={<><GhostBtn onClick={()=>setRotorOnModal(false)}>Cancel</GhostBtn><PrimaryBtn color={D.green} onClick={hRon}>Confirm Rotor ON</PrimaryBtn></>}>
        <Label>Rotor ON Time</Label>
        <DarkInput type="time" value={rotorOnTime} onChange={e=>setRotorOnTime(e.target.value)}/>
        <div style={{ fontSize:12, color:M.textSec }}>Trip #{trips.length+1} of the day</div>
      </DarkModal>

      <DarkModal open={rotorOffModal} onClose={()=>setRotorOffModal(false)} title="🔴 Rotor OFF"
        footer={<><GhostBtn onClick={()=>setRotorOffModal(false)}>Cancel</GhostBtn><PrimaryBtn color={D.amber} onClick={hRoff}>Confirm Rotor OFF</PrimaryBtn></>}>
        <Label>Rotor OFF Time</Label>
        <DarkInput type="time" value={rotorOffTime} onChange={e=>setRotorOffTime(e.target.value)}/>
        {activeTrip&&(
          <div style={{ marginTop:12, padding:'12px 14px', background:M.surface3, borderRadius:8, fontSize:12 }}>
            <MRow><span style={{ color:M.textSec }}>Rotor ON</span><span style={{ color:D.amber, fontFamily:'monospace' }}>{activeTrip.rotor_on_time?.slice(0,5)}</span></MRow>
            <MRow><span style={{ color:M.textSec }}>This trip</span><strong style={{ color:M.text }}>{fmtMin(calcBlockMin(activeTrip.rotor_on_time,rotorOffTime))}</strong></MRow>
            <MRow style={{ borderTop:`1px solid ${M.border}`, paddingTop:5, marginTop:3 }}><span style={{ color:M.textSec }}>Total today</span><strong style={{ color:blockMin>420?D.red:M.text }}>{fmtMin(blockMin+calcBlockMin(activeTrip.rotor_on_time,rotorOffTime))} / 8h</strong></MRow>
          </div>
        )}
      </DarkModal>

      <DarkModal open={partirModal} onClose={()=>setPartirModal(false)} title="✈️ Start Flight" wide
        footer={<><GhostBtn onClick={()=>setPartirModal(false)}>Cancel</GhostBtn><PrimaryBtn color={D.blue} onClick={hDep} disabled={pPayFree<0}>Depart Now</PrimaryBtn></>}>
        <InfoBanner color={D.blue}>🕐 Auto departure · ⛽ {lastFuel.toLocaleString()} lbs · 📦 Payload: {payloadTotal.toLocaleString()} lbs</InfoBanner>
        <Grid2>
          <div><Label>From *</Label><DarkSelect value={pF.fromDestId} onChange={e=>pf('fromDestId',e.target.value)}><option value="">— Origin —</option>{dests.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</DarkSelect></div>
          <div><Label>To *</Label><DarkSelect value={pF.toDestId} onChange={e=>pf('toDestId',e.target.value)}><option value="">— Destination —</option>{dests.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</DarkSelect></div>
        </Grid2>
        <SectionBox color={D.blue} title="👥 Passengers">
          <Grid2>
            <div><Label>Number of PAX</Label><DarkInput type="number" min={0} value={pF.passengersOnBoard} onChange={e=>pf('passengersOnBoard',e.target.value)}/></div>
            <div><Label>Total PAX Weight (lbs)</Label><DarkInput type="number" min={0} placeholder="ex: 840" value={pF.passengersWeightLbs} onChange={e=>pf('passengersWeightLbs',e.target.value)}/></div>
          </Grid2>
          {parseInt(pF.passengersOnBoard||0)>0&&parseInt(pF.passengersWeightLbs||0)>0&&(
            <div style={{ fontSize:11.5, color:D.blue }}>Avg: <strong>{Math.round(parseInt(pF.passengersWeightLbs)/Math.max(1,parseInt(pF.passengersOnBoard)))} lbs/PAX</strong></div>
          )}
        </SectionBox>
        <SectionBox color={D.amber} title="📦 Cargo">
          <Label>Cargo Weight (lbs)</Label>
          <DarkInput type="number" min={0} placeholder="0" value={pF.cargoOnLbs} onChange={e=>pf('cargoOnLbs',e.target.value)}/>
        </SectionBox>
        <div style={{ background:M.surface3, borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
          <PayloadBar available={payloadTotal} paxWeight={pPaxWt} cargoWeight={pCargoWt}/>
          {pPayFree<0&&<div style={{ marginTop:8, fontSize:12, color:D.red, fontWeight:700 }}>⚠ Cannot depart — overload by {Math.abs(pPayFree).toLocaleString()} lbs</div>}
        </div>
        <Label>Notes</Label>
        <DarkInput value={pF.notes} onChange={e=>pf('notes',e.target.value)} placeholder="Operational notes…"/>
      </DarkModal>

      <DarkModal open={chegarModal} onClose={()=>setChegarModal(false)} title="🛬 Register Arrival" wide
        footer={<><GhostBtn onClick={()=>setChegarModal(false)}>Cancel</GhostBtn><PrimaryBtn color={D.amber} onClick={hArr}>Confirm Arrival</PrimaryBtn></>}>
        {activeLeg&&(
          <div style={{ background:M.surface3, borderRadius:10, padding:'12px 14px', marginBottom:14, fontSize:12 }}>
            <div style={{ fontWeight:700, color:M.text, marginBottom:4 }}>Leg #{activeLeg.flight_number} · Dep {activeLeg.departure_time?.slice(0,5)}</div>
            <div style={{ color:M.textSec }}>PAX: <strong style={{ color:D.blue }}>{activeLeg.passengers_on_board||0}</strong>{activeLeg.passengers_weight_lbs?` (${activeLeg.passengers_weight_lbs.toLocaleString()} lbs)`:''}{avgPax>0?<span> · avg {avgPax} lbs/PAX</span>:''}</div>
            <div style={{ fontSize:10.5, color:D.blue, marginTop:4 }}>🕐 Arrival time recorded automatically</div>
          </div>
        )}
        <Label>Fuel Remaining After Landing (lbs) *</Label>
        <DarkInput type="number" min={0} placeholder="ex: 1100" value={cF.fuelRemainingAfter} onChange={e=>cf('fuelRemainingAfter',e.target.value)}/>
        {burnPreview!==null&&<div style={{ fontSize:12, marginBottom:10, color:burnPreview<0?D.red:M.textSec }}>{burnPreview<0?'⚠ Exceeds available fuel':`Fuel burned: ${burnPreview.toLocaleString()} lbs`}</div>}
        <SectionBox color={D.blue} title="👥 Passengers">
          <Grid2>
            <div><Label>PAX Off (↓)</Label><DarkInput type="number" min={0} value={cF.passengersDrop} onChange={e=>cf('passengersDrop',e.target.value)}/></div>
            <div><Label>PAX On (↑)</Label><DarkInput type="number" min={0} value={cF.passengersPickup} onChange={e=>cf('passengersPickup',e.target.value)}/></div>
          </Grid2>
          {parseInt(cF.passengersPickup||0)>0&&<><Label>Weight of PAX Picked Up (lbs)</Label><DarkInput type="number" min={0} placeholder="ex: 420" value={cF.passengersPickupWeightLbs} onChange={e=>cf('passengersPickupWeightLbs',e.target.value)}/></>}
          {avgPax>0&&(parseInt(cF.passengersDrop||0)>0||parseInt(cF.passengersPickup||0)>0)&&(
            <div style={{ padding:'10px 12px', background:D.bg, borderRadius:8, fontSize:12 }}>
              <MRow><span style={{ color:M.textSec }}>Avg/PAX</span><strong style={{ color:M.text }}>{avgPax} lbs</strong></MRow>
              {parseInt(cF.passengersDrop||0)>0&&<MRow><span style={{ color:M.textSec }}>PAX leaving ({cF.passengersDrop})</span><strong style={{ color:D.red }}>− {dropWtPrev.toLocaleString()} lbs</strong></MRow>}
              {pickupWt>0&&<MRow><span style={{ color:M.textSec }}>PAX boarding ({cF.passengersPickup})</span><strong style={{ color:D.green }}>+ {pickupWt.toLocaleString()} lbs</strong></MRow>}
              <MRow style={{ borderTop:`1px solid ${M.border}`, paddingTop:5, marginTop:4 }}>
                <span style={{ color:M.textSec, fontWeight:600 }}>Next leg PAX weight</span>
                <strong style={{ color:D.green }}>{remPaxWt.toLocaleString()} lbs</strong>
              </MRow>
            </div>
          )}
        </SectionBox>
        <Label>Cargo Offloaded (lbs)</Label>
        <DarkInput type="number" min={0} placeholder="0" value={cF.cargoOffLbs} onChange={e=>cf('cargoOffLbs',e.target.value)}/>
      </DarkModal>

      <DarkModal open={editModal} onClose={()=>setEditModal(false)} title={`✏️ Edit Leg #${editLeg?.flight_number}`} wide
        footer={<><GhostBtn onClick={()=>setEditModal(false)}>Cancel</GhostBtn><PrimaryBtn color={D.amber} onClick={hEdit}>Save Changes</PrimaryBtn></>}>
        <InfoBanner color={D.amber}>⚠ All edits are permanently recorded in the audit log</InfoBanner>
        <Grid2>
          <div><Label>Departure</Label><DarkInput type="time" value={eF.departureTime} onChange={e=>ef('departureTime',e.target.value)}/></div>
          <div><Label>Arrival</Label><DarkInput type="time" value={eF.arrivalTime} onChange={e=>ef('arrivalTime',e.target.value)}/></div>
        </Grid2>
        <Label>Fuel Remaining (lbs)</Label><DarkInput type="number" min={0} value={eF.fuelRemainingAfter} onChange={e=>ef('fuelRemainingAfter',e.target.value)}/>
        <Grid2>
          <div><Label>PAX on Board</Label><DarkInput type="number" min={0} value={eF.passengersOnBoard} onChange={e=>ef('passengersOnBoard',e.target.value)}/></div>
          <div><Label>PAX Weight (lbs)</Label><DarkInput type="number" min={0} value={eF.passengersWeightLbs} onChange={e=>ef('passengersWeightLbs',e.target.value)}/></div>
        </Grid2>
        <Grid2>
          <div><Label>PAX Off</Label><DarkInput type="number" min={0} value={eF.passengersDrop} onChange={e=>ef('passengersDrop',e.target.value)}/></div>
          <div><Label>PAX Pick Up</Label><DarkInput type="number" min={0} value={eF.passengersPickup} onChange={e=>ef('passengersPickup',e.target.value)}/></div>
        </Grid2>
        <Grid2>
          <div><Label>Cargo On (lbs)</Label><DarkInput type="number" min={0} value={eF.cargoOnLbs} onChange={e=>ef('cargoOnLbs',e.target.value)}/></div>
          <div><Label>Cargo Off (lbs)</Label><DarkInput type="number" min={0} value={eF.cargoOffLbs} onChange={e=>ef('cargoOffLbs',e.target.value)}/></div>
        </Grid2>
        <Label>Notes</Label><DarkInput value={eF.notes} onChange={e=>ef('notes',e.target.value)} placeholder="Notes…"/>
        <Label>Edit Reason *</Label><DarkInput value={eF.editReason} onChange={e=>ef('editReason',e.target.value)} placeholder="e.g. fuel correction, PAX count error…"/>
      </DarkModal>

      <DarkModal open={fuelModal} onClose={()=>setFuelModal(false)} title="⛽ Fuel Uplift"
        footer={<><GhostBtn onClick={()=>setFuelModal(false)}>Cancel</GhostBtn><PrimaryBtn color={D.green} onClick={hFuel}>Confirm Uplift</PrimaryBtn></>}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
          {[{l:'Before',v:`${lastFuel.toLocaleString()} lbs`,c:M.textSec},{l:'After',v:fuelAdded&&parseInt(fuelAdded)>0?`${(lastFuel+parseInt(fuelAdded)).toLocaleString()} lbs`:'—',c:fuelAdded&&parseInt(fuelAdded)>0?D.green:M.textSec}].map(x=>(
            <div key={x.l} style={{ background:M.surface3, borderRadius:10, padding:'14px', textAlign:'center' }}>
              <div style={{ fontSize:9.5, color:M.textSec, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>{x.l}</div>
              <div style={{ fontSize:20, fontWeight:800, color:x.c }}>{x.v}</div>
            </div>
          ))}
        </div>
        <Label>Fuel Added (lbs) *</Label>
        <DarkInput type="number" min={0} placeholder="0" value={fuelAdded} onChange={e=>setFuelAdded(e.target.value)} autoFocus/>
        {fuelAdded&&parseInt(fuelAdded)>0&&<div style={{ fontSize:12, color:D.green, marginTop:-8, marginBottom:10, fontWeight:700 }}>+{parseInt(fuelAdded).toLocaleString()} lbs → Total: {(lastFuel+parseInt(fuelAdded)).toLocaleString()} lbs</div>}
        <Label>Notes (optional)</Label>
        <DarkInput value={fuelNotes} onChange={e=>setFuelNotes(e.target.value)} placeholder="e.g. Sonangol refuel at Soyo…"/>
      </DarkModal>

      <DarkModal open={closeModal} onClose={()=>setCloseModal(false)} title="Close Day Operation"
        footer={<><GhostBtn onClick={()=>setCloseModal(false)}>Cancel</GhostBtn><PrimaryBtn color={D.red} onClick={hClose}>Close Operation</PrimaryBtn></>}>
        <p style={{ color:M.textSec, marginBottom:14, fontSize:13, lineHeight:1.6 }}>Confirm closing today's operation?</p>
        <div style={{ background:M.surface3, borderRadius:10, padding:'14px', fontSize:12, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {[['Trips',trips.length],['Block Time',fmtMin(blockMin)],['Legs',legs.filter(f=>f.arrival_time).length],['PAX',totalPax],['Cargo',`${totalCargo.toLocaleString()} lbs`],['Fuel Burned',`${totalBurn.toLocaleString()} lbs`],['Fuel Remaining',`${lastFuel.toLocaleString()} lbs`],...(totalUplift>0?[['Uplift',`+${totalUplift.toLocaleString()} lbs`]]:[])].map(([k,v])=>(
            <div key={k}><span style={{ color:M.textSec }}>{k}: </span><strong style={{ color:M.text }}>{v}</strong></div>
          ))}
        </div>
      </DarkModal>

    </div>
  );
}