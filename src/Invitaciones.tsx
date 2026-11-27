import { useMemo, useState } from 'react';
import { ArrowLeft, Baby, Building2, Cake, Crown, ExternalLink, GraduationCap, Heart, MessageCircle, Pencil, Plus, Search, Star, Trash2, Undo2 } from 'lucide-react';
import { deleteOp, insertOp, PEOPLE, post, reload, saveAll, updateOp, useTable } from './base';
import { toast } from './hooks';
import { norm } from './sheetImport';
import { money } from './services';
import { ACCOUNTS } from './plataTxt';
import { addDays, both, fDate, purse, splitIncome, waNumber, when, type Fund, type Movement } from './negocio';
import { Bar, DateIn, Empty, Field, Modal, Num, Seg } from './ui';
import { useSub } from './rutas';
import { safeUrl, type SysLog } from './sistemaReglas';
import { daysFrom, DURATIONS, EVENTS, INV_HEALTH, STYLES, viewInv, type Invitacion, type InvView } from './invReglas';
import './sistemas.css';

const T = 'invitaciones';
const WEB = 'https://www.mybinvite.com/i/';
/** Acepta el link entero o sólo el nombre del link (sofi-y-juan). */
const fullUrl = (raw: string) => { const t = raw.trim(); return /^[a-z0-9-]+$/i.test(t) ? WEB + t.toLowerCase() : t; };
const slugOf = (url: string) => { try { const p = new URL(url).pathname.split('/').filter(Boolean); const k = p.indexOf('i'); return k >= 0 ? p[k + 1] || '' : ''; } catch { return ''; } };
const ICON: Record<string, typeof Heart> = { 'Casamiento': Heart, 'XV': Crown, 'Cumpleaños': Cake, 'Bautismo': Baby, 'Bar Mitzvá': Star, 'Egresados': GraduationCap, 'Empresa': Building2 };
const who = (by: string) => PEOPLE[by as 'benja'] || '';
type Filter = 'todas' | 'baja_ya' | 'deben' | 'proximas' | 'baja';
const FILTERS: [Filter, string, (v: InvView) => boolean][] = [
  ['todas', 'Todas', v => v.health !== 'baja'], ['baja_ya', 'Para dar de baja', v => v.health === 'vencida'], ['deben', 'Deben', v => v.owe > 0 && v.health !== 'baja'],
  ['proximas', 'Próximos 30 días', v => v.health !== 'baja' && !!v.i.event_date && daysFrom(v.i.event_date) >= 0 && daysFrom(v.i.event_date) <= 30], ['baja', 'De baja', v => v.health === 'baja'],
];
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };

export default function Invitaciones() {
  const inv = useTable<Invitacion>(T);
  const [sub, go] = useSub();
  const [q, setQ] = useState(''), [f, setF] = useState<Filter>('todas'), [ev, setEv] = useState('');
  const [edit, setEdit] = useState<Partial<Invitacion> | null>(null), [cobrar, setCobrar] = useState<Invitacion | null>(null);
  const views = useMemo(() => inv.rows.map(i => viewInv(i)).sort((a, b) => INV_HEALTH[a.health].rank - INV_HEALTH[b.health].rank || (a.i.event_date || 9e15) - (b.i.event_date || 9e15)), [inv.rows]);
  if (!inv.ready) return <div className="view-load"><div className="spinner-lg" /></div>;

  const modal = <>
    {edit && <InvModal value={edit} onClose={() => setEdit(null)} onSaved={id => { setEdit(null); if (id) go(id); }} />}
    {cobrar && <CobroInv i={cobrar} onClose={() => setCobrar(null)} />}
  </>;
  const open = sub ? views.find(v => v.i.id === sub) : null;
  if (open) return <><Detail v={open} onBack={() => go('')} onEdit={() => setEdit(open.i)} onCobrar={() => setCobrar(open.i)} />{modal}</>;
  if (!inv.rows.length) return <><Empty title="Cargá la primera invitación" text="Quién es, cuánto pagó, hasta cuándo queda online y el botón para darla de baja."><button className="btn btn-primary" onClick={() => setEdit({})}><Plus size={17} /> Nueva invitación</button></Empty>{modal}</>;

  const live = views.filter(v => v.health !== 'baja');
  const owed = purse(), month = purse(), from = monthStart();
  live.forEach(v => { owed[v.i.currency] += v.owe; });
  inv.rows.forEach(i => (i.pagos || []).forEach(p => { if (p.at >= from) month[i.currency] += p.amount; }));
  const events = [...new Set(inv.rows.map(i => i.event).filter(Boolean))];
  const t = norm(q);
  const rows = views.filter(v => FILTERS.find(x => x[0] === f)![2](v) && (!ev || v.i.event === ev) && (!t || norm([v.i.name, v.i.event, v.i.style, v.i.contact?.name, v.i.contact?.whatsapp].join(' ')).includes(t)));
  const due = views.filter(v => v.health === 'vencida').length;

  return (
    <div>
      <div className="page-head"><div><h1>Invitaciones</h1><p>{live.length} online{due ? `, ${due === 1 ? 'una para dar de baja' : due + ' para dar de baja'}` : ''}</p></div><button className="btn btn-primary" onClick={() => setEdit({})}><Plus size={17} /> Nueva invitación</button></div>
      <div className="cl-top">
        <div><span>Online</span><b>{live.length}</b></div><div><span>Nos deben</span><b>{both(owed)}</b></div>
        <div><span>Cobrado este mes</span><b>{both(month)}</b></div><div><span>Para dar de baja</span><b>{due}</b></div>
      </div>
      <div className="cl-f"><div className="search-bar"><Search size={16} /><input placeholder="Buscar nombre, estilo o contacto" aria-label="Buscar" value={q} onChange={e => setQ(e.target.value)} /></div>
        {events.length > 1 && <select className="select" aria-label="Evento" value={ev} onChange={e => setEv(e.target.value)}><option value="">Todos los eventos</option>{events.map(x => <option key={x}>{x}</option>)}</select>}
        <div className="chips">{FILTERS.map(([k, l, test]) => { const n = views.filter(test).length; return (k === 'todas' || n > 0) && <button key={k} className={f === k ? 'on' : ''} aria-pressed={f === k} onClick={() => setF(k)}>{l} <em>{n}</em></button>; })}</div></div>
      <div className="cl-list">{rows.length === 0 ? <p className="sv-none">Ninguna con ese filtro.</p> : rows.map(v => <Item key={v.i.id} v={v} onOpen={() => go(v.i.id)} onCobrar={() => setCobrar(v.i)} />)}</div>
      {modal}
    </div>
  );
}

function Item({ v, onOpen, onCobrar }: { v: InvView; onOpen: () => void; onCobrar: () => void }) {
  const h = INV_HEALTH[v.health], i = v.i, link = safeUrl(i.url), w = waNumber(i.contact?.whatsapp);
  return <article className={`cl sy${h.hot ? ' hot' : ''}`}>
    <button className="cl-m" onClick={onOpen}><b>{i.name}</b><span>{[i.event, i.style, i.event_date && fDate(i.event_date)].filter(Boolean).join(', ')}</span></button>
    <button className="cl-s" onClick={onOpen} tabIndex={-1}><em className={h.hot ? 'pill hot' : 'pill'}>{h.label}</em><span>{v.why}</span></button>
    <div className="cl-b"><span>{v.owe ? `${money(v.paid, i.currency)} de ${money(i.price, i.currency)}` : `${money(v.paid, i.currency)} pagado`}</span><Bar pct={i.price ? v.paid / i.price * 100 : 100} label={`Pagó ${money(v.paid, i.currency)} de ${money(i.price, i.currency)}`} /></div>
    <div className="sy-a">
      {v.owe > 0 && v.health !== 'baja' && <button className={`btn btn-sm ${h.hot ? 'btn-primary' : 'btn-secondary'}`} onClick={onCobrar}>Cobrar</button>}
      <a className={`btn btn-secondary btn-icon${link ? '' : ' dis'}`} href={link || undefined} target="_blank" rel="noopener noreferrer" aria-label={link ? `Abrir la invitación de ${i.name}` : 'Sin link'} title={link ? 'Abrir invitación' : 'Sin link'}><ExternalLink size={17} /></a>
      <a className={`btn btn-secondary btn-icon${w ? '' : ' dis'}`} href={w ? `https://wa.me/${w}` : undefined} target="myb-whatsapp" rel="noreferrer" aria-label={w ? `WhatsApp de ${i.name}` : 'Sin WhatsApp'} title={w ? 'WhatsApp' : 'Sin WhatsApp'}><MessageCircle size={17} /></a>
    </div>
  </article>;
}

// ─── Ficha ───
function Detail({ v, onBack, onEdit, onCobrar }: { v: InvView; onBack: () => void; onEdit: () => void; onCobrar: () => void }) {
  const inv = useTable<Invitacion>(T), logs = useTable<SysLog>('sistema_registro');
  const i = v.i, h = INV_HEALTH[v.health], link = safeUrl(i.url), w = waNumber(i.contact?.whatsapp);
  const [baja, setBaja] = useState(false), [notes, setNotes] = useState(i.notes || '');
  const log = logs.rows.filter(l => l.sistema_id === i.id).sort((a, b) => b.at - a.at);
  const pagos = [...(i.pagos || [])].sort((a, b) => b.at - a.at);

  const undo = async (id: string) => {
    const p = i.pagos.find(x => x.id === id); if (!p || !confirm(`¿Deshacer el pago de ${money(p.amount, i.currency)}?${p.movement_id ? ' También sale de Plata.' : ''}`)) return;
    const e = await saveAll([updateOp(T, i.id, { pagos: i.pagos.filter(x => x.id !== id) }), ...(p.movement_id ? [deleteOp('movements', p.movement_id)] : [])]);
    if (e) toast('No se pudo: ' + e, 'error'); else { toast('Pago deshecho'); reload('sistema_registro'); }
  };
  const reactivate = async () => {
    if (!confirm(`¿Volver a poner online la invitación de ${i.name}?`)) return;
    const { error } = await post('sistema-estado', { id: i.id, table: T, status: 'activa' });
    if (error) toast(error.message, 'error'); else { toast('Online de nuevo'); reload(T); reload('sistema_registro'); }
  };
  const remove = async () => {
    if (prompt(`Para borrar la invitación de ${i.name}, escribí su nombre. Lo que entró a Plata queda.`)?.trim() !== i.name.trim()) return;
    if (await inv.remove(i.id)) { toast('Borrada. Queda en la papelera'); onBack(); }
  };

  return (
    <div className="cd">
      <button className="btn btn-ghost" onClick={onBack}><ArrowLeft size={17} /> Invitaciones</button>
      <div className="page-head"><div><h1>{i.name}</h1><p>{[i.event, i.style, i.contact?.name].filter(Boolean).join(', ')}</p></div>
        <div className="row"><button className="btn btn-ghost" onClick={onEdit}><Pencil size={16} /> Datos</button>{w && <a className="btn btn-secondary" href={`https://wa.me/${w}`} target="myb-whatsapp" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>}{link && <a className="btn btn-secondary" href={link} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Abrir</a>}</div></div>

      <div className={`cd-state sy-state${h.hot ? ' hot' : ''}`}>
        <div><b>{h.label}</b><span>{v.why}</span>{i.status === 'baja' && <small>De baja {when(i.status_at)}{i.status_by ? ` por ${who(i.status_by)}` : ''}</small>}</div>
        <div className="row">
          {i.status === 'activa' ? <button className={`btn btn-sm ${v.health === 'vencida' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setBaja(true)}>Dar de baja</button>
            : <><button className="btn btn-primary btn-sm" onClick={reactivate}>Volver a poner online</button><button className="btn btn-ghost btn-sm" onClick={remove}><Trash2 size={14} /> Borrar</button></>}
        </div>
      </div>
      <div className="cl-top">
        <div><span>Precio</span><b>{money(i.price, i.currency)}</b></div>
        <div><span>Debe</span><b>{v.owe ? money(v.owe, i.currency) : 'Nada'}</b></div>
        <div><span>Evento</span><b>{i.event_date ? fDate(i.event_date) : 'Sin fecha'}</b></div>
        <div><span>Online hasta</span><b>{i.ends_at ? fDate(i.ends_at) : 'Sin límite'}</b></div>
      </div>

      <div className="cd-cols">
        <div className="col">
          <section className="pn">
            <div className="pn-h"><div><h2>Pagos</h2><p>{v.owe ? `Pagó ${money(v.paid, i.currency)}, falta ${money(v.owe, i.currency)}` : 'Pagada completa'}</p></div>{v.owe > 0 && <button className={`btn btn-sm ${h.hot ? 'btn-primary' : 'btn-secondary'}`} onClick={onCobrar}>Cobrar</button>}</div>
            {pagos.length === 0 ? <p className="help">Sin pagos todavía.</p> : pagos.map(p => <div className="li" key={p.id}><div><b>{fDate(p.at)}</b><span>{p.method || 'Pago'}</span></div><em>{money(p.amount, i.currency)}</em><button className="btn btn-ghost btn-icon" title="Deshacer" aria-label="Deshacer pago" onClick={() => undo(p.id)}><Undo2 size={15} /></button></div>)}
          </section>
          <section className="pn"><h2>Notas</h2>
            <textarea className="textarea" rows={3} placeholder="Anotar algo" aria-label="Notas" value={notes} onChange={e => setNotes(e.target.value)} />
            {notes !== (i.notes || '') && <button className="btn btn-secondary btn-sm" onClick={async () => { if (await inv.update(i.id, { notes: notes.trim() })) { toast('Guardado'); reload('sistema_registro'); } }}>Guardar</button>}
          </section>
        </div>
        <div className="col">
          <section className="pn"><h2>En la web</h2><p className="help">{slugOf(link) ? `Conectada por su link: al darla de baja deja de verse en un minuto.` : 'Cargá su link en Datos para que la baja la apague en la web.'}</p></section>
          <section className="pn"><h2>Registro</h2>
            {log.length === 0 ? <p className="help">Sin cambios todavía.</p> : log.slice(0, 30).map(l => <div className="nt" key={l.id}><p>{l.detail}</p><small>{when(l.at)}, {fDate(l.at)}{l.by ? `, ${who(l.by)}` : ''}</small></div>)}
          </section>
        </div>
      </div>
      {baja && <BajaModal i={i} onClose={() => setBaja(false)} />}
    </div>
  );
}

function BajaModal({ i, onClose }: { i: Invitacion; onClose: () => void }) {
  const [reason, setReason] = useState(i.ends_at && i.ends_at < Date.now() ? 'Terminó su tiempo' : ''), [msg, setMsg] = useState('Esta invitación ya no está disponible.'), [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await post('sistema-estado', { id: i.id, table: T, status: 'baja', reason: reason.trim(), message: msg.trim() });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Dada de baja'); reload(T); reload('sistema_registro'); onClose();
  };
  return <Modal title={`Dar de baja ${i.name}`} onClose={onClose}><form className="ff" onSubmit={save}>
    <p className="help">La invitación deja de verse. Se puede volver a poner online.</p>
    <Field label="Motivo"><input className="input" maxLength={300} value={reason} onChange={e => setReason(e.target.value)} /></Field>
    <div className="chips">{['Terminó su tiempo', 'No pagó', 'Lo pidieron'].map(r => <button type="button" key={r} className={reason === r ? 'on' : ''} onClick={() => setReason(r)}>{r}</button>)}</div>
    <Field label="Lo que ve quien la abra"><textarea className="textarea" rows={2} maxLength={300} value={msg} onChange={e => setMsg(e.target.value)} /></Field>
    <div className="x-modal-f in"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Dar de baja'}</button></div>
  </form></Modal>;
}

// ─── Cobrar: entra a Plata y queda en la invitación, todo junto ───
function CobroInv({ i, onClose }: { i: Invitacion; onClose: () => void }) {
  const funds = useTable<Fund>('funds').rows;
  const owe = Math.max(0, i.price - (i.pagos || []).reduce((s, p) => s + p.amount, 0));
  const [amount, setAmount] = useState(owe), [at, setAt] = useState(Date.now()), [account, setAccount] = useState(localStorage.getItem('myb_cuenta') || ''), [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!(amount > 0)) return;
    setBusy(true);
    const mid = crypto.randomUUID();
    if (account) localStorage.setItem('myb_cuenta', account);
    const mv: Partial<Movement> = { id: mid, kind: 'ingreso', amount, currency: i.currency, date: at, concept: `Invitación ${i.name}`, category: 'Invitaciones', account, splits: splitIncome(amount, i.currency, funds), client_id: i.client_id };
    const err = await saveAll([insertOp('movements', mv), updateOp(T, i.id, { pagos: [...(i.pagos || []), { id: crypto.randomUUID(), at, amount, movement_id: mid, method: account }] })]);
    setBusy(false);
    if (err) return toast('No se pudo guardar: ' + err, 'error');
    toast(`Cobrado: ${money(amount, i.currency)}`); reload('sistema_registro'); onClose();
  };
  return <Modal title={`Cobrar a ${i.name}`} onClose={onClose}><form className="ff" onSubmit={save}>
    <div className="g2"><Field label="Cuánto pagó" help={amount < owe ? `Queda debiendo ${money(owe - amount, i.currency)}` : undefined}><Num label="Cuánto pagó" prefix={i.currency === 'USD' ? 'US$' : '$'} value={amount} onChange={setAmount} /></Field>
      <Field label="Cuándo"><DateIn label="Cuándo" value={at} onChange={x => x && setAt(x)} /></Field></div>
    <Field label="Dónde entró"><input className="input" list="inv-cuentas" value={account} onChange={e => setAccount(e.target.value)} placeholder="Mercado Pago" /><datalist id="inv-cuentas">{ACCOUNTS.map(x => <option key={x} value={x} />)}</datalist></Field>
    <div className="x-modal-f in"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={busy || !(amount > 0)}>{busy ? 'Guardando…' : 'Registrar cobro'}</button></div>
  </form></Modal>;
}

// ─── Alta y datos ───
const endOf = (t: number, days: number) => { const d = new Date(addDays(t, days)); d.setHours(23, 59, 0, 0); return d.getTime(); };
function InvModal({ value, onClose, onSaved }: { value: Partial<Invitacion>; onClose: () => void; onSaved: (id: string | null) => void }) {
  const inv = useTable<Invitacion>(T);
  const [d, setD] = useState<Partial<Invitacion>>(() => ({ event: 'Casamiento', price: 60, currency: 'USD', contact: {}, ...value }));
  const [dur, setDur] = useState<number | null>(() => value.id ? (value.event_date && value.ends_at ? DURATIONS.find(([, n]) => endOf(value.event_date!, n) === value.ends_at)?.[1] ?? null : null) : 30);
  const [other, setOther] = useState(!!value.event && !EVENTS.includes(value.event)), [busy, setBusy] = useState(false);
  const set = (p: Partial<Invitacion>) => setD(x => ({ ...x, ...p }));
  const ends = dur != null && d.event_date ? endOf(d.event_date, dur) : d.ends_at ?? null;
  const styles = [...new Set([...STYLES, ...inv.rows.map(i => i.style).filter(Boolean)])];
  const link = fullUrl(d.url || ''), bad = !!link && !safeUrl(link);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!d.name?.trim() || bad) return;
    setBusy(true);
    const body: Partial<Invitacion> = {
      name: d.name.trim().slice(0, 120), event: (d.event || '').trim(), event_date: d.event_date ?? null, ends_at: ends, style: (d.style || '').trim(), url: link ? safeUrl(link) : '',
      contact: { name: d.contact?.name?.trim() || '', whatsapp: d.contact?.whatsapp?.trim() || '', email: d.contact?.email?.trim() || '' }, price: d.price || 0, currency: d.currency || 'USD',
    };
    if (value.id) { const okk = await inv.update(value.id, body); setBusy(false); if (okk) { toast('Guardado'); reload('sistema_registro'); onSaved(null); } return; }
    const n = await inv.add(body); setBusy(false); if (n) { reload('sistema_registro'); onSaved(n.id); }
  };
  return <Modal title={value.id ? `Datos de ${value.name}` : 'Nueva invitación'} onClose={onClose} wide><form className="ff" onSubmit={save}>
    <div className="f" role="group" aria-label="Evento"><span>Evento</span>
      <div className="sy-rub">{EVENTS.map(n => { const I = ICON[n]; const on = d.event === n && !other; return <button type="button" key={n} className={on ? 'on' : ''} aria-pressed={on} onClick={() => { setOther(false); set({ event: n }); }}><I size={18} />{n}</button>; })}
        <button type="button" className={other ? 'on' : ''} aria-pressed={other} onClick={() => { setOther(true); set({ event: '' }); }}><Plus size={18} />Otro</button></div>
      {other && <input className="input" autoFocus placeholder="Ej. Aniversario" aria-label="Otro evento" value={d.event || ''} onChange={e => set({ event: e.target.value })} />}</div>
    <div className="g2"><Field label="Quién es"><input className="input" required maxLength={120} placeholder="Sofi y Juan" value={d.name || ''} onChange={e => set({ name: e.target.value })} /></Field>
      <Field label="Estilo"><input className="input" list="inv-estilos" value={d.style || ''} placeholder="Rosedal" onChange={e => set({ style: e.target.value })} /><datalist id="inv-estilos">{styles.map(s => <option key={s} value={s} />)}</datalist></Field></div>
    <div className="g2"><Field label="Fecha del evento"><DateIn label="Fecha del evento" value={d.event_date ?? null} onChange={t => set({ event_date: t })} /></Field>
      <Field label="Precio"><div className="row"><Num label="Precio" prefix={d.currency === 'USD' ? 'US$' : '$'} value={d.price || 0} onChange={n => set({ price: n })} /><Seg label="Moneda" value={d.currency || 'USD'} options={[['USD', 'US$'], ['ARS', '$']]} onChange={c => set({ currency: c })} /></div></Field></div>
    <div className="f" role="group" aria-label="Cuánto dura"><span>Cuánto queda online después del evento</span>
      <div className="chips sy-plans">{DURATIONS.map(([l, n]) => <button type="button" key={n} disabled={!d.event_date} className={dur === n ? 'on' : ''} aria-pressed={dur === n} onClick={() => setDur(n)}>{l}</button>)}<button type="button" className={dur == null ? 'on' : ''} aria-pressed={dur == null} onClick={() => { setDur(null); set({ ends_at: ends }); }}>Otra fecha</button></div>
      {dur == null ? <DateIn label="Online hasta" value={d.ends_at ?? null} onChange={t => set({ ends_at: t ? endOf(t, 0) : null })} /> : <small>{ends ? `Online hasta el ${fDate(ends)}` : 'Poné la fecha del evento'}</small>}</div>
    <div className="g3"><Field label="Contacto"><input className="input" value={d.contact?.name || ''} onChange={e => set({ contact: { ...d.contact, name: e.target.value } })} /></Field>
      <Field label="WhatsApp"><input className="input" inputMode="tel" placeholder="351 555 1234" value={d.contact?.whatsapp || ''} onChange={e => set({ contact: { ...d.contact, whatsapp: e.target.value } })} /></Field>
      <Field label="Email"><input className="input" type="email" value={d.contact?.email || ''} onChange={e => set({ contact: { ...d.contact, email: e.target.value } })} /></Field></div>
    <Field label="Link de la invitación" help={bad ? 'No es una dirección web válida' : link && link !== (d.url || '').trim() ? link : 'El link entero o sólo su nombre, ej. sofi-y-juan'}><input className={`input${bad ? ' bad' : ''}`} placeholder="sofi-y-juan" value={d.url || ''} onChange={e => set({ url: e.target.value })} /></Field>
    <div className="x-modal-f in"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={busy || bad}>{busy ? 'Guardando…' : 'Guardar'}</button></div>
  </form></Modal>;
}
