import React, { useState, useCallback } from 'react';
import { aircraftAPI } from '../../api';
import { useFetch } from '../../hooks/useFetch';
import { useForm } from '../../hooks/useForm';
import { useAlert } from '../../context/AlertContext';
import {
  SectionHeader, Button, Badge, Card, Modal, Field,
  Input, PageLoader, EmptyState, KpiCard,
} from '../../components/ui';

export default function AircraftPage() {
  const { success, error: showError } = useAlert();
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState(null);

  const { data: aircraft, loading, refetch } = useFetch(() => aircraftAPI.list());

  const EMPTY = {
    registration:'', type:'AW169',
    mtowLbs:10560, emptyWeightLbs:6834, crewEquipLbs:1074,
    operatingWeightLbs:7908, maxPassengers:12,
    maxFuelLbs:2200, cruiseSpeedKts:155, paxStdWeightLbs:187,
  };
  const form = useForm(EMPTY);

  const openCreate = () => { form.reset(EMPTY); setEditing(null); setShowModal(true); };
  const openEdit   = (ac) => {
    form.reset({
      registration: ac.registration, type: ac.type,
      mtowLbs: ac.mtow_lbs, emptyWeightLbs: ac.empty_weight_lbs,
      crewEquipLbs: ac.crew_equip_lbs, operatingWeightLbs: ac.operating_weight_lbs,
      maxPassengers: ac.max_passengers, maxFuelLbs: ac.max_fuel_lbs,
      cruiseSpeedKts: ac.cruise_speed_kts, paxStdWeightLbs: ac.pax_std_weight_lbs,
    });
    setEditing(ac);
    setShowModal(true);
  };

  const handleSave = useCallback(async (values) => {
    if (!values.registration || !values.type) { showError('Registration and type required'); return; }
    try {
      const payload = {
        registration: values.registration.toUpperCase(), type: values.type,
        mtowLbs: parseInt(values.mtowLbs), emptyWeightLbs: parseInt(values.emptyWeightLbs),
        crewEquipLbs: parseInt(values.crewEquipLbs), operatingWeightLbs: parseInt(values.operatingWeightLbs),
        maxPassengers: parseInt(values.maxPassengers), maxFuelLbs: parseInt(values.maxFuelLbs),
        cruiseSpeedKts: parseInt(values.cruiseSpeedKts), paxStdWeightLbs: parseInt(values.paxStdWeightLbs),
      };
      if (editing) {
        await aircraftAPI.update(editing.id, payload);
        success('Aircraft updated');
      } else {
        await aircraftAPI.create(payload);
        success('Aircraft added');
      }
      setShowModal(false);
      refetch();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to save aircraft');
    }
  }, [editing, success, showError, refetch]);

  if (loading) return <PageLoader label="Loading fleet…" />;

  return (
    <div className="animate-fade">
      <SectionHeader
        title="Fleet Management"
        subtitle="Aircraft specifications and weight & balance data"
        action={<Button onClick={openCreate} icon="+">Add Aircraft</Button>}
      />

      {(aircraft||[]).length === 0 ? (
        <Card><EmptyState icon="🚁" title="No aircraft registered" action={<Button onClick={openCreate}>Add Aircraft</Button>} /></Card>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(380px,1fr))', gap:18 }}>
          {(aircraft||[]).map(ac => (
            <Card key={ac.id}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{
                    width:48, height:48, borderRadius:12,
                    background:'linear-gradient(135deg,var(--ocean-darkest),var(--ocean))',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:22,
                  }}>✈️</div>
                  <div>
                    <div style={{ fontSize:18, fontWeight:800, color:'var(--text)', letterSpacing:-.3 }}>{ac.registration}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>{ac.type}</div>
                  </div>
                </div>
                <Badge type={ac.active ? 'success' : 'danger'}>{ac.active ? 'Operational' : 'Inactive'}</Badge>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:14 }}>
                {[
                  ['MTOW',        `${ac.mtow_lbs?.toLocaleString()} lbs`],
                  ['Op. Weight',  `${ac.operating_weight_lbs?.toLocaleString()} lbs`],
                  ['Max Fuel',    `${ac.max_fuel_lbs?.toLocaleString()} lbs`],
                  ['Max PAX',     ac.max_passengers],
                  ['Speed',       `${ac.cruise_speed_kts} kts`],
                  ['PAX Std Wt',  `${ac.pax_std_weight_lbs} lbs`],
                ].map(([label, value]) => (
                  <div key={label} style={{
                    background:'var(--bg-muted)', borderRadius:8,
                    padding:'8px 10px', textAlign:'center', border:'1px solid var(--border)',
                  }}>
                    <div style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>{label}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12, color:'var(--text-muted)', marginBottom:12 }}>
                <span>Empty: {ac.empty_weight_lbs?.toLocaleString()} lbs</span>
                <span>Crew/Equip: {ac.crew_equip_lbs?.toLocaleString()} lbs</span>
              </div>

              <Button size="sm" variant="ghost" onClick={() => openEdit(ac)}>Edit Specifications</Button>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? `Edit — ${editing.registration}` : 'Add Aircraft'}
        width={520}
        footer={<>
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button loading={form.loading} onClick={() => form.submit(handleSave)}>
            {editing ? 'Save Changes' : 'Add Aircraft'}
          </Button>
        </>}
      >
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Registration" required>
            <Input name="registration" value={form.values.registration} onChange={form.onChange} placeholder="D2-BFN" disabled={!!editing} />
          </Field>
          <Field label="Type" required>
            <Input name="type" value={form.values.type} onChange={form.onChange} placeholder="AW169" />
          </Field>
          <Field label="MTOW (lbs)" required>
            <Input type="number" name="mtowLbs" value={form.values.mtowLbs} onChange={form.onChange} />
          </Field>
          <Field label="Empty weight (lbs)">
            <Input type="number" name="emptyWeightLbs" value={form.values.emptyWeightLbs} onChange={form.onChange} />
          </Field>
          <Field label="Crew/Equip (lbs)">
            <Input type="number" name="crewEquipLbs" value={form.values.crewEquipLbs} onChange={form.onChange} />
          </Field>
          <Field label="Operating weight (lbs)">
            <Input type="number" name="operatingWeightLbs" value={form.values.operatingWeightLbs} onChange={form.onChange} />
          </Field>
          <Field label="Max passengers">
            <Input type="number" name="maxPassengers" value={form.values.maxPassengers} onChange={form.onChange} />
          </Field>
          <Field label="Max fuel (lbs)">
            <Input type="number" name="maxFuelLbs" value={form.values.maxFuelLbs} onChange={form.onChange} />
          </Field>
          <Field label="Cruise speed (kts)">
            <Input type="number" name="cruiseSpeedKts" value={form.values.cruiseSpeedKts} onChange={form.onChange} />
          </Field>
          <Field label="PAX std weight (lbs)">
            <Input type="number" name="paxStdWeightLbs" value={form.values.paxStdWeightLbs} onChange={form.onChange} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
