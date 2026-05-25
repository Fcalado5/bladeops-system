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
  const { isAdmin, isPilot, user } = useAuth();
  const { success, error: showError } = useAlert();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const { data: ops,      loading, refetch } = useFetch(() => dayOpsAPI.list({ limit: 50 }));
  const { data: todayOps }                   = useFetch(() => dayOpsAPI.list({ limit: 100, online: true }));
  const { data: pilotsData }                 = useFetch(() => pilotsAPI.list());
  const { data: acData }                     = useFetch(() => aircraftAPI.list());

  const pilots   = (pilotsData || []).filter(p => p.role === 'pilot'   && p.active);
  const copilots = (pilotsData || []).filter(p => p.role === 'copilot' && p.active);
  const aircraft = (acData     || []).filter(a => a.active);

  const myPilot = (pilotsData || []).find(p => p.user_id === user?.id);

  const today = new Date().toISOString().split('T')[0];
  const now   = `${String(new Date().getHours()).padStart(2,'0')}:${String(new Date().getMinutes()).padStart(2,'0')}`;

  // Copilotos já em serviço hoje (usa todayOps que tem TODAS as operações abertas)
  const busyCopilotIds = (todayOps || [])
    .map(op => op.copilot_pilot_id)
    .filter(Boolean);

  const availableCopilots = copilots.filter(p => !busyCopilotIds.includes(p.id));

  const form = useForm({
    commanderId: '', copilotId: '', aircraftId: '',
    motorOnTime: now, initialFuelLbs: 1500, date: today,
  });

  const openModal = () => {
    form.reset({
      commanderId:    isPilot && myPilot ? String(myPilot.id) : '',
      copilotId:      '', aircraftId: '',
      motorOnTime:    now, initialFuelLbs: 1500, date: today,
    });
    setShowModal(true);
  };

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
    { header: 'Data',       accessor: 'date',           render: r => new Date(r.date).toLocaleDateString('pt-PT') },
    { header: 'Aeronave',   accessor: 'aircraft_reg' },
    { header: 'Comandante', accessor: 'commander_name' },
    { header: 'Copiloto',   accessor: 'copilot_name' },
    { header: 'Voos',       accessor: 'flight_count' },
    { header: 'Block Time', accessor: 'total_block_minutes', render: r => fmtMin(r.total_block_minutes) },
    { header: 'PAX',        accessor: 'total_passengers' },
    { header: 'Fuel Burn',  accessor: 'total_fuel_burn_lbs', render: r => r.total_fuel_burn_lbs ? `${r.total_fuel_burn_lbs.toLocaleString()} lbs` : '—' },
    { header: 'Estado',     accessor: 'status', render: r => <Badge type={r.status}>{r.status}</Badge> },
  ];

  if (loading) return <PageLoader label="A carregar operações…" />;

  return (
    <div className="animate-fade">
      <SectionHeader
        title="Day Operations"
        subtitle="Gestão de operações diárias e registos TECHLOG"
        action={<Button onClick={openModal} icon="+">Nova Operação</Button>}
      />

      <Card padding={0}>
        {(ops || []).length === 0 ? (
          <EmptyState
            icon="📋" title="Sem operações"
            description="Inicia uma nova operação para começar."
            action={<Button onClick={openModal}>Iniciar Operação</Button>}
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
        title="Nova Operação Diária"
        width={500}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button loading={form.loading} onClick={() => form.submit(handleCreate)}>
              Abrir Operação
            </Button>
          </>
        }
      >
        <Field label="Data" required>
          <Input type="date" name="date" value={form.values.date} onChange={form.onChange} />
        </Field>

        <Field label="Comandante" required>
          {isPilot && myPilot ? (
            <Input value={myPilot.name} disabled />
          ) : (
            <Select name="commanderId" value={form.values.commanderId} onChange={form.onChange}>
              <option value="">— Seleccionar comandante —</option>
              {pilots.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.flightStatus === 'not_apt' ? ' ⚠️' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Copiloto" required>
          <Select name="copilotId" value={form.values.copilotId} onChange={form.onChange}>
            <option value="">— Seleccionar copiloto —</option>
            {availableCopilots.length === 0 ? (
              <option disabled>Nenhum copiloto disponível hoje</option>
            ) : (
              availableCopilots.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))
            )}
          </Select>
        </Field>

        <Field label="Aeronave" required>
          <Select name="aircraftId" value={form.values.aircraftId} onChange={form.onChange}>
            <option value="">— Seleccionar aeronave —</option>
            {aircraft.map(a => (
              <option key={a.id} value={a.id}>{a.registration} · {a.type}</option>
            ))}
          </Select>
        </Field>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <Field label="Motor ON" required>
            <Input type="time" name="motorOnTime" value={form.values.motorOnTime} onChange={form.onChange} />
          </Field>
          <Field label="Fuel inicial (lbs)" required>
            <Input type="number" name="initialFuelLbs" value={form.values.initialFuelLbs} onChange={form.onChange} min={0} />
          </Field>
        </div>

        {availableCopilots.length === 0 && (
          <div style={{ marginTop:10, padding:'8px 12px', background:'var(--warning-bg)', border:'1px solid var(--warning-border)', borderRadius:8, fontSize:12, color:'var(--warning)' }}>
            ⚠️ Todos os copilotos estão em serviço hoje.
          </div>
        )}
      </Modal>
    </div>
  );
}