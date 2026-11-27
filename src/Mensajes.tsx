import { useMemo, useState } from 'react';
import { MessageCircle, RotateCcw } from 'lucide-react';
import { getPerson, PEOPLE, post, useTable } from './base';
import { toast } from './hooks';
import { norm } from './sheetImport';
import type { Service } from './services';
import { buildQueue, RULE_IDS, RULES, ruleOf, VARS, type MessageRule, type ProspectRow, type QueueItem, type RuleId } from './cola';
import { isLive, plural, viewClient, waLink, waNumber, when, type Agreement, type ClientRow, type Touch } from './negocio';
import { Empty, Field, Num, Seg } from './ui';

type Tab = 'hoy' | 'varios' | 'reglas' | 'enviados';

/** Lista de mensajes que tocan hoy. La usan Mensajes, Hoy y el menú. */
export function useQueue(): { queue: QueueItem[]; ready: boolean } {
  const c = useTable<ClientRow>('clients'), a = useTable<Agreement>('agreements'), s = useTable<Service & { id: string }>('services'), t = useTable<Touch>('touches'), p = useTable<ProspectRow>('prospects'), r = useTable<MessageRule>('message_rules');
  const queue = useMemo(() => buildQueue({ clients: c.rows, agreements: a.rows, services: s.rows, touches: t.rows, prospects: p.rows, rules: r.rows }), [c.rows, a.rows, s.rows, t.rows, p.rows, r.rows]);
  return { queue, ready: c.ready && a.ready && t.ready };
}
/** Abre WhatsApp con el mensaje escrito. Queda anotado como enviado y se puede deshacer. */
export async function sendWhats(o: { phone: string; text: string; client_id?: string | null; prospect_id?: string | null; agreement_id?: string | null; rule?: string; key?: string }): Promise<boolean> {
  if (!o.phone) { toast('Falta el WhatsApp', 'error'); return false; }
  const w = window.open(waLink(o.phone, o.text), 'myb-whatsapp');
  if (!w) { toast('El navegador bloqueó la ventana de WhatsApp. Permitila y probá de nuevo.', 'error'); return false; }
  const { error } = await post('db', { table: 'touches', op: 'insert', body: { client_id: o.client_id || null, prospect_id: o.prospect_id || null, agreement_id: o.agreement_id || null, rule: o.rule || '', key: o.key || '', text: o.text, result: 'enviado', at: Date.now(), by: getPerson() } });
  if (error) { toast('Se abrió WhatsApp, pero no se pudo anotar: ' + error.message, 'error'); return false; }
  return true;
}

export default function Mensajes() {
  const [tab, setTab] = useState<Tab>('hoy');
  const { queue, ready } = useQueue();
  return (
    <div>
      <div className="page-head"><div><h1>Mensajes</h1><p>{!ready ? 'Cargando' : queue.length ? `${plural(queue.length, 'mensaje para mandar', 'mensajes para mandar')} hoy` : 'Nada para mandar hoy'}</p></div></div>
      <Seg value={tab} onChange={setTab} label="Sección" options={[['hoy', 'Para hoy'], ['varios', 'Escribir a varios'], ['reglas', 'Cuándo se manda'], ['enviados', 'Enviados']]} />
      <div className="ms">{tab === 'hoy' ? <Today queue={queue} ready={ready} /> : tab === 'varios' ? <Many /> : tab === 'reglas' ? <Rules /> : <Sent />}</div>
    </div>
  );
}

function Today({ queue, ready }: { queue: QueueItem[]; ready: boolean }) {
  if (!ready) return <div className="view-load"><div className="spinner-lg" /></div>;
  if (!queue.length) return <Empty title="Estás al día" text="Acá aparecen solos los avisos de cobro, las entregas, los seguimientos y los pedidos de reseña, según el acuerdo de cada cliente." />;
  return <div className="ms-list">{queue.map(q => <Card key={q.key} q={q} />)}</div>;
}
function Card({ q }: { q: QueueItem }) {
  const clients = useTable<ClientRow>('clients'), touches = useTable<Touch>('touches');
  const [text, setText] = useState(q.text), [num, setNum] = useState(''), [open, setOpen] = useState(false);
  const phone = q.phone || waNumber(num);
  const send = async () => {
    if (!q.phone && q.client_id && phone) { const c = clients.rows.find(x => x.id === q.client_id); if (c) await clients.update(c.id, { contact: { ...c.contact, whatsapp: num } }); }
    if (await sendWhats({ ...q, phone, text })) toast('Anotado como enviado');
  };
  return <article className={`mc${q.hot ? ' hot' : ''}`}>
    <header><div><b>{q.who}</b><span>{q.ruleName}. {q.why}</span></div></header>
    {open ? <textarea className="textarea" aria-label="Mensaje" rows={4} value={text} onChange={e => setText(e.target.value)} autoFocus /> : <button className="mc-t" onClick={() => setOpen(true)} title="Cambiar el texto">{text}</button>}
    {!q.phone && <input className="input" inputMode="tel" placeholder="WhatsApp con característica" aria-label="WhatsApp" value={num} onChange={e => setNum(e.target.value)} />}
    <footer><button className="btn btn-ghost btn-sm" onClick={() => touches.add({ client_id: q.client_id, prospect_id: q.prospect_id, agreement_id: q.agreement_id, rule: q.rule, key: q.key, text: '', result: 'omitido', at: Date.now(), by: getPerson() })}>Omitir</button>
      <button className={`btn ${q.hot ? 'btn-primary' : 'btn-secondary'}`} disabled={!phone} onClick={send}><MessageCircle size={16} /> Enviar</button></footer>
  </article>;
}

function Many() {
  const clients = useTable<ClientRow>('clients'), ags = useTable<Agreement>('agreements'), services = useTable<Service & { id: string }>('services'), touches = useTable<Touch>('touches');
  const [who, setWho] = useState('todos'), [text, setText] = useState('Hola {nombre}, '), [done, setDone] = useState<string[]>([]), [off, setOff] = useState<string[]>([]);
  const list = clients.rows.filter(c => {
    if (who === 'todos') return true;
    const mine = ags.rows.filter(a => a.client_id === c.id && isLive(a));
    if (who.startsWith('s:')) return mine.some(a => a.service_id === who.slice(2));
    const v = viewClient(c, ags.rows, touches.rows, 1);
    return who === 'marcha' ? mine.some(a => a.status === 'firmado') : who === 'terminado' ? v.health === 'terminado' : who === 'debe' ? v.health === 'debe' : true;
  }).sort((a, b) => a.name.localeCompare(b.name));
  const ok = list.filter(c => waNumber(c.contact?.whatsapp)), pick = ok.filter(c => !off.includes(c.id)), left = pick.filter(c => !done.includes(c.id)), next = left[0];
  const fill = (c: ClientRow) => text.replaceAll('{nombre}', (ags.rows.find(a => a.client_id === c.id && a.client_data?.name)?.client_data.name || '').trim().split(/\s+/)[0]).replaceAll('{negocio}', c.name).replace(/ {2,}/g, ' ').replace(/ ([,.])/g, '$1');
  const reset = (w: string) => { setWho(w); setDone([]); setOff([]); };
  return <div className="many">
    <section className="pn ff">
      <Field label="A quiénes"><select className="select" value={who} onChange={e => reset(e.target.value)}><option value="todos">Todos los clientes</option><option value="marcha">Con trabajo en marcha</option><option value="terminado">Con trabajo terminado</option><option value="debe">Que deben un pago</option>{services.rows.map(s => <option key={s.id} value={'s:' + s.id}>Servicio: {s.name}</option>)}</select></Field>
      <Field label="Mensaje" help="{nombre} y {negocio} se completan solos"><textarea className="textarea" rows={6} value={text} onChange={e => { setText(e.target.value); setDone([]); }} /></Field>
      {next ? <><p className="preview">{fill(next)}</p><button className="btn btn-primary" disabled={text.trim().length < 5} onClick={async () => { if (await sendWhats({ phone: waNumber(next.contact?.whatsapp), text: fill(next), client_id: next.id, rule: 'varios' })) setDone(d => [...d, next.id]); }}><MessageCircle size={16} /> Enviar a {next.name}</button><p className="help">{done.length} de {pick.length}. Se abre uno por vez, así WhatsApp no lo toma como spam.</p></>
        : <p className="help">{done.length ? `Listo: ${plural(done.length, 'mensaje', 'mensajes')}.` : 'No hay nadie con WhatsApp en ese grupo.'}</p>}
    </section>
    <section className="pn"><h2>{plural(list.length, 'cliente', 'clientes')}</h2>{list.map(c => { const has = !!waNumber(c.contact?.whatsapp); return <label className="ck" key={c.id}><input type="checkbox" disabled={!has} checked={has && !off.includes(c.id)} onChange={() => setOff(o => o.includes(c.id) ? o.filter(x => x !== c.id) : [...o, c.id])} /><span>{c.name}</span><em>{done.includes(c.id) ? 'Enviado' : has ? '' : 'Sin WhatsApp'}</em></label>; })}</section>
  </div>;
}

function Rules() {
  const r = useTable<MessageRule>('message_rules');
  const save = (id: RuleId, p: Partial<MessageRule>) => {
    const old = r.rows.find(x => x.id === id), cur = ruleOf(id, r.rows);
    return old ? r.update(id, p) : r.add({ id, name: cur.name, days: cur.days, template: cur.template, enabled: cur.enabled, ...p });
  };
  return <div className="rules">{RULE_IDS.map(id => <Rule key={id} id={id} saved={r.rows} save={p => save(id, p)} />)}</div>;
}
function Rule({ id, saved, save }: { id: RuleId; saved: MessageRule[]; save: (p: Partial<MessageRule>) => Promise<unknown> }) {
  const r = ruleOf(id, saved); const [t, setT] = useState(r.template), [d, setD] = useState(r.days);
  const dirty = t !== r.template || d !== r.days;
  return <section className={`pn rule${r.enabled ? '' : ' off'}`}>
    <div className="pn-h"><div><h2>{r.name}</h2><p>{r.help}</p></div><label className="sw"><input type="checkbox" checked={r.enabled} onChange={e => save({ enabled: e.target.checked })} aria-label={`Activar ${r.name}`} /><i /></label></div>
    {r.enabled && <><textarea className="textarea" rows={3} aria-label={`Texto de ${r.name}`} value={t} onChange={e => setT(e.target.value)} />
      <div className="rule-f"><label><Num label={r.daysLabel} value={d} onChange={n => setD(Math.max(0, Math.round(n)))} /><span>{r.daysLabel}</span></label><span />
        {t !== RULES[id].template && <button className="btn btn-ghost btn-sm" onClick={() => setT(RULES[id].template)}>Texto original</button>}<button className="btn btn-secondary btn-sm" disabled={!dirty} onClick={async () => { await save({ template: t, days: d }); toast('Guardado'); }}>Guardar</button></div>
      <p className="help">Se completan solos: {VARS.filter(v => RULES[id].template.includes(`{${v}}`) || v === 'nombre').map(v => `{${v}}`).join(' ')}</p></>}
  </section>;
}

function Sent() {
  const t = useTable<Touch>('touches'), clients = useTable<ClientRow>('clients'), pros = useTable<ProspectRow>('prospects');
  const [q, setQ] = useState('');
  const name = (x: Touch) => clients.rows.find(c => c.id === x.client_id)?.name || pros.rows.find(p => p.id === x.prospect_id)?.business || pros.rows.find(p => p.id === x.prospect_id)?.name || 'Cliente';
  const rows = [...t.rows].sort((a, b) => b.at - a.at).filter(x => !q || norm(name(x) + ' ' + x.text).includes(norm(q))).slice(0, 150);
  if (!t.rows.length) return <Empty title="Todavía no mandaste mensajes" text="Todo lo que envíes desde acá queda anotado con fecha y quién lo mandó." />;
  return <section className="pn"><input className="input" placeholder="Buscar" aria-label="Buscar mensaje" value={q} onChange={e => setQ(e.target.value)} />
    {rows.map(x => <div className="li sent" key={x.id}><div><b>{name(x)}</b><span>{x.result === 'omitido' ? 'Omitido' : x.text}</span><small>{when(x.at)}{x.by ? `, ${PEOPLE[x.by as 'benja'] || x.by}` : ''}{x.rule && RULES[x.rule as RuleId] ? `, ${RULES[x.rule as RuleId].name.toLowerCase()}` : ''}</small></div>
      <button className="btn btn-ghost btn-sm" title="No se envió: vuelve a la lista" onClick={() => t.remove(x.id)}><RotateCcw size={14} /> Deshacer</button></div>)}</section>;
}
