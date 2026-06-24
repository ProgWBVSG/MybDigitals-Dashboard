import { useState } from 'react';
import { Lock, LogIn } from 'lucide-react';
import { supabase } from './supabase';

// Pantalla de login (Supabase Auth). La base sólo responde a la cuenta autorizada
// (RLS por email), así que sin sesión válida no se puede leer ni escribir nada.
export default function Login() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!email.trim() || !pass) { setErr('Completá email y contraseña.'); return; }
    setBusy(true);
    try {
      const fn = mode === 'in'
        ? supabase.auth.signInWithPassword({ email: email.trim(), password: pass })
        : supabase.auth.signUp({ email: email.trim(), password: pass });
      const { error } = await fn;
      if (error) { setErr(traducir(error.message)); return; }
      // onAuthStateChange en App reacciona y muestra el dashboard.
    } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(70% 60% at 14% 6%,rgba(99,102,241,.18),transparent 55%),radial-gradient(70% 60% at 86% 96%,rgba(16,185,129,.12),transparent 55%),#0a0f1e', color: '#cbd5e1', fontFamily: 'Inter, system-ui, sans-serif', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(145deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', boxShadow: '0 0 40px rgba(99,102,241,.45)' }}>
          <Lock size={26} color="#fff" />
        </div>
        <h1 style={{ color: '#f8fafc', fontSize: 22, margin: '0 0 6px' }}>MYB Digitals</h1>
        <p style={{ fontSize: 14, opacity: 0.7, margin: '0 0 22px' }}>Panel interno · acceso privado</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="input" type="email" placeholder="Email" value={email} autoFocus
            onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          <input className="input" type="password" placeholder="Contraseña" value={pass}
            onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          {err && <div style={{ color: '#f87171', fontSize: 13, textAlign: 'left' }}>{err}</div>}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={submit} disabled={busy}>
            <LogIn size={16} /> {busy ? 'Entrando…' : (mode === 'in' ? 'Entrar' : 'Crear cuenta')}
          </button>
        </div>

        <button onClick={() => { setMode(m => m === 'in' ? 'up' : 'in'); setErr(''); }}
          style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 13, marginTop: 16, cursor: 'pointer' }}>
          {mode === 'in' ? '¿Primera vez? Crear mi cuenta' : 'Ya tengo cuenta · Entrar'}
        </button>
      </div>
    </div>
  );
}

function traducir(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos.';
  if (/already registered/i.test(msg)) return 'Ese email ya tiene cuenta. Entrá con tu contraseña.';
  if (/password should be at least/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/email.*invalid|invalid.*email/i.test(msg)) return 'Email inválido.';
  return msg;
}
