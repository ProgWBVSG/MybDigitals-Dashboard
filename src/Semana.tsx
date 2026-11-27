import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { PEOPLE, saveAll, updateOp, usePerson, useTable, type Person, type Row } from './base';
import { toast } from './hooks';
import { addDays, fDate, fDay, fromYmd, monday, plural, worksOf, ymd, type Objective, type PlanItem, type PlanWeek } from './negocio';
import { byOrder, hours, ItemModal, ObjectiveCard, ObjectiveModal, usePlan, type Plan } from './plan';
import { goTo, useSub } from './rutas';
import { Empty, Field, Seg } from './ui';

type Tab = 'semana' | 'objetivos' | 'repaso';
interface Ev extends Row { title: string; start_date: number }

export default function Semana() {
  const plan = usePlan(), me = usePerson();
  const [sub] = useSub();
  const tab: Tab = sub === 'objetivos' || sub === 'repaso' ? sub : 'semana';
  if (!plan.ready) return <div className="view-load"><div className="spinner-lg" /></div>;
  return <div>
    <div className="page-head"><div><h1>{tab === 'objetivos' ? 'Objetivos' : tab === 'repaso' ? 'Repaso de la semana' : 'Semana'}</h1></div>
      <Seg value={tab} onChange={t => goTo(t === 'semana' ? 'semana' : 'semana/' + t)} label="Vista" options={[['semana', 'Semana'], ['objetivos', 'Objetivos'], ['repaso', 'Repaso']]} /></div>
    {tab === 'semana' ? <Week plan={plan} me={me} /> : tab === 'objetivos' ? <Objectives plan={plan} /> : <Review plan={plan} me={me} key={me} />}
  </div>;
}

function Week({ plan, me }: { plan: Plan; me: Person }) {
  const [start, setStart] = useState(monday()), [who, setWho] = useState<Person | 'ambos'>(me), [edit, setEdit] = useState<Partial<PlanItem> | null>(null);
  const [adding, setAdding] = useState(''), [text, setText] = useState(''), [over, setOver] = useState('');
  const events = useTable<Ev>('calendar_events');
  const today = ymd(), wk = ymd(start), days = Array.from({ length: 7 }, (_, k) => ymd(addDays(start, k)));
  const row = plan.weeks.rows.find(w => w.owner === me && w.week === wk);
  const setWeek = (p: Partial<PlanWeek>) => row ? plan.weeks.update(row.id, p) : plan.weeks.add({ week: wk, owner: me, ...p });
  const add = async (date: string) => { const t = text.trim(); if (!t) { setAdding(''); return; } setText(''); await plan.items.add({ title: t, date, owner: who === 'ambos' ? me : who, objective_id: row?.objective_id || null, level: 'clave', sort: Date.now() % 1e9 }); };
  const drop = async (id: string, date: string) => {
    setOver(''); const i = plan.items.rows.find(x => x.id === id); if (!i || i.date === date) return;
    const e = await saveAll([updateOp('plan_items', id, { date, top: false, moved: i.date < date ? i.moved + 1 : i.moved })]); if (e) toast(e, 'error');
  };
  const promised = plan.ags.rows.flatMap(a => worksOf(a).filter(w => !w.phase.done_at && w.phase.due_at).map(w => ({ d: ymd(w.phase.due_at!), t: `${w.phase.name} de ${plan.name(a.client_id)}`, to: `clients/${a.client_id}` })));
  return <>
    <section className="pn wk-top">
      <Field label="Mi semana es un éxito si"><input className="input" key={wk + me + (row?.id || '')} defaultValue={row?.success || ''} placeholder="Una sola frase, que se pueda comprobar el domingo" onBlur={e => { if (e.target.value !== (row?.success || '')) setWeek({ success: e.target.value.trim() }); }} /></Field>
      <Field label="Objetivo de la semana"><select className="select" value={row?.objective_id || ''} onChange={e => setWeek({ objective_id: e.target.value || null })}><option value="">Elegir</option>{plan.active.filter(o => o.owner === me || o.owner === 'ambos').map(o => <option key={o.id} value={o.id}>{o.title}</option>)}</select></Field>
    </section>
    <div className="wk-bar"><div className="row"><button className="btn btn-secondary btn-icon" onClick={() => setStart(addDays(start, -7))} aria-label="Semana anterior"><ChevronLeft size={18} /></button><b>{fDate(start)} al {fDate(addDays(start, 6))}</b><button className="btn btn-secondary btn-icon" onClick={() => setStart(addDays(start, 7))} aria-label="Semana siguiente"><ChevronRight size={18} /></button>{wk !== ymd(monday()) && <button className="btn btn-ghost btn-sm" onClick={() => setStart(monday())}>Esta semana</button>}</div>
      <Seg value={who} onChange={setWho} label="De quién" options={[['benja', 'Benjamín'], ['mati', 'Matías'], ['ambos', 'Los dos']]} /></div>
    <div className="wk">{days.map(d => {
      const l = plan.items.rows.filter(i => i.date === d && (who === 'ambos' || i.owner === who)).sort(byOrder);
      const open = l.filter(i => !i.done_at), min = open.reduce((s, i) => s + i.minutes, 0), cap = who === 'ambos' ? 720 : 360;
      const ev = events.rows.filter(e => ymd(e.start_date) === d).sort((a, b) => a.start_date - b.start_date), pr = promised.filter(p => p.d === d);
      return <section key={d} className={`wd${d === today ? ' now' : ''}${d < today ? ' past' : ''}${over === d ? ' over' : ''}`} onDragOver={e => { e.preventDefault(); setOver(d); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(''); }} onDrop={e => { e.preventDefault(); drop(e.dataTransfer.getData('text/plain'), d); }}>
        <header><b>{fDay(fromYmd(d))}</b><span className={min > cap ? 'much' : ''}>{min ? hours(min) : ''}</span></header>
        {min > cap && d >= today && <p className="note">Es mucho: sacá algo.</p>}
        {pr.map((p, k) => <button key={k} className="wx hot" onClick={() => goTo(p.to)}>Entregar {p.t}</button>)}
        {ev.map(e => <button key={e.id} className="wx" onClick={() => goTo('calendar')}>{new Date(e.start_date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })} {e.title}</button>)}
        {l.map(i => <div key={i.id} className={`wi${i.done_at ? ' done' : ''}${i.top ? ' top' : ''}${i.level === 'extra' ? ' extra' : ''}`} draggable onDragStart={e => e.dataTransfer.setData('text/plain', i.id)}>
          <button className="tk-c" role="checkbox" aria-checked={!!i.done_at} aria-label={i.title} onClick={() => plan.items.update(i.id, { done_at: i.done_at ? null : Date.now() })}>{i.done_at && <Check size={13} />}</button>
          <button className="wi-t" onClick={() => setEdit(i)}><b>{i.title}</b><span>{[who === 'ambos' && PEOPLE[i.owner], hours(i.minutes), plan.objs.rows.find(o => o.id === i.objective_id)?.title].filter(Boolean).join(', ')}</span></button></div>)}
        {adding === d ? <form onSubmit={e => { e.preventDefault(); add(d); }}><input className="input" autoFocus aria-label="Tarea nueva" value={text} onChange={e => setText(e.target.value)} onBlur={() => { add(d); setAdding(''); }} onKeyDown={e => { if (e.key === 'Escape') { setText(''); setAdding(''); } }} /></form>
          : <button className="wa" onClick={() => { setText(''); setAdding(d); }}><Plus size={15} /> Agregar</button>}
      </section>;
    })}</div>
    {edit && <ItemModal value={edit} plan={plan} onClose={() => setEdit(null)} />}
  </>;
}

function Objectives({ plan }: { plan: Plan }) {
  const [edit, setEdit] = useState<Partial<Objective> | null>(null), [old, setOld] = useState(false);
  const past = plan.objs.rows.filter(o => o.status !== 'activo');
  return <>
    {plan.active.length === 0 ? <Empty title="¿Para qué hacen todo esto?" text="Un objetivo con su porqué ordena el resto: cada tarea del día se conecta con algo que les importa."><button className="btn btn-primary" onClick={() => setEdit({})}><Plus size={17} /> Crear el primero</button></Empty>
      : <><div className="obs">{plan.active.map(o => <ObjectiveCard key={o.id} o={o} plan={plan} full onOpen={() => setEdit(o)} />)}</div>
        {plan.active.length > 3 && <p className="note">Tienen {plan.active.length} activos. Con dos o tres se avanza más: suelten el que menos importe por ahora.</p>}
        <button className="btn btn-secondary" onClick={() => setEdit({ owner: 'ambos' })}><Plus size={16} /> Otro objetivo</button></>}
    {past.length > 0 && <><button className="btn btn-ghost" onClick={() => setOld(!old)}>{old ? 'Ocultar' : `Ver ${plural(past.length, 'anterior', 'anteriores')}`}</button>{old && past.map(o => <div className="li" key={o.id}><div><b>{o.title}</b><span>{o.status === 'logrado' ? 'Logrado' : 'Soltado'}</span></div><button className="btn btn-ghost btn-sm" onClick={() => plan.objs.update(o.id, { status: 'activo' })}>Reactivar</button></div>)}</>}
    {edit && <ObjectiveModal value={edit} plan={plan} onClose={() => setEdit(null)} />}
  </>;
}

function Review({ plan, me }: { plan: Plan; me: Person }) {
  // De domingo a martes se repasa la que pasó; el resto, la que está en curso
  const dow = new Date().getDay(), start = dow === 1 || dow === 2 ? addDays(monday(), -7) : monday(), wk = ymd(start), next = ymd(addDays(start, 7));
  const row = plan.weeks.rows.find(w => w.owner === me && w.week === wk), nrow = plan.weeks.rows.find(w => w.owner === me && w.week === next);
  const [f, setF] = useState({ wins: row?.wins || '', blockers: row?.blockers || '', change: row?.change || '', success: nrow?.success || '' });
  const set = (p: Partial<typeof f>) => setF(x => ({ ...x, ...p }));
  const l = plan.items.rows.filter(i => i.owner === me && i.date >= wk && i.date < next), keys = l.filter(i => i.level === 'clave'), done = l.filter(i => i.done_at);
  const notes = plan.days.rows.filter(d => d.owner === me && d.date >= wk && d.date < next && (d.proud || d.blocker)).sort((a, b) => a.date.localeCompare(b.date));
  const byObj = plan.objs.rows.map(o => ({ o, n: done.filter(i => i.objective_id === o.id).length })).filter(x => x.n).sort((a, b) => b.n - a.n), loose = done.filter(i => !i.objective_id).length;
  const stuck = l.filter(i => i.moved >= 2 && !i.done_at);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = { wins: f.wins.trim(), blockers: f.blockers.trim(), change: f.change.trim(), reviewed_at: Date.now() }, b = { success: f.success.trim() };
    const ok = (row ? await plan.weeks.update(row.id, a) : await plan.weeks.add({ week: wk, owner: me, ...a })) && (nrow ? await plan.weeks.update(nrow.id, b) : await plan.weeks.add({ week: next, owner: me, ...b }));
    if (ok) { toast('Repaso guardado'); goTo('semana'); }
  };
  return <div className="rv">
    <section className="pn"><h2>Lo que pasó, {fDate(start)} al {fDate(addDays(start, 6))}</h2>
      {row?.success && <p className="rv-s">Dijiste que era un éxito si: <b>{row.success}</b></p>}
      <div className="rv-n"><div><b>{done.length}</b><span>{done.length === 1 ? 'tarea terminada' : 'tareas terminadas'}</span></div><div><b>{keys.length ? Math.round(keys.filter(i => i.done_at).length / keys.length * 100) : 0} %</b><span>de las claves</span></div><div><b>{new Set(l.filter(i => i.top && i.done_at).map(i => i.date)).size}</b><span>días con lo más importante hecho</span></div></div>
      {byObj.length > 0 && <><h3>A dónde fue tu esfuerzo</h3>{byObj.map(x => <p key={x.o.id} className="rv-l"><span>{x.o.title}</span><b>{x.n}</b></p>)}{loose > 0 && <p className="rv-l"><span>Sin objetivo</span><b>{loose}</b></p>}</>}
      {stuck.length > 0 && <><h3>Se viene pateando</h3>{stuck.map(i => <p key={i.id} className="rv-l"><span>{i.title}</span><b>{i.moved} veces</b></p>)}</>}
      {notes.length > 0 && <><h3>Lo que escribiste</h3>{notes.map(d => <p key={d.id} className="rv-q"><small>{fDay(fromYmd(d.date))}</small>{d.proud}{d.blocker && <em>Te frenó: {d.blocker}</em>}</p>)}</>}
      {!l.length && <p className="help">Esa semana no tiene tareas cargadas.</p>}
    </section>
    <form className="pn ff" onSubmit={save}>
      <Field label="¿Qué salió bien y por qué?"><textarea className="textarea" rows={3} value={f.wins} onChange={e => set({ wins: e.target.value })} /></Field>
      <Field label="¿Qué te frenó?"><textarea className="textarea" rows={3} value={f.blockers} onChange={e => set({ blockers: e.target.value })} /></Field>
      <Field label="¿Qué vas a hacer distinto?"><textarea className="textarea" rows={3} value={f.change} onChange={e => set({ change: e.target.value })} /></Field>
      <Field label="La semana que viene es un éxito si"><input className="input" value={f.success} onChange={e => set({ success: e.target.value })} /></Field>
      <button className="btn btn-primary">Guardar el repaso</button>
    </form>
  </div>;
}
