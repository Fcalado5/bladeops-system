import React, { createContext, useContext, useState, useCallback } from 'react';

const AlertContext = createContext(null);

export function AlertProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const success = useCallback((msg) => addToast(msg, 'success'), [addToast]);
  const error   = useCallback((msg) => addToast(msg, 'error', 5000), [addToast]);
  const warning = useCallback((msg) => addToast(msg, 'warning'), [addToast]);
  const info    = useCallback((msg) => addToast(msg, 'info'), [addToast]);

  const dismiss = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  return (
    <AlertContext.Provider value={{ toasts, success, error, warning, info, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </AlertContext.Provider>
  );
}

export const useAlert = () => {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be inside AlertProvider');
  return ctx;
};

const icons = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

const colors = {
  success: { bg: 'var(--success-bg)', border: 'var(--success-border)', text: 'var(--success)' },
  error:   { bg: 'var(--danger-bg)',  border: 'var(--danger-border)',  text: 'var(--danger)' },
  warning: { bg: 'var(--warning-bg)', border: 'var(--warning-border)', text: 'var(--warning)' },
  info:    { bg: 'var(--info-bg)',    border: 'var(--info-border)',    text: 'var(--ocean)' },
};

function ToastContainer({ toasts, dismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360,
    }}>
      {toasts.map(t => {
        const c = colors[t.type] || colors.info;
        return (
          <div key={t.id} onClick={() => dismiss(t.id)} style={{
            background: c.bg, border: `1px solid ${c.border}`,
            borderRadius: 'var(--radius)', padding: '12px 16px',
            display: 'flex', alignItems: 'flex-start', gap: 10,
            boxShadow: 'var(--shadow)', cursor: 'pointer', animation: 'fadeIn .2s ease',
          }}>
            <span style={{ color: c.text, fontWeight: 700, fontSize: 14, lineHeight: 1.4 }}>
              {icons[t.type]}
            </span>
            <span style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.5, flex: 1 }}>
              {t.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}
