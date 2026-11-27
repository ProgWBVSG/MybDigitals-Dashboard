// Planificación: datos compartidos por Hoy y Semana, y las ventanas para cargar tareas y objetivos.
import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { PEOPLE, saveAll, updateOp, useTable, type Op, type Person, type Row } from './base';
import { toast, useExchangeRate } from './hooks';
import { useQueue } from './Mensajes';
import { money } from './services';
import {
  addDays, daysTo, duesOf, fromYmd, METRICS, objectiveNow, objValue, pace, plural, when, worksOf, ymd,
  type Agreement, type Bill, type ClientRow, type Movement, type Objective, type PlanDay, type PlanItem, type PlanWeek,
} from './negocio';
import { Bar, DateIn, Field, Group, Modal, Num, Seg } from './ui';

export interface Alert { key: string; title: string; sub: string; hot: boolean; to: string; rank: number; client_id?: string | null; agreement_id?: string | null; first: string }
interface KTask extends Row { title: string; due_date: number | null; column_id: string; board_id: string }
interface KBoard extends Row { columns: { id: string; name: string }[] }

export function usePlan() {
  const items = useTable<PlanItem>('plan_items'), days = useTable<PlanDay>('plan_days'), weeks = useTable<PlanWeek>('plan_weeks'), objs = useTable<Objective>('objectives');
  const ags = useTable<Agreement>('agreements'), clients = useTable<ClientRow>('clients'), bills = useTable<Bill>('bills'), moves = useTable<Movement>('movements');
  const tasks = useTable<KTask>('tasks'), boards = useTable<KBoard>('boards');
  const rate = useExchangeRate();
  const { queue } = useQueue();
  const name = (id: string | null) => clients.rows.find(c => c.id === id)?.name || 'el cliente';

  const alerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [];
    for (const a of ags.rows) {
      for (const w of worksOf(a)) {
        if (w.phase.done_at || w.phase.due_at == null) continue;
        const n = daysTo(w.phase.due_at);
        if (n <= 4) out.push({ key: 'f' + w.phase.id, title: `${w.phase.name} de ${name(a.client_id)}`, sub: n < 0 ? `Le debemos esta entrega: venció ${when(w.phase.due_at)}` : `La prometimos para ${when(w.phase.due_at)}`, hot: n <= 1, to: `clients/${a.client_id}`, rank: n < 0 ? 0 : 3 + n, client_id: a.client_id, agreement_id: a.id, first: 'Abrí el proyecto y anotá las tres cosas que faltan para entregarla.' });
      }
      for (const d of duesOf(a)) if (d.state === 'vencido') out.push({ key: 'd' + d.key, title: `Cobrarle a ${name(a.client_id)}`, sub: `${d.label}: ${money(d.left, a.currency)}, venció ${when(d.due_at!)}`, hot: true, to: `clients/${a.client_id}`, rank: 1, client_id: a.client_id, agreement_id: a.id, first: 'Mandale el mensaje que ya está escrito en su ficha.' });
    }
    for (const b of bills.rows) { const n = daysTo(b.due_at); if (b.active && n <= 2) out.push({ key: 'b' + b.id, title: `Pagar ${b.name}`, sub: `${money(b.amount, b.currency)}, ${n < 0 ? 'venció' : 'vence'} ${when(b.due_at)}`, hot: n <= 0, to: 'plata', rank: 2, first: 'Entrá a Plata, pagalo y marcalo.' }); }
    const hot = queue.filter(q => q.hot).length;
    if (queue.length) out.push({ key: 'mensajes', title: `Mandar ${plural(queue.length, 'mensaje', 'mensajes')}`, sub: hot ? `${hot} de cobros y entregas` : 'Ya están escritos', hot: hot > 0, to: 'mensajes', rank: hot ? 2 : 8, first: 'Entrá a Mensajes y tocá Enviar en el primero.' });
    return out.sort((a, b) => a.rank - b.rank);
  }, [ags.rows, clients.rows, bills.rows, queue]);

  const kanban = useMemo(() => tasks.rows.filter(t => t.due_date && daysTo(t.due_date) <= 3 && !/complet|hecho|listo/i.test(boards.rows.find(b => b.id === t.board_id)?.columns.find(c => c.id === t.column_id)?.name || '')), [tasks.rows, boards.rows]);
  const active = useMemo(() => objs.rows.filter(o => o.status === 'activo').sort((a, b) => a.sort - b.sort || Number(a.created_at) - Number(b.created_at)), [objs.rows]);
  const progress = (o: Objective) => { const n = objectiveNow(o, moves.rows, ags.rows, rate); return { n, ...pace(o, n) }; };
  return { items, days, weeks, objs, active, alerts, kanban, progress, ags, clients, ready: items.ready && objs.ready && ags.ready && clients.ready, name };
}
export type Plan = ReturnType<typeof usePlan>;
export const isMine = (o: { owner: string }, p: Person) => o.owner === p || o.owner === 'ambos';
export const byOrder = (a: PlanItem, b: PlanItem) => Number(b.top) - Number(a.top) || (a.level === b.level ? 0 : a.level === 'clave' ? -1 : 1) || a.sort - b.sort || Number(a.created_at) - Number(b.created_at);
export const hours = (m: number) => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
/** Sólo una tarea por persona y día puede ser la más importante. */
export const topOps = (all: PlanItem[], id: string, owner: Person, date: string): Op[] => all.filter(x => x.top && x.id !== id && x.owner === owner && x.date === date).map(x => updateOp('plan_items', x.id, { top: false }));

// ─── Tarea ───
export function ItemModal({ value, plan, onClose }: { value: Partial<PlanItem>; plan: Plan; onClose: () => void }) {
  const [f, setF] = useState<Partial<PlanItem>>({ title: '', date: ymd(), owner: 'benja', objective_id: null, level: 'clave', top: false, minutes: 45, when_then: '', first_step: '', ...value });
  const set = (p: Partial<PlanItem>) => setF(x => ({ ...x, ...p }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = f.id || crypto.randomUUID();
    const body = { ...f, id, title: f.title!.trim(), moved: f.id && value.date && value.date !== f.date ? (f.moved || 0) + 1 : f.moved || 0 };
    const err = await saveAll([...(f.top ? topOps(plan.items.rows, id, f.owner!, f.date!) : []), { table: 'plan_items', op: 'upsert', body }]);
    if (err) toast('No se pudo guardar: ' + err, 'error'); else onClose();
  };
  return <Modal title={f.id ? 'Tarea' : 'Nueva tarea'} onClose={onClose}><form className="ff" onSubmit={save}>
    <Field label="Qué vas a hacer" help="Empezá con un verbo: terminar, mandar, llamar"><input className="input" required autoFocus value={f.title} onChange={e => set({ title: e.target.value })} /></Field>
    <Field label="Para qué sirve"><select className="select" value={f.objective_id || ''} onChange={e => set({ objective_id: e.target.value || null })}><option value="">Sin objetivo</option>{plan.active.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}</select></Field>
    <div className="g2">
      <Field label="Día"><DateIn label="Día" value={f.date ? fromYmd(f.date) : null} onChange={t => t && set({ date: ymd(t) })} /></Field>
      <Group label="Quién"><Seg value={f.owner!} options={[['benja', 'Benjamín'], ['mati', 'Matías']]} onChange={o => set({ owner: o })} /></Group>
    </div>
    <Group label="Cuánto lleva"><Seg value={String(f.minutes)} options={[['15', '15 min'], ['30', '30'], ['45', '45'], ['60', '1 h'], ['90', '1 h 30'], ['120', '2 h']]} onChange={m => set({ minutes: Number(m) })} /></Group>
    <Field label="Cuándo y dónde arrancás" help="Decidirlo antes hace mucho más probable que pase"><input className="input" value={f.when_then} placeholder="Cuando termine el café, en el escritorio" onChange={e => set({ when_then: e.target.value })} /></Field>
    <Field label="Primer paso, de cinco minutos"><input className="input" value={f.first_step} placeholder="Abrir el archivo y escribir el título" onChange={e => set({ first_step: e.target.value })} /></Field>
    <label className="ck"><input type="checkbox" checked={!!f.top} onChange={e => set({ top: e.target.checked, level: e.target.checked ? 'clave' : f.level })} /><span>Es lo más importante del día</span></label>
    <label className="ck"><input type="checkbox" checked={f.level === 'extra'} disabled={!!f.top} onChange={e => set({ level: e.target.checked ? 'extra' : 'clave' })} /><span>Sólo si sobra tiempo</span></label>
    <div className="x-modal-f in">{f.id && <button type="button" className="btn btn-ghost" onClick={async () => { if (await plan.items.remove(f.id!)) onClose(); }}><Trash2 size={15} /> Borrar</button>}<span /><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary">Guardar</button></div>
  </form></Modal>;
}

// ─── Objetivo ───
export function ObjectiveModal({ value, plan, onClose, onSaved }: { value: Partial<Objective>; plan: Plan; onClose: () => void; onSaved?: (id: string) => void }) {
  const [f, setF] = useState<Partial<Objective>>({ title: '', why: '', what_for: '', obstacle: '', plan_b: '', owner: 'ambos', metric: 'manual', unit: '', currency: 'ARS', start: 0, current: 0, target: 0, start_at: Date.now(), due_at: addDays(Date.now(), 90), status: 'activo', sort: plan.objs.rows.length, ...value });
  const set = (p: Partial<Objective>) => setF(x => ({ ...x, ...p }));
  const isMoney = f.metric === 'ingresos' || f.metric === 'abonos' || f.metric === 'caja';
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.id) { if (await plan.objs.update(f.id, f)) onClose(); return; }
    const start = f.metric === 'caja' || f.metric === 'abonos' ? plan.progress({ ...f, id: 'x' } as Objective).n : f.metric === 'manual' ? f.current || 0 : 0;
    const r = await plan.objs.add({ ...f, start }); if (r) { onSaved?.(r.id); onClose(); }
  };
  return <Modal title={f.id ? 'Objetivo' : 'Nuevo objetivo'} onClose={onClose} wide><form className="ff" onSubmit={save}>
    <Field label="Qué quieren lograr"><input className="input" required autoFocus value={f.title} placeholder="Diez barberías con el sistema" onChange={e => set({ title: e.target.value })} /></Field>
    <Field label="Por qué les importa de verdad" help="No la respuesta linda: la que los hace levantarse"><textarea className="textarea" required rows={2} value={f.why} onChange={e => set({ why: e.target.value })} /></Field>
    <Field label="Qué cambia en sus vidas cuando lo logren"><textarea className="textarea" rows={2} value={f.what_for} onChange={e => set({ what_for: e.target.value })} /></Field>
    <div className="g3">
      <Field label="Cómo se mide"><select className="select" value={f.metric} onChange={e => set({ metric: e.target.value as Objective['metric'] })}>{Object.entries(METRICS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      <Field label="Llegar a"><Num label="Llegar a" prefix={isMoney ? (f.currency === 'USD' ? 'US$' : '$') : undefined} value={f.target!} onChange={n => set({ target: n })} /></Field>
      {f.metric === 'manual' ? <Field label="Van en"><Num label="Van en" value={f.current!} onChange={n => set({ current: n })} /></Field> : isMoney ? <Group label="Moneda"><Seg value={f.currency!} options={[['ARS', 'Pesos'], ['USD', 'Dólares']]} onChange={c => set({ currency: c })} /></Group> : <span />}
      {f.metric === 'manual' && <Field label="Qué se cuenta"><input className="input" value={f.unit} placeholder="clientes, videos, reuniones" onChange={e => set({ unit: e.target.value })} /></Field>}
      <Field label="Para cuándo"><DateIn label="Para cuándo" value={f.due_at!} onChange={t => set({ due_at: t })} /></Field>
      <Group label="De quién"><Seg value={f.owner!} options={[['ambos', 'Los dos'], ['benja', 'Benjamín'], ['mati', 'Matías']]} onChange={o => set({ owner: o })} /></Group>
    </div>
    <div className="g2">
      <Field label="Qué los puede frenar"><input className="input" value={f.obstacle} placeholder="Nos dispersamos con ideas nuevas" onChange={e => set({ obstacle: e.target.value })} /></Field>
      <Field label="Si pasa, entonces"><input className="input" value={f.plan_b} placeholder="la anotamos en Ideas y seguimos" onChange={e => set({ plan_b: e.target.value })} /></Field>
    </div>
    <div className="x-modal-f in">{f.id && <><button type="button" className="btn btn-ghost" onClick={async () => { if (confirm('¿Borrar este objetivo? Sus tareas quedan sin objetivo.') && await plan.objs.remove(f.id!)) onClose(); }}><Trash2 size={15} /> Borrar</button>{f.status === 'activo' && <button type="button" className="btn btn-ghost" onClick={async () => { if (await plan.objs.update(f.id!, { status: 'soltado' })) onClose(); }}>Soltar</button>}</>}<span /><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary">Guardar</button></div>
  </form></Modal>;
}

export function ObjectiveCard({ o, plan, onOpen, full }: { o: Objective; plan: Plan; onOpen?: () => void; full?: boolean }) {
  const p = plan.progress(o);
  const reach = p.pct >= 1;
  return <article className={`ob${full ? ' full' : ''}`}>
    <button className="ob-t" onClick={onOpen} disabled={!onOpen}><b>{o.title}</b>{o.owner !== 'ambos' && <em>{PEOPLE[o.owner]}</em>}</button>
    {full && o.why && <p className="ob-w">{o.why}</p>}
    {o.target > 0 && <><Bar pct={p.pct * 100} label={`${Math.round(p.pct * 100)} %`} /><div className="ob-n"><span>{o.metric === 'manual' || o.metric === 'clientes' ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(p.n) : objValue(o, p.n)} de {objValue(o, o.target)}</span><span>{o.due_at ? when(o.due_at) : ''}</span></div></>}
    {reach ? <p className="ob-p">Llegaron.</p> : p.perWeek != null && o.target > 0 && <p className="ob-p">{p.behind ? 'Vienen atrás. ' : 'Vienen bien. '}Hace falta {objValue(o, Math.ceil(p.perWeek * 10) / 10)} por semana.</p>}
    {full && o.what_for && <p className="ob-x">Para qué: {o.what_for}</p>}
    {full && o.obstacle && <p className="ob-x">Si {o.obstacle[0].toLowerCase() + o.obstacle.slice(1)}{o.plan_b ? `, ${o.plan_b}` : ''}.</p>}
    {full && o.metric === 'manual' && o.status === 'activo' && <div className="ob-f"><span>Van en</span><Num label={`Avance de ${o.title}`} value={o.current} onChange={n => { plan.objs.update(o.id, { current: n }); }} /></div>}
    {full && reach && o.status === 'activo' && <button className="btn btn-primary btn-sm" onClick={async () => { if (await plan.objs.update(o.id, { status: 'logrado' })) toast('Objetivo logrado'); }}>Marcar logrado</button>}
  </article>;
}
