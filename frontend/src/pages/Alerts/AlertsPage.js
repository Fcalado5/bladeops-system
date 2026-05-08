import React from 'react';
import { alertsAPI } from '../../api';
import { useFetch } from '../../hooks/useFetch';
import { Card, SectionHeader, Badge, PageLoader, KpiCard, AlertBanner } from '../../components/ui';

const ICONS = { doc_expiry:'📄', hours_limit:'⏱️', overweight:'⚖️', maintenance:'🔧' };

export default function AlertsPage() {
  const { data, loading, refetch, error } = useFetch(() => alertsAPI.list());
  const alerts = data?.alerts || [];
  const counts = data?.counts || {};
  const generatedAt = data?.generatedAt;

  const danger  = alerts.filter(a => a.severity === 'danger');
  const warning = alerts.filter(a => a.severity === 'warning');

  if (loading) return <PageLoader label="Checking alerts…" />;

  return (
    <div className="animate-fade">
      <SectionHeader
        title="Alerts & Notifications"
        subtitle="Document expiry, flight limits and maintenance warnings"
        action={
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
            <button onClick={refetch} style={{ background:'var(--bg-muted)', border:'1px solid var(--border)', borderRadius:8, padding:'7px 14px', fontSize:12, cursor:'pointer', fontWeight:600 }}>
              ↻ Refresh
            </button>
            {generatedAt && (
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>
                Last updated: {new Date(generatedAt).toLocaleTimeString('pt-PT')}
              </span>
            )}
          </div>
        }
      />

      {error && <AlertBanner type="danger">Failed to load alerts. {error}</AlertBanner>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        <KpiCard label="Total Alerts" value={counts.total || 0} color={counts.total > 0 ? 'var(--danger)' : 'var(--success)'} icon="🔔" />
        <KpiCard label="Critical"     value={counts.danger  || 0} color="var(--danger)"  icon="🚨" />
        <KpiCard label="Warnings"     value={counts.warning || 0} color="var(--warning)" icon="⚠️" />
      </div>

      {alerts.length === 0 && !error && (
        <Card>
          <div style={{ textAlign:'center', padding:'48px 24px', color:'var(--text-muted)' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <div style={{ fontSize:16, fontWeight:600, color:'var(--success)', marginBottom:6 }}>All clear</div>
            <p style={{ fontSize:13 }}>No active alerts. All documents valid and operations within limits.</p>
          </div>
        </Card>
      )}

      {danger.length > 0 && (
        <Card style={{ marginBottom:20 }}>
          <h3 style={{ fontSize:14, fontWeight:700, color:'var(--danger)', marginBottom:14 }}>
            🚨 Critical ({danger.length})
          </h3>
          {danger.map((a,i) => <AlertItem key={i} alert={a} />)}
        </Card>
      )}

      {warning.length > 0 && (
        <Card>
          <h3 style={{ fontSize:14, fontWeight:700, color:'var(--warning)', marginBottom:14 }}>
            ⚠️ Warnings ({warning.length})
          </h3>
          {warning.map((a,i) => <AlertItem key={i} alert={a} />)}
        </Card>
      )}
    </div>
  );
}

function AlertItem({ alert }) {
  const isDanger = alert.severity === 'danger';
  return (
    <div style={{
      display:'flex', alignItems:'flex-start', gap:12, padding:'12px 14px',
      borderRadius:10, marginBottom:8,
      background: isDanger ? 'var(--danger-bg)' : 'var(--warning-bg)',
      border: `1px solid ${isDanger ? 'var(--danger-border)' : 'var(--warning-border)'}`,
    }}>
      <span style={{ fontSize:18, flexShrink:0 }}>{ICONS[alert.type] || '🔔'}</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:3 }}>{alert.title}</div>
        {alert.message && <div style={{ fontSize:12, color:'var(--text-sec)', lineHeight:1.5 }}>{alert.message}</div>}
        <div style={{ marginTop:6, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <Badge type={isDanger ? 'danger' : 'warning'}>{alert.severity}</Badge>
          <Badge type="default">{alert.type.replace('_',' ')}</Badge>
          {alert.pilotName && <Badge type="info">{alert.pilotName}</Badge>}
          {alert.generatedAt && (
            <span style={{ fontSize:10, color:'var(--text-muted)' }}>
              {new Date(alert.generatedAt).toLocaleTimeString('pt-PT')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
