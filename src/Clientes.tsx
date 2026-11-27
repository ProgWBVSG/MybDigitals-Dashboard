import { useMemo, useState } from 'react';
import { ArrowLeft, Check, FileText, MessageCircle, Pencil, Plus, Search, Trash2, Undo2, Waypoints } from 'lucide-react';
import { deleteOp, PEOPLE, saveAll, updateOp, useTable, type Row } from './base';
import { toast, useExchangeRate } from './hooks';
import { norm } from './sheetImport';
import { money, type Service } from './services';
import AcuerdoEditor, { newAgreement } from './AcuerdoEditor';
import Cobro from './Cobro';
import { sendWhats, useQueue } from './Mensajes';
import {
  AG_STATUS, both, daysTo, duesOf, fDate, firstMonthly, HEALTH, isLive, paidOf, plural, projectTotal, purse, scoreOf, viewClient, waNumber, when, worksOf,
  type Agreement, type ClientRow, type ClientView, type Due, type Health, type Phase, type Score, type Touch,
} from './negocio';
import { Bar, DateIn, Empty, Field, Modal } from './ui';
import { goTo, useSub } from './rutas';

interface Note extends Row { client_id: string; content: string }
type Filter = 'todos' | 'atencion' | 'al_dia' | 'borrador' | 'terminado';
const FILTERS: [Filter, string, (h: Health) => boolean][] = [
  ['todos', 'Todos', () => true], ['atencion', 'Necesitan algo', h => HEALTH[h].rank <= 3], ['al_dia', 'Al día', h => h === 'al_dia'],
  ['borrador', 'Sin firmar', h => h === 'borrador' || h === 'sin_acuerdo'], ['terminado', 'Terminados', h => h === 'terminado'],
];

export default function Clientes() {
  const clients = useTable<ClientRow>('clients'), ags = useTable<Agreement>('agreements'), touches = useTable<Touch>('touches'), services = useTable<Service & { id: string }>('services');
  const rate = useExchangeRate();
  const [sub, go] = useSub();
  const [q, setQ] = useState(''), [f, setF] = useState<Filter>('todos'), [svc, setSvc] = useState('');
  const [edit, setEdit] = useState<Partial<ClientRow> | null>(null);
  const views = useMemo(() => clients.rows.map(c => viewClient(c, ags.rows, touches.rows, rate)).sort((a, b) => HEALTH[a.health].rank - HEALTH[b.health].rank || a.client.name.localeCompare(b.client.name)), [clients.rows, ags.rows, touches.rows, rate]);
  if (!clients.ready || !ags.ready) return <div className="view-load"><div className="spinner-lg" /></div>;

  const [cid, agId] = sub.split('/');
  const openAg = agId ? ags.rows.find(a => a.id === agId) : null;
  if (openAg) return <AcuerdoEditor key={openAg.id} agreement={openAg} onClose={() => go(cid)} />;
  const open = cid ? views.find(v => v.client.id === cid) : null;
  const modal = edit && <ClientModal value={edit} onClose={() => setEdit(null)} onSave={async c => {
    if (c.id ? await clients.update(c.id, c) : null) { setEdit(null); toast('Guardado'); return; }
    if (c.id) return;
    const n = await clients.add({ ...c, status: 'active' }); if (n) { setEdit(null); go(n.id); }
  }} onDelete={async c => { if (confirm(`¿Borrar ${c.name} con sus acuerdos, notas y mensajes? La plata que entró queda. Se puede recuperar desde la papelera.`) && await clients.remove(c.id!)) { setEdit(null); go(''); } }} />;
  if (open) return <><Detail v={open} onBack={() => go('')} onEdit={() => setEdit(open.client)} onAgreement={id => go(`${open.client.id}/${id}`)} />{modal}</>;

  const t = norm(q);
  const rows = views.filter(v => FILTERS.find(x => x[0] === f)![2](v.health) && (!svc || v.agreements.some(a => a.service_id === svc)) && (!t || norm([v.client.name, v.client.contact?.whatsapp, ...v.agreements.map(a => a.title)].join(' ')).includes(t)));
  const score = scoreOf(ags.rows), mon = purse();
  views.forEach(v => v.monthly.forEach(m => { mon[m.cur] += m.amount; }));
  const owed = views.flatMap(v => [...v.overdue, ...v.claim]).reduce((p, d) => { p[d.agreement.currency] += d.left; return p; }, purse());
  const used = services.rows.filter(s => ags.rows.some(a => a.service_id === s.id));

  if (!clients.rows.length) return <><Empty title="Cargá el primer cliente" text="Con su acuerdo vas a ver las fases, los pagos, cómo cumple cada parte y qué mensaje le toca."><button className="btn btn-primary" onClick={() => setEdit({})}><Plus size={17} /> Nuevo cliente</button></Empty>{modal}</>;
  return (
    <div>
      <div className="page-head"><div><h1>Clientes</h1><p>{plural(views.filter(v => HEALTH[v.health].rank <= 3).length, 'necesita algo', 'necesitan algo')} de {clients.rows.length}</p></div><div className="row"><button className="btn btn-secondary" onClick={() => goTo('red')}><Waypoints size={17} /> Ver en red</button><button className="btn btn-primary" onClick={() => setEdit({})}><Plus size={17} /> Nuevo cliente</button></div></div>
      <div className="cl-top">
        <div><span>Para cobrar ahora</span><b>{both(owed)}</b></div><div><span>Abono por mes</span><b>{both(mon)}</b></div>
        <div><span>Entregamos a tiempo</span><b>{pct(score.us)}</b></div><div><span>Nos pagan a tiempo</span><b>{pct(score.them)}</b></div>
      </div>
      <div className="cl-f"><div className="search-bar"><Search size={16} /><input placeholder="Buscar cliente" aria-label="Buscar cliente" value={q} onChange={e => setQ(e.target.value)} /></div>
        {used.length > 0 && <select className="select" aria-label="Servicio" value={svc} onChange={e => setSvc(e.target.value)}><option value="">Todos los servicios</option>{used.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
        <div className="chips">{FILTERS.map(([k, l, test]) => { const n = views.filter(v => test(v.health)).length; return (k === 'todos' || n > 0) && <button key={k} className={f === k ? 'on' : ''} aria-pressed={f === k} onClick={() => setF(k)}>{l} <em>{n}</em></button>; })}</div></div>
      <div className="cl-list">{rows.length === 0 ? <p className="sv-none">Nadie con ese filtro.</p> : rows.map(v => <Item key={v.client.id} v={v} onOpen={() => go(v.client.id)} />)}</div>
      {modal}
    </div>
  );
}
const pct = (s: Score) => s.ok + s.late ? `${Math.round(s.ok / (s.ok + s.late) * 100)} %` : 'Sin datos';

function Item({ v, onOpen }: { v: ClientView; onOpen: () => void }) {
  const h = HEALTH[v.health], w = waNumber(v.client.contact?.whatsapp);
  return <article className={`cl${h.hot ? ' hot' : ''}`}>
    <button className="cl-m" onClick={onOpen}><b>{v.client.name}</b><span>{v.agreements.map(a => a.title).filter(Boolean).join(', ') || 'Sin trabajo cargado'}</span></button>
    <button className="cl-s" onClick={onOpen} tabIndex={-1}><em className={h.hot ? 'pill hot' : 'pill'}>{h.label}</em><span>{v.why}</span></button>
    <div className="cl-b"><span>{v.phases ? `${v.done} de ${plural(v.phases, 'fase', 'fases')}` : 'Sin fases'}</span><Bar pct={v.phases ? v.done / v.phases * 100 : 0} label={`${v.done} de ${v.phases} fases`} /></div>
    <div className="cl-b"><span>{v.total ? `Cobrado ${Math.round(v.paid / v.total * 100)} %` : v.monthly.length ? `${money(v.monthly[0].amount, v.monthly[0].cur)} por mes` : 'Sin cobros'}</span><Bar pct={v.total ? v.paid / v.total * 100 : 0} label={`Cobrado ${money(Math.round(v.paid), 'ARS')} de ${money(Math.round(v.total), 'ARS')}`} /></div>
    <a className={`btn btn-secondary btn-icon${w ? '' : ' dis'}`} href={w ? `https://wa.me/${w}` : undefined} target="myb-whatsapp" rel="noreferrer" aria-label={w ? `WhatsApp de ${v.client.name}` : 'Sin WhatsApp'} title={w ? 'WhatsApp' : 'Sin WhatsApp'}><MessageCircle size={18} /></a>
  </article>;
}

// ─── Ficha ───
function Detail({ v, onBack, onEdit, onAgreement }: { v: ClientView; onBack: () => void; onEdit: () => void; onAgreement: (id: string) => void }) {
  const ags = useTable<Agreement>('agreements'), notes = useTable<Note>('client_notes'), touches = useTable<Touch>('touches');
  const { queue } = useQueue();
  const [due, setDue] = useState<Due | null>(null), [move, setMove] = useState<{ a: Agreement; p: Phase } | null>(null), [done, setDone] = useState<{ a: Agreement; p: Phase } | null>(null);
  const [text, setText] = useState(''), [note, setNote] = useState('');
  const c = v.client, h = HEALTH[v.health], w = waNumber(c.contact?.whatsapp), score = scoreOf(v.agreements);
  const mine = queue.filter(q => q.client_id === c.id);
  const log = touches.rows.filter(t => t.client_id === c.id && t.result === 'enviado').sort((a, b) => b.at - a.at);
  const create = async () => { const a = await ags.add(newAgreement(c, ags.rows)); if (a) onAgreement(a.id); };
  const undoPay = async (a: Agreement, movement: string) => {
    if (!confirm('¿Deshacer este pago? También se saca de Plata.')) return;
    const e = await saveAll([deleteOp('movements', movement), updateOp('agreements', a.id, { phases: a.phases.map(p => ({ ...p, payments: p.payments.filter(x => x.movement_id !== movement) })), monthly_paid: a.monthly_paid.filter(x => x.movement_id !== movement) })]);
    if (e) toast('No se pudo: ' + e, 'error'); else toast('Pago deshecho');
  };
  return (
    <div className="cd">
      <button className="btn btn-ghost" onClick={onBack}><ArrowLeft size={17} /> Clientes</button>
      <div className="page-head"><div><h1>{c.name}</h1><p>{[c.contact?.whatsapp, c.contact?.email, c.contact?.instagram].filter(Boolean).join(', ') || 'Sin datos de contacto'}</p></div>
        <div className="row"><button className="btn btn-ghost" onClick={onEdit}><Pencil size={16} /> Datos</button>{w && <a className="btn btn-secondary" href={`https://wa.me/${w}`} target="myb-whatsapp" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>}<button className={`btn ${v.agreements.length ? 'btn-secondary' : 'btn-primary'}`} onClick={create}><Plus size={16} /> Acuerdo</button></div></div>
      <div className={`cd-state${h.hot ? ' hot' : ''}`}><b>{h.label}</b><span>{v.why}</span></div>
      {(score.us.ok + score.us.late + score.them.ok + score.them.late) > 0 && <div className="cl-top two"><div><span>Nosotros entregamos a tiempo</span><b>{score.us.ok} de {score.us.ok + score.us.late}</b></div><div><span>El cliente pagó a tiempo</span><b>{score.them.ok} de {score.them.ok + score.them.late}</b></div><div><span>Último contacto</span><b>{v.lastTouch ? when(v.lastTouch) : 'Ninguno'}</b></div></div>}

      <div className="cd-cols">
        <div className="col">
          {v.agreements.length === 0 && <Empty title="Falta el acuerdo" text="Ahí van las fases con fecha, los pagos y a qué se compromete cada parte."><button className="btn btn-primary" onClick={create}>Armar el acuerdo</button></Empty>}
          {v.agreements.map(a => {
            const dues = duesOf(a), works = worksOf(a), live = isLive(a), allDone = live && works.length > 0 && works.every(x => x.phase.done_at) && dues.every(d => d.kind === 'mes' || d.state === 'pagado');
            const months = dues.filter(d => d.kind === 'mes' && d.state !== 'futuro').reverse();
            return <section className="pn ag" key={a.id}>
              <div className="pn-h"><div><h2>{a.title || 'Acuerdo sin título'}</h2><p>{a.number}. {AG_STATUS[a.status]}{a.signed_at ? `, firmado el ${fDate(a.signed_at)}` : ''}. {[projectTotal(a) > 0 && money(projectTotal(a), a.currency), a.monthly && `${money(a.monthly.amount, a.currency)} por mes`].filter(Boolean).join(' + ')}</p></div>
                <button className={`btn btn-sm ${a.status === 'borrador' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => onAgreement(a.id)}><FileText size={15} /> {a.status === 'borrador' ? 'Terminar' : 'Ver acuerdo'}</button></div>
              {!live ? <p className="help">Cuando se firme, acá vas a marcar las entregas y los pagos.</p> : <ol className="tl">{a.phases.map(p => {
                const wk = works.find(x => x.phase.id === p.id), d = dues.find(x => x.ref === p.id), late = wk?.state === 'atrasada';
                return <li key={p.id} className={(p.kind === 'sena' ? d?.state === 'pagado' : p.done_at) ? 'done' : late ? 'late' : ''}>
                  <div className="tl-t"><b>{p.name}</b><span>{p.kind === 'sena' ? 'Al firmar' : p.done_at ? `Entregada el ${fDate(p.done_at)}${wk?.state === 'tarde' ? `, ${plural(wk.late, 'día', 'días')} tarde` : ', a tiempo'}` : p.due_at ? `${late ? 'Era para' : 'Para'} el ${fDate(p.due_at)}, ${when(p.due_at)}` : 'Sin fecha'}{(p.moved?.length || 0) > 0 && `. Se movió ${plural(p.moved!.length, 'vez', 'veces')}`}</span>{p.deliverable && <small>{p.deliverable}</small>}</div>
                  {d && <div className="tl-m"><b>{money(p.amount, a.currency)}</b><span>{d.state === 'pagado' ? `Pagado${p.payments.length ? ` el ${fDate(p.payments[p.payments.length - 1].at)}` : ''}` : d.state === 'futuro' ? 'Se paga al entregar' : d.state === 'vencido' ? `Vencido ${when(d.due_at!)}` : `Vence ${when(d.due_at!)}`}{d.state !== 'pagado' && paidOf(p) > 0 && `. Pagó ${money(paidOf(p), a.currency)}`}</span></div>}
                  <div className="tl-a">
                    {p.kind === 'fase' && !p.done_at && <><button className="btn btn-ghost btn-sm" onClick={() => setMove({ a, p })}>Mover</button><button className={`btn btn-sm ${late ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDone({ a, p })}><Check size={15} /> Entregada</button></>}
                    {d && d.state !== 'pagado' && d.state !== 'futuro' && <button className={`btn btn-sm ${d.state === 'vencido' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDue(d)}>Cobrar</button>}
                    {p.payments.length > 0 && <button className="btn btn-ghost btn-icon" title="Deshacer el último pago" aria-label="Deshacer el último pago" onClick={() => undoPay(a, p.payments[p.payments.length - 1].movement_id)}><Undo2 size={15} /></button>}
                    {p.done_at && !p.payments.length && <button className="btn btn-ghost btn-icon" title="No está entregada" aria-label="Deshacer entrega" onClick={() => ags.update(a.id, { phases: a.phases.map(x => x.id === p.id ? { ...x, done_at: null } : x) })}><Undo2 size={15} /></button>}
                  </div>
                </li>;
              })}</ol>}
              {live && a.monthly && <><h3>Abono, día {a.monthly.day}</h3>{months.length === 0 ? <p className="help">El primero es el {fDate(firstMonthly(a.monthly))}.</p> : months.slice(0, 6).map(d => <div className="li" key={d.key}><div><b>{d.label}</b><span>{d.state === 'pagado' ? `Pagado el ${fDate(d.paid_at!)}` : `${d.state === 'vencido' ? 'Venció' : 'Vence'} ${when(d.due_at!)}`}</span></div><em>{money(d.amount, a.currency)}</em>{d.state !== 'pagado' ? <button className={`btn btn-sm ${d.state === 'vencido' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDue(d)}>Cobrar</button> : <button className="btn btn-ghost btn-icon" title="Deshacer" aria-label="Deshacer pago" onClick={() => undoPay(a, a.monthly_paid.filter(x => x.period === d.ref).pop()!.movement_id)}><Undo2 size={15} /></button>}</div>)}</>}
              <div className="ag-f">
                {allDone && a.status === 'firmado' && !a.monthly && <button className="btn btn-primary btn-sm" onClick={async () => { if (await ags.update(a.id, { status: 'terminado', ended_at: Date.now() })) toast('Trabajo terminado'); }}>Cerrar el trabajo</button>}
                {a.status === 'firmado' && a.monthly && <button className="btn btn-ghost btn-sm" onClick={async () => { if (confirm('¿Dar de baja el abono desde hoy? Deja de generar cobros nuevos.')) await ags.update(a.id, { ended_at: Date.now(), status: 'terminado' }); }}>Dar de baja el abono</button>}
                {a.status !== 'terminado' && <button className="btn btn-ghost btn-sm" onClick={async () => { if (!confirm(a.status === 'borrador' ? '¿Borrar este borrador?' : '¿Cancelar este acuerdo? Deja de contar para cobros y fechas.')) return; if (a.status === 'borrador') await ags.remove(a.id); else await ags.update(a.id, { status: 'cancelado', ended_at: Date.now() }); }}><Trash2 size={14} /> {a.status === 'borrador' ? 'Borrar' : 'Cancelar acuerdo'}</button>}
                {a.status === 'terminado' && <button className="btn btn-ghost btn-sm" onClick={() => ags.update(a.id, { status: 'firmado', ended_at: null })}>Reabrir</button>}
              </div>
            </section>;
          })}
        </div>
        <div className="col">
          {mine.length > 0 && <section className="pn hot"><h2>Le toca un mensaje</h2>{mine.map(q => <div className="nx" key={q.key}><span>{q.ruleName}. {q.why}</span><p>{q.text}</p><button className="btn btn-primary btn-sm" disabled={!q.phone} onClick={async () => { if (await sendWhats(q)) toast('Anotado como enviado'); }}><MessageCircle size={15} /> Enviar</button></div>)}</section>}
          <section className="pn"><h2>Escribirle</h2><textarea className="textarea" rows={3} placeholder="Mensaje" aria-label="Mensaje" value={text} onChange={e => setText(e.target.value)} /><button className="btn btn-secondary btn-sm" disabled={!text.trim() || !w} onClick={async () => { if (await sendWhats({ phone: w, text: text.trim(), client_id: c.id })) { setText(''); toast('Anotado como enviado'); } }}><MessageCircle size={15} /> Abrir en WhatsApp</button>{!w && <p className="help">Falta su WhatsApp en Datos.</p>}</section>
          <section className="pn"><h2>Notas</h2><form className="ff" onSubmit={async e => { e.preventDefault(); if (note.trim() && await notes.add({ client_id: c.id, content: note.trim() })) setNote(''); }}><textarea className="textarea" rows={2} placeholder="Anotar algo" aria-label="Nota nueva" value={note} onChange={e => setNote(e.target.value)} />{note.trim() && <button className="btn btn-secondary btn-sm">Guardar nota</button>}</form>
            {notes.rows.filter(n => n.client_id === c.id).sort((a, b) => Number(b.created_at) - Number(a.created_at)).map(n => <div className="nt" key={n.id}><p>{n.content}</p><small>{fDate(Number(n.created_at))}</small><button className="btn btn-ghost btn-icon" onClick={() => notes.remove(n.id)} aria-label="Borrar nota"><Trash2 size={14} /></button></div>)}</section>
          {log.length > 0 && <section className="pn"><h2>Mensajes enviados</h2>{log.slice(0, 12).map(t => <div className="nt" key={t.id}><p>{t.text}</p><small>{when(t.at)}{t.by ? `, ${PEOPLE[t.by as 'benja'] || ''}` : ''}</small></div>)}</section>}
        </div>
      </div>
      {due && <Cobro due={due} onClose={() => setDue(null)} />}
      {move && <MoveDate {...move} onClose={() => setMove(null)} />}
      {done && <DoneModal {...done} onClose={() => setDone(null)} />}
    </div>
  );
}
function DoneModal({ a, p, onClose }: { a: Agreement; p: Phase; onClose: () => void }) {
  const ags = useTable<Agreement>('agreements'); const [t, setT] = useState(Date.now());
  const late = p.due_at ? daysTo(t, p.due_at) : 0;
  return <Modal title={`Entregar ${p.name}`} onClose={onClose} actions={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={async () => { if (await ags.update(a.id, { phases: a.phases.map(x => x.id === p.id ? { ...x, done_at: t } : x) })) { toast(p.amount > 0 ? 'Entregada. El aviso de cobro está en Mensajes' : 'Entregada'); onClose(); } }}>Entregada</button></>}>
    <Field label="Cuándo la entregamos"><DateIn label="Cuándo la entregamos" value={t} onChange={x => x && setT(x)} /></Field>
    <p className="help">{p.due_at ? late > 0 ? `${plural(late, 'día', 'días')} después de lo acordado.` : 'Dentro de lo acordado.' : ''} {p.amount > 0 && `Desde ahí tiene ${plural(p.pay_days, 'día', 'días')} para pagar ${money(p.amount, a.currency)}.`}</p>
  </Modal>;
}
function MoveDate({ a, p, onClose }: { a: Agreement; p: Phase; onClose: () => void }) {
  const ags = useTable<Agreement>('agreements'); const [t, setT] = useState<number | null>(p.due_at), [why, setWhy] = useState(''), [by, setBy] = useState<'nosotros' | 'cliente'>('nosotros');
  return <Modal title={`Mover ${p.name}`} onClose={onClose}><form className="ff" onSubmit={async e => { e.preventDefault(); if (!t) return; if (await ags.update(a.id, { phases: a.phases.map(x => x.id === p.id ? { ...x, due_at: t, moved: [...(x.moved || []), { from: p.due_at || t, to: t, why: why.trim(), by, at: Date.now() }] } : x) })) { toast('Fecha nueva guardada. Avisale al cliente'); onClose(); } }}>
    <Field label="Fecha nueva"><DateIn label="Fecha nueva" value={t} onChange={setT} /></Field>
    <Field label="Por quién"><select className="select" value={by} onChange={e => setBy(e.target.value as typeof by)}><option value="nosotros">Por nosotros</option><option value="cliente">Por el cliente</option></select></Field>
    <Field label="Motivo"><input className="input" required value={why} onChange={e => setWhy(e.target.value)} /></Field>
    {(p.moved?.length || 0) > 0 && <div className="lst">{p.moved!.map((m, i) => <div key={i}><b>{fDate(m.from)} a {fDate(m.to)}</b><span>{m.why}</span><em>{m.by}</em></div>)}</div>}
    <div className="x-modal-f in"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary">Guardar</button></div>
  </form></Modal>;
}
function ClientModal({ value, onClose, onSave, onDelete }: { value: Partial<ClientRow>; onClose: () => void; onSave: (c: Partial<ClientRow>) => void; onDelete: (c: Partial<ClientRow>) => void }) {
  const [name, setName] = useState(value.name || ''), [ct, setCt] = useState<ClientRow['contact']>(value.contact || {});
  const wa = ct.whatsapp ? waNumber(ct.whatsapp) : '';
  return <Modal title={value.id ? 'Datos del cliente' : 'Nuevo cliente'} onClose={onClose}><form className="ff" onSubmit={e => { e.preventDefault(); if (name.trim()) onSave({ ...(value.id ? { id: value.id } : {}), name: name.trim(), contact: { email: ct.email || '', whatsapp: ct.whatsapp || '', instagram: ct.instagram || '' } }); }}>
    <Field label="Nombre del negocio o la persona"><input className="input" required autoFocus value={name} onChange={e => setName(e.target.value)} /></Field>
    <Field label="WhatsApp" help={ct.whatsapp ? wa ? `Se usa +${wa}` : 'Escribilo con característica, sin el 15' : undefined}><input className="input" inputMode="tel" value={ct.whatsapp || ''} placeholder="351 555 1234" onChange={e => setCt({ ...ct, whatsapp: e.target.value })} /></Field>
    <div className="g2"><Field label="Email"><input className="input" type="email" value={ct.email || ''} onChange={e => setCt({ ...ct, email: e.target.value })} /></Field><Field label="Instagram"><input className="input" value={ct.instagram || ''} onChange={e => setCt({ ...ct, instagram: e.target.value })} /></Field></div>
    <div className="x-modal-f in">{value.id && <button type="button" className="btn btn-ghost" onClick={() => onDelete(value)}><Trash2 size={15} /> Borrar</button>}<span /><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary">Guardar</button></div>
  </form></Modal>;
}
