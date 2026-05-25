import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dayOpsAPI, alertsAPI } from '../../api';
import { useFetch } from '../../hooks/useFetch';
import { KpiCard, Card, Badge, PageLoader, AlertBanner, SectionHeader, Button } from '../../components/ui';

function fmtMin(m) {
  if (!m || m === 0) return '—';
  const h = Math.floor(m / 60), mn = m % 60;
  return h > 0 ? `${h}h ${String(mn).padStart(2,'0')}m` : `${mn}m`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  const { data: ops,    loading: opsLoading,  error: opsError  } = useFetch(() => dayOpsAPI.list({ date: today }));
  const { data: alerts, loading: altLoading,  error: altError  } = useFetch(() => alertsAPI.list());

  // FIXED: loading individual por secção, não bloqueia tudo
  const todayOps    = ops || [];
  const allAlerts   = alerts?.alerts || [];
  const dangerAlerts  = allAlerts.filter(a => a.severity === 'danger');
  const warningAlerts = allAlerts.filter(a => a.severity === 'warning');
  const generatedAt   = alerts?.generatedAt;

  const totalFlights = todayOps.reduce((a, o) => a + (parseInt(o.flight_count) || 0), 0);
  const totalPax     = todayOps.reduce((a, o) => a + (o.total_passengers || 0), 0);
  const totalBurn    = todayOps.reduce((a, o) => a + (o.total_fuel_burn_lbs || 0), 0);
  const totalBlockMin= todayOps.reduce((a, o) => a + (o.total_block_minutes || 0), 0);

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="animate-fade">
      {/* Welcome banner */}
      <div style={{
        background:'linear-gradient(135deg,var(--ocean-darkest),var(--ocean))',
        borderRadius:'var(--radius-lg)', padding:'20px 24px',
        color:'#fff', marginBottom:24,
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700 }}>
            {greeting}, {user?.name?.split(' ')[0]}
          </h2>
          <p style={{ fontSize:13, color:'rgba(255,255,255,.7)', marginTop:4 }}>
            {new Date().toLocaleDateString('pt-PT',{ weekday:'long', day:'2-digit', month:'long', year:'numeric' })}
            {' · '}{user?.role?.toUpperCase()}
          </p>
        </div>
        <Link to="/day-operations">
        <Button
  variant="ghost"
  style={{
    background: '#ffffff',
    borderColor: 'rgba(255,255,255,.65)',
    color: '#0f4c81',
    fontWeight: 800,
    boxShadow: '0 8px 20px rgba(0,0,0,.12)',
  }}
>
  Today's Operations →
</Button>
        </Link>
      </div>

      {/* Alerts */}
      {dangerAlerts.length > 0 && (
        <AlertBanner type="danger" icon="🚨">
          <strong>{dangerAlerts.length} critical alert{dangerAlerts.length > 1 ? 's' : ''}</strong>
          {' — '}{dangerAlerts[0].title}
          {dangerAlerts.length > 1 && ` and ${dangerAlerts.length - 1} more.`}
          {' '}<Link to="/alerts" style={{ color:'var(--danger)', fontWeight:600 }}>View all →</Link>
        </AlertBanner>
      )}
      {warningAlerts.length > 0 && dangerAlerts.length === 0 && (
        <AlertBanner type="warning" icon="⚠️">
          <strong>{warningAlerts.length} warning{warningAlerts.length > 1 ? 's' : ''}</strong>
          {' — '}{warningAlerts[0].title}
          {' '}<Link to="/alerts" style={{ color:'var(--warning)', fontWeight:600 }}>View all →</Link>
        </AlertBanner>
      )}

      {/* KPIs — FIXED: mostra — quando 0 em vez de 0 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        <KpiCard label="Flights Today"   value={totalFlights || '—'} icon="✈️" color="var(--ocean)" />
        <KpiCard label="Passengers"      value={totalPax     || '—'} icon="👥" color="var(--text)" />
        <KpiCard label="Block Time"      value={fmtMin(totalBlockMin)} icon="⏱️" color="var(--ocean-dark)" />
        <KpiCard label="Fuel Burn (lbs)" value={totalBurn ? totalBurn.toLocaleString() : '—'} icon="⛽" color="var(--text)" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20 }}>
        {/* Today's operations */}
        <Card>
          <SectionHeader
            title="Today's Operations"
            action={<Link to="/day-operations"><Button size="sm" variant="subtle">View all</Button></Link>}
          />
          {opsLoading ? (
            <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text-muted)', fontSize:13 }}>Loading…</div>
          ) : opsError ? (
            <AlertBanner type="danger">Failed to load operations</AlertBanner>
          ) : todayOps.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-muted)', fontSize:13 }}>
              No operations today.{' '}
              <Link to="/day-operations" style={{ color:'var(--ocean)' }}>Start one →</Link>
            </div>
          ) : todayOps.map(op => (
            <Link key={op.id} to={`/day-operations/${op.id}`} style={{ textDecoration:'none' }}>
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'11px 14px', borderRadius:'var(--radius)',
                border:'1px solid var(--border)', marginBottom:8,
                transition:'all .15s', background:'var(--bg-surface)',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--ocean)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>
                    {op.aircraft_reg} — {op.commander_name}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                    {op.flight_count} flight(s) · {fmtMin(op.total_block_minutes)} · {op.total_passengers || 0} pax
                  </div>
                </div>
                <Badge type={op.status}>{op.status}</Badge>
              </div>
            </Link>
          ))}
        </Card>

        {/* Alerts summary */}
        <Card>
          <SectionHeader
            title="Alerts"
            action={<Link to="/alerts"><Button size="sm" variant="subtle">View all</Button></Link>}
          />
          {altLoading ? (
            <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text-muted)', fontSize:13 }}>Loading…</div>
          ) : altError ? (
            <AlertBanner type="danger">Failed to load alerts</AlertBanner>
          ) : allAlerts.length === 0 ? (
            <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text-muted)', fontSize:13 }}>
              ✅ All clear
            </div>
          ) : (
            <>
              {dangerAlerts.slice(0,4).map((a,i) => (
                <div key={i} style={{ background:'var(--danger-bg)', border:'1px solid var(--danger-border)', borderRadius:8, padding:'8px 10px', marginBottom:6, fontSize:12 }}>
                  <div style={{ fontWeight:600, color:'var(--danger)' }}>{a.title}</div>
                </div>
              ))}
              {warningAlerts.slice(0,3).map((a,i) => (
                <div key={i} style={{ background:'var(--warning-bg)', border:'1px solid var(--warning-border)', borderRadius:8, padding:'8px 10px', marginBottom:6, fontSize:12 }}>
                  <div style={{ fontWeight:600, color:'var(--warning)' }}>{a.title}</div>
                </div>
              ))}
              {generatedAt && (
                <div style={{ fontSize:10, color:'var(--text-muted)', textAlign:'right', marginTop:6 }}>
                  Updated: {new Date(generatedAt).toLocaleTimeString('pt-PT')}
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
