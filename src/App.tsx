import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Layers, LayoutGrid, CalendarDays, BarChart3, Users, CheckCircle2, Rocket, Target, LogOut, Bell, SlidersHorizontal, History as HistoryIcon, BookOpen, Smartphone } from 'lucide-react';
import { supabase } from './supabase';
import { useToastProvider, useNotifications } from './hooks';
import Skills from './Skills';
import Tasks from './Tasks';
import CalendarView from './Calendar';
import Metrics from './Metrics';
import Clients from './Clients';
import Onboarding from './Onboarding';
import PreVenta from './PreVenta';
import ProposalView from './ProposalView';
import Notifications from './Notifications';
import SettingsView from './Settings';
import History from './History';
import Guide from './Guide';
import Login from './Login';
import Content from './Content';
import './index.css';

type Tab = 'metrics' | 'preventa' | 'onboarding' | 'tasks' | 'calendar' | 'clients' | 'history' | 'guide' | 'skills' | 'notifications' | 'settings' | 'content';

export default function App() {
  // Link público de propuesta: muestra SOLO el deck, sin sesión ni acceso al dashboard.
  const proposalToken = new URL(window.location.href).searchParams.get('p');

  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (proposalToken) return <ProposalView token={proposalToken} />;
  if (!ready) return null; // evita parpadeo del login mientras carga la sesión
  if (!session) return <Login />;

  return <Dashboard />;
}

function Dashboard() {
  const toasts = useToastProvider();
  const [tab, setTab] = useState<Tab>('metrics');
  const notif = useNotifications();

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
          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
            <HistoryIcon size={16} /> Historial
          </button>
          <button className={tab === 'guide' ? 'active' : ''} onClick={() => setTab('guide')}>
            <BookOpen size={16} /> Guía
          </button>
          <button className={tab === 'content' ? 'active' : ''} onClick={() => setTab('content')}>
            <Smartphone size={16} /> IG Content
          </button>
          <button className={tab === 'skills' ? 'active' : ''} onClick={() => setTab('skills')}>
            <Layers size={16} /> Skills
          </button>
        </nav>

        <div className="header-actions">
          <button className={`btn btn-ghost btn-icon notif-bell${tab === 'notifications' ? ' active' : ''}`} onClick={() => setTab('notifications')} title="Notificaciones">
            <Bell size={18} />
            {notif.unread > 0 && <span className="notif-bell-badge">{notif.unread > 99 ? '99+' : notif.unread}</span>}
          </button>
          <button className={`btn btn-ghost btn-icon${tab === 'settings' ? ' active' : ''}`} onClick={() => setTab('settings')} title="Configuración">
            <SlidersHorizontal size={18} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => supabase.auth.signOut()} title="Cerrar sesión">
            <LogOut size={16} /> Salir
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main">
        {tab === 'metrics' && <Metrics />}
        {tab === 'preventa' && <PreVenta />}
        {tab === 'onboarding' && <Onboarding />}
        {tab === 'tasks' && <Tasks />}
        {tab === 'calendar' && <CalendarView />}
        {tab === 'clients' && <Clients />}
        {tab === 'history' && <History />}
        {tab === 'guide' && <Guide />}
        {tab === 'content' && <Content />}
        {tab === 'skills' && <Skills />}
        {tab === 'notifications' && <Notifications notif={notif} onGoto={t => setTab(t as Tab)} />}
        {tab === 'settings' && <SettingsView />}
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
