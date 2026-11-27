// Qué mensaje le toca a cada cliente, según lo que está pasando con su acuerdo.
import type { Row } from './base';
import { addDays, DAY, daysTo, duesOf, fDate, isLive, waNumber, when, worksOf, type Agreement, type ClientRow, type Touch } from './negocio';
import { money, type Service } from './services';

export interface MessageRule extends Row { name: string; template: string; days: number; enabled: boolean; sort: number }
export interface ProspectRow extends Row { name: string; business: string; stage: string; contact: { whatsapp?: string }; client_id?: string | null; updated_at?: number; created_at?: number; meeting_at?: number | null }

export type RuleId = 'bienvenida' | 'fase_lista' | 'por_vencer' | 'vencido' | 'fecha_nueva' | 'avance' | 'resena' | 'volver' | 'sin_firmar' | 'prospecto' | 'reunion';
/** days: lo que significa el número en cada regla. */
export const RULES: Record<RuleId, { name: string; help: string; days: number; daysLabel: string; template: string }> = {
  bienvenida: { name: 'Bienvenida', help: 'Apenas se firma el acuerdo', days: 0, daysLabel: 'días después de firmar', template: 'Hola {nombre}, ya está firmado el acuerdo de {trabajo}. Arrancamos con {fase} y la entrega es el {fecha}. Cualquier cosa me escribís por acá.' },
  fase_lista: { name: 'Fase terminada', help: 'Cuando marcan una fase como entregada', days: 0, daysLabel: 'días después de entregar', template: 'Hola {nombre}, terminamos {fase} de {trabajo}. Revisala tranquilo y contame. Según lo acordado corresponde el pago de {monto}, hasta el {fecha}.' },
  por_vencer: { name: 'Pago por vencer', help: 'Antes de que venza', days: 2, daysLabel: 'días antes', template: 'Hola {nombre}, te recuerdo que el {fecha} vence {concepto} de {trabajo}: {monto}. ¡Gracias!' },
  vencido: { name: 'Pago vencido', help: 'Si no pagó. Se repite hasta que pague', days: 3, daysLabel: 'días entre aviso y aviso', template: 'Hola {nombre}, el {fecha} venció {concepto} de {trabajo}: {monto}. ¿Lo podés ver hoy? Si ya lo hiciste, pasame el comprobante y lo marco.' },
  fecha_nueva: { name: 'Cambio de fecha', help: 'Cuando mueven una entrega por algo nuestro', days: 0, daysLabel: 'días después', template: 'Hola {nombre}, te aviso que la entrega de {fase} de {trabajo} pasa al {fecha}. El motivo: {motivo}. Cualquier duda me decís.' },
  avance: { name: 'Contarle cómo va', help: 'Trabajo en marcha y hace días que no le escribimos', days: 7, daysLabel: 'días sin contacto', template: 'Hola {nombre}, te cuento cómo viene {trabajo}: estamos con {fase} y la entrega es el {fecha}. Seguimos según lo planeado.' },
  resena: { name: 'Pedir reseña', help: 'Después de la última entrega', days: 7, daysLabel: 'días después', template: 'Hola {nombre}, ya pasó una semana desde que entregamos {trabajo}. ¿Cómo lo estás usando? Si te sirvió, nos ayuda mucho que nos dejes una reseña.' },
  volver: { name: 'Volver a hablar', help: 'Trabajo terminado y sin contacto', days: 30, daysLabel: 'días sin contacto', template: 'Hola {nombre}, ¿cómo anda todo con {trabajo}? Quería saber si hay algo del día a día que te esté llevando tiempo y podamos resolver.' },
  sin_firmar: { name: 'Acuerdo sin firmar', help: 'Borrador que no avanza', days: 3, daysLabel: 'días en borrador', template: 'Hola {nombre}, ¿pudiste ver el acuerdo de {trabajo}? Si querés cambiar algo lo ajustamos y arrancamos.' },
  prospecto: { name: 'Prospecto sin respuesta', help: 'Está en pre-venta y no se movió', days: 4, daysLabel: 'días sin movimiento', template: 'Hola {nombre}, ¿cómo estás? Te escribo por lo que hablamos para {negocio}. ¿Lo seguimos esta semana?' },
  reunion: { name: 'Recordar reunión', help: 'El día anterior', days: 1, daysLabel: 'días antes', template: 'Hola {nombre}, te confirmo la reunión de {cuando}. ¿Te queda bien el horario?' },
};
export const RULE_IDS = Object.keys(RULES) as RuleId[];
export const VARS = ['nombre', 'trabajo', 'fase', 'concepto', 'monto', 'fecha', 'negocio', 'cuando', 'motivo'];
export const ruleOf = (id: RuleId, saved: MessageRule[]) => {
  const s = saved.find(r => r.id === id);
  return { id, ...RULES[id], days: s?.days ?? RULES[id].days, template: s?.template || RULES[id].template, enabled: s?.enabled ?? true };
};

export interface QueueItem {
  key: string; rule: RuleId; ruleName: string; who: string; phone: string; text: string; why: string; hot: boolean; at: number;
  client_id: string | null; prospect_id: string | null; agreement_id: string | null;
}
const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? (VARS.includes(k) ? '' : m)).replace(/ {2,}/g, ' ').replace(/ ([.,])/g, '$1').trim();
const first = (s: string) => (s || '').trim().split(/\s+/)[0] || '';

export function buildQueue(o: { clients: ClientRow[]; agreements: Agreement[]; services: Service[]; touches: Touch[]; prospects: ProspectRow[]; rules: MessageRule[]; now?: number }): QueueItem[] {
  const now = o.now ?? Date.now();
  const out: QueueItem[] = [];
  const sentAt = (key: string) => { const t = o.touches.filter(x => x.key === key); return t.length ? Math.max(...t.map(x => x.at)) : null; };
  const R = Object.fromEntries(RULE_IDS.map(id => [id, ruleOf(id, o.rules)])) as Record<RuleId, ReturnType<typeof ruleOf>>;

  for (const a of o.agreements) {
    const c = o.clients.find(x => x.id === a.client_id);
    if (!c || a.status === 'cancelado') continue;
    // Sólo se saluda por el nombre si hay una persona: "Hola Ana", nunca "Hola Bar"
    const name = first(a.client_data?.name || ''), phone = waNumber(c.contact?.whatsapp || a.client_data?.whatsapp);
    const work = a.title || o.services.find(s => s.id === a.service_id)?.name || 'tu proyecto';
    const base = { nombre: name, trabajo: work, negocio: c.name };
    const add = (rule: RuleId, ref: string, why: string, vars: Record<string, string>, hot = false, at = now, repeat = 0) => {
      const r = R[rule]; if (!r.enabled) return;
      const key = `${rule}:${a.id}:${ref}`, last = sentAt(key);
      if (last != null && (!repeat || now - last < repeat * DAY - DAY / 2)) return;
      out.push({ key, rule, ruleName: r.name, who: c.name, phone, text: fill(r.template, { ...base, ...vars }), why, hot, at, client_id: c.id, prospect_id: null, agreement_id: a.id });
    };
    const mine = o.touches.filter(t => t.client_id === c.id && t.result === 'enviado');
    const quiet = mine.length ? -daysTo(Math.max(...mine.map(t => t.at)), now) : null;
    if (a.status === 'borrador') {
      const age = -daysTo(Number(a.created_at) || now, now);
      if (age >= R.sin_firmar.days) add('sin_firmar', 'x', `Hace ${age} días que está en borrador`, {}, false, now, Math.max(3, R.sin_firmar.days));
      continue;
    }
    if (!isLive(a)) continue;
    const works = worksOf(a, now), dues = duesOf(a, now);
    const current = works.find(w => !w.phase.done_at);
    const phaseVars: Record<string, string> = current ? { fase: current.phase.name, fecha: current.phase.due_at ? fDate(current.phase.due_at) : 'a confirmar' } : {};
    const n0 = out.length;
    for (const w of works) { // si movimos una fecha por algo nuestro, se avisa
      const m = w.phase.moved?.[w.phase.moved.length - 1];
      if (!m || w.phase.done_at || m.by === 'cliente' || now - m.at > 5 * DAY) continue;
      add('fecha_nueva', `${w.phase.id}:${m.at}`, `Pasó del ${fDate(m.from)} al ${fDate(m.to)}`, { fase: w.phase.name, fecha: fDate(m.to), motivo: m.why.replace(/\.$/, '').replace(/^./, x => x.toLowerCase()) }, true, m.at);
    }
    if (a.status === 'firmado' && a.signed_at && daysTo(addDays(a.signed_at, R.bienvenida.days), now) <= 0 && -daysTo(a.signed_at, now) <= 7 && current && !works.some(w => w.phase.done_at))
      add('bienvenida', 'x', `Firmó ${when(a.signed_at, now)}`, phaseVars);
    for (const d of dues) {
      if (d.state === 'pagado' || d.state === 'futuro' || d.due_at == null) continue;
      const vars = { concepto: d.kind === 'mes' ? `el ${d.label.toLowerCase()}` : d.kind === 'sena' ? 'la seña' : `el pago de ${d.label}`, fase: d.label, monto: money(d.left, a.currency), fecha: fDate(d.due_at) };
      if (d.state === 'vencido') { add('vencido', `${d.kind}:${d.ref}`, `Venció ${when(d.due_at, now)}: ${money(d.left, a.currency)}`, vars, true, d.due_at, Math.max(1, R.vencido.days)); continue; }
      const ph = d.kind === 'fase' ? a.phases.find(p => p.id === d.ref) : null;
      const told = sentAt(`fase_lista:${a.id}:${d.ref}`) != null;
      if (ph?.done_at && !told && daysTo(addDays(ph.done_at, R.fase_lista.days), now) <= 0) add('fase_lista', d.ref, `Entregada ${when(ph.done_at, now)}`, vars, true, ph.done_at);
      else if (daysTo(d.due_at, now) <= R.por_vencer.days) add('por_vencer', `${d.kind}:${d.ref}`, `Vence ${when(d.due_at, now)}`, vars, true, d.due_at);
    }
    // Con una entrega nuestra atrasada no se manda "va según lo planeado": primero se entrega o se mueve la fecha
    if (a.status === 'firmado' && current && out.length === n0 && !works.some(w => w.state === 'atrasada')) {
      const since = quiet ?? -daysTo(a.signed_at ?? a.start_at, now);
      if (since >= R.avance.days) add('avance', 'x', `Hace ${since} días que no le escribimos`, phaseVars, false, now, R.avance.days);
    }
    const lastDone = works.length && works.every(w => w.phase.done_at) ? Math.max(...works.map(w => w.phase.done_at!)) : null;
    if (lastDone && !dues.some(d => d.state === 'vencido')) {
      const n = -daysTo(lastDone, now);
      if (n >= R.resena.days && n < R.resena.days + 21) add('resena', 'x', `Entregamos hace ${n} días`, {});
      else if (n >= R.volver.days && (quiet == null || quiet >= R.volver.days)) add('volver', 'x', quiet == null ? `Entregamos hace ${n} días` : `Último mensaje hace ${quiet} días`, {}, false, now, R.volver.days);
    }
  }

  for (const p of o.prospects) {
    if (['ganado', 'perdido'].includes(p.stage) || p.client_id) continue;
    const phone = waNumber(p.contact?.whatsapp), vars = { nombre: first(p.name), negocio: p.business || 'tu negocio', trabajo: '' };
    const add = (rule: RuleId, ref: string, why: string, more: Record<string, string>, hot: boolean) => {
      const r = R[rule], key = `${rule}:${p.id}:${ref}`;
      if (!r.enabled || sentAt(key) != null) return;
      out.push({ key, rule, ruleName: r.name, who: p.business || p.name, phone, text: fill(r.template, { ...vars, ...more }), why, hot, at: now, client_id: null, prospect_id: p.id, agreement_id: null });
    };
    if (p.meeting_at && daysTo(p.meeting_at, now) >= 0 && daysTo(p.meeting_at, now) <= R.reunion.days) {
      add('reunion', String(p.meeting_at), `Reunión ${when(p.meeting_at, now)}`, { cuando: `${when(p.meeting_at, now)} a las ${new Date(p.meeting_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}` }, true);
      continue;
    }
    const ts = o.touches.filter(t => t.prospect_id === p.id).map(t => t.at);
    const last = Math.max(Number(p.updated_at) || 0, Number(p.created_at) || 0, ...ts);
    const n = -daysTo(last, now);
    if (last && n >= R.prospecto.days && !(p.meeting_at && p.meeting_at > now)) add('prospecto', String(last), `Sin movimiento hace ${n} días`, {}, false);
  }
  return out.sort((a, b) => Number(b.hot) - Number(a.hot) || a.at - b.at);
}
