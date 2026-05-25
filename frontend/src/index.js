import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
// ── TRIPS ─────────────────────────────────────────────────────────────────
export const tripsAPI = {
  list:     (dayOpId)          => client.get('/trips', { params: { dayOpId } }),
  rotorOn:  (dayOpId, time)    => client.post('/trips', { dayOpId, rotorOnTime: time }),
  rotorOff: (tripId, time)     => client.patch(`/trips/${tripId}/rotoroff`, { rotorOffTime: time }),
};