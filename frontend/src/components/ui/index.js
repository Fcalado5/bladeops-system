import React, { useState, useRef, useEffect } from 'react';

// ── Button ────────────────────────────────────────────────────────────────
export function Button({
  children, variant = 'primary', size = 'md',
  loading = false, disabled, onClick, type = 'button',
  style, icon,
}) {
  const variants = {
    primary:  { bg: 'linear-gradient(135deg,var(--ocean-dark),var(--ocean))', color: '#fff', border: 'none', shadow: '0 3px 10px rgba(0,119,182,.3)' },
    success:  { bg: 'linear-gradient(135deg,#0F6B4F,var(--success))', color: '#fff', border: 'none', shadow: '0 3px 10px rgba(26,147,111,.25)' },
    danger:   { bg: 'linear-gradient(135deg,#8B0000,var(--danger))', color: '#fff', border: 'none', shadow: '0 3px 10px rgba(193,18,31,.25)' },
    warning:  { bg: 'linear-gradient(135deg,#B07800,var(--warning))', color: '#fff', border: 'none', shadow: 'none' },
    ghost:    { bg: '#fff', color: 'var(--ocean)', border: '1.5px solid var(--ocean)', shadow: 'none' },
    subtle:   { bg: 'var(--bg-muted)', color: 'var(--text-sec)', border: '1px solid var(--border)', shadow: 'none' },
  };
  const sizes = {
    sm: { padding: '5px 12px', fontSize: 12, borderRadius: 6 },
    md: { padding: '9px 18px', fontSize: 13, borderRadius: 8 },
    lg: { padding: '12px 24px', fontSize: 14, borderRadius: 10 },
  };
  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...s, background: v.bg, color: v.color,
        border: v.border, boxShadow: v.shadow,
        fontWeight: 600, fontFamily: 'inherit',
        display: 'inline-flex', alignItems: 'center', gap: 7,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? .5 : 1,
        transition: 'all .15s',
        ...style,
      }}
    >
      {loading && <Spinner size={12} color="currentColor" />}
      {icon && !loading && <span>{icon}</span>}
      {children}
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────
export function Card({ children, style, padding = 20 }) {
  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding,
      boxShadow: 'var(--shadow-sm)',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────
export function Badge({ children, type = 'default' }) {
  const types = {
    success:      { bg: 'var(--success-bg)',  color: 'var(--success)',  border: 'var(--success-border)' },
    warning:      { bg: 'var(--warning-bg)',  color: 'var(--warning)',  border: 'var(--warning-border)' },
    danger:       { bg: 'var(--danger-bg)',   color: 'var(--danger)',   border: 'var(--danger-border)'  },
    info:         { bg: 'var(--info-bg)',     color: 'var(--ocean)',    border: 'var(--info-border)'    },
    default:      { bg: 'var(--bg-muted)',    color: 'var(--text-sec)', border: 'var(--border)'         },
    ocean:        { bg: 'var(--ocean-pale)',  color: 'var(--ocean-dark)', border: 'var(--ocean-light)'  },
    open:         { bg: 'var(--info-bg)',     color: 'var(--ocean)',    border: 'var(--info-border)'    },
    closed:       { bg: 'var(--bg-muted)',    color: 'var(--text-sec)', border: 'var(--border)'         },
    signed:       { bg: 'var(--success-bg)',  color: 'var(--success)',  border: 'var(--success-border)' },
    apt:          { bg: 'var(--success-bg)',  color: 'var(--success)',  border: 'var(--success-border)' },
    not_apt:      { bg: 'var(--danger-bg)',   color: 'var(--danger)',   border: 'var(--danger-border)'  },
    expiring:     { bg: 'var(--warning-bg)',  color: 'var(--warning)',  border: 'var(--warning-border)' },
    valid:        { bg: 'var(--success-bg)',  color: 'var(--success)',  border: 'var(--success-border)' },
    expired:      { bg: 'var(--danger-bg)',   color: 'var(--danger)',   border: 'var(--danger-border)'  },
    pilot:        { bg: 'var(--info-bg)',     color: 'var(--ocean-dark)', border: 'var(--info-border)'  },
    copilot:      { bg: 'var(--ocean-pale)',  color: 'var(--ocean-dark)', border: 'var(--ocean-light)'  },
    admin:        { bg: 'var(--warning-bg)',  color: 'var(--warning)',  border: 'var(--warning-border)' },
  };
  const t = types[type] || types.default;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: t.bg, color: t.color,
      border: `1px solid ${t.border}`,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────
export function Spinner({ size = 20, color = 'var(--ocean)' }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid transparent`,
      borderTopColor: color,
      borderRightColor: color,
      animation: 'spin .6s linear infinite',
      flexShrink: 0,
    }} />
  );
}

// ── PageLoader ────────────────────────────────────────────────────────────
export function PageLoader({ label = 'Loading...' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: 300, gap: 16, color: 'var(--text-muted)',
    }}>
      <Spinner size={32} />
      <span style={{ fontSize: 13 }}>{label}</span>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────
export function Field({ label, error, required, children, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label style={{
          display: 'block', fontSize: 11, fontWeight: 600,
          color: 'var(--text-sec)', marginBottom: 5,
          textTransform: 'uppercase', letterSpacing: '.05em',
        }}>
          {label}{required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
        </label>
      )}
      {children}
      {hint && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</p>}
      {error && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{error}</p>}
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────
export function Input({ style, hasError, ...props }) {
  return (
    <input
      {...props}
      style={{
        width: '100%', padding: '8px 11px',
        border: `1.5px solid ${hasError ? 'var(--danger)' : 'var(--border)'}`,
        borderRadius: 8, fontSize: 13,
        background: 'var(--bg-surface)', color: 'var(--text)',
        outline: 'none', transition: 'border-color .15s',
        fontFamily: 'inherit',
        ...style,
      }}
      onFocus={e => { e.target.style.borderColor = 'var(--ocean)'; }}
      onBlur={e => { e.target.style.borderColor = hasError ? 'var(--danger)' : 'var(--border)'; }}
    />
  );
}

// ── Select ────────────────────────────────────────────────────────────────
export function Select({ style, hasError, children, ...props }) {
  return (
    <select
      {...props}
      style={{
        width: '100%', padding: '8px 11px',
        border: `1.5px solid ${hasError ? 'var(--danger)' : 'var(--border)'}`,
        borderRadius: 8, fontSize: 13,
        background: 'var(--bg-surface)', color: 'var(--text)',
        outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </select>
  );
}

// ── Textarea ──────────────────────────────────────────────────────────────
export function Textarea({ style, ...props }) {
  return (
    <textarea
      {...props}
      style={{
        width: '100%', padding: '8px 11px',
        border: '1.5px solid var(--border)',
        borderRadius: 8, fontSize: 13,
        background: 'var(--bg-surface)', color: 'var(--text)',
        outline: 'none', fontFamily: 'inherit', resize: 'vertical', minHeight: 72,
        ...style,
      }}
    />
  );
}

// ── Grid ──────────────────────────────────────────────────────────────────
export function Grid({ cols = 2, gap = 14, children, style }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start',
      justifyContent: 'space-between', marginBottom: 20,
    }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
        {subtitle && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────
export function Table({ columns, rows, onRowClick, emptyMessage = 'No data' }) {
  const [sortKey, setSortKey]   = useState(null);
  const [sortDir, setSortDir]   = useState('asc');
  const [filter, setFilter]     = useState('');

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  let display = rows || [];
  if (filter) {
    const q = filter.toLowerCase();
    display = display.filter(r =>
      columns.some(c => String(c.accessor ? r[c.accessor] : '').toLowerCase().includes(q))
    );
  }
  if (sortKey) {
    display = [...display].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <Input
          placeholder="Filter…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ width: 200 }}
        />
      </div>
      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-muted)', borderBottom: '2px solid var(--border)' }}>
              {columns.map(col => (
                <th
                  key={col.key || col.accessor}
                  onClick={col.sortable !== false && col.accessor ? () => toggleSort(col.accessor) : undefined}
                  style={{
                    padding: '10px 14px', textAlign: 'left',
                    fontSize: 11, fontWeight: 700, color: 'var(--text-sec)',
                    textTransform: 'uppercase', letterSpacing: '.05em',
                    cursor: col.sortable !== false && col.accessor ? 'pointer' : 'default',
                    userSelect: 'none', whiteSpace: 'nowrap',
                  }}
                >
                  {col.header}
                  {sortKey === col.accessor && (
                    <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {display.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{
                  padding: '32px 14px', textAlign: 'center',
                  color: 'var(--text-muted)', fontSize: 13,
                }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : display.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{
                  borderBottom: '1px solid var(--border)',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background .1s',
                  background: i % 2 === 0 ? 'var(--bg)' : 'var(--bg-surface)',
                }}
                onMouseEnter={e => onRowClick && (e.currentTarget.style.background = 'var(--ocean-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--bg)' : 'var(--bg-surface)')}
              >
                {columns.map(col => (
                  <td key={col.key || col.accessor} style={{
                    padding: '11px 14px', fontSize: 13, color: 'var(--text)',
                    whiteSpace: col.wrap ? 'normal' : 'nowrap',
                  }}>
                    {col.render ? col.render(row) : row[col.accessor] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 480, footer }) {
  const overlayRef = useRef();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose?.()}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,30,80,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: 'var(--bg)', borderRadius: 'var(--radius-lg)',
        width: '100%', maxWidth: width, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)', animation: 'fadeIn .2s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              fontSize: 18, color: 'var(--text-muted)', cursor: 'pointer',
              padding: '2px 6px', borderRadius: 4,
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: '14px 20px', borderTop: '1px solid var(--border)',
            display: 'flex', justifyContent: 'flex-end', gap: 10,
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Alert Banner ──────────────────────────────────────────────────────────
export function AlertBanner({ type = 'info', children, icon }) {
  const types = {
    info:    { bg: 'var(--info-bg)',     color: 'var(--ocean)',   border: 'var(--info-border)'    },
    success: { bg: 'var(--success-bg)', color: 'var(--success)', border: 'var(--success-border)' },
    warning: { bg: 'var(--warning-bg)', color: 'var(--warning)', border: 'var(--warning-border)' },
    danger:  { bg: 'var(--danger-bg)',  color: 'var(--danger)',  border: 'var(--danger-border)'  },
  };
  const t = types[type] || types.info;
  return (
    <div style={{
      background: t.bg, border: `1px solid ${t.border}`,
      borderRadius: 'var(--radius)', padding: '10px 14px',
      display: 'flex', alignItems: 'flex-start', gap: 10,
      fontSize: 13, color: 'var(--text)', marginBottom: 14,
    }}>
      {icon && <span style={{ color: t.color, fontSize: 14, flexShrink: 0 }}>{icon}</span>}
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────
export function KpiCard({ label, value, sub, color = 'var(--ocean)', icon }) {
  return (
    <Card style={{ minHeight: 90 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
            {label}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: 'var(--text-sec)', marginTop: 4 }}>{sub}</div>}
        </div>
        {icon && (
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'var(--ocean-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, label, showPercent = true }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const col = pct >= 87 ? 'var(--danger)' : pct >= 70 ? 'var(--warning)' : 'var(--success)';
  return (
    <div>
      {(label || showPercent) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-sec)', marginBottom: 5 }}>
          {label && <span>{label}</span>}
          {showPercent && <span style={{ color: col, fontWeight: 600 }}>{pct}%</span>}
        </div>
      )}
      <div style={{ height: 7, background: 'var(--bg-muted)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 4, transition: 'width .4s ease' }} />
      </div>
    </div>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────────────────
export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={400}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={variant} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <p style={{ fontSize: 14, color: 'var(--text-sec)', lineHeight: 1.6 }}>{message}</p>
    </Modal>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────
export function EmptyState({ icon = '📋', title, description, action }) {
  return (
    <div style={{
      textAlign: 'center', padding: '48px 24px',
      color: 'var(--text-muted)',
    }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-sec)', marginBottom: 6 }}>{title}</div>
      {description && <p style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>{description}</p>}
      {action}
    </div>
  );
}
