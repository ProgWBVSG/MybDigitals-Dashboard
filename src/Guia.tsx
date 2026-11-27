import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Plus, RefreshCw, Volume2 } from 'lucide-react';
import { post, usePerson, useTable } from './base';
import { toast, useExchangeRate } from './hooks';
import { useQueue } from './Mensajes';
import { daysTo, ymd, type Agreement, type Bill, type ClientRow, type Fund, type Movement, type Objective, type PlanItem } from './negocio';
import { panorama } from './voz/consultas';
import type { Datos } from './voz/accion';
import { HEALTH, viewSys, type Sistema, type SysPago } from './sistemaReglas';
import { INV_HEALTH, viewInv, type Invitacion } from './invReglas';
import { money } from './services';
import { Modal } from './ui';

// Lo contrario de "Hablar": mira lo cargado y dice qué conviene hacer ahora. Claude ordena; si no está, se arma con reglas.
type Paso = { titulo: string; por_que: string; seccion: string; minutos: number };
type Guia = { foco: string; pasos: Paso[]; ojo: string; ia: boolean };
const LUGAR: Record<string, string> = { hoy: 'Hoy', semana: 'Semana', clients: 'Clientes', sistemas: 'Sistemas', invitaciones: 'Invitaciones', mensajes: 'Mensajes', plata: 'Plata', servicios: 'Servicios', preventa: 'Pre-venta' };
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); };

export default function GuiaPanel({ onClose, go }: { onClose: () => void; go: (t: string) => void }) {
  const me = usePerson(), rate = useExchangeRate();
  const t = {
    clients: useTable<ClientRow>('clients'), ags: useTable<Agreement>('agreements'), moves: useTable<Movement>('movements'), funds: useTable<Fund>('funds'), bills: useTable<Bill>('bills'),
    items: useTable<PlanItem>('plan_items'), objs: useTable<Objective>('objectives'), sys: useTable<Sistema>('sistemas'), pays: useTable<SysPago>('sistema_pagos'), invs: useTable<Invitacion>('invitaciones'),
    pros: useTable<{ id: string; name: string; business?: string; stage: string; meeting_at: number | null }>('prospects'),
  };
  const { queue, ready: qReady } = useQueue();
  const ready = Object.values(t).every(x => x.ready) && qReady;
  const [g, setG] = useState<Guia | null>(null), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [added, setAdded] = useState<string[]>([]);

  const { ctx, local } = useMemo(() => {
    const now = Date.now(), hoy = ymd(now);
    const d = { clients: t.clients.rows, agreements: t.ags.rows, movements: t.moves.rows, funds: t.funds.rows, bills: t.bills.rows, items: t.items.rows, services: [], prospects: [], memoria: [], rate, yo: me, now, cuenta: '' } as unknown as Datos;
    const mias = t.items.rows.filter(i => i.owner === me && !i.done_at && i.date <= ymd(now + 2 * 86400000)).sort((a, b) => a.date.localeCompare(b.date));
    const sys = t.sys.rows.map(s => viewSys(s, t.pays.rows, now)).filter(v => v.health !== 'al_dia' && v.health !== 'baja');
    const invs = t.invs.rows.map(i => viewInv(i, now)).filter(v => v.health !== 'baja' && (INV_HEALTH[v.health].hot || (v.owe > 0 && !!v.i.event_date && daysTo(v.i.event_date, now) <= 30)));
    const pan = panorama(d);
    const ctx = {
      yo: me, hoy: new Date(now).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      mis_tareas: mias.slice(0, 25).map(i => ({ titulo: i.title, dia: i.date, importante: i.level === 'clave' || i.top, atrasada: i.date < hoy })),
      objetivos: t.objs.rows.filter(o => o.status === 'activo' && (o.owner === me || o.owner === 'ambos')).map(o => ({ titulo: o.title, para_que: o.why, actual: o.current, meta: o.target, unidad: o.unit || o.currency, vence: o.due_at ? ymd(o.due_at) : '' })),
      plata: pan,
      sistemas: sys.map(v => ({ nombre: v.s.name, estado: HEALTH[v.health].label, detalle: v.why, debe: v.debt ? money(v.debt, v.s.currency) : '' })),
      invitaciones: invs.map(v => ({ nombre: v.i.name, estado: INV_HEALTH[v.health].label, detalle: v.why, debe: v.owe ? money(v.owe, v.i.currency) : '' })),
      mensajes: queue.slice(0, 10).map(q => ({ para: q.who, que: q.ruleName, por_que: q.why, urgente: q.hot })),
      prospectos: { total: t.pros.rows.length, reuniones: t.pros.rows.filter(p => p.meeting_at && daysTo(p.meeting_at, now) >= 0 && daysTo(p.meeting_at, now) <= 7).map(p => ({ nombre: p.name, negocio: p.business || '', dia: ymd(p.meeting_at!) })) },
    };
    // Sin Claude: lo mismo, ordenado con reglas
    const pasos: Paso[] = [
      ...sys.filter(v => HEALTH[v.health].hot).map(v => ({ titulo: `Cobrarle a ${v.s.name}`, por_que: v.why, seccion: 'sistemas', minutos: 10 })),
      ...pan.nos_deben.slice(0, 3).map(x => ({ titulo: `Cobrar ${x.que} a ${x.cliente}`, por_que: `${money(x.monto, x.moneda)} pendientes`, seccion: 'clients', minutos: 10 })),
      ...invs.filter(v => INV_HEALTH[v.health].hot).map(v => ({ titulo: v.health === 'vencida' ? `Dar de baja la invitación de ${v.i.name}` : `Cobrarle a ${v.i.name}`, por_que: v.why, seccion: 'invitaciones', minutos: 5 })),
      ...queue.filter(q => q.hot).slice(0, 2).map(q => ({ titulo: `Mandarle el mensaje a ${q.who}`, por_que: q.why, seccion: 'mensajes', minutos: 5 })),
      ...mias.filter(i => i.date <= hoy).slice(0, 3).map(i => ({ titulo: i.title, por_que: i.date < hoy ? 'Quedó atrasada' : 'Es para hoy', seccion: 'hoy', minutos: i.minutes || 30 })),
    ].slice(0, 5);
    return { ctx, local: { foco: pasos.length ? 'Esto es lo que más pesa ahora.' : 'No hay nada urgente cargado. Buen momento para avanzar con un objetivo o buscar clientes.', pasos, ojo: '', ia: false } as Guia };
  }, [ready, me, rate, queue]); // eslint-disable-line react-hooks/exhaustive-deps

  const pedir = async (forzar = false) => {
    const h = hash(JSON.stringify({ ...ctx, hoy: ymd(Date.now()) }));
    try { const c = JSON.parse(localStorage.getItem('myb_guia_' + me) || 'null'); if (!forzar && c?.h === h && Date.now() - c.at < 6 * 3600000) { setG(c.g); return; } } catch { /* sin guardado */ }
    setBusy(true); setErr('');
    const r = await post<Omit<Guia, 'ia'>>('guia', { ctx });
    setBusy(false);
    if (!r.data) { setErr(r.error?.message || ''); setG(local); return; }
    const res = { ...r.data, ia: true };
    setG(res); localStorage.setItem('myb_guia_' + me, JSON.stringify({ h, at: Date.now(), g: res }));
  };
  const once = useRef(false);
  useEffect(() => { if (ready && !once.current) { once.current = true; pedir(); } }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const sumar = async (p: Paso) => {
    if (await t.items.add({ title: p.titulo, owner: me, date: ymd(Date.now()), level: 'clave', minutes: p.minutos } as Partial<PlanItem>)) { setAdded(a => [...a, p.titulo]); toast('Agregado a tu día'); }
  };
  const escuchar = () => {
    if (!g || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance([g.foco, ...g.pasos.map((p, i) => `${i + 1}. ${p.titulo}.`), g.ojo].filter(Boolean).join(' '));
    u.lang = 'es-AR'; speechSynthesis.speak(u);
  };
  useEffect(() => () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); }, []);

  return (
    <Modal title="¿Qué hago ahora?" onClose={onClose}>
      {!g ? <div className="gu-load"><div className="spinner-lg" /><p>{ready ? 'Mirando lo que hay cargado…' : 'Leyendo el dashboard…'}</p></div> : <>
        <p className="gu-foco">{g.foco}</p>
        {g.pasos.length > 0 && <ol className="gu-pasos">{g.pasos.map((p, i) => <li key={i}>
          <div><b>{p.titulo}</b><span>{p.por_que}</span><small>{LUGAR[p.seccion] || 'Hoy'}, unos {p.minutos} min</small></div>
          <div className="gu-a">
            <button className="btn btn-ghost btn-icon" title="Agregar a mi día" aria-label={`Agregar a mi día: ${p.titulo}`} disabled={added.includes(p.titulo)} onClick={() => sumar(p)}>{added.includes(p.titulo) ? <Check size={16} /> : <Plus size={16} />}</button>
            <button className={`btn btn-sm ${i === 0 ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { go(p.seccion); onClose(); }}>Ir <ArrowRight size={14} /></button>
          </div>
        </li>)}</ol>}
        {g.ojo && <p className="gu-ojo"><b>Ojo:</b> {g.ojo}</p>}
        {(err || !g.ia) && <p className="help">{err ? `${err}. ` : ''}Armado sin Claude, con lo que está cargado.</p>}
        <div className="x-modal-f in"><button className="btn btn-ghost btn-sm" onClick={escuchar}><Volume2 size={15} /> Escuchar</button><span /><button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => pedir(true)}><RefreshCw size={14} className={busy ? 'spin' : ''} /> {busy ? 'Pensando…' : 'Actualizar'}</button></div>
      </>}
    </Modal>
  );
}
