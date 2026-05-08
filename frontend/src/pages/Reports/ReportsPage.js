import React, { useState, useCallback } from 'react';
import { dayOpsAPI, exportAPI } from '../../api';
import { useFetch } from '../../hooks/useFetch';
import { useAlert } from '../../context/AlertContext';
import { Card, SectionHeader, Button, Badge, PageLoader, Table } from '../../components/ui';

function fmtMin(m) {
  if (!m) return '—';
  const h = Math.floor(m/60), mn = m%60;
  return h>0 ? `${h}h ${String(mn).padStart(2,'0')}m` : `${mn}m`;
}

export default function ReportsPage() {
  const { success, error: showError } = useAlert();
  const [exporting, setExporting] = useState(null);

  const { data: ops, loading } = useFetch(() => dayOpsAPI.list({ limit:100 }));

  const handleExport = useCallback(async (op) => {
    try {
      setExporting(op.id);
      const res = await exportAPI.pdf(op.id);
      const url = URL.createObjectURL(new Blob([res.data], { type:'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `TECHLOG_${op.date}_${op.aircraft_reg}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      success('PDF exported');
    } catch {
      showError('Failed to export PDF. Ensure the day has flights.');
    } finally {
      setExporting(null);
    }
  }, [success, showError]);

  const columns = [
    { header:'Date',       accessor:'date',       render: r => new Date(r.date).toLocaleDateString('pt-PT') },
    { header:'Aircraft',   accessor:'aircraft_reg' },
    { header:'Commander',  accessor:'commander_name' },
    { header:'Flights',    accessor:'flight_count' },
    { header:'Block Time', render: r => fmtMin(r.total_block_minutes) },
    { header:'PAX',        accessor:'total_passengers' },
    { header:'Status',     render: r => <Badge type={r.status}>{r.status}</Badge> },
    { header:'Export',     sortable:false, render: r => (
        <Button
          size="sm" variant="success" icon="📄"
          loading={exporting === r.id}
          onClick={() => handleExport(r)}
        >
          PDF
        </Button>
      )},
  ];

  if (loading) return <PageLoader label="Loading reports…" />;

  return (
    <div className="animate-fade">
      <SectionHeader
        title="Reports"
        subtitle="Export TECHLOG PDFs for all day operations"
      />
      <Card padding={0}>
        <Table
          columns={columns}
          rows={ops || []}
          emptyMessage="No operations to export"
        />
      </Card>
    </div>
  );
}
