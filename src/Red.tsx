import { useEffect, useMemo, useRef, useState, type PointerEvent as PE } from 'react';
import { ArrowRight, Building2, LocateFixed, MessageCircle, Plus, Search, Trash2, UserPlus, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useTable } from './base';
import { toast, useExchangeRate } from './hooks';
import { HEALTH, viewClient, waNumber, type Agreement, type Touch } from './negocio';
import { goTo } from './rutas';
import { Field, Modal } from './ui';
import {
  armarGrafo, buscar, ETAPA_DE, iniciales, mismaEmpresa, NIVEL, NIVELES, trajo, ubicar, VIAS, viaLabel,
  type ClienteR, type Empresa, type Grafo, type Nivel, type Nodo, type Pos, type ProspectoR, type Red as RedT,
} from './redReglas';
import './red.css';

// La lista de prospectos y clientes vista como un mapa: MYB al centro, cuanto más cerca y más grueso el trazo, más fuerte la relación.
type View = { x: number; y: number; k: number };
const BOTONES: Nivel[] = ['nuevo', 'hablado', 'seguimiento', 'compro', 'perdido'];

export default function Red() {
  const P = useTable<ProspectoR>('prospects'), C = useTable<ClienteR>('clients'), A = useTable<Agreement>('agreements'), T = useTable<Touch>('touches'), E = useTable<Empresa>('empresas');
  const rate = useExchangeRate();
  const ready = P.ready && C.ready && A.ready && E.ready;
  const g = useMemo<Grafo>(() => {
    const vistas = new Map(C.rows.map(c => [c.id, viewClient(c, A.rows, T.rows, rate)]));
    return armarGrafo(P.rows, C.rows, vistas, E.rows);
  }, [P.rows, C.rows, A.rows, T.rows, E.rows, rate]);

  const [pos, setPos] = useState<Pos>(new Map());
  const posRef = useRef(pos); posRef.current = pos;
  useEffect(() => { if (ready) setPos(ubicar(g, posRef.current)); }, [g, ready]);

  const [sel, setSel] = useState(''), [hover, setHover] = useState(''), [q, setQ] = useState('');
  const [hidden, setHidden] = useState<Set<string>>(new Set()), [nuevo, setNuevo] = useState<'persona' | 'empresa' | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const box = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el); return () => ro.disconnect();
  }, [ready]);

  const shown = (n: Nodo) => n.kind === 'yo' || (n.kind === 'empresa' ? !hidden.has('empresas') : !hidden.has(n.nivel));
  const vis = g.nodos.filter(shown), visId = new Set(vis.map(n => n.id));
  const lines = g.lineas.filter(l => visId.has(l.a) && visId.has(l.b));
  const focus = hover || sel;
  const near = useMemo(() => { if (!focus) return null; const s = new Set([focus]); g.lineas.forEach(l => { if (l.a === focus) s.add(l.b); if (l.b === focus) s.add(l.a); }); return s; }, [focus, g]);
  const hits = q.trim() ? new Set(vis.filter(n => n.kind !== 'yo' && buscar(n, q)).map(n => n.id)) : null;
  const dim = (id: string) => (hits && !hits.has(id) && id !== 'yo') || (near && !near.has(id));

  // Encuadrar todo la primera vez
  const fitted = useRef(false);
  const fit = () => {
    const pts = vis.map(n => pos.get(n.id)).filter(Boolean) as { x: number; y: number }[]; if (!pts.length) return;
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y), pad = 70;
    const w = Math.max(...xs) - Math.min(...xs) + pad * 2, h = Math.max(...ys) - Math.min(...ys) + pad * 2;
    const k = Math.max(.35, Math.min(1.8, size.w / w, size.h / h));
    setView({ k, x: -((Math.max(...xs) + Math.min(...xs)) / 2) * k, y: -((Math.max(...ys) + Math.min(...ys)) / 2) * k });
  };
  useEffect(() => { if (!fitted.current && pos.size > 1 && size.w > 0 && size.h > 0) { fitted.current = true; fit(); } }, [pos, size]); // eslint-disable-line react-hooks/exhaustive-deps
  const center = (id: string) => { const p = pos.get(id); if (p) setView(v => ({ ...v, x: -p.x * v.k, y: -p.y * v.k + (size.w < 700 ? size.h * .18 : 0) })); };
  const zoom = (f: number, cx = 0, cy = 0) => setView(v => { const k = Math.max(.25, Math.min(3, v.k * f)), r = k / v.k; return { k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r }; });

  // Rueda: zoom donde está el mouse
  useEffect(() => {
    const el = svg.current; if (!el) return;
    const w = (e: WheelEvent) => { e.preventDefault(); const b = el.getBoundingClientRect(); zoom(Math.exp(-e.deltaY * .0015), e.clientX - b.left - b.width / 2, e.clientY - b.top - b.height / 2); };
    el.addEventListener('wheel', w, { passive: false }); return () => el.removeEventListener('wheel', w);
  }, [ready]);

  // Arrastrar: fondo mueve el mapa, un nodo lo mueve a él, dos dedos hacen zoom. Un toque sin mover elige.
  const ptr = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ id: string; sx: number; sy: number; moved: boolean; pinch?: number } | null>(null);
  const down = (e: PE<SVGSVGElement>) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    ptr.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const id = (e.target as Element).closest('[data-id]')?.getAttribute('data-id') || '';
    if (ptr.current.size === 2) { const [a, b] = [...ptr.current.values()]; drag.current = { id: '', sx: 0, sy: 0, moved: true, pinch: Math.hypot(a.x - b.x, a.y - b.y) }; return; }
    drag.current = { id, sx: e.clientX, sy: e.clientY, moved: false };
  };
  const move = (e: PE<SVGSVGElement>) => {
    const last = ptr.current.get(e.pointerId), d = drag.current; if (!last || !d) return;
    ptr.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (d.pinch && ptr.current.size === 2) {
      const [a, b] = [...ptr.current.values()], dist = Math.hypot(a.x - b.x, a.y - b.y), r = svg.current!.getBoundingClientRect();
      zoom(dist / d.pinch, (a.x + b.x) / 2 - r.left - r.width / 2, (a.y + b.y) / 2 - r.top - r.height / 2); d.pinch = dist; return;
    }
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
    d.moved = true;
    if (d.id && d.id !== 'yo') setPos(p => { const n = new Map(p), o = n.get(d.id); if (o) n.set(d.id, { x: o.x + dx / view.k, y: o.y + dy / view.k }); return n; });
    else setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };
  const up = (e: PE<SVGSVGElement>) => {
    ptr.current.delete(e.pointerId);
    const d = drag.current; if (ptr.current.size) return; drag.current = null;
    if (d && !d.moved) setSel(d.id && d.id !== 'yo' ? d.id : '');
  };

  const grow = Math.max(1, .8 / view.k); // de lejos, puntos y nombres siguen legibles
  const pick = (id: string) => { setSel(id); center(id); };
  const n = sel ? g.byId.get(sel) : undefined;
  if (sel && !n && ready) setSel('');
  if (!ready) return <div className="view-load"><div className="spinner-lg" /></div>;

  const gente = g.nodos.filter(x => x.kind === 'persona'), urgentes = gente.filter(x => x.hot).length;
  const count = (k: string) => k === 'empresas' ? E.rows.length : gente.filter(x => x.nivel === k).length;
  const toggle = (k: string) => setHidden(h => { const s = new Set(h); if (s.has(k)) s.delete(k); else s.add(k); return s; });

  return (
    <div className="red">
      <div className="page-head"><div><h1>Red de contactos</h1>
        <p>{gente.length} {gente.length === 1 ? 'persona' : 'personas'}, {E.rows.length} {E.rows.length === 1 ? 'empresa' : 'empresas'}{urgentes ? `. ${urgentes} para mover hoy` : ''}</p></div>
        <div className="row"><button className="btn btn-ghost btn-sm" onClick={() => goTo('preventa')}>Ver prospectos en lista</button><button className="btn btn-ghost btn-sm" onClick={() => goTo('clients')}>Ver clientes en lista</button></div>
      </div>
      <div className="red-bar">
        <div className="search-bar"><Search size={16} /><input placeholder="Buscar persona, empresa o nota" aria-label="Buscar en la red" value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && hits?.size) pick([...hits][0]); }} />{q && <button className="btn btn-ghost btn-icon" aria-label="Borrar búsqueda" onClick={() => setQ('')}><X size={14} /></button>}</div>
        <button className="btn btn-primary" onClick={() => setNuevo('persona')}><UserPlus size={16} /> Persona</button>
        <button className="btn btn-secondary" onClick={() => setNuevo('empresa')}><Building2 size={16} /> Empresa</button>
      </div>
      <div className="red-ley" role="group" aria-label="Mostrar u ocultar">
        {NIVELES.map(k => { const c = count(k); return c > 0 && <button key={k} className={hidden.has(k) ? 'off' : ''} aria-pressed={!hidden.has(k)} onClick={() => toggle(k)}>
          <svg width="26" height="8" aria-hidden><line x1="1" y1="4" x2="25" y2="4" stroke="currentColor" strokeWidth={NIVEL[k].w} strokeDasharray={NIVEL[k].dash} opacity={Math.max(.35, NIVEL[k].op)} strokeLinecap="round" /></svg>{NIVEL[k].label} <em>{c}</em></button>; })}
        {E.rows.length > 0 && <button className={hidden.has('empresas') ? 'off' : ''} aria-pressed={!hidden.has('empresas')} onClick={() => toggle('empresas')}><Building2 size={13} /> Empresas <em>{E.rows.length}</em></button>}
        {urgentes > 0 && <span className="red-hot-ley"><i /> Hay que hacer algo</span>}
      </div>

      <div className={`red-main${n ? ' con' : ''}`}>
        <div className="red-cv" ref={box}>
          {gente.length === 0 && E.rows.length === 0 && <div className="red-empty"><h3>Todavía no hay nadie en la red</h3><p>Cargá prospectos en Pre-venta o sumá una persona acá. Cada uno aparece unido a MYB según cómo esté la relación.</p><button className="btn btn-primary" onClick={() => setNuevo('persona')}><Plus size={16} /> Sumar persona</button></div>}
          <svg ref={svg} width={size.w} height={size.h} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="img" aria-label="Mapa de contactos">
            <g transform={`translate(${size.w / 2 + view.x} ${size.h / 2 + view.y}) scale(${view.k})`}>
              {(['activo', 'compro', 'seguimiento', 'hablado', 'nuevo'] as Nivel[]).map(k => <circle key={k} r={NIVEL[k].r} className="red-ring" />)}
              {lines.map(l => {
                const a = pos.get(l.a), b = pos.get(l.b); if (!a || !b) return null;
                const s = NIVEL[l.nivel], off = (near && !(near.has(l.a) && near.has(l.b) && (l.a === focus || l.b === focus))) || (hits && !hits.has(l.b));
                return l.kind === 'emp'
                  ? <line key={l.a + l.b} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="red-l emp" opacity={off ? .06 : .4} />
                  : <line key={l.a + l.b} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="red-l" strokeWidth={s.w} strokeDasharray={s.dash} opacity={off ? .05 : s.op} />;
              })}
              {vis.map(x => {
                const p = pos.get(x.id); if (!p) return null;
                const r = (x.kind === 'yo' ? 28 : x.kind === 'empresa' ? 13 : NIVEL[x.nivel].size) * grow, cl = !!x.cliente;
                const label = x.kind === 'yo' || vis.length <= 45 || view.k > .55 || x.id === focus || (hits?.has(x.id) ?? false);
                return <g key={x.id} data-id={x.id} className={`red-n ${x.kind}${cl ? ' cl' : ''}${x.id === sel ? ' sel' : ''}`} transform={`translate(${p.x} ${p.y})`} opacity={dim(x.id) ? .16 : x.nivel === 'perdido' && x.kind === 'persona' ? .55 : 1}
                  onPointerEnter={() => setHover(x.id)} onPointerLeave={() => setHover('')}>
                  {x.hot && <circle r={r + 6} className="red-hot" />}
                  {x.kind === 'empresa' ? <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={5} /> : <circle r={r} />}
                  <text className="ini" dy=".35em" fontSize={x.kind === 'yo' ? 13 * grow : Math.max(8, r * .72)}>{x.kind === 'yo' ? 'MYB' : x.kind === 'empresa' ? iniciales(x.name).slice(0, 1) : iniciales(x.name)}</text>
                  {label && x.kind !== 'yo' && <text className="nm" y={r + 13 * grow} fontSize={12 * grow}>{x.name.length > 22 ? x.name.slice(0, 21) + '…' : x.name}</text>}
                </g>;
              })}
            </g>
          </svg>
          <div className="red-zoom">
            <button className="btn btn-secondary btn-icon" aria-label="Acercar" onClick={() => zoom(1.25)}><ZoomIn size={16} /></button>
            <button className="btn btn-secondary btn-icon" aria-label="Alejar" onClick={() => zoom(.8)}><ZoomOut size={16} /></button>
            <button className="btn btn-secondary btn-icon" aria-label="Ver todo" title="Ver todo" onClick={fit}><LocateFixed size={16} /></button>
          </div>
        </div>
        {n && <Panel key={n.id} n={n} g={g} P={P} C={C} E={E} onPick={pick} onClose={() => setSel('')} />}
      </div>
      {nuevo && <Nuevo kind={nuevo} g={g} P={P} E={E} onClose={() => setNuevo(null)} onDone={id => { setNuevo(null); setTimeout(() => pick(id), 60); }} />}
    </div>
  );
}

type Tables = { P: ReturnType<typeof useTable<ProspectoR>>; C: ReturnType<typeof useTable<ClienteR>>; E: ReturnType<typeof useTable<Empresa>> };

/** Busca la empresa por nombre o la crea. Devuelve el id ('' si el nombre está vacío). */
async function empresaDe(E: Tables['E'], name: string): Promise<string | null> {
  const s = name.trim(); if (!s) return '';
  const e = E.rows.find(x => mismaEmpresa(x.name, s)); if (e) return e.id;
  const nueva = await E.add({ name: s }); return nueva ? nueva.id : null;
}
const fuente = (g: Grafo, red: RedT) => red.via === 'referido' ? `Referido${red.por && g.byId.get(red.por) ? ' por ' + g.byId.get(red.por)!.name : ''}` : viaLabel(red.via);

function Panel({ n, g, P, C, E, onPick, onClose }: Tables & { n: Nodo; g: Grafo; onPick: (id: string) => void; onClose: () => void }) {
  const rid = n.id.slice(2);
  const [red, setRed] = useState<RedT>({ ...n.red, via: n.via, por: n.por });
  const empName = n.empresaId ? E.rows.find(e => e.id === n.empresaId)?.name || '' : '';
  const [emp, setEmp] = useState(empName);
  const save = async (patch: Partial<RedT>, extra: Record<string, unknown> = {}) => {
    const next = { ...red, ...patch }; setRed(next);
    const ok = n.cliente ? await C.update(rid, { red: next, ...extra } as Partial<ClienteR>) : await P.update(rid, { red: next, ...extra } as Partial<ProspectoR>);
    if (!ok) toast('No se pudo guardar', 'error');
  };
  const saveVia = (patch: Partial<RedT>) => { const next = { ...red, ...patch }; save(patch, n.cliente ? {} : { source: fuente(g, next) }); };
  const commitEmp = async () => {
    if (mismaEmpresa(emp, empName)) return;
    const id = await empresaDe(E, emp); if (id === null) return;
    save({ empresa: id }, !n.cliente && id && !n.prospecto?.business ? { business: emp.trim() } : {});
  };

  if (n.kind === 'empresa') return <EmpresaPanel n={n} g={g} E={E} onPick={onPick} onClose={onClose} />;
  const tel = waNumber(n.tel), recom = trajo(g, n.id), quien = g.nodos.filter(x => x.kind === 'persona' && x.id !== n.id).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <aside className="red-panel" aria-label={n.name}>
      <div className="red-ph"><div><h2>{n.name}</h2><p>{NIVEL[n.nivel].label}{n.cliente ? ', cliente' : ', prospecto'}{n.sub ? `. ${n.sub}` : ''}</p></div>
        <button className="btn btn-ghost btn-icon" aria-label="Cerrar" onClick={onClose}><X size={18} /></button></div>
      {n.hot && <p className="red-alert">{n.hot}</p>}
      <div className="red-pb">
        {n.cliente ? <div className="f"><span>Relación</span><p className="red-st">{n.vista ? HEALTH[n.vista.health].label : 'Cliente'}. Se actualiza solo con sus acuerdos.</p></div>
          : <div className="f" role="group" aria-label="Relación"><span>Relación</span><div className="chips wrap">{BOTONES.map(k =>
            <button key={k} className={n.nivel === k ? 'on' : ''} aria-pressed={n.nivel === k} onClick={() => P.update(rid, { stage: ETAPA_DE[k] })}>{NIVEL[k].label}</button>)}</div></div>}
        <Field label="Qué hace"><input className="input" placeholder="Dueño, encargada, socio…" defaultValue={red.rol || ''} onBlur={e => e.target.value.trim() !== (red.rol || '') && save({ rol: e.target.value.trim() })} /></Field>
        <Field label="Empresa donde trabaja" help={!emp && n.prospecto?.business ? `En Pre-venta figura "${n.prospecto.business}"` : undefined}>
          <input className="input" list="red-emps" placeholder={n.prospecto?.business || 'Escribí o elegí una empresa'} value={emp} onChange={e => setEmp(e.target.value)} onBlur={commitEmp} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
          <datalist id="red-emps">{E.rows.map(e => <option key={e.id} value={e.name} />)}</datalist>
        </Field>
        <div className="f" role="group" aria-label="De dónde vino"><span>De dónde vino</span><div className="chips wrap">{VIAS.map(([k, l]) =>
          <button key={k} className={red.via === k ? 'on' : ''} aria-pressed={red.via === k} onClick={() => saveVia({ via: red.via === k ? '' : k, por: k === 'referido' ? red.por : '' })}>{l}</button>)}</div></div>
        {red.via === 'referido' && <Field label="Quién lo recomendó">
          <select className="select" value={red.por || ''} onChange={e => saveVia({ por: e.target.value })}><option value="">Elegí a la persona</option>{quien.map(x => <option key={x.id} value={x.id}>{x.name}{x.cliente ? ' (cliente)' : ''}</option>)}</select></Field>}
        <Field label="Cómo es" help="Para acordarte antes de hablarle."><textarea className="input" rows={4} placeholder="Qué le importa, cómo decide, cómo conviene hablarle" defaultValue={red.perfil || ''} onBlur={e => e.target.value !== (red.perfil || '') && save({ perfil: e.target.value })} /></Field>
        {recom.length > 0 && <div className="f"><span>Nos trajo a</span><div className="red-list">{recom.map(x => <button key={x.id} onClick={() => onPick(x.id)}>{x.name}<small>{NIVEL[x.nivel].label}</small></button>)}</div></div>}
      </div>
      <div className="red-pf">
        {tel && <a className="btn btn-secondary btn-sm" href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a>}
        <button className="btn btn-primary btn-sm" onClick={() => goTo(n.cliente ? `clients/${rid}` : `preventa/${rid}`)}>{n.cliente ? 'Abrir ficha' : 'Abrir en Pre-venta'} <ArrowRight size={14} /></button>
      </div>
    </aside>
  );
}

function EmpresaPanel({ n, g, E, onPick, onClose }: { n: Nodo; g: Grafo; E: Tables['E']; onPick: (id: string) => void; onClose: () => void }) {
  const e = n.empresa!, gente = g.nodos.filter(x => x.empresaId === e.id);
  const save = (patch: Partial<Empresa>) => E.update(e.id, patch);
  return (
    <aside className="red-panel" aria-label={e.name}>
      <div className="red-ph"><div><h2>{e.name}</h2><p>Empresa{gente.length ? `, ${gente.length} ${gente.length === 1 ? 'persona' : 'personas'}` : ''}</p></div>
        <button className="btn btn-ghost btn-icon" aria-label="Cerrar" onClick={onClose}><X size={18} /></button></div>
      <div className="red-pb">
        <Field label="Nombre"><input className="input" defaultValue={e.name} onBlur={x => x.target.value.trim() && x.target.value.trim() !== e.name && save({ name: x.target.value.trim() })} /></Field>
        <Field label="Rubro"><input className="input" placeholder="Barbería, restaurante, inmobiliaria…" defaultValue={e.rubro || ''} onBlur={x => x.target.value !== (e.rubro || '') && save({ rubro: x.target.value.trim() })} /></Field>
        <Field label="Notas"><textarea className="input" rows={3} defaultValue={e.notes || ''} onBlur={x => x.target.value !== (e.notes || '') && save({ notes: x.target.value })} /></Field>
        <div className="f"><span>Gente que trabaja ahí</span>{gente.length ? <div className="red-list">{gente.map(x => <button key={x.id} onClick={() => onPick(x.id)}>{x.name}<small>{NIVEL[x.nivel].label}</small></button>)}</div>
          : <p className="help">Nadie todavía. Elegí esta empresa en la ficha de una persona.</p>}</div>
      </div>
      <div className="red-pf"><button className="btn btn-ghost btn-sm" onClick={async () => { if (confirm(`¿Borrar la empresa ${e.name}? Las personas quedan.`) && await E.remove(e.id)) onClose(); }}><Trash2 size={15} /> Borrar empresa</button></div>
    </aside>
  );
}

function Nuevo({ kind, g, P, E, onClose, onDone }: { kind: 'persona' | 'empresa'; g: Grafo; P: Tables['P']; E: Tables['E']; onClose: () => void; onDone: (id: string) => void }) {
  const [f, setF] = useState({ name: '', rol: '', emp: '', via: '', por: '', tel: '', rubro: '' }), [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(x => ({ ...x, [k]: e.target.value }));
  const gente = g.nodos.filter(x => x.kind === 'persona').sort((a, b) => a.name.localeCompare(b.name));
  const ok = async () => {
    if (!f.name.trim()) return toast('Falta el nombre', 'error');
    setBusy(true);
    if (kind === 'empresa') {
      const id = await empresaDe(E, f.name); setBusy(false);
      if (id) { if (f.rubro.trim()) await E.update(id, { rubro: f.rubro.trim() }); onDone('e:' + id); } return;
    }
    const empresa = await empresaDe(E, f.emp); if (empresa === null) return setBusy(false);
    const red: RedT = { rol: f.rol.trim(), empresa, via: f.via, por: f.via === 'referido' ? f.por : '' };
    const p = await P.add({ name: f.name.trim(), business: f.emp.trim(), source: fuente(g, red), stage: 'prospeccion', contact: { whatsapp: f.tel.trim() }, red } as Partial<ProspectoR>);
    setBusy(false); if (p) { toast('Sumado a la red y a Pre-venta'); onDone('p:' + p.id); }
  };
  return (
    <Modal title={kind === 'empresa' ? 'Nueva empresa' : 'Nueva persona'} onClose={onClose} actions={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={busy} onClick={ok}>Sumar</button></>}>
      <form className="red-form" onSubmit={e => { e.preventDefault(); ok(); }}>
        <Field label="Nombre"><input className="input" value={f.name} onChange={set('name')} placeholder={kind === 'empresa' ? 'Ej: Barbería Roy' : 'Ej: Ana Paz'} /></Field>
        {kind === 'empresa' ? <Field label="Rubro"><input className="input" value={f.rubro} onChange={set('rubro')} placeholder="Barbería, restaurante…" /></Field> : <>
          <Field label="Qué hace"><input className="input" value={f.rol} onChange={set('rol')} placeholder="Dueño, encargada, socio…" /></Field>
          <Field label="Empresa donde trabaja"><input className="input" list="red-emps-n" value={f.emp} onChange={set('emp')} placeholder="Escribí o elegí una" /><datalist id="red-emps-n">{E.rows.map(e => <option key={e.id} value={e.name} />)}</datalist></Field>
          <Field label="WhatsApp"><input className="input" inputMode="tel" value={f.tel} onChange={set('tel')} placeholder="351 555 1234" /></Field>
          <Field label="De dónde vino"><select className="select" value={f.via} onChange={set('via')}><option value="">Sin dato</option>{VIAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          {f.via === 'referido' && <Field label="Quién lo recomendó"><select className="select" value={f.por} onChange={set('por')}><option value="">Elegí a la persona</option>{gente.map(x => <option key={x.id} value={x.id}>{x.name}{x.cliente ? ' (cliente)' : ''}</option>)}</select></Field>}
        </>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
