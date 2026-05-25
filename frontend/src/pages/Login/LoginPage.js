import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
.lp * { font-family:'Inter',-apple-system,sans-serif; box-sizing:border-box; }
@keyframes spin   { to{transform:rotate(360deg)} }
@keyframes fadein { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none} }
@keyframes live   { 0%,100%{opacity:1}50%{opacity:.35} }
@keyframes float  { 0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)} }

.lp-input {
  width:100%; padding:13px 16px;
  background:rgba(255,255,255,0.06);
  color:#ffffff;
  border:1.5px solid rgba(0,168,255,0.35);
  border-radius:10px; font-size:15px;
  outline:none; font-family:inherit;
  transition:border-color .2s, box-shadow .2s, background .2s;
  -webkit-appearance:none;
}
.lp-input:focus {
  border-color:rgba(0,168,255,0.85);
  box-shadow:0 0 0 4px rgba(0,168,255,0.18);
  background:rgba(255,255,255,0.09);
}
.lp-input::placeholder { color:rgba(180,220,255,0.35); }

.lp-btn {
  width:100%; padding:14px;
  background:linear-gradient(135deg,#0077cc 0%,#00aaff 60%,#00ccff 100%);
  color:#ffffff; border:none; border-radius:10px;
  font-size:15px; font-weight:800; cursor:pointer;
  font-family:inherit; letter-spacing:.04em;
  transition:all .2s;
  box-shadow:0 6px 24px rgba(0,168,255,0.5);
  text-shadow:0 1px 3px rgba(0,0,0,0.25);
}
.lp-btn:hover:not(:disabled) {
  transform:translateY(-2px);
  box-shadow:0 12px 36px rgba(0,168,255,0.6);
}
.lp-btn:active:not(:disabled) { transform:translateY(0); }
.lp-btn:disabled { opacity:.35; cursor:not-allowed; transform:none; box-shadow:none; }

.feat-card { transition:all .15s; }
.feat-card:hover { background:rgba(0,168,255,0.1)!important; border-color:rgba(0,168,255,0.35)!important; }
`;

function HelicopterIcon({ size=44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none">
      <ellipse cx="30" cy="11" rx="24" ry="4" fill="#00ccff" opacity=".95"/>
      <rect x="28.5" y="11" width="3" height="9" rx="1.5" fill="#00ccff"/>
      <ellipse cx="30" cy="28" rx="12" ry="5" fill="#00ccff"/>
      <path d="M18 28 Q10 31 5 36 L12 36 Q17.5 32 23.5 30Z" fill="#00ccff"/>
      <path d="M42 28 Q50 31 55 36 L48 36 Q42.5 32 36.5 30Z" fill="#00ccff" opacity=".85"/>
      <rect x="28.5" y="33" width="3" height="13" rx="1.5" fill="#00ccff"/>
      <ellipse cx="27" cy="47" rx="4" ry="2" fill="#00ccff" opacity=".5"/>
      <ellipse cx="33" cy="47" rx="4" ry="2" fill="#00ccff" opacity=".5"/>
    </svg>
  );
}

function UTCClock() {
  const [t,setT]=useState(new Date());
  useEffect(()=>{const i=setInterval(()=>setT(new Date()),1000);return()=>clearInterval(i);},[]);
  return (
    <span style={{fontFamily:'monospace',color:'#00ccff',fontWeight:700,letterSpacing:'.08em',fontSize:13}}>
      {t.toUTCString().slice(17,25)} UTC
    </span>
  );
}

export default function LoginPage() {
  const { login, loading } = useAuth();
  const { warning }        = useAlert();
  const navigate           = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(()=>{
    const h=()=>setIsMobile(window.innerWidth<=768);
    window.addEventListener('resize',h);
    return()=>window.removeEventListener('resize',h);
  },[]);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    const re=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!re.test(email.trim())){ setError('Please enter a valid email address.'); return; }
    const result = await login(email.trim(), password);
    if(!result.ok){ setError(result.error); return; }
    if(result.docWarnings?.length) result.docWarnings.forEach(w=>warning(`Document warning: ${w.field} — ${w.status}`));
    navigate('/');
  };

  return (
    <div className="lp" style={{minHeight:'100vh',display:'flex',background:'#04080f',position:'relative',overflow:'hidden'}}>
      <style>{CSS}</style>

      {/* Background grid */}
      <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(0,168,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,168,255,0.04) 1px,transparent 1px)',backgroundSize:'48px 48px',pointerEvents:'none'}}/>

      {/* Glow orbs */}
      <div style={{position:'absolute',top:'-20%',left:'-5%',width:600,height:600,borderRadius:'50%',background:'rgba(0,120,255,0.09)',filter:'blur(80px)',pointerEvents:'none'}}/>
      <div style={{position:'absolute',bottom:'-15%',right:'10%',width:500,height:500,borderRadius:'50%',background:'rgba(0,200,255,0.07)',filter:'blur(70px)',pointerEvents:'none'}}/>

      {/* ══ LEFT PANEL ══════════════════════════════════════════ */}
      {!isMobile && (
        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'space-between',padding:'44px 52px',animation:'fadein .4s ease'}}>

          {/* Logo + status bar */}
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:60}}>

              {/* Logo */}
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:50,height:50,borderRadius:13,background:'rgba(0,180,255,0.14)',border:'1.5px solid rgba(0,180,255,0.4)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 24px rgba(0,180,255,0.22)',animation:'float 4s ease-in-out infinite'}}>
                  <HelicopterIcon size={30}/>
                </div>
                <div>
                  <div style={{fontSize:22,fontWeight:900,color:'#ffffff',letterSpacing:'.01em'}}>BladeOps</div>
                  {/* ← "Aviation OCC" mais brilhante */}
                  <div style={{fontSize:9,color:'#7ac0d8',letterSpacing:'.28em',textTransform:'uppercase',marginTop:2}}>Aviation OCC</div>
                </div>
              </div>

              {/* System status pill */}
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'7px 16px',background:'rgba(0,0,0,0.35)',borderRadius:99,border:'1px solid rgba(0,168,255,0.2)'}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:'#00e07a',animation:'live 1.5s infinite',boxShadow:'0 0 8px #00e07a'}}/>
                {/* ← "SYS OK" mais brilhante */}
                <span style={{fontSize:11,color:'#00e07a',fontWeight:800,letterSpacing:'.1em'}}>SYS OK</span>
                <span style={{color:'rgba(255,255,255,0.25)'}}>·</span>
                <UTCClock/>
                <span style={{color:'rgba(255,255,255,0.25)'}}>·</span>
                {/* ← "VMC · CAVOK" mais brilhante */}
                <span style={{fontSize:11,color:'#00ddc8',fontWeight:700,letterSpacing:'.06em'}}>VMC · CAVOK</span>
              </div>
            </div>

            {/* Sector badge */}
            <div style={{display:'inline-flex',alignItems:'center',gap:8,padding:'5px 16px',background:'rgba(0,168,255,0.12)',border:'1px solid rgba(0,168,255,0.3)',borderRadius:99,marginBottom:22}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:'#00aaff',animation:'live 2s infinite'}}/>
              {/* ← sector label mais brilhante */}
              <span style={{fontSize:10,color:'#60c0e0',fontWeight:700,letterSpacing:'.16em',textTransform:'uppercase'}}>ANGOLA OFFSHORE · LUANDA FIR</span>
            </div>

            {/* Headline */}
            <h1 style={{fontSize:44,fontWeight:900,color:'#ffffff',lineHeight:1.08,letterSpacing:'-.02em',marginBottom:16}}>
              Offshore Operations<br/>
              <span style={{background:'linear-gradient(90deg,#00aaff,#00ddff)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>
                Control Centre
              </span>
            </h1>

            {/* ← Parágrafo mais brilhante: #a0c8e0 → #b8d8ee */}
            <p style={{fontSize:15,color:'#b8d8ee',lineHeight:1.75,maxWidth:440,marginBottom:44}}>
              Mission-critical helicopter operations management for Angola's offshore energy sector. Real-time tracking, weight &amp; balance, fuel management and automated TECHLOG reporting.
            </p>

            {/* Features */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,maxWidth:480}}>
              {[
                {icon:'✈️',label:'Real-Time Flight Ops', sub:'Live tracking · Rotor ON/OFF · Leg registration', color:'#00aaff'},
                {icon:'⚖️',label:'Weight & Balance',     sub:'PAX · Cargo · Fuel · Payload limits',            color:'#00ccff'},
                {icon:'📄',label:'TECHLOG PDF',          sub:'Automated techlog generation & export',           color:'#00ddc8'},
                {icon:'🔔',label:'Crew Alerts',          sub:'Document expiry · Duty limits · NOTAMs',          color:'#ffb300'},
              ].map(f=>(
                <div key={f.label} className="feat-card" style={{display:'flex',alignItems:'flex-start',gap:12,padding:'13px 14px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:11}}>
                  <div style={{width:36,height:36,borderRadius:9,background:`${f.color}20`,border:`1px solid ${f.color}45`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,flexShrink:0}}>
                    {f.icon}
                  </div>
                  <div>
                    {/* ← feature title branco */}
                    <div style={{fontSize:12.5,fontWeight:700,color:'#e8f4ff',marginBottom:4}}>{f.label}</div>
                    {/* ← feature sub mais brilhante: #6a9ab8 → #90bcd4 */}
                    <div style={{fontSize:10.5,color:'#90bcd4',lineHeight:1.45}}>{f.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          {/* ← footer text mais brilhante: #4a7a96 → #6aa0bc */}
          <p style={{fontSize:12,color:'#6aa0bc',lineHeight:1.7}}>
            BladeOps is purpose-built for offshore helicopter operations in Angola.<br/>
            Authorised personnel only · All activity is logged and monitored.
          </p>
        </div>
      )}

      {/* ══ RIGHT PANEL — Form ══════════════════════════════════ */}
      <div style={{
        width:isMobile?'100%':460,
        background:'rgba(6,12,24,0.97)',
        borderLeft:isMobile?'none':'1px solid rgba(0,168,255,0.14)',
        backdropFilter:'blur(20px)',
        display:'flex',flexDirection:'column',justifyContent:'center',
        padding:isMobile?'44px 24px':'52px 44px',
        position:'relative',flexShrink:0,
        animation:'fadein .5s ease .12s both',
      }}>

        {/* Mobile logo */}
        {isMobile&&(
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:36}}>
            <div style={{width:44,height:44,borderRadius:12,background:'rgba(0,180,255,0.14)',border:'1.5px solid rgba(0,180,255,0.4)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <HelicopterIcon size={24}/>
            </div>
            <div>
              <div style={{fontSize:20,fontWeight:900,color:'#ffffff'}}>BladeOps</div>
              <div style={{fontSize:8.5,color:'#7ac0d8',letterSpacing:'.22em',textTransform:'uppercase'}}>Aviation OCC</div>
            </div>
          </div>
        )}

        {/* Form header */}
        <div style={{marginBottom:30}}>
          {/* ← "Crew Access" mais brilhante */}
          <div style={{fontSize:10,color:'#70b8d4',textTransform:'uppercase',letterSpacing:'.18em',fontWeight:700,marginBottom:10}}>
            Crew Access
          </div>
          <div style={{fontSize:28,fontWeight:900,color:'#ffffff',marginBottom:10,lineHeight:1.2}}>
            Sign In
          </div>
          {/* ← descrição bem mais brilhante: #88b8d0 → #b0d4e8 */}
          <div style={{fontSize:14,color:'#b0d4e8',lineHeight:1.7}}>
            Enter your credentials to access<br/>the Operations Control Centre.
          </div>
        </div>

        {/* Error */}
        {error&&(
          <div style={{background:'rgba(255,68,68,0.14)',border:'1px solid rgba(255,68,68,0.45)',borderRadius:9,padding:'11px 15px',marginBottom:20,fontSize:13,color:'#ff8888',display:'flex',alignItems:'center',gap:9}}>
            <span style={{fontSize:16}}>⚠</span> {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>

          <div style={{marginBottom:18}}>
            {/* ← label mais brilhante: #6ab0cc → #80c4dc */}
            <div style={{fontSize:10,color:'#80c4dc',textTransform:'uppercase',letterSpacing:'.14em',fontWeight:700,marginBottom:8}}>
              Email Address
            </div>
            <input className="lp-input" type="email" value={email}
              onChange={e=>setEmail(e.target.value)}
              placeholder="pilot@bladeops.ao"
              required autoComplete="email"/>
          </div>

          <div style={{marginBottom:28}}>
            {/* ← label mais brilhante */}
            <div style={{fontSize:10,color:'#80c4dc',textTransform:'uppercase',letterSpacing:'.14em',fontWeight:700,marginBottom:8}}>
              Password
            </div>
            <div style={{position:'relative'}}>
              <input className="lp-input" type={showPass?'text':'password'} value={password}
                onChange={e=>setPassword(e.target.value)}
                placeholder="••••••••"
                required autoComplete="current-password"
                style={{paddingRight:52}}/>
              <button type="button" onClick={()=>setShowPass(p=>!p)}
                style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'#70b8d4',cursor:'pointer',padding:6,display:'flex',alignItems:'center',minHeight:'auto'}}>
                {showPass
                  ?<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path d="M10 4C5 4 1.7 7.4 1 10c.7 2.6 4 6 9 6s8.3-3.4 9-6c-.7-2.6-4-6-9-6zm0 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>
                  :<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path d="M3 3l14 14M10 4C5 4 1.7 7.4 1 10a9.4 9.4 0 0 0 3.1 4.2M8.2 5.3A5 5 0 0 1 10 5c5 0 8.3 3.4 9 6a9.5 9.5 0 0 1-2 3.5M12 12a3 3 0 0 1-4.9-3.4"/></svg>
                }
              </button>
            </div>
          </div>

          <button type="submit" className="lp-btn" disabled={loading||!email||!password}>
            {loading
              ?<span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
                 <div style={{width:16,height:16,border:'2px solid rgba(255,255,255,.3)',borderTop:'2px solid #fff',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
                 Authenticating…
               </span>
              :'Sign In to Operations →'
            }
          </button>
        </form>

        {/* System status card */}
        <div style={{marginTop:26,padding:'15px 18px',background:'rgba(0,0,0,0.35)',borderRadius:11,border:'1px solid rgba(0,168,255,0.18)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            {/* ← "System Status" label mais brilhante */}
            <span style={{fontSize:9.5,color:'#70b8d4',textTransform:'uppercase',letterSpacing:'.14em',fontWeight:700}}>
              System Status
            </span>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:'#00e07a',animation:'live 1.5s infinite',boxShadow:'0 0 8px #00e07a'}}/>
              {/* ← "ALL SYSTEMS NOMINAL" brilhante */}
              <span style={{fontSize:10,color:'#00e07a',fontWeight:800,letterSpacing:'.1em'}}>ALL SYSTEMS NOMINAL</span>
            </div>
          </div>
          {/* ← VMC, CAVOK, etc. mais brilhantes */}
          <div style={{display:'flex',gap:10,fontSize:12,flexWrap:'wrap',alignItems:'center'}}>
            <span style={{color:'#00ddc8',fontWeight:700}}>VMC</span>
            <span style={{color:'rgba(255,255,255,.2)'}}>·</span>
            <span style={{color:'#00ddc8',fontWeight:700}}>CAVOK</span>
            <span style={{color:'rgba(255,255,255,.2)'}}>·</span>
            <span style={{color:'#b8d8ee',fontWeight:500}}>Angola Offshore</span>
            <span style={{color:'rgba(255,255,255,.2)'}}>·</span>
            <span style={{color:'#b8d8ee',fontWeight:500}}>Luanda FIR</span>
          </div>
        </div>

        {/* ← rodapé mais brilhante */}
        <p style={{fontSize:12,color:'#5aa0bc',textAlign:'center',marginTop:18,lineHeight:1.5}}>
          Forgot your password? Contact your system administrator.
        </p>
      </div>
    </div>
  );
}