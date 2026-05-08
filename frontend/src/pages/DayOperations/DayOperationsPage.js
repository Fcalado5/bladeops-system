import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dayOpsAPI, pilotsAPI, aircraftAPI } from '../../api';
import { useFetch } from '../../hooks/useFetch';
import { useForm } from '../../hooks/useForm';
import { useAlert } from '../../context/AlertContext';
import { useAuth } from '../../context/AuthContext';
import {
  SectionHeader, Button, Badge, Table, Modal, Field,
  Input, Select, Card, PageLoader, EmptyState,
} from '../../components/ui';

function fmtMin(m) {
  if (!m) return '—';
  const h = Math.floor(m / 60), mn = m % 60;
  return h > 0 ? `${h}h ${String(mn).padStart(2,'0')}m` : `${mn}m`;
}

export default function DayOperationsPage() {
  const { isAdmin } = useAuth();
  const { success, error: showError } = useAlert();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const { data: ops, loading, refetch } = useFetch(() => dayOpsAPI.list({ limit: 50 }));
  const { data: pilotsData } = useFetch(() => pilotsAPI.list());
  const { data: acData }     = useFetch(() => aircraftAPI.list());

  const pilots   = pilotsData?.filter(p => p.role === 'pilot' && p.active) || [];
  const copilots = pilotsData?.filter(p => p.role === 'copilot' && p.active) || [];
  const aircraft = acData?.filter(a => a.active) || [];

  const today = new Date().toISOString().split('T')[0];
  const now   = `${String(new Date().getHours()).padStart(2,'0')}:${String(new Date().getMinutes()).padStart(2,'0')}`;

  const form = useForm({
    commanderId: '', copilotId: '', aircraftId: '',
    motorOnTime: now, initialFuelLbs: 1500, date: today,
  });

  const handleCreate = useCallback(async (values) => {
    if (!values.commanderId || !values.copilotId || !values.aircraftId) {
      showError('All fields are required'); return;
    }
    if (values.commanderId === values.copilotId) {
      showError('Commander and copilot cannot be the same person'); return;
    }
    try {
      const res = await dayOpsAPI.create({
        commanderId:    values.commanderId,
        copilotId:      values.copilotId,
        aircraftId:     values.aircraftId,
        motorOnTime:    values.motorOnTime,
        initialFuelLbs: parseInt(values.initialFuelLbs),
        date:           values.date,
      });
      success('Day operation opened');
      setShowModal(false);
      refetch();
      navigate(`/day-operations/${res.data.id}`);
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to create operation');
    }
  }, [navigate, success, showError, refetch]);

  const columns = [
    { header: 'Date',       accessor: 'date',           render: r => new Date(r.date).toLocaleDateString('pt-PT') },
    { header: 'Aircraft',   accessor: 'aircraft_reg' },
    { header: 'Commander',  accessor: 'commander_name' },
    { header: 'Copilot',    accessor: 'copilot_name' },
    { header: 'Flights',    accessor: 'flight_count' },
    { header: 'Block Time', accessor: 'total_block_minutes', render: r => fmtMin(r.total_block_minutes) },
    { header: 'PAX',        accessor: 'total_passengers' },
    { header: 'Fuel Burn',  accessor: 'total_fuel_burn_lbs', render: r => r.total_fuel_burn_lbs ? `${r.total_fuel_burn_lbs.toLocaleString()} lbs` : '—' },
    { header: 'Status',     accessor: 'status', render: r => <Badge type={r.status}>{r.status}</Badge> },
  ];

  if (loading) return <PageLoader label="Loading operations…" />;

  return (
    <div className="animate-fade">
      <SectionHeader
        title="Day Operations"
        subtitle="Manage daily flight operations and TECHLOG records"
        action={
          <Button onClick={() => setShowModal(true)} icon="+">
            New Day Operation
          </Button>
        }
      />

      <Card padding={0}>
        {(ops || []).length === 0 ? (
          <EmptyState
            icon="📋" title="No operations yet"
            description="Start a new day operation to begin tracking flights."
            action={<Button onClick={() => setShowModal(true)}>Start Operation</Button>}
          />
        ) : (
          <Table
            columns={columns}
            rows={ops || []}
            onRowClick={row => navigate(`/day-operations/${row.id}`)}
          />
        )}
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="New Day Operation"
        width={500}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button loading={form.loading} onClick={() => form.submit(handleCreate)}>
              Open Operation
            </Button>
          </>
        }
      >
        <Field label="Date" required>
          <Input type="date" name="date" value={form.values.date} onChange={form.onChange} />
        </Field>
        <Field label="Commander" required>
          <Select name="commanderId" value={form.values.commanderId} onChange={form.onChange}>
            <option value="">— Select commander —</option>
            {pilots.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.flight_status === 'not_apt' ? ' ⚠️' : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Copilot" required>
          <Select name="copilotId" value={form.values.copilotId} onChange={form.onChange}>
            <option value="">— Select copilot —</option>
            {copilots.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Aircraft" required>
          <Select name="aircraftId" value={form.values.aircraftId} onChange={form.onChange}>
            <option value="">— Select aircraft —</option>
            {aircraft.map(a => (
              <option key={a.id} value={a.id}>{a.registration} · {a.type}</option>
            ))}
          </Select>
        </Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <Field label="Motor ON time" required>
            <Input type="time" name="motorOnTime" value={form.values.motorOnTime} onChange={form.onChange} />
          </Field>
          <Field label="Initial fuel (lbs)" required>
            <Input type="number" name="initialFuelLbs" value={form.values.initialFuelLbs} onChange={form.onChange} min={0} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}