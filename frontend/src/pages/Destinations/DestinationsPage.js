import React, { useState, useCallback } from 'react';
import { destinationsAPI } from '../../api';
import { useFetch } from '../../hooks/useFetch';
import { useForm } from '../../hooks/useForm';
import { useAlert } from '../../context/AlertContext';
import { useAuth } from '../../context/AuthContext';
import {
  SectionHeader, Button, Badge, Card, Modal, Field,
  Input, Select, PageLoader, EmptyState,
} from '../../components/ui';

function nmColor(nm) {
  if (!nm || nm === 0) return 'var(--text-muted)';
  if (nm > 100) return 'var(--danger)';
  if (nm > 30)  return 'var(--warning)';
  return 'var(--success)';
}

export default function DestinationsPage() {
  const { isAdmin } = useAuth();
  const { success, error: showError } = useAlert();
  const [showModal,  setShowModal]  = useState(false);
  const [showDistModal, setShowDistModal] = useState(false);
  const [editingDist,   setEditingDist]   = useState(null);
  const [distValues,    setDistValues]    = useState({});

  const { data, loading, refetch } = useFetch(() => destinationsAPI.list());
  const destinations = data?.destinations || [];
  const distances    = data?.distances || {};

  const form = useForm({ name:'', type:'Offshore', coordinates:'' });

  const handleCreate = useCallback(async (values) => {
    if (!values.name) { showError('Name required'); return; }
    try {
      const distMap = {};
      destinations.forEach(d => {
        const k = `${d.name}:${values.name}`;
        if (distances[k]) distMap[d.name] = distances[k];
      });
      await destinationsAPI.create({ name: values.name, type: values.type, coordinates: values.coordinates, distances: distMap });
      success('Destination added');
      setShowModal(false);
      refetch();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to add destination');
    }
  }, [destinations, distances, success, showError, refetch]);

  const openEditDist = (dest) => {
    setEditingDist(dest);
    const init = {};
    destinations.filter(d => d.id !== dest.id).forEach(d => {
      const k1 = `${dest.name}:${d.name}`;
      const k2 = `${d.name}:${dest.name}`;
      init[d.id] = distances[k1] || distances[k2] || '';
    });
    setDistValues(init);
    setShowDistModal(true);
  };

  const handleSaveDist = useCallback(async () => {
    if (!editingDist) return;
    try {
      const payload = {};
      Object.entries(distValues).forEach(([id, nm]) => {
        if (nm) payload[id] = parseInt(nm);
      });
      await destinationsAPI.updateDistances(editingDist.id, payload);
      success('Distances updated');
      setShowDistModal(false);
      refetch();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to update distances');
    }
  }, [editingDist, distValues, success, showError, refetch]);

  if (loading) return <PageLoader label="Loading destinations…" />;

  const typeColors = { Base:'ocean', Offshore:'info', FPSO:'warning', Other:'default' };

  return (
    <div className="animate-fade">
      <SectionHeader
        title="Destinations"
        subtitle="PSVM offshore points and distance matrix"
        action={isAdmin && <Button onClick={() => { form.reset({ name:'', type:'Offshore', coordinates:'' }); setShowModal(true); }} icon="+">Add Destination</Button>}
      />

      {/* Destination cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14, marginBottom:24 }}>
        {destinations.map(d => (
          <Card key={d.id} style={{ padding:'14px 16px' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{d.name}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{d.coordinates||'No coordinates'}</div>
              </div>
              <Badge type={typeColors[d.type]||'default'}>{d.type}</Badge>
            </div>
            {isAdmin && (
              <Button size="sm" variant="subtle" onClick={() => openEditDist(d)}>Edit Distances</Button>
            )}
          </Card>
        ))}
      </div>

      {/* Distance matrix */}
      <Card>
        <h3 style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>Distance Matrix (NM)</h3>
        <div style={{ overflowX:'auto' }}>
          <table style={{ borderCollapse:'collapse', width:'100%', fontSize:12 }}>
            <thead>
              <tr>
                <th style={{ padding:'8px 12px', background:'var(--ocean-dark)', color:'#fff', fontWeight:700, textAlign:'left', borderRadius:'8px 0 0 0' }}>
                  From / To
                </th>
                {destinations.map(d => (
                  <th key={d.id} style={{ padding:'8px 10px', background:'var(--ocean-dark)', color:'#fff', fontWeight:700, textAlign:'center', whiteSpace:'nowrap', fontSize:11 }}>
                    {d.name.replace('PSVM ','')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {destinations.map((from, ri) => (
                <tr key={from.id} style={{ background: ri%2===0?'var(--bg)':'var(--bg-surface)' }}>
                  <td style={{ padding:'8px 12px', fontWeight:700, color:'var(--ocean-dark)', borderRight:'2px solid var(--border)', whiteSpace:'nowrap' }}>
                    {from.name.replace('PSVM ','')}
                  </td>
                  {destinations.map(to => {
                    if (from.id === to.id) return (
                      <td key={to.id} style={{ padding:'8px 10px', textAlign:'center', background:'var(--bg-muted)', color:'var(--text-muted)' }}>—</td>
                    );
                    const k1 = `${from.name}:${to.name}`;
                    const k2 = `${to.name}:${from.name}`;
                    const nm = distances[k1] || distances[k2] || null;
                    return (
                      <td key={to.id} style={{ padding:'8px 10px', textAlign:'center', fontWeight: nm ? 600 : 400, color: nmColor(nm) }}>
                        {nm ? `${nm} NM` : <span style={{ color:'var(--text-muted)' }}>?</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display:'flex', gap:16, marginTop:12, fontSize:11, color:'var(--text-muted)' }}>
          <span>🟢 &lt;30 NM (inter-platform)</span>
          <span>🟡 30–100 NM (medium)</span>
          <span>🔴 &gt;100 NM (base to offshore)</span>
        </div>
      </Card>

      {/* Add destination modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Destination" width={440}
        footer={<>
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button loading={form.loading} onClick={() => form.submit(handleCreate)}>Add Destination</Button>
        </>}
      >
        <Field label="Name" required>
          <Input name="name" value={form.values.name} onChange={form.onChange} placeholder="PSVM Block 20" />
        </Field>
        <Field label="Type" required>
          <Select name="type" value={form.values.type} onChange={form.onChange}>
            <option value="Offshore">Offshore</option>
            <option value="Base">Base</option>
            <option value="FPSO">FPSO</option>
            <option value="Other">Other</option>
          </Select>
        </Field>
        <Field label="Coordinates">
          <Input name="coordinates" value={form.values.coordinates} onChange={form.onChange} placeholder="9°54'S 11°28'E" />
        </Field>
      </Modal>

      {/* Edit distances modal */}
      <Modal open={showDistModal} onClose={() => setShowDistModal(false)}
        title={`Distances from "${editingDist?.name?.replace('PSVM ','')}"` }
        width={440}
        footer={<>
          <Button variant="ghost" onClick={() => setShowDistModal(false)}>Cancel</Button>
          <Button onClick={handleSaveDist}>Save Distances</Button>
        </>}
      >
        {destinations.filter(d => d.id !== editingDist?.id).map(d => (
          <Field key={d.id} label={`To ${d.name.replace('PSVM ','')}`}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Input
                type="number" min={0} placeholder="NM"
                value={distValues[d.id] || ''}
                onChange={e => setDistValues(prev => ({ ...prev, [d.id]: e.target.value }))}
              />
              <span style={{ fontSize:11, color:'var(--text-muted)', whiteSpace:'nowrap' }}>NM</span>
            </div>
          </Field>
        ))}
      </Modal>
    </div>
  );
}
