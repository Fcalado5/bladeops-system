import React from 'react';
import { Link } from 'react-router-dom';
import { dayOpsAPI } from '../../api';
import { useFetch } from '../../hooks/useFetch';
import { Card, SectionHeader, Badge, PageLoader, Table, Button } from '../../components/ui';

function fmtMin(m) {
  if (!m) return '—';
  const h = Math.floor(m/60), mn = m%60;
  return h>0 ? `${h}h ${String(mn).padStart(2,'0')}m` : `${mn}m`;
}

export default function FlightsPage() {
  const { data: ops, loading } = useFetch(() => dayOpsAPI.list({ limit:100 }));

  const allOps = ops || [];
  const columns = [
    { header:'Date',       accessor:'date',            render: r => new Date(r.date).toLocaleDateString('pt-PT') },
    { header:'Aircraft',   accessor:'aircraft_reg' },
    { header:'Commander',  accessor:'commander_name' },
    { header:'Copilot',    accessor:'copilot_name' },
    { header:'Flights',    accessor:'flight_count' },
    { header:'Block Time', accessor:'total_block_minutes', render: r => fmtMin(r.total_block_minutes) },
    { header:'PAX',        accessor:'total_passengers' },
    { header:'Fuel Burn',  accessor:'total_fuel_burn_lbs', render: r => r.total_fuel_burn_lbs ? `${r.total_fuel_burn_lbs.toLocaleString()} lbs` : '—' },
    { header:'NM',         accessor:'total_nm', render: r => r.total_nm ? `${r.total_nm} NM` : '—' },
    { header:'Status',     accessor:'status', render: r => <Badge type={r.status}>{r.status}</Badge> },
    { header:'',           sortable:false, render: r => <Link to={`/day-operations/${r.id}`}><Button size="sm" variant="subtle">View →</Button></Link> },
  ];

  if (loading) return <PageLoader label="Loading flights…" />;

  return (
    <div className="animate-fade">
      <SectionHeader
        title="All Flights"
        subtitle="Complete flight history across all day operations"
      />
      <Card padding={0}>
        <Table
          columns={columns}
          rows={allOps}
          emptyMessage="No flight records found"
        />
      </Card>
    </div>
  );
}
