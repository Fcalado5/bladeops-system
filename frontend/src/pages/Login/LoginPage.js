import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { Button, Field, Input, AlertBanner } from '../../components/ui';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const { warning } = useAlert();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // FIXED: validação de email no frontend
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    const result = await login(email.trim(), password);
    if (!result.ok) { setError(result.error); return; }
    if (result.docWarnings?.length) {
      result.docWarnings.forEach(w =>
        warning(`Document warning: ${w.field} — ${w.status}`)
      );
    }
    navigate('/');
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: 'linear-gradient(160deg, var(--ocean-darkest) 0%, var(--ocean-dark) 55%, var(--ocean) 100%)',
    }}>
      {/* Left panel */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
        <div style={{ color:'#fff', maxWidth:420 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:32 }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path d="M8 37L24 8L40 37" stroke="#90E0EF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 37L24 20L32 37" stroke="rgba(144,224,239,.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 42H43" stroke="#90E0EF" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <div>
              {/* FIXED: BladeOps */}
              <div style={{ fontSize:28, fontWeight:800, letterSpacing:-.5 }}>BladeOps</div>
              <div style={{ fontSize:12, color:'var(--ocean-light)', letterSpacing:3, textTransform:'uppercase' }}>Aviation</div>
            </div>
          </div>
          <h1 style={{ fontSize:32, fontWeight:700, lineHeight:1.2, marginBottom:14 }}>
            Offshore Operations<br />Management System
          </h1>
          <p style={{ fontSize:15, color:'rgba(255,255,255,.65)', lineHeight:1.7 }}>
            Real-time flight tracking, weight & balance calculations,
            fuel management and automated TECHLOG reporting for
            AW169 offshore operations.
          </p>
          <div style={{ display:'flex', gap:24, marginTop:32 }}>
            {[['✈️','Flight Ops'],['⚖️','W&B Calc'],['📄','TECHLOG PDF'],['🔔','Alerts']].map(([icon, label]) => (
              <div key={label} style={{ textAlign:'center' }}>
                <div style={{ fontSize:22 }}>{icon}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.55)', marginTop:4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{
        width:420, background:'rgba(255,255,255,.97)',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:48, boxShadow:'-20px 0 60px rgba(0,0,0,.2)',
      }}>
        <div style={{ width:'100%', maxWidth:340 }}>
          <h2 style={{ fontSize:22, fontWeight:700, color:'var(--text)', marginBottom:6 }}>Sign in</h2>
          <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:28 }}>
            Enter your credentials to access operations.
          </p>

          {error && <AlertBanner type="danger" icon="✕">{error}</AlertBanner>}

          <form onSubmit={handleSubmit}>
            <Field label="Email address" required>
              <Input
                type="email" name="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="pilot@bladeops.ao"
                required autoFocus autoComplete="email"
              />
            </Field>
            <Field label="Password" required>
              <div style={{ position:'relative' }}>
                <Input
                  type={showPass ? 'text' : 'password'}
                  name="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required autoComplete="current-password"
                  style={{ paddingRight:40 }}
                />
                <button type="button" onClick={() => setShowPass(p => !p)} style={{
                  position:'absolute', right:10, top:'50%',
                  transform:'translateY(-50%)', background:'none', border:'none',
                  color:'var(--text-muted)', fontSize:14, cursor:'pointer', padding:4,
                }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </Field>
            <Button type="submit" loading={loading} size="lg"
              style={{ width:'100%', marginTop:8, justifyContent:'center' }}>
              Sign in to Operations
            </Button>
          </form>

          <p style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', marginTop:20 }}>
            Forgot your password? Contact your administrator.
          </p>

          {/* FIXED: BladeOps credentials */}
          <div style={{
            marginTop:32, padding:'14px 16px',
            background:'var(--bg-muted)', borderRadius:8,
            fontSize:11, color:'var(--text-muted)', lineHeight:1.8,
          }}>
            <div style={{ fontWeight:600, marginBottom:4, color:'var(--text-sec)' }}>Demo credentials</div>
            <div>Admin: <code>admin@bladeops.ao</code> / <code>123456</code></div>
            <div>Pilot: <code>c.mendes@bladeops.ao</code> / <code>123456</code></div>
            <div>Copilot: <code>j.ferreira@bladeops.ao</code> / <code>123456</code></div>
          </div>
        </div>
      </div>
    </div>
  );
}
