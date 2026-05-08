import React, { useState, useCallback } from 'react';
import { pilotsAPI } from '../../api';
import { useFetch } from '../../hooks/useFetch';
import { useForm } from '../../hooks/useForm';
import { useAlert } from '../../context/AlertContext';
import { useAuth } from '../../context/AuthContext';
import {
  SectionHeader, Button, Badge, Card, Modal, Field, Input, Select,
  PageLoader, EmptyState, AlertBanner, ConfirmModal,
} from '../../components/ui';

const DOC_FIELDS = [
  { key: 'licenseExpiry',       label: 'Licence Expiry',     apiKey: 'license_expiry',        statusKey: 'license' },
  { key: 'medicalClass1Expiry', label: 'Medical Class 1',    apiKey: 'medical_class1_expiry', statusKey: 'medical' },
  { key: 'huetExpiry',          label: 'HUET Expiry',        apiKey: 'huet_expiry',           statusKey: 'huet' },
  { key: 'bosietExpiry',        label: 'BOSIET Expiry',      apiKey: 'bosiet_expiry',         statusKey: 'bosiet' },
  { key: 'annualCheckExpiry',   label: 'Annual Check AW169', apiKey: 'annual_check_expiry',   statusKey: 'annualCheck' },
];

// FIXED: usa statusKey correcto que bate com o backend
function docBadge(docStatuses, statusKey, apiDate) {
  const s = docStatuses?.[statusKey]?.status;
  if (!s || s === 'missing') return <Badge type="danger">Missing</Badge>;
  if (s === 'expired')       return <Badge type="danger">Expired</Badge>;
  if (s === 'expiring_soon') return <Badge type="warning">Expiring soon</Badge>;
  return <Badge type="success">Valid</Badge>;
}

export default function PilotsPage() {
  const { isAdmin } = useAuth();
  const { success, error: showError } = useAlert();
  const [showModal,   setShowModal]   = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [expanded,    setExpanded]    = useState(null);
  const [confirmToggle, setConfirmToggle] = useState(null);

  const { data: pilots, loading, refetch } = useFetch(() => pilotsAPI.list());

  const EMPTY = {
    name:'', email:'', password:'', role:'pilot', aircraftAssigned:'',
    phone:'', totalHours:0, hoursAw169:0,
    licenseNumber:'', licenseType:'ATPL/H',
    licenseExpiry:'', medicalClass1Expiry:'',
    huetExpiry:'', bosietExpiry:'', annualCheckExpiry:'',
  };
  const form = useForm(EMPTY);

  const openCreate = () => { form.reset(EMPTY); setEditing(null); setShowModal(true); };
  const openEdit   = (p) => {
    form.reset({
      name: p.name, email: p.email, password: '',
      role: p.role, aircraftAssigned: p.aircraft_assigned || '',
      phone: p.phone || '', totalHours: p.total_hours || 0,
      hoursAw169: p.hours_aw169 || 0,
      licenseNumber: p.license_number || '', licenseType: p.license_type || 'ATPL/H',
      licenseExpiry:       p.license_expiry?.split('T')[0]       || '',
      medicalClass1Expiry: p.medical_class1_expiry?.split('T')[0] || '',
      huetExpiry:          p.huet_expiry?.split('T')[0]          || '',
      bosietExpiry:        p.bosiet_expiry?.split('T')[0]        || '',
      annualCheckExpiry:   p.annual_check_expiry?.split('T')[0]  || '',
    });
    setEditing(p);
    setShowModal(true);
  };

  const handleSave = useCallback(async (values) => {
    if (!values.name || !values.email) { showError('Name and email required'); return; }
    try {
      const payload = {
        name: values.name, email: values.email, role: values.role,
        aircraftAssigned: values.aircraftAssigned, phone: values.phone,
        totalHours: parseInt(values.totalHours) || 0,
        hoursAw169: parseInt(values.hoursAw169) || 0,
        licenseNumber: values.licenseNumber, licenseType: values.licenseType,
        licenseExpiry:       values.licenseExpiry       || null,
        medicalClass1Expiry: values.medicalClass1Expiry || null,
        huetExpiry:          values.huetExpiry          || null,
        bosietExpiry:        values.bosietExpiry        || null,
        annualCheckExpiry:   values.annualCheckExpiry   || null,
      };
      if (values.password) payload.password = values.password;

      if (editing) {
        await pilotsAPI.update(editing.id, payload);
        success('Pilot updated');
      } else {
        if (!values.password) { showError('Password is required for new pilots'); return; }
        await pilotsAPI.create({ ...payload, password: values.password });
        success('Pilot created');
      }
      setShowModal(false);
      refetch();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to save pilot');
    }
  }, [editing, success, showError, refetch]);

  // FIXED: confirmação antes de desactivar
  const handleToggle = useCallback(async (pilot) => {
    try {
      await pilotsAPI.toggle(pilot.id);
      setConfirmToggle(null);
      refetch();
    } catch { showError('Failed to toggle pilot'); }
  }, [refetch, showError]);

  if (loading) return <PageLoader label="Loading pilots…" />;

  return (
    <div className="animate-fade">
      <SectionHeader
        title="Pilots & Crew"
        subtitle="Manage crew profiles, documents and flight status"
        action={isAdmin && <Button onClick={openCreate} icon="+">Add Pilot</Button>}
      />

      {(pilots || []).length === 0 ? (
        <Card>
          <EmptyState icon="👤" title="No pilots registered"
            description="Add pilots to get started."
            action={isAdmin && <Button onClick={openCreate}>Add Pilot</Button>}
          />
        </Card>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:16 }}>
          {(pilots || []).map(p => (
            <Card key={p.id} style={{ border: p.flight_status === 'not_apt' ? '1.5px solid var(--danger-border)' : '1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12 }}>
                <div style={{
                  width:44, height:44, borderRadius:'50%', flexShrink:0,
                  background:'linear-gradient(135deg,var(--ocean-dark),var(--ocean))',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:15, fontWeight:700, color:'#fff',
                }}>
                  {p.name.split(' ').map(x => x[0]).join('').slice(0,2)}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--text)' }}>{p.name}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:1 }}>
                    <Badge type={p.role}>{p.role}</Badge>
                    {' · '}{p.aircraft_assigned || '—'}
                  </div>
                </div>
                <Badge type={p.flight_status}>{p.flight_status === 'apt' ? 'Apt to Fly' : 'Not Apt'}</Badge>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10, fontSize:12, color:'var(--text-sec)' }}>
                <div>Total hrs: <strong style={{ color:'var(--text)' }}>{p.total_hours || 0}h</strong></div>
                <div>AW169 hrs: <strong style={{ color:'var(--text)' }}>{p.hours_aw169 || 0}h</strong></div>
                {p.phone && <div style={{ gridColumn:'1/-1' }}>📞 {p.phone}</div>}
              </div>

              <button onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                style={{ background:'none', border:'none', color:'var(--ocean)', fontSize:12, cursor:'pointer', fontWeight:600, marginBottom:8, padding:0 }}>
                {expanded === p.id ? '▲ Hide documents' : '▼ Show documents'}
              </button>

              {expanded === p.id && (
                <div style={{ borderTop:'1px solid var(--border)', paddingTop:10 }}>
                  {DOC_FIELDS.map(df => (
                    <div key={df.key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, fontSize:12 }}>
                      <span style={{ color:'var(--text-sec)' }}>{df.label}</span>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {p[df.apiKey] && (
                          <span style={{ color:'var(--text-muted)' }}>
                            {new Date(p[df.apiKey]).toLocaleDateString('pt-PT')}
                          </span>
                        )}
                        {/* FIXED: passa statusKey correcto */}
                        {docBadge(p.docStatuses, df.statusKey, p[df.apiKey])}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isAdmin && (
                <div style={{ display:'flex', gap:8, marginTop:10, borderTop:'1px solid var(--border)', paddingTop:10 }}>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>Edit</Button>
                  {/* FIXED: confirmação antes de desactivar */}
                  <Button size="sm" variant={p.active ? 'subtle' : 'success'}
                    onClick={() => p.active ? setConfirmToggle(p) : handleToggle(p)}>
                    {p.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* FIXED: modal de confirmação para desactivar */}
      <ConfirmModal
        open={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={() => handleToggle(confirmToggle)}
        title="Deactivate pilot"
        message={`Are you sure you want to deactivate ${confirmToggle?.name}? They will no longer be able to log in.`}
        confirmLabel="Deactivate"
        variant="danger"
      />

      {/* Create / Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? `Edit — ${editing.name}` : 'Add New Pilot'}
        width={560}
        footer={<>
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button loading={form.loading} onClick={() => form.submit(handleSave)}>
            {editing ? 'Save Changes' : 'Create Pilot'}
          </Button>
        </>}
      >
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Full name" required style={{ gridColumn:'1/-1' }}>
            <Input name="name" value={form.values.name} onChange={form.onChange} placeholder="Full name" />
          </Field>
          <Field label="Email" required>
            <Input type="email" name="email" value={form.values.email} onChange={form.onChange} placeholder="email@bladeops.ao" />
          </Field>
          <Field label={editing ? 'New password (leave blank to keep)' : 'Password'} required={!editing}>
            <Input type="password" name="password" value={form.values.password} onChange={form.onChange} placeholder="••••••••" />
          </Field>
          <Field label="Role" required>
            <Select name="role" value={form.values.role} onChange={form.onChange}>
              <option value="pilot">Commander (Pilot)</option>
              <option value="copilot">Copilot</option>
            </Select>
          </Field>
          <Field label="Aircraft assigned">
            <Input name="aircraftAssigned" value={form.values.aircraftAssigned} onChange={form.onChange} placeholder="D2-BFN" />
          </Field>
          <Field label="Phone">
            <Input name="phone" value={form.values.phone} onChange={form.onChange} placeholder="+244 9XX XXX XXX" />
          </Field>
          <Field label="Total hours">
            <Input type="number" name="totalHours" value={form.values.totalHours} onChange={form.onChange} min={0} />
          </Field>
          <Field label="AW169 hours">
            <Input type="number" name="hoursAw169" value={form.values.hoursAw169} onChange={form.onChange} min={0} />
          </Field>
          <Field label="Licence number">
            <Input name="licenseNumber" value={form.values.licenseNumber} onChange={form.onChange} placeholder="ATPL/H-2021" />
          </Field>
          <Field label="Licence type">
            <Select name="licenseType" value={form.values.licenseType} onChange={form.onChange}>
              <option value="ATPL/H">ATPL/H</option>
              <option value="CPL/H">CPL/H</option>
            </Select>
          </Field>
        </div>

        <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--border)' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--ocean)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>
            Document expiry dates
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {DOC_FIELDS.map(df => (
              <Field key={df.key} label={df.label}>
                <Input type="date" name={df.key} value={form.values[df.key]} onChange={form.onChange} />
              </Field>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
