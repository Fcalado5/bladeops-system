import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dayOpsAPI, flightsAPI, destinationsAPI, exportAPI } from '../../api';
import { useFetch } from '../../hooks/useFetch';
import { useForm } from '../../hooks/useForm';
import { useAlert } from '../../context/AlertContext';
import { useAuth } from '../../context/AuthContext';
import {
  Card, Button, Badge, Field, Input, Select,
  Modal, PageLoader, AlertBanner, KpiCard, Textarea,
} from '../../components/ui';

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtMin(m) {
  if (!m) return '—';
  const h = Math.floor(m / 60), mn = m % 60;
  return h > 0 ? `${h}h ${String(mn).padStart(2,'0')}m` : `${mn}m`;
}

function fmtTimer(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

// ── Flight state machine phases ───────────────────────────────────────────
// 'idle' → 'departing' → 'in_flight' → 'arriving' → 'idle'

export default function DayOperationDetailPage() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const { success, error: showError } = useAlert();
  const navigate = useNavigate();

  // UI state
  const [phase, setPhase]               = useState('idle'); // idle | departing | in_flight | arriving
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showEditModal,  setShowEditModal]  = useState(false);
  const [editFlight,     setEditFlight]     = useState(null);
  const [exportLoading,  setExportLoading]  = useState(false);
  const [closingDay,     setClosingDay]     = useState(false);

  // Timer
  const [timerSecs, setTimerSecs]   = useState(0);
  const [departureTime, setDepartureTime] = useState('');
  const timerRef = useRef(null);

  const { data, loading, refetch } = useFetch(() => dayOpsAPI.get(id), [id]);
  const { data: destData }         = useFetch(() => destinationsAPI.list());

  const destinations = destData?.destinations || [];
  const op      = data?.dayOperation;
  const flights = data?.flights || [];
  const edits   = data?.editLogs || [];
  const summary = data?.summary || {};

  // ── Current state inherited from last flight ──────────────────────────
  const lastFlight    = flights[flights.length - 1] || null;
 const currentPAX = lastFlight
  ? lastFlight.passengers_on_board - (lastFlight.passengers_drop || 0) + (lastFlight.passengers_pickup || 0)
  : 0;
  const currentFuel   = lastFlight ? lastFlight.fuel_after_lbs : (op?.initial_fuel_lbs || 0);
  const currentCargo  = lastFlight ? Math.max(0, (lastFlight.cargo_on_lbs || 0) - (lastFlight.cargo_off_lbs || 0)) : 0;
  const currentWeight = lastFlight ? lastFlight.total_weight_lbs : (op ? (7908 + currentFuel) : 0);
  const lastDestId    = lastFlight ? lastFlight.to_dest_id : '';
  const lastDestName  = lastFlight ? lastFlight.to_name : '';

  // ── Departure form ────────────────────────────────────────────────────
  const deptForm = useForm({
    fromDestId: '',
    toDestId:   '',
  });

  // Update fromDestId when last flight changes
  useEffect(() => {
    if (lastDestId) deptForm.set('fromDestId', lastDestId);
  }, [lastDestId]); // eslint-disable-line

  // ── Arrival form ──────────────────────────────────────────────────────
  const arrForm = useForm({
    arrivalTime:       '',
    passengersDrop:    0,
    passengersPickup:  0,
    cargoOffLbs:       0,
    cargoOnLbs:        0,
    fuelUpliftLbs:     0,
    fuelBurnLbs:       0,
  });

  // ── Edit form ─────────────────────────────────────────────────────────
  const editForm = useForm({
    fuelBurnLbs: 0, fuelUpliftLbs: 0, passengersOnBoard: 0,
    cargoOnLbs: 0, cargoOffLbs: 0, arrivalTime: '', editReason: '',
  });

  // ── Close form ────────────────────────────────────────────────────────
  const closeForm = useForm({ motorOffTime: '' });

  // ── Timer logic ───────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    setTimerSecs(0);
    timerRef.current = setInterval(() => {
      setTimerSecs(s => s + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopTimer(), [stopTimer]);

  // ── STEP 1: Start departure ───────────────────────────────────────────
  const handleStartDeparture = useCallback(() => {
    if (!deptForm.values.fromDestId) { showError('Select departure point'); return; }
    if (!deptForm.values.toDestId)   { showError('Select destination'); return; }
    if (deptForm.values.fromDestId === deptForm.values.toDestId) {
      showError('Departure and destination cannot be the same'); return;
    }
    setPhase('in_flight');
    const now = getCurrentTime();
    setDepartureTime(now);
    arrForm.set('arrivalTime', now); // pre-fill arrival
    startTimer();
  }, [deptForm.values, showError, startTimer, arrForm]);

  // ── STEP 2: Arrive — stop timer, show arrival form ────────────────────
  const handleArriveClick = useCallback(() => {
    stopTimer();
    arrForm.set('arrivalTime', getCurrentTime());
    setPhase('arriving');
  }, [stopTimer, arrForm]);

  // ── STEP 3: Submit arrival form ───────────────────────────────────────
  const handleSubmitArrival = useCallback(async (values) => {
    if (!values.arrivalTime) { showError('Arrival time is required'); return; }

    const drop   = parseInt(values.passengersDrop)   || 0;
    const pickup = parseInt(values.passengersPickup)  || 0;
    const burn   = parseInt(values.fuelBurnLbs)       || 0;
    const uplift = parseInt(values.fuelUpliftLbs)     || 0;

    // Validate PAX
    if (drop > currentPAX) {
      showError(`Cannot drop ${drop} passengers — only ${currentPAX} on board`);
      return;
    }

    // Validate fuel burn
    const totalFuel = currentFuel + uplift;
    if (burn > totalFuel) {
      showError(`Fuel burn (${burn} lbs) cannot exceed total fuel (${totalFuel} lbs)`);
      return;
    }

    try {
      // Calculate new PAX after this flight
      const newPAX = currentPAX - drop + pickup;

      await flightsAPI.create({
        dayOpId:           id,
        fromDestId:        deptForm.values.fromDestId,
        toDestId:          deptForm.values.toDestId,
        departureTime,
        arrivalTime:       values.arrivalTime,
        passengersOnBoard: currentPAX,
        passengersDrop:    drop,
        passengersPickup:  pickup,
        fuelRemainLbs:     currentFuel,
        fuelUpliftLbs:     uplift,
        fuelBurnLbs:       burn,
        cargoOnLbs:        parseInt(values.cargoOnLbs)  || 0,
        cargoOffLbs:       parseInt(values.cargoOffLbs) || 0,
        notes: '',
      });

      // Record arrival
      const flightsAfter = await refetch();

      success(`Viagem concluída! ${fmtMin(Math.floor(timerSecs / 60))} de voo`);

      // Reset for next flight
      setPhase('idle');
      setTimerSecs(0);
      deptForm.reset({ fromDestId: deptForm.values.toDestId, toDestId: '' });
      arrForm.reset({ arrivalTime:'', passengersDrop:0, passengersPickup:0, cargoOffLbs:0, cargoOnLbs:0, fuelUpliftLbs:0, fuelBurnLbs:0 });

    } catch (err) {
      showError(err.response?.data?.error || 'Failed to record flight');
      setPhase('in_flight');
      startTimer();
    }
  }, [
    id, deptForm, arrForm, departureTime, currentPAX, currentFuel,
    timerSecs, success, showError, refetch, startTimer,
  ]);

  // ── Edit flight ───────────────────────────────────────────────────────
  const openEdit = useCallback((flight) => {
    setEditFlight(flight);
    editForm.setValues({
      fuelBurnLbs:       flight.fuel_burn_lbs       || 0,
      fuelUpliftLbs:     flight.fuel_uplift_lbs     || 0,
      passengersOnBoard: flight.passengers_on_board || 0,
      cargoOnLbs:        flight.cargo_on_lbs        || 0,
      cargoOffLbs:       flight.cargo_off_lbs       || 0,
      arrivalTime:       flight.arrival_time        || '',
      editReason:        '',
    });
    setShowEditModal(true);
  }, [editForm]);

  const handleEdit = useCallback(async (values) => {
    if (!values.editReason.trim()) { showError('Reason is required for edits'); return; }
    try {
      await flightsAPI.update(editFlight.id, {
        fuelBurnLbs:       parseInt(values.fuelBurnLbs),
        fuelUpliftLbs:     parseInt(values.fuelUpliftLbs),
        passengersOnBoard: parseInt(values.passengersOnBoard),
        cargoOnLbs:        parseInt(values.cargoOnLbs) || 0,
        cargoOffLbs:       parseInt(values.cargoOffLbs) || 0,
        arrivalTime:       values.arrivalTime || undefined,
        editReason:        values.editReason,
      });
      success('Flight updated — fuel chain recalculated');
      setShowEditModal(false);
      refetch();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to update flight');
    }
  }, [editFlight, success, showError, refetch]);

  // ── Close day ─────────────────────────────────────────────────────────
  const handleClose = useCallback(async (values) => {
    try {
      setClosingDay(true);
      await dayOpsAPI.close(id, values.motorOffTime);
      success('Day operation closed');
      setShowCloseModal(false);
      refetch();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to close operation');
    } finally {
      setClosingDay(false);
    }
  }, [id, success, showError, refetch]);

  // ── Export PDF ────────────────────────────────────────────────────────
  const handleExportPDF = useCallback(async () => {
    try {
      setExportLoading(true);
      const res  = await exportAPI.pdf(id);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `TECHLOG_${op?.date || 'report'}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
      success('PDF exported');
    } catch {
      showError('Failed to export PDF. Make sure the operation has flights.');
    } finally {
      setExportLoading(false);
    }
  }, [id, op, success, showError]);

  if (loading) return <PageLoader label="Loading operation…" />;
  if (!op)    return <AlertBanner type="danger">Operation not found</AlertBanner>;

  const isClosed = op.status === 'closed' || op.status === 'signed';
  const fromDest = destinations.find(d => d.id === deptForm.values.fromDestId);
  const toDest   = destinations.find(d => d.id === deptForm.values.toDestId);

  // Weight calculation preview
  const previewFuel   = currentFuel + (parseInt(arrForm.values.fuelUpliftLbs) || 0);
  const previewWeight = 7908 + currentPAX * 187 + currentCargo + previewFuel;

  return (
    <div className="animate-fade" style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <button onClick={() => navigate('/day-operations')}
            style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:13, cursor:'pointer', marginBottom:6, padding:0 }}>
            ← Back
          </button>
          <h2 style={{ fontSize:20, fontWeight:700 }}>
            {op.aircraft_reg} · {op.commander_name} &amp; {op.copilot_name}
          </h2>
          <p style={{ fontSize:13, color:'var(--text-muted)', marginTop:3 }}>
            {new Date(op.date).toLocaleDateString('pt-PT',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}
            {' · Motor ON: '}{op.motor_on_time || '—'}
            {op.motor_off_time && ` · Motor OFF: ${op.motor_off_time}`}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <Badge type={op.status}>{op.status}</Badge>
          {!isClosed && (
            <Button variant="ghost" size="sm" onClick={() => setShowCloseModal(true)}>
              Fechar dia
            </Button>
          )}
          <Button variant="success" size="sm" loading={exportLoading} onClick={handleExportPDF} icon="📄">
            PDF
          </Button>
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
        <KpiCard label="Viagens"     value={flights.length}                            color="var(--ocean)" />
        <KpiCard label="Block time"  value={summary.totalBlockTime || '—'}             color="var(--ocean-dark)" />
        <KpiCard label="PAX bordo"   value={currentPAX}                               color="var(--text)" />
        <KpiCard label="Fuel actual" value={`${currentFuel.toLocaleString()} lbs`}    color="var(--success)" />
        <KpiCard label="Peso actual" value={`${currentWeight.toLocaleString()} lbs`}  color={currentWeight > 10560 ? 'var(--danger)' : 'var(--text)'} />
      </div>

      {/* ── FLIGHT OPERATION PANEL ──────────────────────────────────── */}
      {!isClosed && (
        <Card style={{ marginBottom:20, border:'2px solid var(--ocean-light)' }}>

          {/* PHASE: IDLE — select route */}
          {phase === 'idle' && (
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--ocean-dark)', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                ✈️ {flights.length === 0 ? 'Primeira viagem' : `Viagem ${flights.length + 1}`}
                {lastDestName && (
                  <span style={{ fontSize:12, fontWeight:400, color:'var(--text-muted)' }}>
                    · Partida automática: <strong>{lastDestName.replace('PSVM ','')}</strong>
                  </span>
                )}
              </div>

              {/* Current state summary */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16, padding:'12px', background:'var(--bg-muted)', borderRadius:10 }}>
                <div style={{ fontSize:12, textAlign:'center' }}>
                  <div style={{ color:'var(--text-muted)', marginBottom:3 }}>PAX a bordo</div>
                  <div style={{ fontSize:20, fontWeight:700, color:'var(--ocean)' }}>{currentPAX}</div>
                </div>
                <div style={{ fontSize:12, textAlign:'center' }}>
                  <div style={{ color:'var(--text-muted)', marginBottom:3 }}>Fuel disponível</div>
                  <div style={{ fontSize:20, fontWeight:700, color:'var(--success)' }}>{currentFuel.toLocaleString()} lbs</div>
                </div>
                <div style={{ fontSize:12, textAlign:'center' }}>
                  <div style={{ color:'var(--text-muted)', marginBottom:3 }}>Carga a bordo</div>
                  <div style={{ fontSize:20, fontWeight:700, color:'var(--text)' }}>{currentCargo.toLocaleString()} lbs</div>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <Field label="Partida" required>
                  <Select name="fromDestId" value={deptForm.values.fromDestId} onChange={deptForm.onChange}>
                    <option value="">— Seleccionar —</option>
                    {destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                </Field>
                <Field label="Destino" required>
                  <Select name="toDestId" value={deptForm.values.toDestId} onChange={deptForm.onChange}>
                    <option value="">— Seleccionar —</option>
                    {destinations.filter(d => d.id !== deptForm.values.fromDestId).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Button variant="success" style={{ width:'100%', padding:14, fontSize:15, justifyContent:'center' }}
                onClick={handleStartDeparture} icon="🚀">
                Iniciar Viagem
              </Button>
            </div>
          )}

          {/* PHASE: IN FLIGHT — timer running */}
          {phase === 'in_flight' && (
            <div>
              {/* Timer */}
              <div style={{
                background:'linear-gradient(135deg,var(--ocean-darkest),var(--ocean))',
                borderRadius:12, padding:'24px 20px', textAlign:'center', marginBottom:16,
              }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', textTransform:'uppercase', letterSpacing:2, marginBottom:8 }}>
                  Em voo · {fromDest?.name?.replace('PSVM ','') || '—'} → {toDest?.name?.replace('PSVM ','') || '—'}
                </div>
                <div style={{ fontSize:60, fontWeight:700, color:'#fff', letterSpacing:4, fontVariantNumeric:'tabular-nums', fontFamily:'monospace' }}>
                  {fmtTimer(timerSecs)}
                </div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,.6)', marginTop:6 }}>
                  Saída: {departureTime}
                </div>
              </div>

              {/* Info during flight */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16, padding:'12px', background:'var(--bg-muted)', borderRadius:10 }}>
                <div style={{ fontSize:12, textAlign:'center' }}>
                  <div style={{ color:'var(--text-muted)', marginBottom:3 }}>PAX a bordo</div>
                  <div style={{ fontSize:20, fontWeight:700, color:'var(--ocean)' }}>{currentPAX}</div>
                </div>
                <div style={{ fontSize:12, textAlign:'center' }}>
                  <div style={{ color:'var(--text-muted)', marginBottom:3 }}>Fuel a bordo</div>
                  <div style={{ fontSize:20, fontWeight:700, color:'var(--success)' }}>{currentFuel.toLocaleString()} lbs</div>
                </div>
                <div style={{ fontSize:12, textAlign:'center' }}>
                  <div style={{ color:'var(--text-muted)', marginBottom:3 }}>Peso total</div>
                  <div style={{ fontSize:20, fontWeight:700, color: currentWeight > 10560 ? 'var(--danger)' : 'var(--text)' }}>
                    {currentWeight.toLocaleString()} lbs
                  </div>
                </div>
              </div>

              <Button variant="danger" style={{ width:'100%', padding:14, fontSize:15, justifyContent:'center' }}
                onClick={handleArriveClick} icon="🛬">
                Chegámos — Registar chegada
              </Button>
            </div>
          )}

          {/* PHASE: ARRIVING — arrival form */}
          {phase === 'arriving' && (
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--ocean-dark)', marginBottom:14 }}>
                🛬 Chegada — {fromDest?.name?.replace('PSVM ','') || '—'} → {toDest?.name?.replace('PSVM ','') || '—'}
              </div>

              <div style={{ background:'var(--ocean-pale)', border:'1px solid var(--ocean-light)', borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:12 }}>
                ⏱️ Tempo de voo: <strong>{fmtTimer(timerSecs)}</strong>
                {' · '}Saída: <strong>{departureTime}</strong>
              </div>

              <Field label="Hora de chegada" required>
                <Input type="time" name="arrivalTime" value={arrForm.values.arrivalTime} onChange={arrForm.onChange} />
              </Field>

              {/* Passengers */}
              <div style={{ fontSize:11, fontWeight:700, color:'var(--ocean)', textTransform:'uppercase', letterSpacing:'.06em', margin:'14px 0 8px' }}>
                Passageiros — {currentPAX} a bordo antes da chegada
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <Field label={`Deixou (máx: ${currentPAX})`}>
                  <Input type="number" name="passengersDrop" value={arrForm.values.passengersDrop}
                    onChange={arrForm.onChange} min={0} max={currentPAX} />
                </Field>
                <Field label="Recolheu">
                  <Input type="number" name="passengersPickup" value={arrForm.values.passengersPickup}
                    onChange={arrForm.onChange} min={0} />
                </Field>
              </div>

              {/* PAX preview */}
              {(parseInt(arrForm.values.passengersDrop) > 0 || parseInt(arrForm.values.passengersPickup) > 0) && (
                <div style={{ background:'var(--bg-muted)', borderRadius:8, padding:'8px 12px', marginBottom:14, fontSize:12, display:'flex', gap:16 }}>
                  <span style={{ color:'var(--danger)' }}>↓ {arrForm.values.passengersDrop || 0} saíram</span>
                  <span style={{ color:'var(--success)' }}>↑ {arrForm.values.passengersPickup || 0} embarcaram</span>
                  <span style={{ color:'var(--ocean)', fontWeight:700 }}>
                    = {Math.max(0, currentPAX - (parseInt(arrForm.values.passengersDrop)||0) + (parseInt(arrForm.values.passengersPickup)||0))} a bordo na próxima viagem
                  </span>
                </div>
              )}

              {/* Cargo */}
              <div style={{ fontSize:11, fontWeight:700, color:'var(--ocean)', textTransform:'uppercase', letterSpacing:'.06em', margin:'14px 0 8px' }}>
                Carga — {currentCargo.toLocaleString()} lbs a bordo
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <Field label="Desembarcada (lbs)">
                  <Input type="number" name="cargoOffLbs" value={arrForm.values.cargoOffLbs}
                    onChange={arrForm.onChange} min={0} />
                </Field>
                <Field label="Embarcada (lbs)">
                  <Input type="number" name="cargoOnLbs" value={arrForm.values.cargoOnLbs}
                    onChange={arrForm.onChange} min={0} />
                </Field>
              </div>

              {/* Fuel */}
              <div style={{ fontSize:11, fontWeight:700, color:'var(--ocean)', textTransform:'uppercase', letterSpacing:'.06em', margin:'14px 0 8px' }}>
                Combustível — {currentFuel.toLocaleString()} lbs antes da viagem
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:8 }}>
                <Field label="Burn real (lbs)" required>
                  <Input type="number" name="fuelBurnLbs" value={arrForm.values.fuelBurnLbs}
                    onChange={arrForm.onChange} min={0} max={currentFuel} />
                </Field>
                <Field label="Uplift / Abasteceu (lbs)">
                  <Input type="number" name="fuelUpliftLbs" value={arrForm.values.fuelUpliftLbs}
                    onChange={arrForm.onChange} min={0} />
                </Field>
              </div>

              {/* Fuel preview */}
              <div style={{ background:'var(--bg-muted)', borderRadius:8, padding:'8px 12px', marginBottom:16, fontSize:12, display:'flex', gap:16, flexWrap:'wrap' }}>
                <span>Fuel após: <strong style={{ color:'var(--ocean)' }}>
                  {Math.max(0, currentFuel - (parseInt(arrForm.values.fuelBurnLbs)||0) + (parseInt(arrForm.values.fuelUpliftLbs)||0)).toLocaleString()} lbs
                </strong></span>
                <span>Peso próxima viagem: <strong style={{
                  color: (7908 + Math.max(0,currentPAX-(parseInt(arrForm.values.passengersDrop)||0)+(parseInt(arrForm.values.passengersPickup)||0))*187 +
                    Math.max(0,currentFuel-(parseInt(arrForm.values.fuelBurnLbs)||0)+(parseInt(arrForm.values.fuelUpliftLbs)||0))) > 10560
                    ? 'var(--danger)' : 'var(--success)'
                }}>
                  {(7908 +
                    Math.max(0,currentPAX-(parseInt(arrForm.values.passengersDrop)||0)+(parseInt(arrForm.values.passengersPickup)||0))*187 +
                    Math.max(0,currentFuel-(parseInt(arrForm.values.fuelBurnLbs)||0)+(parseInt(arrForm.values.fuelUpliftLbs)||0))
                  ).toLocaleString()} lbs
                </strong></span>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <Button variant="ghost" onClick={() => { setPhase('in_flight'); startTimer(); }}>
                  ← Voltar ao voo
                </Button>
                <Button variant="success" loading={arrForm.loading}
                  onClick={() => arrForm.submit(handleSubmitArrival)} icon="✅">
                  Confirmar chegada
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── FLIGHTS TABLE ────────────────────────────────────────────── */}
      <Card padding={0} style={{ marginBottom:20 }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ fontSize:15, fontWeight:700 }}>Registo de voos</h3>
          <span style={{ fontSize:12, color:'var(--text-muted)' }}>
            {flights.length} voo(s) · Block time: <strong>{summary.totalBlockTime || '—'}</strong>
          </span>
        </div>

        {flights.length === 0 ? (
          <div style={{ padding:'32px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
            Nenhuma viagem registada ainda.
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'var(--bg-muted)', borderBottom:'2px solid var(--border)' }}>
                  {['#','De','Para','Saída','Chegada','Duração','NM','PAX','↓','↑','Fuel Rem','Uplift','Burn','Após','Peso',''].map((h,i) => (
                    <th key={i} style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, color:'var(--text-sec)', textTransform:'uppercase', fontSize:10, whiteSpace:'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {flights.map((f,i) => (
                  <tr key={f.id} style={{ borderBottom:'1px solid var(--border)', background: i%2===0?'var(--bg)':'var(--bg-surface)' }}>
                    <td style={{ padding:'9px 10px', fontWeight:700, color:'var(--ocean)' }}>V{f.flight_number}</td>
                    <td style={{ padding:'9px 10px', fontWeight:600 }}>{(f.from_name||'').replace('PSVM ','')}</td>
                    <td style={{ padding:'9px 10px', fontWeight:600 }}>{(f.to_name||'').replace('PSVM ','')}</td>
                    <td style={{ padding:'9px 10px' }}>{f.departure_time || '—'}</td>
                    <td style={{ padding:'9px 10px' }}>{f.arrival_time || '—'}</td>
                    <td style={{ padding:'9px 10px', color:'var(--ocean)', fontWeight:600 }}>{fmtMin(f.duration_minutes)}</td>
                    <td style={{ padding:'9px 10px' }}>{f.distance_nm || 0}</td>
                    <td style={{ padding:'9px 10px', fontWeight:700 }}>{f.passengers_on_board || 0}</td>
                    <td style={{ padding:'9px 10px', color:'var(--danger)', fontWeight:600 }}>{f.passengers_drop || 0}</td>
                    <td style={{ padding:'9px 10px', color:'var(--success)', fontWeight:600 }}>{f.passengers_pickup || 0}</td>
                    <td style={{ padding:'9px 10px' }}>{(f.fuel_remain_lbs||0).toLocaleString()}</td>
                    <td style={{ padding:'9px 10px' }}>{f.fuel_uplift_lbs || '—'}</td>
                    <td style={{ padding:'9px 10px', color:'var(--danger)', fontWeight:600 }}>{f.fuel_burn_lbs || 0}</td>
                    <td style={{ padding:'9px 10px', color:'var(--ocean)', fontWeight:700 }}>{(f.fuel_after_lbs||0).toLocaleString()}</td>
                    <td style={{ padding:'9px 10px', fontWeight:600 }}>{(f.total_weight_lbs||0).toLocaleString()}</td>
                    <td style={{ padding:'9px 10px' }}>
                      <Button size="sm" variant="subtle" onClick={() => openEdit(f)}>✏️</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── EDIT LOG ─────────────────────────────────────────────────── */}
      {edits.length > 0 && (
        <Card style={{ marginBottom:20 }}>
          <h3 style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>✏️ Edit Log ({edits.length})</h3>
          {edits.map(e => (
            <div key={e.id} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid var(--warning-border)', background:'var(--warning-bg)', marginBottom:7, fontSize:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                <strong>{e.user_name}</strong>
                <span style={{ color:'var(--text-muted)', fontSize:11 }}>{new Date(e.created_at).toLocaleString('pt-PT')}</span>
              </div>
              alterou <strong>{e.field_name}</strong>: <code>{e.old_value}</code> → <code style={{ color:'var(--ocean)' }}>{e.new_value}</code>
              <div style={{ color:'var(--warning)', marginTop:3 }}>📝 "{e.reason}"</div>
            </div>
          ))}
        </Card>
      )}

      {/* ── MODAL: Edit flight ───────────────────────────────────────── */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)}
        title={`Editar Voo V${editFlight?.flight_number}`} width={480}
        footer={<>
          <Button variant="ghost" onClick={() => setShowEditModal(false)}>Cancelar</Button>
          <Button variant="warning" loading={editForm.loading} onClick={() => editForm.submit(handleEdit)}>Guardar</Button>
        </>}
      >
        <AlertBanner type="warning" icon="⚠️">Todas as edições são registadas e visíveis ao administrador.</AlertBanner>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <Field label="Fuel Uplift (lbs)"><Input type="number" name="fuelUpliftLbs" value={editForm.values.fuelUpliftLbs} onChange={editForm.onChange} min={0} /></Field>
          <Field label="Fuel Burn (lbs)"><Input type="number" name="fuelBurnLbs" value={editForm.values.fuelBurnLbs} onChange={editForm.onChange} min={0} /></Field>
          <Field label="PAX a bordo"><Input type="number" name="passengersOnBoard" value={editForm.values.passengersOnBoard} onChange={editForm.onChange} min={0} /></Field>
          <Field label="Hora chegada"><Input type="time" name="arrivalTime" value={editForm.values.arrivalTime} onChange={editForm.onChange} /></Field>
          <Field label="Carga embarcada (lbs)"><Input type="number" name="cargoOnLbs" value={editForm.values.cargoOnLbs} onChange={editForm.onChange} min={0} /></Field>
          <Field label="Carga desembarcada (lbs)"><Input type="number" name="cargoOffLbs" value={editForm.values.cargoOffLbs} onChange={editForm.onChange} min={0} /></Field>
        </div>
        <Field label="Motivo da alteração" required>
          <Textarea name="editReason" value={editForm.values.editReason} onChange={editForm.onChange} placeholder="Explica o motivo da alteração…" />
        </Field>
      </Modal>

      {/* ── MODAL: Close day ─────────────────────────────────────────── */}
      <Modal open={showCloseModal} onClose={() => setShowCloseModal(false)} title="Fechar Dia de Operações" width={400}
        footer={<>
          <Button variant="ghost" onClick={() => setShowCloseModal(false)}>Cancelar</Button>
          <Button variant="danger" loading={closingDay} onClick={() => closeForm.submit(handleClose)}>Fechar operação</Button>
        </>}
      >
        <Field label="Hora Motor OFF">
          <Input type="time" name="motorOffTime" value={closeForm.values.motorOffTime} onChange={closeForm.onChange} />
        </Field>
        {flights.length === 0 && (
          <AlertBanner type="warning" icon="⚠️" style={{ marginTop:10 }}>Nenhuma viagem registada.</AlertBanner>
        )}
        <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:10 }}>
          Fechar o dia bloqueia novos voos. O PDF pode ser exportado depois.
        </p>
      </Modal>
    </div>
  );
}