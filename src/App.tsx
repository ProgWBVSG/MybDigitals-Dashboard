import { useState } from 'react';
import { Layers, LayoutGrid, CalendarDays, BarChart3, Users, CheckCircle2, Rocket, Target, Lock } from 'lucide-react';
import { useToastProvider } from './hooks';
import Skills from './Skills';
import Tasks from './Tasks';
import CalendarView from './Calendar';
import Metrics from './Metrics';
import Clients from './Clients';
import Onboarding from './Onboarding';
import PreVenta from './PreVenta';
import ProposalView from './ProposalView';
import './index.css';

type Tab = 'metrics' | 'preventa' | 'onboarding' | 'tasks' | 'calendar' | 'clients' | 'skills';

// Llave de acceso al dashboard. Cambiable en Vercel con VITE_DASH_KEY sin tocar código.
const ACCESS_KEY = import.meta.env.VITE_DASH_KEY || 'mybmatiybenja1717.OK';
const LS_KEY = 'myb_dash_key';

function readUrl() {
  const u = new URL(window.location.href);
  return { p: u.searchParams.get('p'), k: u.searchParams.get('k') };
}

// Si vino ?k= en la URL, guardarla y limpiar la barra (queda en el navegador)
function captureKey(k: string | null) {
  if (k) {
    localStorage.setItem(LS_KEY, k);
    const u = new URL(window.location.href);
    u.searchParams.delete('k');
    window.history.replaceState({}, '', u.pathname + (u.search || ''));
  }
}

function Locked() {
  const [val, setVal] = useState('');
  const enter = () => { localStorage.setItem(LS_KEY, val.trim()); window.location.reload(); };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1e', color: '#cbd5e1', fontFamily: 'Inter, system-ui, sans-serif', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 360, width: '100%' }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(145deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
          <Lock size={26} color="#fff" />
        </div>
        <h1 style={{ color: '#f8fafc', fontSize: 22, margin: '0 0 8px' }}>Acceso privado</h1>
        <p style={{ fontSize: 14, opacity: 0.7, margin: '0 0 20px' }}>Este panel es de uso interno de MYB Digitals.</p>
        <input className="input" type="password" value={val} autoFocus placeholder="Llave de acceso"
          onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') enter(); }}
          style={{ textAlign: 'center', marginBottom: 12 }} />
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={enter}>Entrar</button>
      </div>
    </div>
  );
}

export default function App() {
  const { p, k } = readUrl();

  // 1) Link público de propuesta: muestra SOLO el deck. Sin acceso al dashboard.
  if (p) return <ProposalView token={p} />;

  // 2) Gate por llave (sin login molesto: una vez puesta queda en el navegador).
  captureKey(k);
  if ((localStorage.getItem(LS_KEY) || '') !== ACCESS_KEY) return <Locked />;

  return <Dashboard />;
}

function Dashboard() {
  const toasts = useToastProvider();
  const [tab, setTab] = useState<Tab>('metrics');

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--primary)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <LayoutGrid size={18} color="#fff" />
          </div>
          MYB Digitals <span>Dashboard</span>
        </div>

        <nav className="header-nav">
          <button className={tab === 'metrics' ? 'active' : ''} onClick={() => setTab('metrics')}>
            <BarChart3 size={16} /> Métricas
          </button>
          <button className={tab === 'preventa' ? 'active' : ''} onClick={() => setTab('preventa')}>
            <Target size={16} /> Pre-venta
          </button>
          <button className={tab === 'onboarding' ? 'active' : ''} onClick={() => setTab('onboarding')}>
            <Rocket size={16} /> Onboarding
          </button>
          <button className={tab === 'tasks' ? 'active' : ''} onClick={() => setTab('tasks')}>
            <LayoutGrid size={16} /> Tasks
          </button>
          <button className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')}>
            <CalendarDays size={16} /> Calendar
          </button>
          <button className={tab === 'clients' ? 'active' : ''} onClick={() => setTab('clients')}>
            <Users size={16} /> Clientes
          </button>
          <button className={tab === 'skills' ? 'active' : ''} onClick={() => setTab('skills')}>
            <Layers size={16} /> Skills
          </button>
        </nav>

        <div className="header-actions" />
      </header>

      {/* Main Content */}
      <main className="main">
        {tab === 'metrics' && <Metrics />}
        {tab === 'preventa' && <PreVenta />}
        {tab === 'onboarding' && <Onboarding />}
        {tab === 'tasks' && <Tasks />}
        {tab === 'calendar' && <CalendarView />}
        {tab === 'clients' && <Clients />}
        {tab === 'skills' && <Skills />}
      </main>

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <CheckCircle2 size={16} />
            {t.msg}
          </div>
        ))}
      </div>
    </>
  );
}
