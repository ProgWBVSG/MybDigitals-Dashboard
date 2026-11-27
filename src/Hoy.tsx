import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Compass, Moon, Pencil, Play, Plus, Undo2, X } from 'lucide-react';
import { insertOp, PEOPLE, saveAll, updateOp, usePerson, useTable, type Op, type Person } from './base';
import { toast } from './hooks';
import { addDays, fDay, fromYmd, monday, plural, ymd, type Objective, type PlanItem } from './negocio';
import { byOrder, hours, isMine, ItemModal, ObjectiveCard, ObjectiveModal, topOps, usePlan, type Alert, type Plan } from './plan';
import { goTo } from './rutas';
import { Field, Modal } from './ui';

export default function Hoy() {
  const plan = usePlan(), me = usePerson(), other: Person = me === 'benja' ? 'mati' : 'benja';
  const [today, setToday] = useState(ymd());
  const [focus, setFocus] = useState<string | null>(null), [edit, setEdit] = useState<Partial<PlanItem> | null>(null), [obj, setObj] = useState<Partial<Objective> | null>(null);
  const [planning, setPlanning] = useState(false), [lost, setLost] = useState(false), [closing, setClosing] = useState(false);
  useEffect(() => { const t = setInterval(() => setToday(ymd()), 30000); return () => clearInterval(t); }, []); // si pasa la medianoche
  if (!plan.ready) return <div className="view-load"><div className="spinner-lg" /></div>;

  const mine = plan.items.rows.filter(i => i.owner === me && i.date === today).sort(byOrder);
  const top = mine.find(i => i.top) || null, keys = mine.filter(i => i.level === 'clave' && i !== top), extra = mine.filter(i => i.level === 'extra');
  const doneN = mine.filter(i => i.done_at).length, day = plan.days.rows.find(d => d.owner === me && d.date === today);
  const objOf = (i: PlanItem) => plan.objs.rows.find(o => o.id === i.objective_id);
  const toggle = async (i: PlanItem) => { const on = !i.done_at; if (await plan.items.update(i.id, { done_at: on ? Date.now() : null }) && on) toast(objOf(i) ? `Hecho. Un paso más: ${objOf(i)!.title}` : 'Hecho'); };
  const his = plan.items.rows.filter(i => i.owner === other && i.date === today).sort(byOrder);
  const hour = new Date().getHours(), hello = hour < 13 ? 'Buen día' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const focusItem = plan.items.rows.find(i => i.id === focus);
  const allDone = mine.length > 0 && mine.filter(i => i.level === 'clave').every(i => i.done_at);
  const objs = plan.active.filter(o => isMine(o, me)).slice(0, 3);

  return (
    <div className="hoy">
      <div className="page-head"><div><h1>{hello}, {PEOPLE[me]}</h1><p>{fDay(Date.now())}{mine.length > 0 && `, ${doneN} de ${mine.length} ${mine.length === 1 ? 'hecha' : 'hechas'}`}</p></div>
        <div className="row">{mine.length > 0 && !day?.closed_at && <button className="btn btn-ghost" onClick={() => setClosing(true)}><Moon size={16} /> Cerrar el día</button>}<button className="btn btn-secondary" onClick={() => setLost(true)}><Compass size={17} /> No sé por dónde seguir</button></div></div>

      <div className="hoy-g">
        <div className="col">
          {day?.closed_at ? <section className="pn hoy-end"><h2>Día cerrado</h2><p>{doneN ? `Terminaste ${plural(doneN, 'cosa', 'cosas')}.` : 'Mañana se arranca de nuevo.'}{day.proud && ` ${day.proud}`}</p><button className="btn btn-ghost btn-sm" onClick={() => plan.days.update(day.id, { closed_at: null })}><Undo2 size={15} /> Reabrir</button></section>
            : mine.length === 0 ? <section className="hoy-top empty"><h2>Todavía no elegiste qué hace que hoy valga la pena.</h2><p>Dos minutos: un objetivo, hasta tres tareas y cuál va primero.</p><button className="btn btn-ink" onClick={() => setPlanning(true)}>Armar mi día <ArrowRight size={17} /></button></section>
            : top ? <section className={`hoy-top${top.done_at ? ' done' : ''}`}>
              <span>{top.done_at ? 'Lo más importante ya está hecho' : 'Lo más importante de hoy'}</span><h2>{top.title}</h2>
              {objOf(top) && <p><b>Para qué.</b> {objOf(top)!.why || objOf(top)!.title}</p>}
              {top.when_then && !top.done_at && <p><b>Cuándo.</b> {top.when_then}</p>}
              <div className="row">{top.done_at ? <button className="btn btn-secondary" onClick={() => toggle(top)}><Undo2 size={16} /> No está</button> : <><button className="btn btn-ink" onClick={() => setFocus(top.id)}><Play size={16} /> Empezar</button><button className="btn btn-line" onClick={() => toggle(top)}><Check size={16} /> Ya está</button></>}<button className="btn btn-line btn-icon" onClick={() => setEdit(top)} aria-label="Cambiar"><Pencil size={16} /></button></div>
            </section> : <section className="hoy-top empty"><h2>¿Cuál es la más importante?</h2><div className="hoy-pick">{mine.filter(i => !i.done_at).slice(0, 5).map(i => <button key={i.id} onClick={async () => { const e = await saveAll([...topOps(plan.items.rows, i.id, me, today), updateOp('plan_items', i.id, { top: true, level: 'clave' })]); if (e) toast(e, 'error'); }}>{i.title}</button>)}</div></section>}

          {mine.length > 0 && !day?.closed_at && <section className="pn">
            <div className="pn-h"><h2>{keys.length ? 'Después' : 'Lo demás'}</h2><button className="btn btn-ghost btn-sm" onClick={() => setEdit({ owner: me, date: today, level: keys.length + (top ? 1 : 0) >= 3 ? 'extra' : 'clave' })}><Plus size={15} /> Tarea</button></div>
            {keys.length === 0 && extra.length === 0 && <p className="help">Nada más. Una cosa bien hecha alcanza.</p>}
            {keys.map(i => <Task key={i.id} i={i} obj={objOf(i)} onToggle={() => toggle(i)} onStart={() => setFocus(i.id)} onEdit={() => setEdit(i)} />)}
            {extra.length > 0 && <><h3>Si sobra tiempo</h3>{extra.map(i => <Task key={i.id} i={i} obj={objOf(i)} onToggle={() => toggle(i)} onStart={() => setFocus(i.id)} onEdit={() => setEdit(i)} />)}</>}
            {keys.length + (top ? 1 : 0) > 3 && <p className="note">Son {keys.length + (top ? 1 : 0)} claves. Con tres se termina más: pasá alguna a otro día.</p>}
            {allDone && <div className="hoy-win"><b>Las claves de hoy están hechas.</b><button className="btn btn-primary btn-sm" onClick={() => setClosing(true)}>Cerrar el día</button></div>}
          </section>}
        </div>

        <div className="col">
          <section className="pn"><h2>No puede esperar</h2>
            {plan.alerts.length === 0 ? <p className="help">Nada urgente. Entregas, cobros y mensajes están al día.</p> : plan.alerts.slice(0, 5).map(a => <button className={`al${a.hot ? ' hot' : ''}`} key={a.key} onClick={() => goTo(a.to)}><i /><span><b>{a.title}</b><small>{a.sub}</small></span><ArrowRight size={16} /></button>)}
            {plan.alerts.length > 5 && <p className="help">Y {plan.alerts.length - 5} más.</p>}</section>
          <section className="pn"><div className="pn-h"><h2>Hacia dónde vamos</h2><button className="btn btn-ghost btn-sm" onClick={() => objs.length ? goTo('semana/objetivos') : setObj({})}>{objs.length ? 'Ver todos' : 'Crear'}</button></div>
            {objs.length === 0 ? <p className="help">Sin un objetivo, todo parece igual de importante. Creá el primero con su porqué.</p> : objs.map(o => <ObjectiveCard key={o.id} o={o} plan={plan} onOpen={() => setObj(o)} />)}</section>
          <section className="pn"><h2>Tu semana</h2><WeekStrip plan={plan} me={me} today={today} /></section>
          <section className="pn"><h2>{PEOPLE[other]} hoy</h2>{his.length === 0 ? <p className="help">Todavía no armó su día.</p> : his.slice(0, 4).map(i => <p key={i.id} className={`hz${i.done_at ? ' done' : ''}`}>{i.done_at ? <Check size={15} /> : <i />}{i.title}</p>)}</section>
        </div>
      </div>

      {planning && <PlanDay plan={plan} me={me} date={today} onClose={() => setPlanning(false)} onObjective={() => setObj({})} />}
      {edit && <ItemModal value={edit} plan={plan} onClose={() => setEdit(null)} />}
      {obj && <ObjectiveModal value={obj} plan={plan} onClose={() => setObj(null)} />}
      {lost && <Lost plan={plan} me={me} mine={mine} onClose={() => setLost(false)} onStart={id => { setLost(false); setFocus(id); }} onPlan={() => { setLost(false); setPlanning(true); }} />}
      {closing && <CloseDay me={me} date={today} mine={mine} onClose={() => setClosing(false)} />}
      {focusItem && <Focus item={focusItem} obj={objOf(focusItem)} plan={plan} other={PEOPLE[other]} onClose={() => setFocus(null)} />}
    </div>
  );
}

function Task({ i, obj, onToggle, onStart, onEdit }: { i: PlanItem; obj?: Objective; onToggle: () => void; onStart: () => void; onEdit: () => void }) {
  return <div className={`tk${i.done_at ? ' done' : ''}`}>
    <button className="tk-c" role="checkbox" aria-checked={!!i.done_at} aria-label={i.title} onClick={onToggle}>{i.done_at && <Check size={15} />}</button>
    <button className="tk-t" onClick={onEdit}><b>{i.title}</b><span>{[hours(i.minutes), i.when_then, obj?.title].filter(Boolean).join(', ')}{i.moved >= 2 && `. Ya se movió ${i.moved} veces`}</span></button>
    {!i.done_at && <button className="btn btn-ghost btn-icon" onClick={onStart} aria-label={`Empezar ${i.title}`}><Play size={16} /></button>}
  </div>;
}

function WeekStrip({ plan, me, today }: { plan: Plan; me: Person; today: string }) {
  const m = monday();
  const days = Array.from({ length: 7 }, (_, k) => { const d = ymd(addDays(m, k)); const l = plan.items.rows.filter(i => i.owner === me && i.date === d && i.level === 'clave'); return { d, n: l.length, ok: l.filter(i => i.done_at).length, top: l.some(i => i.top && i.done_at) }; });
  const tops = days.filter(d => d.top).length, done = days.reduce((s, d) => s + d.ok, 0);
  return <><div className="ws">{days.map(d => <div key={d.d} className={`${d.d === today ? 'now' : ''}${d.top ? ' ok' : d.ok ? ' half' : ''}`} title={`${d.ok} de ${d.n}`}><i>{d.top && <Check size={14} />}</i><span>{new Date(fromYmd(d.d)).toLocaleDateString('es-AR', { weekday: 'narrow' })}</span></div>)}</div>
    <p className="help">{tops ? `${plural(tops, 'día', 'días')} con lo más importante hecho. ` : ''}{done ? plural(done, 'tarea clave terminada.', 'tareas clave terminadas.') : 'Esta semana arranca con la primera.'}</p></>;
}

// ─── Armar el día ───
interface Sug { key: string; title: string; sub: string; objective_id?: string | null; client_id?: string | null; agreement_id?: string | null; first_step?: string; item?: PlanItem }
function PlanDay({ plan, me, date, onClose, onObjective }: { plan: Plan; me: Person; date: string; onClose: () => void; onObjective: () => void }) {
  const [step, setStep] = useState(0);
  const week = plan.weeks.rows.find(w => w.owner === me && w.week === ymd(monday()));
  const [objective, setObjective] = useState<string | null>(week?.objective_id || null);
  const [picked, setPicked] = useState<Sug[]>([]), [text, setText] = useState('');
  const [topK, setTopK] = useState(''), [wt, setWt] = useState(''), [fs, setFs] = useState(''), [busy, setBusy] = useState(false);
  const mine = plan.active.filter(o => isMine(o, me));
  const sugs = useMemo<Sug[]>(() => [
    ...plan.items.rows.filter(i => i.owner === me && !i.done_at && i.date < date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map(i => ({ key: 'i' + i.id, title: i.title, sub: i.moved >= 2 ? `Ya se movió ${i.moved} veces` : 'Quedó de antes', objective_id: i.objective_id, item: i })),
    ...plan.alerts.map((a: Alert) => ({ key: a.key, title: a.key[0] === 'f' ? `Entregar ${a.title}` : a.title, sub: a.sub, client_id: a.client_id, agreement_id: a.agreement_id, first_step: a.first })),
    ...plan.kanban.map(t => ({ key: 't' + t.id, title: t.title, sub: 'Del tablero de tareas' })),
  ].slice(0, 12), []);
  const toggle = (s: Sug) => setPicked(p => p.some(x => x.key === s.key) ? p.filter(x => x.key !== s.key) : [...p, s]);
  const add = () => { const t = text.trim(); if (!t) return; setPicked(p => [...p, { key: crypto.randomUUID(), title: t, sub: 'Nueva', objective_id: objective }]); setText(''); };
  const finish = async () => {
    setBusy(true);
    const ops: Op[] = picked.map((s, k) => {
      const isTop = s.key === topK, level = isTop || k < 3 ? 'clave' : 'extra';
      const more = { date, owner: me, level, top: isTop, sort: k, ...(isTop ? { when_then: wt.trim(), first_step: fs.trim() || s.first_step || '' } : {}) };
      return s.item ? updateOp('plan_items', s.item.id, { ...more, moved: s.item.moved + 1 }) : insertOp('plan_items', { title: s.title, objective_id: s.objective_id ?? null, client_id: s.client_id ?? null, agreement_id: s.agreement_id ?? null, first_step: s.first_step || '', ...more });
    });
    const e = await saveAll(ops); setBusy(false);
    if (e) toast('No se pudo guardar: ' + e, 'error'); else onClose();
  };
  const o = plan.objs.rows.find(x => x.id === objective);
  return <Modal title={['¿Qué objetivo empujás hoy?', '¿Qué vas a hacer?', '¿Cuál hace que el día valga?'][step]} onClose={onClose} wide actions={<>
    {step > 0 && <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>Atrás</button>}<span />
    {step === 0 && <button className="btn btn-primary" onClick={() => setStep(1)}>{objective ? 'Seguir' : 'Seguir sin objetivo'}</button>}
    {step === 1 && <button className="btn btn-primary" disabled={!picked.length} onClick={() => { if (!picked.some(p => p.key === topK)) setTopK(picked[0].key); setStep(2); }}>Seguir</button>}
    {step === 2 && <button className="btn btn-primary" disabled={busy || !topK} onClick={finish}>Listo, a trabajar</button>}</>}>
    {step === 0 && <div className="pick">{mine.map(x => <button key={x.id} className={objective === x.id ? 'on' : ''} aria-pressed={objective === x.id} onClick={() => setObjective(objective === x.id ? null : x.id)}><b>{x.title}</b><span>{x.why}</span></button>)}<button className="new" onClick={onObjective}><Plus size={17} /> {mine.length ? 'Otro objetivo' : 'Crear el primer objetivo'}</button></div>}
    {step === 1 && <>
      {o && <p className="help">Empuja: {o.title}</p>}
      <form className="row grow" onSubmit={e => { e.preventDefault(); add(); }}><input className="input" autoFocus placeholder="Escribí una tarea y Enter" aria-label="Tarea nueva" value={text} onChange={e => setText(e.target.value)} /><button className="btn btn-secondary" disabled={!text.trim()}>Agregar</button></form>
      <div className="pick">{picked.filter(p => !sugs.some(s => s.key === p.key)).map(s => <button key={s.key} className="on" aria-pressed onClick={() => toggle(s)}><b>{s.title}</b><span>{s.sub}</span></button>)}{sugs.map(s => { const on = picked.some(p => p.key === s.key); return <button key={s.key} className={on ? 'on' : ''} aria-pressed={on} onClick={() => toggle(s)}><b>{s.title}</b><span>{s.sub}</span></button>; })}</div>
      <p className={picked.length > 3 ? 'note' : 'help'}>{picked.length > 3 ? `Elegiste ${picked.length}. Las tres primeras son clave; el resto queda para si sobra tiempo.` : 'Hasta tres. Lo demás queda para otro día.'}</p></>}
    {step === 2 && <>
      <div className="pick">{picked.map(s => <button key={s.key} className={topK === s.key ? 'on' : ''} aria-pressed={topK === s.key} onClick={() => setTopK(s.key)}><b>{s.title}</b></button>)}</div>
      <Field label="¿Cuándo y dónde la arrancás?"><input className="input" value={wt} placeholder="A las 9, apenas me siento en el escritorio" onChange={e => setWt(e.target.value)} /></Field>
      <Field label="¿Cuál es el primer paso, de cinco minutos?"><input className="input" value={fs} placeholder={picked.find(p => p.key === topK)?.first_step || 'Abrir el archivo y escribir el título'} onChange={e => setFs(e.target.value)} /></Field></>}
  </Modal>;
}

// ─── "No sé por dónde seguir": una sola cosa ───
function Lost({ plan, me, mine, onClose, onStart, onPlan }: { plan: Plan; me: Person; mine: PlanItem[]; onClose: () => void; onStart: (id: string) => void; onPlan: () => void }) {
  const [skip, setSkip] = useState(0);
  const open = mine.filter(i => !i.done_at), top = open.find(i => i.top);
  const obj = (i: PlanItem) => plan.objs.rows.find(o => o.id === i.objective_id);
  type Opt = { title: string; why: string; first: string; go: () => void; label: string };
  const late = plan.alerts.filter(a => a.rank === 0), rest = plan.alerts.filter(a => a.rank > 0 && a.hot);
  const fromAlert = (a: Alert): Opt => ({ title: a.title, why: a.sub, first: a.first, go: () => { onClose(); goTo(a.to); }, label: 'Ir' });
  const fromItem = (i: PlanItem): Opt => ({ title: i.title, why: obj(i)?.why || (i.top ? 'Es lo que elegiste como más importante de hoy.' : 'Está en tu plan de hoy.'), first: i.first_step || 'Poné cinco minutos y hacé sólo la primera parte. Si después querés parar, parás.', go: () => onStart(i.id), label: 'Empezar' });
  const behind = plan.active.filter(o => isMine(o, me) && plan.progress(o).behind);
  const list: Opt[] = [...late.map(fromAlert), ...(top ? [fromItem(top)] : []), ...rest.map(fromAlert), ...open.filter(i => i !== top).map(fromItem),
    ...(!mine.length ? [{ title: 'Armar tu día', why: 'Cuando no está escrito, la cabeza da vueltas. Escribirlo la libera.', first: 'Elegí un objetivo y una sola tarea.', go: onPlan, label: 'Armar mi día' }] : []),
    ...behind.map(o => ({ title: o.title, why: o.why, first: 'Escribí una tarea de media hora que lo mueva hoy.', go: () => { onClose(); goTo('semana/objetivos'); }, label: 'Ver objetivo' }))];
  const x = list.length ? list[skip % list.length] : null;
  return <Modal title={x ? 'Hacé esto ahora' : 'Estás al día'} onClose={onClose} actions={<>{list.length > 1 && <button className="btn btn-ghost" onClick={() => setSkip(skip + 1)}>Esto no, otra cosa</button>}<span />{x ? <button className="btn btn-primary" onClick={x.go}>{x.label}</button> : <button className="btn btn-primary" onClick={onClose}>Listo</button>}</>}>
    {x ? <div className="lost"><h3>{x.title}</h3><p>{x.why}</p><div><b>Primer paso</b><p>{x.first}</p></div></div> : <p className="help">No hay nada urgente ni pendiente. Descansá o planificá mañana.</p>}
  </Modal>;
}

// ─── Modo foco ───
function Focus({ item, obj, plan, other, onClose }: { item: PlanItem; obj?: Objective; plan: Plan; other: string; onClose: () => void }) {
  const KEY = 'myb_foco';
  const saved = useMemo(() => { try { const x = JSON.parse(localStorage.getItem(KEY) || ''); return x.id === item.id && Date.now() - x.at < 4 * 3600000 ? x as { id: string; at: number } : null; } catch { return null; } }, []);
  const [start, setStart] = useState<number | null>(saved?.at || null), [now, setNow] = useState(Date.now()), [stuck, setStuck] = useState(false);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const begin = () => { const at = Date.now(); setStart(at); localStorage.setItem(KEY, JSON.stringify({ id: item.id, at })); if (!item.started_at) plan.items.update(item.id, { started_at: at }); };
  const mins = start ? Math.round((Date.now() - start) / 60000) : 0;
  const stop = async (patch: Partial<PlanItem> = {}) => { localStorage.removeItem(KEY); await plan.items.update(item.id, { spent: item.spent + mins, ...patch }); onClose(); };
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.focus(); const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.modal-overlay')) onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  const s = start ? Math.max(0, Math.floor((now - start) / 1000)) : 0, goal = item.minutes * 60;
  return <div className="fo" ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={item.title}>
    <button className="btn btn-ghost btn-icon fo-x" onClick={onClose} aria-label="Salir"><X size={22} /></button>
    <div className="fo-c">
      <h1>{item.title}</h1>
      {obj && <p className="fo-w">{obj.why || obj.title}</p>}
      {!start ? <><div className="fo-1"><b>Primer paso</b><p>{item.first_step || 'Elegí la parte más chica y hacé sólo esa, cinco minutos.'}</p></div><button className="btn btn-primary fo-b" onClick={begin}><Play size={19} /> Empezar {hours(item.minutes)}</button></>
        : <><div className={`fo-t${s >= goal ? ' over' : ''}`} role="timer">{String(Math.floor(s / 3600)).padStart(s >= 3600 ? 2 : 1, '0') !== '0' ? `${Math.floor(s / 3600)}:` : ''}{String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}</div>
          <p className="fo-w">{s >= goal ? 'Llegaste al tiempo. Cerrala o seguí un rato más.' : `De ${hours(item.minutes)}`}</p>
          <div className="row"><button className="btn btn-primary fo-b" onClick={() => stop({ done_at: Date.now() })}><Check size={19} /> Terminada</button><button className="btn btn-secondary fo-b" onClick={() => setStuck(true)}>Me trabé</button><button className="btn btn-ghost fo-b" onClick={() => stop()}>Pausar</button></div></>}
    </div>
    {stuck && <Modal title="¿Qué pasó?" onClose={() => setStuck(false)}><div className="opts">
      <button onClick={async () => { const t = prompt('¿Cuál es la parte más chica que sí podés hacer ahora?'); if (t?.trim()) { await plan.items.update(item.id, { first_step: t.trim(), stuck: 'grande' }); setStuck(false); toast('Hacé sólo eso'); } }}><b>Es muy grande</b><span>La achicamos a un pedacito.</span></button>
      <button onClick={async () => { const t = prompt(`¿Qué necesitás que ${other} te resuelva?`); if (t?.trim()) { const e = await saveAll([insertOp('plan_items', { title: `Ayudar con: ${t.trim()}`, owner: item.owner === 'benja' ? 'mati' : 'benja', date: ymd(), objective_id: item.objective_id, minutes: 15, level: 'clave' })]); if (e) toast(e, 'error'); else { toast(`Le aparece a ${other} en su día`); stop({ stuck: 'ayuda' }); } } }}><b>Necesito a {other}</b><span>Le queda la tarea en su día.</span></button>
      <button onClick={() => stop({ date: ymd(addDays(Date.now(), 1)), top: false, moved: item.moved + 1, stuck: 'movida' })}><b>Hoy no va a salir</b><span>Pasa a mañana.</span></button>
      <button onClick={() => { setStuck(false); setStart(null); localStorage.removeItem(KEY); }}><b>Me distraje</b><span>Arrancamos de nuevo desde el primer paso.</span></button>
    </div></Modal>}
  </div>;
}

// ─── Cerrar el día ───
function CloseDay({ me, date, mine, onClose }: { me: Person; date: string; mine: PlanItem[]; onClose: () => void }) {
  const days = useTable<any>('plan_days');
  const left = mine.filter(i => !i.done_at), done = mine.filter(i => i.done_at);
  const [what, setWhat] = useState<Record<string, 'manana' | 'soltar' | 'lunes'>>({}), [proud, setProud] = useState(''), [blocker, setBlocker] = useState('');
  const save = async () => {
    const row = days.rows.find(d => d.owner === me && d.date === date);
    const ops: Op[] = left.map(i => { const w = what[i.id] || 'manana'; return w === 'soltar' ? { table: 'plan_items', op: 'delete' as const, filters: [['eq', 'id', i.id]] as [string, string, unknown][] } : updateOp('plan_items', i.id, { date: ymd(w === 'lunes' ? addDays(monday(), 7) : addDays(fromYmd(date), 1)), top: false, moved: i.moved + 1 }); });
    const body = { date, owner: me, proud: proud.trim(), blocker: blocker.trim(), closed_at: Date.now() };
    ops.push(row ? updateOp('plan_days', row.id, body) : insertOp('plan_days', body));
    const e = await saveAll(ops); if (e) toast('No se pudo guardar: ' + e, 'error'); else { toast('Día cerrado'); onClose(); }
  };

  return <Modal title="Cerrar el día" onClose={onClose} wide actions={<><button className="btn btn-ghost" onClick={onClose}>Todavía no</button><button className="btn btn-primary" onClick={save}>Cerrar</button></>}>
    {done.length > 0 && <div className="wins"><b>Hoy avanzaste</b>{done.map(i => <p key={i.id}><Check size={16} />{i.title}</p>)}</div>}
    <Field label="¿De qué estás conforme hoy?"><textarea className="textarea" rows={2} value={proud} onChange={e => setProud(e.target.value)} /></Field>
    <Field label="¿Qué te frenó?"><input className="input" value={blocker} onChange={e => setBlocker(e.target.value)} /></Field>
    {left.length > 0 && <div className="lefts"><b>Lo que quedó</b>{left.map(i => <div key={i.id}><span>{i.title}{i.moved >= 2 && <small>Ya se movió {i.moved} veces. ¿Sigue sirviendo?</small>}</span><div className="seg">{([['manana', 'Mañana'], ['lunes', 'Otra semana'], ['soltar', 'Soltar']] as const).map(([k, l]) => <button key={k} className={(what[i.id] || 'manana') === k ? 'on' : ''} onClick={() => setWhat({ ...what, [i.id]: k })}>{l}</button>)}</div></div>)}</div>}
  </Modal>;
}
