import { lazy, Suspense, useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { setFailHandler, whoAmI, type Me } from './base';
import { toast, useToastProvider, useNotifications } from './hooks';
import { ALL_TABS, Shell, type Tab } from './Shell';
import { goTo, useHash } from './rutas';
import Login from './Login';
import './index.css';
import './Content.css';
import './portal.css';
import './shell.css';
import './servicios.css';
import './app.css';
import './app2.css';
import './voz.css';

// Cada sección se descarga recién cuando se abre
const VIEWS = {
  hoy: lazy(() => import('./Hoy')),
  semana: lazy(() => import('./Semana')),
  clients: lazy(() => import('./Clientes')),
  sistemas: lazy(() => import('./Sistemas')),
  mensajes: lazy(() => import('./Mensajes')),
  plata: lazy(() => import('./Plata')),
  servicios: lazy(() => import('./Servicios')),
  preventa: lazy(() => import('./PreVenta')),
  buscar: lazy(() => import('./LeadFinder')),
  competencia: lazy(() => import('./Competitors')),
  onboarding: lazy(() => import('./Onboarding')),
  notas: lazy(() => import('./Notes')),
  tasks: lazy(() => import('./Tasks')),
  calendar: lazy(() => import('./Calendar')),
  portales: lazy(() => import('./Portals')),
  history: lazy(() => import('./History')),
  guide: lazy(() => import('./Guide')),
  content: lazy(() => import('./Content')),
  skills: lazy(() => import('./Skills')),
  settings: lazy(() => import('./Settings')),
};
const Estrategia = lazy(() => import('./Estrategia'));
const Notifications = lazy(() => import('./Notifications'));
const ProposalView = lazy(() => import('./ProposalView'));
const ClientPortalView = lazy(() => import('./ClientPortalView'));
const OLD: Record<string, Tab> = { metrics: 'plata', clientes: 'clients' }; // nombres de antes

setFailHandler(m => toast(m, 'error'));

export default function App() {
  // Links públicos: se resuelven antes de la sesión, así el cliente ve sólo eso.
  const params = new URL(window.location.href).searchParams;
  const proposalToken = params.get('p'), portalToken = params.get('portal');
  const [me, setMe] = useState<Me | null>(null);
  const [down, setDown] = useState(false);

  useEffect(() => {
    if (proposalToken || portalToken) return;
    whoAmI().then(m => { if (m) setMe(m); else setDown(true); });
    const out = () => setMe(m => m && m.cloud ? { ...m, user: null } : m);
    window.addEventListener('myb-salir', out); return () => window.removeEventListener('myb-salir', out);
  }, []);

  if (proposalToken) return <Suspense fallback={null}><ProposalView token={proposalToken} /></Suspense>;
  if (portalToken) return <Suspense fallback={null}><ClientPortalView token={portalToken} /></Suspense>;
  if (down) return <div className="lg"><div className="lg-box"><h1>No se pudo abrir la base</h1><button className="btn btn-primary" onClick={() => location.reload()}>Reintentar</button></div></div>;
  if (!me) return null;
  if (!me.user) return <Login me={me} onDone={setMe} />;
  return <Dashboard />;
}

function Dashboard() {
  const toasts = useToastProvider();
  const raw = useHash().split('/')[0];
  const tab: Tab = ALL_TABS.some(t => t.key === raw) ? raw as Tab : OLD[raw] || 'hoy';
  const notif = useNotifications();
  const View = tab === 'estrategia' || tab === 'notifications' ? null : VIEWS[tab];
  return (
    <>
      <Shell tab={tab} go={goTo} unread={notif.unread}>
        <Suspense fallback={<div className="view-load"><div className="spinner-lg" /></div>}>
          {View && <View />}
          {tab === 'estrategia' && <Estrategia onNavigate={goTo} />}
          {tab === 'notifications' && <Notifications notif={notif} onGoto={goTo} />}
        </Suspense>
      </Shell>
      <div className="toast-container" role="status">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            {t.msg}
          </div>
        ))}
      </div>
    </>
  );
}
