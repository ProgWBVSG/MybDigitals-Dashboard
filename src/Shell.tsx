import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  Layers, LayoutGrid, CalendarDays, Users, Rocket, Target, LogOut, Bell, SlidersHorizontal, History as HistoryIcon, BookOpen, Sun, CalendarRange, MessageCircle, Wallet,
  Smartphone, Server, MailOpen, MapPin, Swords, Lightbulb, GitBranch, DoorOpen, Tag, Search, Menu, X, CornerDownLeft, ChevronDown, Mic,
} from 'lucide-react';
import { db, isCloud, PEOPLE, post, setPerson, usePerson, useTable, type Person } from './base';
import { HEALTH, viewClient, type Agreement, type ClientRow, type Touch } from './negocio';
import { useQueue } from './Mensajes';
import { norm } from './sheetImport';
import { priceText, type SvcPrice } from './services';
import { INV_HEALTH, viewInv, type Invitacion } from './invReglas';
import { HEALTH as SYS_HEALTH, viewSys, type Sistema, type SysPago } from './sistemaReglas';

const Voz = lazy(() => import('./Voz'));
export type Tab = 'hoy' | 'semana' | 'sistemas' | 'invitaciones' | 'mensajes' | 'plata' | 'servicios' | 'preventa' | 'buscar' | 'competencia' | 'onboarding' | 'notas' | 'estrategia' | 'tasks' | 'calendar' | 'clients' | 'portales' | 'history' | 'guide' | 'skills' | 'notifications' | 'settings' | 'content';
type Item = { key: Tab; label: string; icon: ComponentType<{ size?: number }>; words?: string };

// Arriba lo de todos los días. El resto se abre cuando hace falta.
export const MAIN: Item[] = [
  { key: 'hoy', label: 'Hoy', icon: Sun, words: 'inicio dia tareas foco metricas' },
  { key: 'semana', label: 'Semana', icon: CalendarRange, words: 'planificar objetivos repaso calendario metas' },
  { key: 'clients', label: 'Clientes', icon: Users, words: 'crm acuerdos contratos cobros fases' },
  { key: 'sistemas', label: 'Sistemas', icon: Server, words: 'barberia peluqueria restaurante boliche cafeteria abonos suscripciones suspender baja cortar panel' },
  { key: 'invitaciones', label: 'Invitaciones', icon: MailOpen, words: 'casamiento boda quince xv evento cumpleanos baja' },
  { key: 'mensajes', label: 'Mensajes', icon: MessageCircle, words: 'whatsapp automaticos' },
  { key: 'plata', label: 'Plata', icon: Wallet, words: 'ingresos gastos inversion caja sobres pagos metricas balance' },
  { key: 'servicios', label: 'Servicios', icon: Tag, words: 'precios catalogo excel presupuesto' },
];
export const NAV: { title: string; items: Item[] }[] = [
  { title: 'Conseguir clientes', items: [
    { key: 'preventa', label: 'Pre-venta', icon: Target, words: 'prospectos propuesta' },
    { key: 'buscar', label: 'Buscar clientes', icon: MapPin, words: 'leads mapa' },
    { key: 'competencia', label: 'Competencia', icon: Swords },
    { key: 'content', label: 'Contenido', icon: Smartphone, words: 'instagram reels guiones ganchos' },
  ] },
  { title: 'Trabajar', items: [
    { key: 'tasks', label: 'Tareas', icon: LayoutGrid, words: 'kanban tablero' },
    { key: 'calendar', label: 'Calendario', icon: CalendarDays, words: 'eventos reuniones' },
    { key: 'onboarding', label: 'Onboarding', icon: Rocket },
    { key: 'portales', label: 'Portales', icon: DoorOpen },
    { key: 'notas', label: 'Ideas', icon: Lightbulb, words: 'notas pizarra' },
    { key: 'estrategia', label: 'Estrategia', icon: GitBranch, words: 'embudos documentos' },
  ] },
  { title: 'Archivo', items: [
    { key: 'history', label: 'Historial', icon: HistoryIcon, words: 'comprobantes' },
    { key: 'guide', label: 'Guía', icon: BookOpen, words: 'ayuda procesos' },
    { key: 'skills', label: 'Skills', icon: Layers },
  ] },
];
const EXTRA: Item[] = [{ key: 'notifications', label: 'Notificaciones', icon: Bell }, { key: 'settings', label: 'Configuración', icon: SlidersHorizontal, words: 'copias papelera datos' }];
export const ALL_TABS = [...MAIN, ...NAV.flatMap(g => g.items), ...EXTRA];
const MOBILE: Tab[] = ['hoy', 'clients', 'mensajes', 'plata'];

export function Logo() { return <span className="logo"><b>MYB</b> Digitals</span>; }

export function Shell({ tab, go, unread, children }: { tab: Tab; go: (t: string) => void; unread: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const [voz, setVoz] = useState(false);
  const title = ALL_TABS.find(t => t.key === tab)?.label || '';
  const pick = (t: Tab) => { go(t); setOpen(false); };
  const me = usePerson();
  const [groups, setGroups] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('myb_menu') || '[]'); } catch { return []; } });
  const toggle = (t: string) => setGroups(g => { const n = g.includes(t) ? g.filter(x => x !== t) : [...g, t]; localStorage.setItem('myb_menu', JSON.stringify(n)); return n; });
  // Números del menú: cuántas cosas esperan en cada sección
  const { queue } = useQueue();
  const clients = useTable<ClientRow>('clients').rows, ags = useTable<Agreement>('agreements').rows, touches = useTable<Touch>('touches').rows;
  const hot = useMemo(() => clients.filter(c => HEALTH[viewClient(c, ags, touches, 1).health].hot).length, [clients, ags, touches]);
  const sys = useTable<Sistema>('sistemas').rows, sysPay = useTable<SysPago>('sistema_pagos').rows;
  const sysHot = useMemo(() => sys.filter(s => SYS_HEALTH[viewSys(s, sysPay).health].hot).length, [sys, sysPay]);
  const invs = useTable<Invitacion>('invitaciones').rows;
  const invHot = useMemo(() => invs.filter(i => INV_HEALTH[viewInv(i).health].hot).length, [invs]);
  const count: Partial<Record<Tab, number>> = { clients: hot, sistemas: sysHot, invitaciones: invHot, mensajes: queue.filter(q => q.hot).length, notifications: unread };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch(s => !s); }
      if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); setSearch(false); setVoz(true); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  useEffect(() => { document.title = `${title} · MYB Dashboard`; }, [title]);

  const link = (i: Item) => (
    <button key={i.key} className={`side-i${tab === i.key ? ' on' : ''}`} aria-current={tab === i.key ? 'page' : undefined} onClick={() => pick(i.key)}>
      <i.icon size={18} /><span>{i.label}</span>{!!count[i.key] && <em>{count[i.key]! > 99 ? '99+' : count[i.key]}</em>}
    </button>
  );

  return (
    <div className="shell">
      <header className="topbar">
        <button className="btn btn-ghost btn-icon" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu size={21} /></button>
        <strong>{title}</strong>
        <button className="btn btn-ghost btn-icon" onClick={() => setSearch(true)} aria-label="Buscar"><Search size={20} /></button>
        <button className="btn btn-ghost btn-icon top-bell" onClick={() => pick('notifications')} aria-label="Notificaciones"><Bell size={20} />{unread > 0 && <i />}</button>
      </header>
      {open && <div className="side-bg" onClick={() => setOpen(false)} />}
      <aside className={`side${open ? ' open' : ''}`}>
        <div className="side-top"><Logo /><button className="btn btn-ghost btn-icon side-close" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X size={19} /></button></div>
        <button className="side-search" onClick={() => { setSearch(true); setOpen(false); }}><Search size={16} /><span>Buscar</span><kbd>Ctrl K</kbd></button>
        <nav>
          <div className="side-g">{MAIN.map(link)}</div>
          {NAV.map(g => { const has = g.items.some(i => i.key === tab), on = groups.includes(g.title) || has; return <div key={g.title} className="side-g"><button className="side-t" aria-expanded={on} onClick={() => toggle(g.title)} disabled={has}><span>{g.title}</span><ChevronDown size={15} /></button>{on && g.items.map(link)}</div>; })}
        </nav>
        <div className="side-foot">
          {EXTRA.map(link)}
          {isCloud() ? <button className="side-i" onClick={async () => { await post('salir'); location.reload(); }}><LogOut size={18} /><span>Salir ({PEOPLE[me]})</span></button>
            : <div className="seg side-who" role="group" aria-label="Quién sos">{(Object.keys(PEOPLE) as Person[]).map(p => <button key={p} className={me === p ? 'on' : ''} aria-pressed={me === p} onClick={() => setPerson(p)}>{PEOPLE[p]}</button>)}</div>}
        </div>
      </aside>
      <main className="main">{children}</main>
      <nav className="tabbar" aria-label="Principal">
        {MOBILE.map(k => { const i = ALL_TABS.find(t => t.key === k)!; return <button key={k} className={tab === k ? 'on' : ''} onClick={() => pick(k)}><i.icon size={21} /><span>{i.label}</span>{!!count[k] && <em />}</button>; })}
        <button className={open ? 'on' : ''} onClick={() => setOpen(true)}><Menu size={21} /><span>Más</span></button>
      </nav>
      {!voz && <button className="fab-voz" onClick={() => setVoz(true)} title="Ctrl Espacio"><Mic size={20} /><span>Hablar</span></button>}
      {voz && <Suspense fallback={null}><Voz onClose={() => setVoz(false)} /></Suspense>}
      {search && <Palette onClose={() => setSearch(false)} go={pick} />}
    </div>
  );
}

// ─── Buscador (Ctrl K): secciones, servicios y clientes ───
type Hit = { id: string; label: string; sub: string; icon: Item['icon']; run: () => void; text: string };
function Palette({ onClose, go }: { onClose: () => void; go: (t: Tab) => void }) {
  const [q, setQ] = useState('');
  const [n, setN] = useState(0);
  const [data, setData] = useState<Hit[]>([]);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [s, c, y, iv] = await Promise.all([db.from('services').select('id,name,area,prices,includes'), db.from('clients').select('id,name,status'), db.from('sistemas').select('id,name,rubro,city'), db.from('invitaciones').select('id,name,event,style')]);
      if (!alive) return;
      setData([
        ...(s.data || []).map((x: any) => ({
          id: 's' + x.id, label: x.name as string, icon: Tag, text: norm([x.name, x.area, ...(x.includes || [])].join(' ')),
          sub: ((x.prices || []) as SvcPrice[]).filter(p => p.amount > 0).slice(0, 2).map(p => priceText(p) + (p.period === 'mes' ? ' por mes' : '')).join(', ') || 'Sin precio',
          run: () => { sessionStorage.setItem('myb_open_service', x.id); go('servicios'); window.dispatchEvent(new Event('myb-open-service')); },
        })),
        ...(iv.data || []).map((x: any) => ({ id: 'i' + x.id, label: x.name as string, icon: MailOpen, sub: x.event || 'Invitación', text: norm([x.name, x.event, x.style].join(' ')), run: () => go(('invitaciones/' + x.id) as Tab) })),
        ...(y.data || []).map((x: any) => ({ id: 'y' + x.id, label: x.name as string, icon: Server, sub: x.rubro || 'Sistema', text: norm([x.name, x.rubro, x.city].join(' ')), run: () => go(('sistemas/' + x.id) as Tab) })),
        ...(c.data || []).map((x: any) => ({ id: 'c' + x.id, label: x.name as string, icon: Users, sub: 'Cliente', text: norm(x.name || ''), run: () => go(('clients/' + x.id) as Tab) })),
      ]);
    })();
    return () => { alive = false; };
  }, []);

  const tabs: Hit[] = useMemo(() => ALL_TABS.map(t => ({ id: t.key, label: t.label, sub: 'Sección', icon: t.icon, text: norm(`${t.label} ${t.words || ''}`), run: () => go(t.key) })), []);
  const t = norm(q);
  const hits = (t ? [...tabs, ...data].filter(h => t.split(/\s+/).every(w => h.text.includes(w))) : tabs).slice(0, 12);
  const run = (h?: Hit) => { if (h) { h.run(); onClose(); } };
  useEffect(() => { list.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); }, [n]);

  return (
    <div className="pal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pal" role="dialog" aria-label="Buscar">
        <div className="pal-in"><Search size={18} />
          <input autoFocus placeholder="Buscar sección, servicio, cliente o negocio" value={q} onChange={e => { setQ(e.target.value); setN(0); }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setN(x => Math.min(hits.length - 1, x + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setN(x => Math.max(0, x - 1)); }
              if (e.key === 'Enter') run(hits[n]);
              if (e.key === 'Escape') onClose();
            }} /></div>
        <div className="pal-list" ref={list}>
          {hits.length === 0 && <p>No encontré nada con eso.</p>}
          {hits.map((h, i) => <button key={h.id} className={i === n ? 'on' : ''} onMouseMove={() => setN(i)} onClick={() => run(h)}><h.icon size={17} /><span>{h.label}</span><em>{h.sub}</em>{i === n && <CornerDownLeft size={14} />}</button>)}
        </div>
      </div>
    </div>
  );
}
