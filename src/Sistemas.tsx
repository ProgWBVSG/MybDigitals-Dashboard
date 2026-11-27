import { useMemo, useState } from 'react';
import { ArrowLeft, Coffee, Copy, Dumbbell, Martini, Music, Scissors, Sparkles, Store, UtensilsCrossed, Shapes, ExternalLink, KeyRound, MessageCircle, Pencil, Pin, Plus, Search, Trash2, Undo2, X } from 'lucide-react';
import { deleteOp, insertOp, isCloud, PEOPLE, post, reload, saveAll, useTable } from './base';
import { toast } from './hooks';
import { norm } from './sheetImport';
import { money, type Service, type SvcCurrency } from './services';
import { ACCOUNTS } from './plataTxt';
import { both, fDate, purse, splitIncome, waNumber, when, type ClientRow, type Fund, type Movement } from './negocio';
import { copyText, DateIn, Empty, Field, Modal, Num, Seg } from './ui';
import { useSub } from './rutas';
import {
  dueOf, HEALTH, monthsOf, nextPeriod, periodLabel, periodOf, periodShort, RUBROS, safeUrl, snippet, STATUS, viewSys,
  type Sistema, type SysHealth, type SysLog, type SysNota, type SysPago, type SysStatus, type SysView,
} from './sistemaReglas';
import './sistemas.css';

type Filter = 'todos' | 'atencion' | 'al_dia' | 'prueba' | 'suspendido' | 'baja';
const FILTERS: [Filter, string, (h: SysHealth) => boolean][] = [
  ['todos', 'Todos', h => h !== 'baja'], ['atencion', 'Deben', h => HEALTH[h].hot], ['al_dia', 'Al día', h => h === 'al_dia' || h === 'por_vencer'],
  ['prueba', 'En prueba', h => h === 'prueba'], ['suspendido', 'Suspendidos', h => h === 'suspendido'], ['baja', 'De baja', h => h === 'baja'],
];
const who = (by: string) => PEOPLE[by as 'benja'] || '';

export default function Sistemas() {
  const sys = useTable<Sistema>('sistemas'), pagos = useTable<SysPago>('sistema_pagos');
  const [sub, go] = useSub();
  const [q, setQ] = useState(''), [f, setF] = useState<Filter>('todos'), [rubro, setRubro] = useState('');
  const [edit, setEdit] = useState<Partial<Sistema> | null>(null), [cobrar, setCobrar] = useState<Sistema | null>(null);
  const views = useMemo(() => sys.rows.map(s => viewSys(s, pagos.rows)).sort((a, b) => HEALTH[a.health].rank - HEALTH[b.health].rank || b.debt - a.debt || a.s.name.localeCompare(b.s.name)), [sys.rows, pagos.rows]);
  if (!sys.ready || !pagos.ready) return <div className="view-load"><div className="spinner-lg" /></div>;

  const modal = <>
    {edit && <SysModal value={edit} onClose={() => setEdit(null)} onSaved={id => { setEdit(null); if (id) go(id); }} />}
    {cobrar && <CobroModal s={cobrar} onClose={() => setCobrar(null)} />}
  </>;
  const open = sub ? views.find(v => v.s.id === sub) : null;
  if (open) return <><Detail v={open} onBack={() => go('')} onEdit={() => setEdit(open.s)} onCobrar={() => setCobrar(open.s)} />{modal}</>;
  if (!sys.rows.length) return <><Empty title="Cargá el primer sistema" text="Cada barbería, restaurante o boliche que usa lo nuestro: cuánto paga, si está al día, sus accesos y el botón para cortarle el servicio."><button className="btn btn-primary" onClick={() => setEdit({})}><Plus size={17} /> Nuevo sistema</button></Empty>{modal}</>;

  const live = views.filter(v => v.s.status === 'activo');
  const mon = purse(), owed = purse();
  live.forEach(v => { mon[v.s.currency] += v.s.price; });
  views.filter(v => v.s.status !== 'baja').forEach(v => { owed[v.s.currency] += v.debt; });
  const rubros = [...new Set(sys.rows.map(s => s.rubro).filter(Boolean))].sort();
  const t = norm(q);
  const rows = views.filter(v => FILTERS.find(x => x[0] === f)![2](v.health) && (!rubro || v.s.rubro === rubro)
    && (!t || norm([v.s.name, v.s.rubro, v.s.city, v.s.plan, v.s.owner?.name, v.s.owner?.whatsapp, ...(v.s.tags || []), ...(v.s.fields || []).map(x => x.v)].join(' ')).includes(t)));
  const hot = views.filter(v => HEALTH[v.health].hot).length;

  return (
    <div>
      <div className="page-head"><div><h1>Sistemas</h1><p>{hot ? `${hot === 1 ? 'Uno debe' : hot + ' deben'} de ${live.length} activos` : `${live.length} activos, todos al día`}</p></div><button className="btn btn-primary" onClick={() => setEdit({})}><Plus size={17} /> Nuevo sistema</button></div>
      <div className="cl-top">
        <div><span>Entra por mes</span><b>{both(mon)}</b></div><div><span>Nos deben</span><b>{both(owed)}</b></div>
        <div><span>Activos</span><b>{live.length}</b></div><div><span>Suspendidos</span><b>{views.filter(v => v.s.status === 'suspendido').length}</b></div>
      </div>
      <div className="cl-f"><div className="search-bar"><Search size={16} /><input placeholder="Buscar negocio, dueño, ciudad o dato" aria-label="Buscar" value={q} onChange={e => setQ(e.target.value)} /></div>
        {rubros.length > 1 && <select className="select" aria-label="Rubro" value={rubro} onChange={e => setRubro(e.target.value)}><option value="">Todos los rubros</option>{rubros.map(r => <option key={r}>{r}</option>)}</select>}
        <div className="chips">{FILTERS.map(([k, l, test]) => { const n = views.filter(v => test(v.health)).length; return (k === 'todos' || n > 0) && <button key={k} className={f === k ? 'on' : ''} aria-pressed={f === k} onClick={() => setF(k)}>{l} <em>{n}</em></button>; })}</div></div>
      <div className="cl-list">{rows.length === 0 ? <p className="sv-none">Nadie con ese filtro.</p> : rows.map(v => <Item key={v.s.id} v={v} onOpen={() => go(v.s.id)} onCobrar={() => setCobrar(v.s)} />)}</div>
      {modal}
    </div>
  );
}

function Dots({ v }: { v: SysView }) {
  const last = v.months.slice(-6);
  if (!last.length) return <span className="sy-none">{v.s.status === 'prueba' ? 'En prueba' : 'Sin meses'}</span>;
  return <div className="sy-dots" aria-label={last.map(m => `${periodLabel(m.period)}: ${m.state.replace('_', ' ')}`).join(', ')}>{last.map(m => <i key={m.period} className={m.state} title={`${periodLabel(m.period)}: ${m.state.replace('_', ' ')}`} />)}</div>;
}

function Item({ v, onOpen, onCobrar }: { v: SysView; onOpen: () => void; onCobrar: () => void }) {
  const h = HEALTH[v.health], link = v.s.links?.map(l => safeUrl(l.url)).find(Boolean), w = waNumber(v.s.owner?.whatsapp);
  return <article className={`cl sy${h.hot ? ' hot' : ''}`}>
    <button className="cl-m" onClick={onOpen}><b>{v.s.name}</b><span>{[v.s.rubro, v.s.city, v.s.plan].filter(Boolean).join(', ') || 'Sin datos'}</span></button>
    <button className="cl-s" onClick={onOpen} tabIndex={-1}><em className={h.hot ? 'pill hot' : 'pill'}>{h.label}</em><span>{v.why}</span></button>
    <div className="cl-b"><span>{v.s.price ? `${money(v.s.price, v.s.currency)} por mes` : 'Sin precio'}</span><Dots v={v} /></div>
    <div className="sy-a">
      {v.s.status !== 'baja' && v.s.status !== 'prueba' && <button className={`btn btn-sm ${v.owed.length ? 'btn-primary' : 'btn-secondary'}`} onClick={onCobrar}>Cobrar</button>}
      <a className={`btn btn-secondary btn-icon${link ? '' : ' dis'}`} href={link || undefined} target="_blank" rel="noopener noreferrer" aria-label={link ? `Entrar al panel de ${v.s.name}` : 'Sin acceso cargado'} title={link ? 'Entrar al panel' : 'Sin acceso cargado'}><ExternalLink size={17} /></a>
      <a className={`btn btn-secondary btn-icon${w ? '' : ' dis'}`} href={w ? `https://wa.me/${w}` : undefined} target="myb-whatsapp" rel="noreferrer" aria-label={w ? `WhatsApp de ${v.s.name}` : 'Sin WhatsApp'} title={w ? 'WhatsApp' : 'Sin WhatsApp'}><MessageCircle size={17} /></a>
    </div>
  </article>;
}

// ─── Ficha de cada negocio ───
function Detail({ v, onBack, onEdit, onCobrar }: { v: SysView; onBack: () => void; onEdit: () => void; onCobrar: () => void }) {
  const sys = useTable<Sistema>('sistemas'), pagos = useTable<SysPago>('sistema_pagos'), notas = useTable<SysNota>('sistema_notas'), logs = useTable<SysLog>('sistema_registro');
  const [to, setTo] = useState<SysStatus | null>(null), [note, setNote] = useState(''), [k, setK] = useState(''), [val, setVal] = useState('');
  const s = v.s, h = HEALTH[v.health], w = waNumber(s.owner?.whatsapp), links = (s.links || []).filter(l => safeUrl(l.url));
  const mine = pagos.rows.filter(p => p.sistema_id === s.id).sort((a, b) => b.paid_at - a.paid_at);
  const log = logs.rows.filter(l => l.sistema_id === s.id).sort((a, b) => b.at - a.at);
  const grid = v.months.slice(-12);

  const undo = async (p: SysPago) => {
    const group = p.movement_id ? mine.filter(x => x.movement_id === p.movement_id) : [p];
    if (!confirm(group.length > 1 ? `¿Deshacer este cobro? Son ${group.length} meses (${group.map(x => periodShort(x.period)).join(', ')}) y también sale de Plata.` : `¿Deshacer el pago de ${periodLabel(p.period)}?${p.movement_id ? ' También sale de Plata.' : ''}`)) return;
    const e = await saveAll([...group.map(x => deleteOp('sistema_pagos', x.id)), ...(p.movement_id ? [deleteOp('movements', p.movement_id)] : [])]);
    if (e) toast('No se pudo: ' + e, 'error'); else { toast('Pago deshecho'); reload('sistema_registro'); }
  };
  const remove = async () => {
    if (prompt(`Para borrar ${s.name} con sus pagos y notas, escribí su nombre. Lo que entró a Plata queda.`)?.trim() !== s.name.trim()) return;
    if (await sys.remove(s.id)) { toast('Borrado. Queda en la papelera'); onBack(); }
  };
  const fields = s.fields || [];
  const addField = async (e: React.FormEvent) => { e.preventDefault(); if (!k.trim()) return; if (await sys.update(s.id, { fields: [...fields, { k: k.trim().slice(0, 60), v: val.trim().slice(0, 500) }] })) { setK(''); setVal(''); reload('sistema_registro'); } };

  return (
    <div className="cd">
      <button className="btn btn-ghost" onClick={onBack}><ArrowLeft size={17} /> Sistemas</button>
      <div className="page-head"><div><h1>{s.name}</h1><p>{[s.rubro, s.city, s.plan, s.owner?.name].filter(Boolean).join(', ') || 'Sin datos'}</p></div>
        <div className="row"><button className="btn btn-ghost" onClick={onEdit}><Pencil size={16} /> Datos</button>{w && <a className="btn btn-secondary" href={`https://wa.me/${w}`} target="myb-whatsapp" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>}{links[0] && <a className="btn btn-secondary" href={safeUrl(links[0].url)} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Entrar</a>}</div></div>

      <div className={`cd-state sy-state${h.hot ? ' hot' : ''}`}>
        <div><b>{h.label}</b><span>{v.why}</span>{(s.status === 'suspendido' || s.status === 'baja') && <small>{STATUS[s.status]} {when(s.status_at)}{s.status_by ? ` por ${who(s.status_by)}` : ''}{s.status_msg ? `. En su app dice: "${s.status_msg}"` : ''}</small>}</div>
        <div className="row">
          {s.status === 'prueba' && <button className="btn btn-secondary btn-sm" onClick={() => setTo('activo')}>Pasar a activo</button>}
          {(s.status === 'activo' || s.status === 'prueba') && <button className={`btn btn-sm ${v.health === 'cortar' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTo('suspendido')}>Suspender servicio</button>}
          {(s.status === 'suspendido' || s.status === 'baja') && <button className="btn btn-primary btn-sm" onClick={() => setTo('activo')}>Reactivar</button>}
          {s.status !== 'baja' ? <button className="btn btn-ghost btn-sm" onClick={() => setTo('baja')}>Dar de baja</button> : <button className="btn btn-ghost btn-sm" onClick={remove}><Trash2 size={14} /> Borrar</button>}
        </div>
      </div>
      <div className="cl-top">
        <div><span>Abono</span><b>{s.price ? money(s.price, s.currency) : 'Sin precio'}</b></div>
        <div><span>Debe</span><b>{v.debt ? money(v.debt, s.currency) : 'Nada'}</b></div>
        <div><span>Último pago</span><b>{v.lastPay ? fDate(v.lastPay.paid_at) : 'Ninguno'}</b></div>
        <div><span>Cobro</span><b>Día {s.bill_day}</b></div>
      </div>

      <div className="cd-cols">
        <div className="col">
          <section className="pn">
            <div className="pn-h"><div><h2>Pagos</h2><p>{v.owed.length ? `Debe ${v.owed.map(m => periodShort(m.period)).join(', ')}` : 'Nada vencido'}</p></div>{s.status !== 'baja' && s.status !== 'prueba' && <button className={`btn btn-sm ${v.owed.length ? 'btn-primary' : 'btn-secondary'}`} onClick={onCobrar}>Cobrar</button>}</div>
            {grid.length > 0 && <div className="sy-grid">{grid.map(m => <div key={m.period} className={`sy-m ${m.state}`}><b>{periodShort(m.period)}</b><span>{m.state === 'pagado' ? fDate(m.pago!.paid_at) : m.state === 'bonificado' ? 'Bonificado' : m.state === 'vencido' ? 'Debe' : 'Por vencer'}</span></div>)}</div>}
            {mine.length === 0 ? <p className="help">Todavía no hay pagos cargados.</p> : mine.slice(0, 14).map(p => <div className="li" key={p.id}><div><b>{periodLabel(p.period)}</b><span>{p.amount > 0 ? `Pagó el ${fDate(p.paid_at)}${p.method ? `, ${p.method}` : ''}` : 'Bonificado'}{p.by ? `. Lo cargó ${who(p.by)}` : ''}</span></div><em>{p.amount > 0 ? money(p.amount, p.currency) : 'Sin cargo'}</em><button className="btn btn-ghost btn-icon" title="Deshacer" aria-label={`Deshacer pago de ${periodLabel(p.period)}`} onClick={() => undo(p)}><Undo2 size={15} /></button></div>)}
          </section>
          <section className="pn">
            <div className="pn-h"><h2>Accesos</h2><button className="btn btn-ghost btn-sm" onClick={onEdit}><Pencil size={14} /> Editar</button></div>
            {links.length === 0 ? <p className="help">Sin accesos cargados.</p>
              : links.map((l, i) => <a key={i} className="sy-link" href={safeUrl(l.url)} target="_blank" rel="noopener noreferrer"><div><b>{l.label || 'Entrar'}</b><span>{new URL(safeUrl(l.url)).host}</span></div><ExternalLink size={16} /></a>)}
          </section>
          <section className="pn">
            <h2>Datos propios</h2>
            {fields.map((x, i) => <div className="li sy-f" key={i}><div><span>{x.k}</span><b>{x.v || 'Sin dato'}</b></div><button className="btn btn-ghost btn-icon" aria-label={`Sacar ${x.k}`} onClick={async () => { if (await sys.update(s.id, { fields: fields.filter((_, j) => j !== i) })) reload('sistema_registro'); }}><X size={15} /></button></div>)}
            <form className="sy-add" onSubmit={addField}><input className="input" placeholder="Dato (ej. Sillas)" aria-label="Nombre del dato" value={k} onChange={e => setK(e.target.value)} /><input className="input" placeholder="Valor (ej. 3)" aria-label="Valor" value={val} onChange={e => setVal(e.target.value)} /><button className="btn btn-secondary btn-icon" disabled={!k.trim()} aria-label="Agregar dato"><Plus size={16} /></button></form>
          </section>
        </div>
        <div className="col">
          <section className="pn"><h2>Notas</h2>
            <form className="ff" onSubmit={async e => { e.preventDefault(); if (note.trim() && await notas.add({ sistema_id: s.id, text: note.trim() })) { setNote(''); reload('sistema_registro'); } }}><textarea className="textarea" rows={2} placeholder="Anotar algo" aria-label="Nota nueva" value={note} onChange={e => setNote(e.target.value)} />{note.trim() && <button className="btn btn-secondary btn-sm">Guardar nota</button>}</form>
            {notas.rows.filter(n => n.sistema_id === s.id).sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.created_at) - Number(a.created_at)).map(n => <div className={`nt sy-n${n.pinned ? ' on' : ''}`} key={n.id}><p>{n.text}</p><small>{fDate(Number(n.created_at))}{n.by ? `, ${who(n.by)}` : ''}</small>
              <div className="sy-nb"><button className="btn btn-ghost btn-icon" aria-pressed={n.pinned} aria-label={n.pinned ? 'Desfijar' : 'Fijar arriba'} title={n.pinned ? 'Desfijar' : 'Fijar arriba'} onClick={() => notas.update(n.id, { pinned: !n.pinned })}><Pin size={14} /></button><button className="btn btn-ghost btn-icon" aria-label="Borrar nota" onClick={async () => { if (confirm('¿Borrar esta nota?') && await notas.remove(n.id)) reload('sistema_registro'); }}><Trash2 size={14} /></button></div></div>)}
          </section>
          <Corte s={s} />
          <section className="pn"><h2>Registro</h2>
            {log.length === 0 ? <p className="help">Sin cambios todavía.</p> : log.slice(0, 30).map(l => <div className="nt" key={l.id}><p>{l.detail}</p><small>{when(l.at)}, {fDate(l.at)}{l.by ? `, ${who(l.by)}` : ''}</small></div>)}
          </section>
        </div>
      </div>
      {to && <EstadoModal s={s} to={to} owed={v.owed.length} onClose={() => setTo(null)} />}
    </div>
  );
}

function Corte({ s }: { s: Sistema }) {
  const [show, setShow] = useState(false);
  const origin = isCloud() ? location.origin : 'https://DIRECCION-DEL-DASHBOARD';
  const rotate = async () => {
    if (!confirm('¿Cambiar la llave? El código que ya está pegado en su app deja de funcionar y hay que pegar el nuevo.')) return;
    const { error } = await post('sistema-estado', { id: s.id, rotate: true });
    if (error) toast(error.message, 'error'); else { toast('Llave nueva'); reload('sistemas'); reload('sistema_registro'); }
  };
  return <section className="pn">
    <div className="pn-h"><h2>Corte automático</h2><button className="btn btn-ghost btn-sm" onClick={() => setShow(x => !x)}>{show ? 'Ocultar' : 'Ver código'}</button></div>
    <p className="help">Pegalo en su panel y su app: al suspenderlo, se cortan solos.{!isCloud() && ' Funciona cuando el dashboard esté en internet.'}</p>
    {show && <>
      <pre className="sy-code">{snippet(origin, s.service_key)}</pre>
      <div className="row"><button className="btn btn-secondary btn-sm" onClick={async () => toast(await copyText(snippet(origin, s.service_key)) ? 'Código copiado' : 'No se pudo copiar', 'success')}><Copy size={14} /> Copiar</button><button className="btn btn-ghost btn-sm" onClick={rotate}><KeyRound size={14} /> Cambiar llave</button></div>
    </>}
  </section>;
}

// ─── Suspender, reactivar o dar de baja ───
const REASONS: Record<'suspendido' | 'baja', string[]> = { suspendido: ['Falta de pago', 'Lo pidió el cliente', 'Uso indebido'], baja: ['Cerró el negocio', 'Se pasó a otro sistema', 'Falta de pago'] };
function EstadoModal({ s, to, owed, onClose }: { s: Sistema; to: SysStatus; owed: number; onClose: () => void }) {
  const off = to === 'suspendido' || to === 'baja';
  const [reason, setReason] = useState(off && owed ? 'Falta de pago' : ''), [msg, setMsg] = useState(to === 'baja' ? 'Este servicio fue dado de baja. Escribinos si querés volver.' : 'Tu servicio está pausado. Escribinos a MYB Digitals para reactivarlo.');
  const [busy, setBusy] = useState(false);
  const title = to === 'suspendido' ? `Suspender ${s.name}` : to === 'baja' ? `Dar de baja ${s.name}` : `Reactivar ${s.name}`;
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await post('sistema-estado', { id: s.id, status: to, reason: reason.trim(), message: msg.trim() });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast(to === 'activo' ? 'Reactivado' : to === 'suspendido' ? 'Suspendido' : 'Dado de baja'); reload('sistemas'); reload('sistema_registro'); onClose();
  };
  return <Modal title={title} onClose={onClose}><form className="ff" onSubmit={save}>
    <p className="help">{to === 'suspendido' ? 'Su panel y su app se cortan. No se pierde nada.' : to === 'baja' ? 'Deja de cobrarse y su app se corta.' : 'Su panel y su app vuelven a andar.'}</p>
    {off && <><Field label="Motivo"><input className="input" required maxLength={300} value={reason} onChange={e => setReason(e.target.value)} /></Field>
      <div className="chips">{REASONS[to as 'baja'].map(r => <button type="button" key={r} className={reason === r ? 'on' : ''} onClick={() => setReason(r)}>{r}</button>)}</div>
      <Field label="Lo que ve en su app" help={`${msg.length} de 300`}><textarea className="textarea" rows={3} maxLength={300} value={msg} onChange={e => setMsg(e.target.value)} /></Field></>}
    <div className="x-modal-f in"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={busy || (off && !reason.trim())}>{busy ? 'Guardando…' : to === 'activo' ? 'Reactivar' : to === 'suspendido' ? 'Suspender ahora' : 'Dar de baja'}</button></div>
  </form></Modal>;
}

// ─── Cobrar uno o varios meses: entra a Plata y queda en el sistema, todo junto ───
function CobroModal({ s, onClose }: { s: Sistema; onClose: () => void }) {
  const pagos = useTable<SysPago>('sistema_pagos').rows, funds = useTable<Fund>('funds').rows;
  const open = useMemo(() => {
    const unpaid = monthsOf(s, pagos).filter(m => !m.pago).map(m => m.period);
    let p = unpaid.length ? nextPeriod(unpaid[unpaid.length - 1]) : nextPeriod(periodOf(Date.now()));
    const paid = new Set(pagos.filter(x => x.sistema_id === s.id).map(x => x.period));
    const out = [...unpaid];
    for (let i = 0; out.length < unpaid.length + 3 && i < 24; i++, p = nextPeriod(p)) if (!paid.has(p) && p >= s.bill_from) out.push(p);
    return [...new Set(out)].sort();
  }, [s, pagos]);
  const [pick, setPick] = useState<string[]>(() => { const late = open.filter(p => dueOf(p, s.bill_day) < Date.now()); return late.length ? late : open.slice(0, 1); });
  const [each, setEach] = useState(s.price), [at, setAt] = useState(Date.now()), [account, setAccount] = useState(localStorage.getItem('myb_cuenta') || ''), [free, setFree] = useState(false), [busy, setBusy] = useState(false);
  const total = free ? 0 : each * pick.length, cur: SvcCurrency = s.currency;
  const splits = total > 0 ? splitIncome(total, cur, funds) : [];
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!pick.length || (!free && !(each > 0))) return;
    setBusy(true);
    const mid = total > 0 ? crypto.randomUUID() : null;
    if (account) localStorage.setItem('myb_cuenta', account);
    const mv: Partial<Movement> = { id: mid!, kind: 'ingreso', amount: total, currency: cur, date: at, concept: `Abono ${pick.map(periodShort).join(', ')}, ${s.name}`, category: 'Abono mensual', account, splits, client_id: s.client_id };
    const err = await saveAll([...(mid ? [insertOp('movements', mv)] : []), ...pick.map(p => insertOp('sistema_pagos', { sistema_id: s.id, period: p, amount: free ? 0 : each, currency: cur, paid_at: at, method: free ? 'Bonificado' : account, movement_id: mid }))]);
    setBusy(false);
    if (err) return toast('No se pudo guardar: ' + err, 'error');
    toast(free ? 'Bonificado' : `Cobrado: ${money(total, cur)}`); reload('sistema_registro'); onClose();
  };
  return <Modal title={`Cobrar a ${s.name}`} onClose={onClose}><form className="ff" onSubmit={save}>
    <div className="f" role="group" aria-label="Meses"><span>Qué meses paga</span><div className="sy-pick">{open.map(p => { const late = dueOf(p, s.bill_day) < Date.now(), on = pick.includes(p); return <button type="button" key={p} className={`${on ? 'on' : ''}${late ? ' late' : ''}`} aria-pressed={on} onClick={() => setPick(x => on ? x.filter(y => y !== p) : [...x, p].sort())}>{periodLabel(p)}{late && <em>vencido</em>}</button>; })}</div></div>
    <Seg label="Tipo" value={free ? 'free' : 'pay'} options={[['pay', 'Pagó'], ['free', 'Bonificado']]} onChange={x => setFree(x === 'free')} />
    {!free && <div className="g2"><Field label="Por mes"><Num label="Por mes" prefix={cur === 'USD' ? 'US$' : '$'} value={each} onChange={setEach} /></Field><Field label="Cuándo"><DateIn label="Cuándo" value={at} onChange={t => t && setAt(t)} /></Field></div>}
    {!free && <Field label="Dónde entró"><input className="input" list="sy-cuentas" value={account} onChange={e => setAccount(e.target.value)} placeholder="Mercado Pago" /><datalist id="sy-cuentas">{ACCOUNTS.map(x => <option key={x} value={x} />)}</datalist></Field>}
    <p className="help">{pick.length === 0 ? 'Elegí al menos un mes.' : free ? `${pick.length === 1 ? 'Ese mes queda' : 'Esos meses quedan'} sin cargo y no entra plata.` : `Total ${money(total, cur)}. Entra a Plata.`}</p>
    <div className="x-modal-f in"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={busy || !pick.length || (!free && !(each > 0))}>{busy ? 'Guardando…' : free ? 'Bonificar' : 'Registrar cobro'}</button></div>
  </form></Modal>;
}

// ─── Rubro y sistema: se eligen tocando, con precios del catálogo de Servicios ───
const ICON: Record<string, typeof Scissors> = { 'Barbería': Scissors, 'Peluquería': Scissors, 'Estética': Sparkles, 'Restaurante': UtensilsCrossed, 'Cafetería': Coffee, 'Boliche': Music, 'Bar': Martini, 'Gimnasio': Dumbbell, 'Comercio': Store };
type Setter = (p: Partial<Sistema>) => void;
function RubroPicker({ d, set, isNew }: { d: Partial<Sistema>; set: Setter; isNew: boolean }) {
  const sys = useTable<Sistema>('sistemas').rows;
  const mine = [...new Set(sys.map(s => s.rubro).filter(r => r && !RUBROS.some(x => x.name === r)))];
  const names = [...RUBROS.map(r => r.name), ...mine];
  const [other, setOther] = useState(!!d.rubro && !names.includes(d.rubro));
  const pick = (name: string) => {
    setOther(false);
    // Uno nuevo copia precio y sistema del último negocio del mismo rubro
    const prev = isNew && !d.price ? sys.filter(s => s.rubro === name && s.price > 0).sort((a, b) => Number(b.created_at) - Number(a.created_at))[0] : null;
    set({ rubro: name, ...(prev ? { price: prev.price, currency: prev.currency, plan: d.plan || prev.plan } : {}) });
  };
  return <div className="f" role="group" aria-label="Rubro"><span>Rubro</span>
    <div className="sy-rub">{names.map(n => { const I = ICON[n] || Shapes; return <button type="button" key={n} className={d.rubro === n && !other ? 'on' : ''} aria-pressed={d.rubro === n && !other} onClick={() => pick(n)}><I size={18} />{n}</button>; })}
      <button type="button" className={other ? 'on' : ''} aria-pressed={other} onClick={() => { setOther(true); set({ rubro: '' }); }}><Plus size={18} />Otro</button></div>
    {other && <input className="input" autoFocus placeholder="Ej. Lavadero" aria-label="Otro rubro" value={d.rubro || ''} onChange={e => set({ rubro: e.target.value })} />}
  </div>;
}
function PlanPicker({ d, set }: { d: Partial<Sistema>; set: Setter }) {
  const services = useTable<Service & { id: string }>('services').rows;
  const r = RUBROS.find(x => x.name === d.rubro);
  const monthly = (s: Service) => s.prices?.find(p => p.period === 'mes' && p.amount > 0 && !p.optional);
  const catalog = services.filter(s => s.status !== 'pausado' && s.status !== 'idea' && monthly(s) && (!r || s.area === r.area || s.area === 'Todo rubro'));
  const parts = (d.plan || '').split(' + ').map(x => x.trim()).filter(Boolean);
  const toggle = (p: string) => set({ plan: (parts.includes(p) ? parts.filter(x => x !== p) : [...parts, p]).join(' + ') });
  return <div className="f" role="group" aria-label="Sistema"><span>Qué sistema tiene</span>
    {catalog.length > 0 && <div className="sy-cat">{catalog.map(s => { const m = monthly(s)!, on = d.plan === s.name; return <button type="button" key={s.id} className={on ? 'on' : ''} aria-pressed={on} onClick={() => set({ plan: s.name, price: m.amount, currency: m.currency })}><b>{s.name}</b><span>{money(m.amount, m.currency)} por mes</span></button>; })}</div>}
    {r && <div className="chips sy-plans">{r.plans.map(p => <button type="button" key={p} className={parts.includes(p) ? 'on' : ''} aria-pressed={parts.includes(p)} onClick={() => toggle(p)}>{p}</button>)}</div>}
    <input className="input" aria-label="Sistema" placeholder={r ? 'Tocá arriba o escribilo' : 'Elegí el rubro o escribilo'} value={d.plan || ''} onChange={e => set({ plan: e.target.value })} />
  </div>;
}

// ─── Alta y datos ───
function SysModal({ value, onClose, onSaved }: { value: Partial<Sistema>; onClose: () => void; onSaved: (id: string | null) => void }) {
  const sys = useTable<Sistema>('sistemas'), clients = useTable<ClientRow>('clients').rows;
  const [d, setD] = useState<Partial<Sistema>>(() => ({ rubro: '', currency: 'ARS', price: 0, bill_day: 10, grace_days: 5, bill_from: periodOf(Date.now()), owner: {}, links: [{ label: 'Panel del dueño', url: '' }], tags: [], ...value }));
  const [trial, setTrial] = useState(false), [tags, setTags] = useState((value.tags || []).join(', ')), [busy, setBusy] = useState(false);
  const set = (p: Partial<Sistema>) => setD(x => ({ ...x, ...p }));
  const links = d.links || [];
  const bad = links.some(l => l.url.trim() && !safeUrl(l.url));
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!d.name?.trim() || bad) return;
    setBusy(true);
    const body: Partial<Sistema> = {
      name: d.name.trim().slice(0, 120), rubro: (d.rubro || '').trim(), city: (d.city || '').trim(), plan: (d.plan || '').trim(), client_id: d.client_id || null,
      owner: { name: d.owner?.name?.trim() || '', whatsapp: d.owner?.whatsapp?.trim() || '', email: d.owner?.email?.trim() || '' },
      price: d.price || 0, currency: d.currency || 'ARS', bill_day: Math.min(28, Math.max(1, Number(d.bill_day) || 10)), bill_from: d.bill_from || periodOf(Date.now()), grace_days: Math.max(0, Number(d.grace_days) || 0),
      links: links.filter(l => l.url.trim()).map(l => ({ label: l.label.trim().slice(0, 60), url: safeUrl(l.url) })), tags: tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 12),
    };
    if (value.id) { const okk = await sys.update(value.id, body); setBusy(false); if (okk) { toast('Guardado'); reload('sistema_registro'); onSaved(null); } return; }
    const n = await sys.add({ ...body, ...(trial ? { trial: true } : {}) } as Partial<Sistema>);
    setBusy(false); if (n) { reload('sistema_registro'); onSaved(n.id); }
  };
  return <Modal title={value.id ? `Datos de ${value.name}` : 'Nuevo sistema'} onClose={onClose} wide><form className="ff" onSubmit={save}>
    <RubroPicker d={d} set={set} isNew={!value.id} />
    <div className="g2"><Field label="Nombre del negocio"><input className="input" required maxLength={120} value={d.name || ''} onChange={e => set({ name: e.target.value })} /></Field>
      <Field label="Ciudad"><input className="input" value={d.city || ''} onChange={e => set({ city: e.target.value })} /></Field></div>
    <PlanPicker d={d} set={set} />
    <div className="g2"><Field label="Abono por mes"><Num label="Abono por mes" prefix={d.currency === 'USD' ? 'US$' : '$'} value={d.price || 0} onChange={n => set({ price: n })} /></Field>
      <Field label="Moneda"><Seg label="Moneda" value={d.currency || 'ARS'} options={[['ARS', 'Pesos'], ['USD', 'Dólares']]} onChange={c => set({ currency: c })} /></Field></div>
    <div className="g3"><Field label="Día de cobro"><input className="input" type="number" min={1} max={28} value={d.bill_day || ''} onChange={e => set({ bill_day: Number(e.target.value) })} /></Field>
      <Field label="Primer mes a cobrar"><input className="input" type="month" value={d.bill_from || ''} onChange={e => set({ bill_from: e.target.value })} /></Field>
      <Field label="Días de gracia" help="Después, se marca para suspender"><input className="input" type="number" min={0} max={60} value={d.grace_days ?? 5} onChange={e => set({ grace_days: Number(e.target.value) })} /></Field></div>
    <div className="g3"><Field label="Dueño o encargado"><input className="input" value={d.owner?.name || ''} onChange={e => set({ owner: { ...d.owner, name: e.target.value } })} /></Field>
      <Field label="WhatsApp"><input className="input" inputMode="tel" value={d.owner?.whatsapp || ''} placeholder="351 555 1234" onChange={e => set({ owner: { ...d.owner, whatsapp: e.target.value } })} /></Field>
      <Field label="Email"><input className="input" type="email" value={d.owner?.email || ''} onChange={e => set({ owner: { ...d.owner, email: e.target.value } })} /></Field></div>
    <div className="f" role="group" aria-label="Accesos"><span>Accesos</span>
      {links.map((l, i) => <div className="sy-add" key={i}><input className="input" placeholder="Panel del dueño" aria-label="Nombre del acceso" value={l.label} onChange={e => set({ links: links.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} /><input className={`input${l.url.trim() && !safeUrl(l.url) ? ' bad' : ''}`} placeholder="https://…" aria-label="Dirección" value={l.url} onChange={e => set({ links: links.map((x, j) => j === i ? { ...x, url: e.target.value } : x) })} /><button type="button" className="btn btn-ghost btn-icon" aria-label="Sacar acceso" onClick={() => set({ links: links.filter((_, j) => j !== i) })}><X size={15} /></button></div>)}
      <button type="button" className="btn btn-ghost btn-sm sy-more" onClick={() => set({ links: [...links, { label: '', url: '' }] })}><Plus size={14} /> Otro acceso</button>
      {bad && <small>Hay una dirección que no es una web válida.</small>}</div>
    <div className="g2"><Field label="Etiquetas" help="Separadas por coma"><input className="input" value={tags} placeholder="España, 2 sedes" onChange={e => setTags(e.target.value)} /></Field>
      <Field label="Cliente en Clientes"><select className="select" value={d.client_id || ''} onChange={e => set({ client_id: e.target.value || null })}><option value="">Ninguno</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></div>
    {!value.id && <label className="sy-check"><input type="checkbox" checked={trial} onChange={e => setTrial(e.target.checked)} /> Empieza en prueba, sin cobrar</label>}
    <div className="x-modal-f in"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={busy || bad}>{busy ? 'Guardando…' : 'Guardar'}</button></div>
  </form></Modal>;
}
