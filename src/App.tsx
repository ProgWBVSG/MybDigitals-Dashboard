import { useState } from 'react';
import { Layers, LayoutGrid, CalendarDays, BarChart3, Users, CheckCircle2 } from 'lucide-react';
import { useToastProvider } from './hooks';
import Skills from './Skills';
import Tasks from './Tasks';
import CalendarView from './Calendar';
import Metrics from './Metrics';
import Clients from './Clients';
import './index.css';

type Tab = 'metrics' | 'tasks' | 'calendar' | 'clients' | 'skills';

export default function App() {
  const [tab, setTab] = useState<Tab>('metrics');
  const toasts = useToastProvider();

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
