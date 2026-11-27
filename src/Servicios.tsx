// Sección interna del dashboard: catálogo de servicios con precios. No se muestra en ninguna página pública.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Upload, Download, Table2, LayoutList, X, Check, Copy, ExternalLink, Trash2, Pencil, Database, RefreshCw } from 'lucide-react';
import { useServices, useExchangeRate, toast } from './hooks';
import { useTable } from './base';
import { isLive, plural, type Agreement, type ClientRow } from './negocio';
import { goTo } from './rutas';
import { Modal } from './ui';
import { fmt, uuid } from './utils';
import {
  SVC_AREAS, SVC_PERIODS, SVC_STATUSES, SVC_STATUS_MAP, emptyService, hasPrice, money, priceText, pricesOf, priceIn, quoteMessage, quoteTotals,
  rangeText, servicesSeed, type Service, type ServiceInput, type SvcCurrency, type SvcPeriod, type SvcPrice, type SvcStatus,
} from './services';
import { exportCsv, norm } from './sheetImport';
import ServiciosImport from './ServiciosImport';

const ORDER: SvcStatus[] = ['en_venta', 'se_cotiza', 'en_desarrollo', 'idea', 'pausado'];
type View = 'planilla' | 'fichas';
type Money = 'cargado' | SvcCurrency;

const copy = async (text: string, ok: string) => {
  try { await navigator.clipboard.writeText(text); toast(ok); }
  catch { toast('El navegador no dejó copiar', 'error'); }
};
/** "45.000" = 45000, "29,5" = 29.5 */
function toNumber(t = '') {
  const x = t.replace(/[^\d.,]/g, '');
  const n = Number(/\.\d{3}(\D|$)/.test(x) || x.includes(',') ? x.replace(/\./g, '').replace(',', '.') : x);
  return Number.isFinite(n) ? n : 0;
}
const periodSuffix = (p: SvcPeriod) => SVC_PERIODS.find(x => x.key === p)!.suffix;

export default function Servicios() {
  const { services, loading, failed, add, update, remove, refresh } = useServices();
  const rate = useExchangeRate();
  const ags = useTable<Agreement>('agreements').rows, clients = useTable<ClientRow>('clients').rows;
  const [who, setWho] = useState<Service | null>(null);
  /** Clientes con este servicio firmado, en marcha primero. */
  const clientsOf = (id: string) => [...new Map(ags.filter(a => a.service_id === id && isLive(a) && a.client_id).sort((a, b) => a.status.localeCompare(b.status)).map(a => [a.client_id!, { c: clients.find(c => c.id === a.client_id), a }])).values()].filter(x => x.c);
  const [view, setView] = useState<View>(() => (window.innerWidth < 900 ? 'fichas' : 'planilla'));
  const [cur, setCur] = useState<Money>('cargado');
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [status, setStatus] = useState<SvcStatus | ''>('');
  const [noPrice, setNoPrice] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const [quoting, setQuoting] = useState(false);

  // El buscador general (Ctrl K) puede pedir abrir un servicio puntual
  useEffect(() => {
    const open = () => {
      const id = sessionStorage.getItem('myb_open_service');
      const s = id && services.find(x => x.id === id);
      if (s) { sessionStorage.removeItem('myb_open_service'); setEditing(s); }
    };
    open();
    window.addEventListener('myb-open-service', open);
    return () => window.removeEventListener('myb-open-service', open);
  }, [services]);

  const areas = useMemo(() => [...new Set(services.map(s => s.area).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [services]);
  const without = services.filter(s => !hasPrice(s) && s.status !== 'pausado');
  const list = useMemo(() => {
    const t = norm(q);
    return services.filter(s =>
      (!area || s.area === area) && (!status || s.status === status) && (!noPrice || !hasPrice(s)) &&
      (!t || norm([s.name, s.area, s.summary, s.notes, ...s.includes].join(' ')).includes(t)));
  }, [services, q, area, status, noPrice]);
  const chosen = services.filter(s => sel.includes(s.id));
  const toggle = (id: string) => setSel(l => l.includes(id) ? l.filter(x => x !== id) : [...l, id]);

  const save = async (id: string | null, data: ServiceInput) => {
    const ok = id ? await update(id, data) : await add([{ ...data, sort: services.length }]);
    if (ok) { toast(id ? 'Cambios guardados' : 'Servicio agregado'); setEditing(null); }
  };
  const del = async (s: Service) => {
    if (!confirm(`¿Borrar "${s.name}"? No se puede deshacer.`)) return;
    if (await remove(s.id)) { setEditing(null); setSel(l => l.filter(x => x !== s.id)); toast('Servicio borrado'); }
  };
  const doExport = () => {
    const url = URL.createObjectURL(new Blob([exportCsv(list)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `Servicios MYB ${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (loading) return <div className="sv-state"><div className="spinner-lg" /></div>;
  if (failed) return (
    <div className="sv-state"><Database size={30} />
      <h2>No se pudo leer la base de datos</h2>
      <p>Fijate que MYB Dashboard esté abierto y volvé a intentar.</p>
      <button className="btn btn-primary" onClick={refresh}><RefreshCw size={16} /> Reintentar</button>
    </div>
  );
  const modals = <>
    {editing && <Editor service={editing === 'new' ? null : services.find(s => s.id === editing.id) || editing} areas={areas} rate={rate} onClose={() => setEditing(null)} onSave={save} onDelete={del} />}
    {importing && <ServiciosImport existing={services} onClose={() => setImporting(false)} add={add} update={update} />}
    {who && <Modal title={who.name} onClose={() => setWho(null)}>{clientsOf(who.id).map(({ c, a }) => <button key={c!.id} className="li li-b" onClick={() => goTo('clients/' + c!.id)}><span className="li-x"><b>{c!.name}</b><span>{a.status === 'firmado' ? 'En marcha' : 'Terminado'}</span></span></button>)}</Modal>}
    {quoting && <Quote list={chosen} rate={rate} onClose={() => setQuoting(false)} />}
  </>;

  if (!services.length) return (
    <div className="sv-state">
      <h2>Todavía no hay servicios cargados</h2>
      <p>Podés traer tu Excel o empezar con los {servicesSeed().length} que MYB ya tiene registrados y corregirlos acá.</p>
      <div className="sv-row">
        <button className="btn btn-primary" onClick={() => setImporting(true)}><Upload size={16} /> Traer mi Excel</button>
        <button className="btn btn-secondary" onClick={async () => { if (await add(servicesSeed())) toast('Servicios cargados'); }}>Cargar los registrados</button>
        <button className="btn btn-ghost" onClick={() => setEditing('new')}><Plus size={16} /> Uno nuevo</button>
      </div>
      {modals}
    </div>
  );

  return (
    <div className={`sv${sel.length ? ' has-bar' : ''}`}>
      <div className="page-head">
        <div>
          <h1>Servicios</h1>
          <p>{services.length} en total{without.length > 0 && <>, <button className={`sv-link${noPrice ? ' on' : ''}`} onClick={() => setNoPrice(v => !v)}>{noPrice ? 'ver todos' : `${without.length} sin precio`}</button></>}</p>
        </div>
        <div className="sv-row">
          <button className="btn btn-ghost" onClick={doExport} aria-label="Exportar"><Download size={16} /> <span className="sv-hide-s">Exportar</span></button>
          <button className="btn btn-secondary" onClick={() => setImporting(true)}><Upload size={16} /> Importar Excel</button>
          <button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Nuevo</button>
        </div>
      </div>

      <div className="sv-tools">
        <div className="search-bar sv-search"><Search size={16} /><input placeholder="Buscar servicio o función" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar servicio" />
          {q && <button className="sv-x" onClick={() => setQ('')} aria-label="Limpiar búsqueda"><X size={15} /></button>}</div>
        <select className="select sv-select" value={status} onChange={e => setStatus(e.target.value as SvcStatus | '')} aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          {SVC_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <div className="seg" role="group" aria-label="Moneda" title={`Dólar blue: $${rate}`}>
          {([['cargado', 'Original'], ['ARS', 'Pesos'], ['USD', 'Dólares']] as [Money, string][]).map(([k, l]) =>
            <button key={k} className={cur === k ? 'on' : ''} onClick={() => setCur(k)}>{l}</button>)}
        </div>
        <div className="seg sv-views" role="group" aria-label="Vista">
          <button className={view === 'planilla' ? 'on' : ''} onClick={() => setView('planilla')}><Table2 size={16} /> Planilla</button>
          <button className={view === 'fichas' ? 'on' : ''} onClick={() => setView('fichas')}><LayoutList size={16} /> Fichas</button>
        </div>
      </div>

      <div className="sv-areas">
        <button className={!area ? 'on' : ''} onClick={() => setArea('')}>Todos</button>
        {areas.map(a => <button key={a} className={area === a ? 'on' : ''} onClick={() => setArea(a === area ? '' : a)}>{a}</button>)}
      </div>

      {list.length === 0 ? <div className="sv-none">No hay servicios con ese filtro.</div>
        : view === 'planilla' ? (
          <div className="sv-sheet-wrap">
            <table className="sv-sheet">
              <thead><tr>
                <th className="sv-c-check"><input type="checkbox" aria-label="Elegir todos" checked={list.every(s => sel.includes(s.id))}
                  onChange={e => setSel(e.target.checked ? [...new Set([...sel, ...list.map(s => s.id)])] : sel.filter(id => !list.some(s => s.id === id)))} /></th>
                <th>Servicio</th>{SVC_PERIODS.map(p => <th key={p.key} className="num">{p.col}</th>)}<th className="num">Clientes</th><th>Qué incluye</th><th>Estado</th><th className="sv-c-date">Cambió</th>
              </tr></thead>
              <tbody>
                {list.map(s => (
                  <tr key={s.id} className={sel.includes(s.id) ? 'sel' : ''}>
                    <td className="sv-c-check"><input type="checkbox" aria-label={`Elegir ${s.name}`} checked={sel.includes(s.id)} onChange={() => toggle(s.id)} /></td>
                    <td className="sv-c-name"><button onClick={() => setEditing(s)}><strong>{s.name}</strong><span>{s.area || 'Sin rubro'}</span></button></td>
                    {SVC_PERIODS.map(p => <td key={p.key} className="num"><PriceCell s={s} period={p.key} cur={cur} rate={rate} onSave={prices => update(s.id, { prices })} /></td>)}
                    <td className="num">{clientsOf(s.id).length ? <button className="sv-cell sv-who" onClick={() => setWho(s)}><span>{clientsOf(s.id).length}</span></button> : <span className="sv-zero">0</span>}</td>
                    <td className="sv-c-inc"><button onClick={() => setEditing(s)} title={s.includes.join('\n')}>
                      {s.includes.length ? <><span className="sv-inc-n">{s.includes.length}</span><span className="sv-inc-t">{s.includes.slice(0, 3).join(', ')}</span></> : <span className="sv-empty">Agregar</span>}
                    </button></td>
                    <td><StatusPick value={s.status} onChange={st => update(s.id, { status: st })} /></td>
                    <td className="sv-c-date" title={fmt(s.updatedAt)}>{new Date(s.updatedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sv-groups">
            {ORDER.filter(g => list.some(s => s.status === g)).map(g => {
              const items = list.filter(s => s.status === g).sort((a, b) => clientsOf(b.id).length - clientsOf(a.id).length || a.sort - b.sort);
              const n = items.reduce((t, s) => t + clientsOf(s.id).length, 0);
              return <section key={g}><h2>{SVC_STATUS_MAP[g].label}<span>{plural(items.length, 'servicio', 'servicios')}{n > 0 && `, ${plural(n, 'cliente', 'clientes')}`}</span></h2>
                <div className="sv-cards">{items.map(s => <Card key={s.id} s={s} cur={cur} rate={rate} n={clientsOf(s.id).length} onWho={() => setWho(s)} selected={sel.includes(s.id)} onToggle={() => toggle(s.id)} onEdit={() => setEditing(s)} />)}</div></section>;
            })}
          </div>
        )}

      {sel.length > 0 && (
        <div className="sv-bar">
          <strong>{sel.length} {sel.length === 1 ? 'elegido' : 'elegidos'}</strong>
          <Totals list={chosen} cur={cur === 'USD' ? 'USD' : 'ARS'} rate={rate} />
          <div className="sv-row"><button className="btn btn-ghost btn-sm" onClick={() => setSel([])}>Limpiar</button><button className="btn btn-primary btn-sm" onClick={() => setQuoting(true)}>Armar presupuesto</button></div>
        </div>
      )}
      {modals}
    </div>
  );
}

// ─── Celda de precio editable, como en Excel ───
function PriceCell({ s, period, cur, rate, onSave }: { s: Service; period: SvcPeriod; cur: Money; rate: number; onSave: (p: SvcPrice[]) => void }) {
  const [edit, setEdit] = useState<string | null>(null); // id del precio, 'new' o null
  const list = pricesOf(s, period).filter(p => p.amount > 0);
  if (cur !== 'cargado') {
    const v = priceIn(s, period, cur, rate);
    return v ? <span className={`sv-p${v.converted ? ' conv' : ''}`} title={v.converted ? `Convertido al blue ($${rate})` : undefined}>{v.converted && '≈ '}{rangeText(v, cur)}</span> : null;
  }
  const target = list.find(p => p.id === edit) || null;
  if (edit) return <PriceInput value={target} onCancel={() => setEdit(null)} onDone={(amount, currency, max) => {
    setEdit(null);
    if (target && target.amount === amount && target.currency === currency && (target.max || null) === max) return;
    if (target) onSave(amount ? s.prices.map(p => p.id === target.id ? { ...p, amount, currency, max } : p) : s.prices.filter(p => p.id !== target.id));
    else if (amount) onSave([...s.prices, { id: uuid(), label: '', amount, max, currency, period }]);
  }} />;
  if (!list.length) return <button className="sv-cell-add" onClick={() => setEdit('new')} aria-label={`Poner precio a ${s.name}`}><Plus size={14} /></button>;
  return <>{list.map(p => (
    <button key={p.id} className="sv-cell" onClick={() => setEdit(p.id)} title="Cambiar precio">
      {p.before ? <s>{money(p.before, p.currency)}</s> : null}<span>{priceText(p)}</span>{p.optional && <em>aparte</em>}
    </button>))}</>;
}

function PriceInput({ value, onDone, onCancel }: { value: SvcPrice | null; onDone: (amount: number, c: SvcCurrency, max: number | null) => void; onCancel: () => void }) {
  const es = (n: number) => String(n).replace('.', ',');
  const [text, setText] = useState(value ? es(value.amount) + (value.max ? `-${es(value.max)}` : '') : '');
  const [c, setC] = useState<SvcCurrency>(value?.currency || 'ARS');
  const box = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const finish = () => {
    if (done.current) return; done.current = true;
    const [a, b] = text.split(/-|–/).map(toNumber);
    onDone(a, c, b && b > a ? b : null);
  };
  return (
    <div className="sv-price-in" ref={box} onBlur={e => { if (!box.current?.contains(e.relatedTarget as Node)) finish(); }}>
      <button type="button" onClick={() => setC(x => x === 'ARS' ? 'USD' : 'ARS')} title="Cambiar moneda">{c === 'ARS' ? '$' : 'US$'}</button>
      <input autoFocus inputMode="decimal" value={text} onFocus={e => e.target.select()} onChange={e => setText(e.target.value)} aria-label="Precio"
        onKeyDown={e => { if (e.key === 'Enter') finish(); if (e.key === 'Escape') { done.current = true; onCancel(); } }} />
    </div>
  );
}

function StatusPick({ value, onChange }: { value: SvcStatus; onChange: (s: SvcStatus) => void }) {
  return (
    <label className="sv-status">
      <i className={value === 'en_venta' ? 'on' : ''} /><select value={value} onChange={e => onChange(e.target.value as SvcStatus)} aria-label="Estado">
        {SVC_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
    </label>
  );
}

// ─── Ficha ───
function Card({ s, cur, rate, n, selected, onToggle, onEdit, onWho }: { s: Service; cur: Money; rate: number; n: number; selected: boolean; onToggle: () => void; onEdit: () => void; onWho: () => void }) {
  const [all, setAll] = useState(false);
  const aside = s.prices.filter(p => p.optional);
  const msgCur: SvcCurrency = cur === 'USD' ? 'USD' : s.prices.some(p => p.currency === 'ARS' && p.amount > 0) || !hasPrice(s) ? 'ARS' : 'USD';
  const when = (p: SvcPeriod) => p === 'unico' ? 'pago único' : p === 'mes' ? 'por mes' : 'por año';
  const main = cur === 'cargado'
    ? s.prices.filter(p => p.amount > 0 && !p.optional).map(p => ({ key: p.id, text: priceText(p), before: p.before ? money(p.before, p.currency) : '', sub: when(p.period) }))
    : SVC_PERIODS.flatMap(p => { const v = priceIn(s, p.key, cur, rate); return v ? [{ key: p.key as string, text: (v.converted ? '≈ ' : '') + rangeText(v, cur), before: '', sub: when(p.key) }] : []; });
  const more = s.includes.length > 4 || !!s.notes || s.links.length > 0 || aside.length > 0;
  return (
    <article className={`sv-card${selected ? ' sel' : ''}${all ? ' open' : ''}`}>
      <header><button onClick={onEdit}><h3>{s.name}</h3></button><p>{s.summary}</p></header>
      <div className="sv-prices">{main.length ? main.map(m => <div key={m.key}><b>{m.before && <s>{m.before}</s>}{m.text}</b><span>{m.sub}</span></div>) : <button className="sv-noprice" onClick={onEdit}>{s.status === 'se_cotiza' ? 'Se cotiza' : 'Poner precio'}</button>}</div>
      <div className="sv-inc">
        <ul>{(all ? s.includes : s.includes.slice(0, 4)).map((i, k) => <li key={k}><Check size={14} />{i}</li>)}</ul>
        {all && <>{aside.length > 0 && <p>Aparte: {aside.map(p => `${p.label || 'adicional'} ${priceText(p)}${periodSuffix(p.period)}`).join(', ')}</p>}{s.delivery && <p>Entrega: {s.delivery}</p>}
          {s.links.length > 0 && <p className="sv-meta">{s.links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noreferrer">{l.label || 'Link'} <ExternalLink size={12} /></a>)}</p>}{s.notes && <p className="sv-notes">{s.notes}</p>}</>}
        {more && <button className="sv-link" onClick={() => setAll(v => !v)}>{all ? 'Ver menos' : 'Ver todo'}</button>}
      </div>
      <footer>
        <div><span className="sv-zero">{s.area}</span>{n > 0 ? <button className="sv-link" onClick={onWho}>{plural(n, 'cliente', 'clientes')}</button> : <span className="sv-zero">Sin clientes</span>}</div>
        <div><label><input type="checkbox" checked={selected} onChange={onToggle} /> Presupuestar</label><button className="btn btn-ghost btn-icon" title="Copiar para WhatsApp" aria-label={`Copiar ${s.name}`} onClick={() => copy(quoteMessage([s], msgCur, rate, ''), 'Copiado')}><Copy size={16} /></button><button className="btn btn-ghost btn-icon" title="Editar" aria-label={`Editar ${s.name}`} onClick={onEdit}><Pencil size={16} /></button></div>
      </footer>
    </article>
  );
}

// ─── Presupuesto ───
function Totals({ list, cur, rate }: { list: Service[]; cur: SvcCurrency; rate: number }) {
  const { totals, converted, missing } = quoteTotals(list, cur, rate);
  return <div className="sv-totals">
    {SVC_PERIODS.filter(p => totals[p.key]).map(p => <div key={p.key}><span>{p.col}</span><b>{rangeText(totals[p.key]!, cur)}</b></div>)}
    {(converted || missing.length > 0) && <small>{[converted ? `convertido al blue ($${rate})` : '', missing.length ? `${missing.length} sin precio` : ''].filter(Boolean).join(', ')}</small>}
  </div>;
}

function Quote({ list, rate, onClose }: { list: Service[]; rate: number; onClose: () => void }) {
  const [cur, setCur] = useState<SvcCurrency>('ARS');
  const [client, setClient] = useState('');
  const [text, setText] = useState('');
  const ids = list.map(s => s.id).join();
  useEffect(() => setText(quoteMessage(list, cur, rate, client)), [ids, cur, rate, client]);
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal sv-modal" onClick={e => e.stopPropagation()}>
      <h2>Presupuesto</h2>
      <div className="sv-two">
        <label className="sv-f"><span>Cliente</span><input className="input" value={client} onChange={e => setClient(e.target.value)} placeholder="Nombre" /></label>
        <div className="sv-f"><span>Cobrar en</span><div className="seg"><button className={cur === 'ARS' ? 'on' : ''} onClick={() => setCur('ARS')}>Pesos</button><button className={cur === 'USD' ? 'on' : ''} onClick={() => setCur('USD')}>Dólares</button></div></div>
      </div>
      <Totals list={list} cur={cur} rate={rate} />
      <label className="sv-f"><span>Mensaje</span><textarea className="textarea" rows={12} value={text} onChange={e => setText(e.target.value)} /></label>
      <div className="modal-actions"><button className="btn btn-ghost" onClick={onClose}>Cerrar</button><button className="btn btn-primary" onClick={() => copy(text, 'Presupuesto copiado')}><Copy size={16} /> Copiar para WhatsApp</button></div>
    </div></div>
  );
}

// ─── Editor completo ───
function Editor({ service, areas, rate, onClose, onSave, onDelete }: {
  service: Service | null; areas: string[]; rate: number; onClose: () => void;
  onSave: (id: string | null, d: ServiceInput) => void; onDelete: (s: Service) => void;
}) {
  const [f, setF] = useState<ServiceInput>(() => {
    if (!service) return emptyService();
    const { id: _i, createdAt: _c, updatedAt: _u, priceHistory: _h, ...rest } = service; return rest;
  });
  const [inc, setInc] = useState(f.includes.join('\n'));
  const [start] = useState(() => JSON.stringify([f, inc]));
  const set = (p: Partial<ServiceInput>) => setF(x => ({ ...x, ...p }));
  const setPrice = (id: string, p: Partial<SvcPrice>) => set({ prices: f.prices.map(x => x.id === id ? { ...x, ...p } : x) });
  const close = () => { if (JSON.stringify([f, inc]) === start || confirm('Hay cambios sin guardar. ¿Cerrar igual?')) onClose(); };
  const month = f.prices.find(p => p.period === 'mes' && p.amount > 0 && !p.optional);
  const monthUsd = month ? (month.currency === 'USD' ? month.amount : month.amount / rate) : null;

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(service?.id || null, {
      ...f, name: f.name.trim(), area: f.area.trim(),
      includes: inc.split('\n').map(x => x.replace(/^[-•*\s]+/, '').trim()).filter(Boolean),
      prices: f.prices.filter(p => p.amount > 0), links: f.links.filter(l => l.url.trim()),
    });
  };

  return (
    <div className="sv-drawer-bg" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
      <form className="sv-drawer" onSubmit={submit}>
        <div className="sv-drawer-head"><h2>{service ? 'Editar servicio' : 'Nuevo servicio'}</h2><button type="button" className="btn btn-ghost btn-icon" onClick={close} aria-label="Cerrar"><X size={18} /></button></div>
        <div className="sv-drawer-body">
          <label className="sv-f"><span>Nombre</span><input className="input" required autoFocus={!service} value={f.name} onChange={e => set({ name: e.target.value })} /></label>
          <div className="sv-two">
            <label className="sv-f"><span>Rubro</span><input className="input" list="sv-areas" value={f.area} onChange={e => set({ area: e.target.value })} /><datalist id="sv-areas">{[...new Set([...SVC_AREAS, ...areas])].map(a => <option key={a} value={a} />)}</datalist></label>
            <label className="sv-f"><span>Estado</span><select className="select" value={f.status} onChange={e => set({ status: e.target.value as SvcStatus })}>{SVC_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
          </div>
          <label className="sv-f"><span>En una frase</span><input className="input" value={f.summary} onChange={e => set({ summary: e.target.value })} /></label>

          <div className="sv-f"><span>Precios</span>
            {f.prices.map(p => (
              <div className="sv-pr" key={p.id}>
                <select className="select" value={p.currency} onChange={e => setPrice(p.id, { currency: e.target.value as SvcCurrency })} aria-label="Moneda"><option value="ARS">$</option><option value="USD">US$</option></select>
                <NumIn value={p.amount} onChange={n => setPrice(p.id, { amount: n })} label="Precio" ph="Precio" />
                <NumIn value={p.max || 0} onChange={n => setPrice(p.id, { max: n || null })} label="Hasta" ph="Hasta" />
                <select className="select" value={p.period} onChange={e => setPrice(p.id, { period: e.target.value as SvcPeriod })} aria-label="Cada cuánto">{SVC_PERIODS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
                <input className="input" value={p.label} placeholder="Detalle" onChange={e => setPrice(p.id, { label: e.target.value })} aria-label="Detalle" />
                <NumIn value={p.before || 0} onChange={n => setPrice(p.id, { before: n || null })} label="Precio de antes" ph="Antes" />
                <label className="sv-opt"><input type="checkbox" checked={!!p.optional} onChange={e => setPrice(p.id, { optional: e.target.checked })} /> Aparte</label>
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => set({ prices: f.prices.filter(x => x.id !== p.id) })} aria-label="Quitar precio"><Trash2 size={15} /></button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm sv-add" onClick={() => set({ prices: [...f.prices, { id: uuid(), label: '', amount: 0, currency: 'ARS', period: 'mes' }] })}><Plus size={14} /> Agregar precio</button>
          </div>

          <label className="sv-f"><span>Qué incluye, uno por renglón</span><textarea className="textarea" rows={Math.min(14, Math.max(5, inc.split('\n').length + 1))} value={inc} onChange={e => setInc(e.target.value)} /></label>
          <div className="sv-two">
            <label className="sv-f"><span>Entrega</span><input className="input" value={f.delivery} onChange={e => set({ delivery: e.target.value })} placeholder="14 días" /></label>
            <div className="sv-f"><span>Costo nuestro por mes (US$)</span><NumIn value={f.costMonthly || 0} onChange={n => set({ costMonthly: n || null })} label="Costo nuestro por mes" ph="0" />
              {monthUsd !== null && f.costMonthly ? <small>Te queda {money(Math.round(monthUsd - f.costMonthly), 'USD')} por mes en cada cliente</small> : null}</div>
          </div>
          <div className="sv-f"><span>Links y demos</span>
            {f.links.map((l, i) => (
              <div className="sv-lk" key={i}>
                <input className="input" value={l.label} placeholder="Nombre" onChange={e => set({ links: f.links.map((x, n) => n === i ? { ...x, label: e.target.value } : x) })} aria-label="Nombre del link" />
                <input className="input" type="url" value={l.url} placeholder="https://" onChange={e => set({ links: f.links.map((x, n) => n === i ? { ...x, url: e.target.value } : x) })} aria-label="Dirección" />
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => set({ links: f.links.filter((_, n) => n !== i) })} aria-label="Quitar link"><Trash2 size={15} /></button>
              </div>))}
            <button type="button" className="btn btn-secondary btn-sm sv-add" onClick={() => set({ links: [...f.links, { label: '', url: '' }] })}><Plus size={14} /> Agregar link</button>
          </div>
          <label className="sv-f"><span>Notas internas</span><textarea className="textarea" rows={4} value={f.notes} onChange={e => set({ notes: e.target.value })} /></label>
          {service && service.priceHistory?.length > 0 && <div className="sv-f"><span>Precios anteriores</span>
            <ul className="sv-hist">{service.priceHistory.slice(0, 8).map((h, i) => <li key={i}><span>hasta {fmt(h.at)}</span>{h.prices.map(p => priceText(p) + periodSuffix(p.period)).join(', ')}</li>)}</ul></div>}
        </div>
        <div className="sv-drawer-foot">
          {service && <button type="button" className="btn btn-danger" onClick={() => onDelete(service)}><Trash2 size={15} /> Borrar</button>}
          <span />
          <button type="button" className="btn btn-ghost" onClick={close}>Cancelar</button>
          <button className="btn btn-primary" type="submit">Guardar</button>
        </div>
      </form>
    </div>
  );
}

function NumIn({ value, onChange, label, ph }: { value: number; onChange: (n: number) => void; label: string; ph: string }) {
  const [t, setT] = useState(value ? String(value).replace('.', ',') : '');
  return <input className="input" inputMode="decimal" value={t} placeholder={ph} aria-label={label} onChange={e => { setT(e.target.value); onChange(toNumber(e.target.value)); }} />;
}
