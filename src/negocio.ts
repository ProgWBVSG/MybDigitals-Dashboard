// Reglas del negocio: acuerdos, cumplimiento, plata y mensajes. Sin pantalla: todo lo que se calcula sale de acá.
import type { Person, Row } from './base';
import type { SvcCurrency as Cur } from './services';
import { money } from './services';
export type { Cur };

// ─── Fechas (siempre en hora local) ───
export const DAY = 86400000;
const p2 = (n: number) => String(n).padStart(2, '0');
export const ymd = (t: number | Date = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
export const fromYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12).getTime(); };
export const addDays = (t: number, n: number) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
export const addMonths = (t: number, n: number) => { const d = new Date(t), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return d.getTime(); };
export const dayStart = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** Días enteros entre hoy y una fecha: negativo si ya pasó. */
export const daysTo = (t: number, now = Date.now()) => Math.round((dayStart(t) - dayStart(now)) / DAY);
export const monday = (t: number = Date.now()) => { const d = new Date(dayStart(t)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(12); return d.getTime(); };
export const fDay = (t: number) => new Date(t).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/[.,]/g, '');
export const fDate = (t: number) => new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: new Date(t).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }).replace('.', '');
export const fLong = (t: number) => new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
export const fMonth = (t: number) => { const s = new Date(t).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }); return s[0].toUpperCase() + s.slice(1); };
export const when = (t: number, now = Date.now()) => {
  const n = daysTo(t, now);
  return n === 0 ? 'hoy' : n === 1 ? 'mañana' : n === -1 ? 'ayer' : n > 0 && n < 15 ? `en ${n} días` : n < 0 && n > -60 ? `hace ${-n} días` : fDate(t);
};
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ─── Acuerdos ───
export interface Payment { id: string; at: number; amount: number; movement_id: string }
export interface Phase {
  id: string; kind: 'sena' | 'fase'; name: string; deliverable: string;
  due_at: number | null; amount: number; pay_days: number; done_at: number | null; payments: Payment[];
  moved?: { from: number; to: number; why: string; by: 'nosotros' | 'cliente'; at: number }[];
}
export interface Monthly { amount: number; day: number; from: number; cancel_days: number; covers: string }
export interface Terms {
  pause_days: number; feedback_days: number; revisions: number; support_days: number; notice_days: number;
  late_fee_pct: number; our_discount_pct: number; city: string; stop_refund: string;
}
export interface ClientData { name?: string; business?: string; dni?: string; email?: string; whatsapp?: string; address?: string }
export type AgreementStatus = 'borrador' | 'firmado' | 'terminado' | 'cancelado';
export interface Agreement extends Row {
  client_id: string | null; service_id: string | null; title: string; number: string; status: AgreementStatus; currency: Cur;
  start_at: number; signed_at: number | null; ended_at: number | null; phases: Phase[]; monthly: Monthly | null;
  monthly_paid: (Payment & { period: string })[]; includes: string[]; excludes: string[]; client_duties: string[]; our_duties: string[];
  terms: Partial<Terms>; client_data: ClientData; notes: string;
}
export const AG_STATUS: Record<AgreementStatus, string> = { borrador: 'Borrador', firmado: 'En marcha', terminado: 'Terminado', cancelado: 'Cancelado' };

export const TERMS: Terms = { pause_days: 5, feedback_days: 5, revisions: 2, support_days: 30, notice_days: 2, late_fee_pct: 0, our_discount_pct: 0, city: 'Córdoba', stop_refund: '' };
export const OUR_DUTIES = [
  'Entregar cada fase en la fecha escrita en este acuerdo.',
  'Avisar con anticipación si una fecha está en riesgo, y proponer una nueva con su motivo.',
  'Mostrar el avance al cierre de cada fase, antes de cobrarla.',
  'Corregir sin cargo los errores propios del trabajo entregado.',
  'Cuidar la información, los accesos y los datos del cliente.',
  'Responder las consultas en días hábiles.',
];
export const CLIENT_DUTIES = [
  'Pagar cada fase dentro del plazo escrito, a partir de que se la entregamos.',
  'Enviar el material y los accesos que pidamos para cada fase.',
  'Revisar y responder cada entrega dentro del plazo acordado.',
  'Elegir una sola persona que apruebe las entregas.',
  'Pedir los cambios por escrito.',
];
export const EXCLUDES = [
  'Todo lo que no figure en "Qué incluye". Se presupuesta aparte y se empieza con tu aprobación.',
  'Producción de fotos, videos o logotipo.',
  'Pauta publicitaria y manejo de redes.',
];
export const newPhase = (p: Partial<Phase> = {}): Phase => ({ id: crypto.randomUUID(), kind: 'fase', name: '', deliverable: '', due_at: null, amount: 0, pay_days: 3, done_at: null, payments: [], ...p });
export const paidOf = (p: Phase) => p.payments.reduce((s, x) => s + x.amount, 0);
/** Primer vencimiento del abono: el día elegido, desde que empieza. */
export function firstMonthly(m: Monthly): number {
  const f = new Date(m.from);
  for (let i = 0; ; i++) { const y = f.getFullYear(), k = f.getMonth() + i, t = new Date(y, k, Math.min(m.day || 1, new Date(y, k + 1, 0).getDate()), 12).getTime(); if (t >= dayStart(m.from)) return t; }
}
export const isLive = (a: Agreement) => a.status === 'firmado' || a.status === 'terminado';
export const projectTotal = (a: Agreement) => a.phases.reduce((s, p) => s + (p.amount || 0), 0);
export const nextNumber = (list: Agreement[]) => {
  const y = new Date().getFullYear();
  const max = list.reduce((m, a) => { const r = /^MYB-(\d{4})-(\d+)$/.exec(a.number || ''); return r && Number(r[1]) === y ? Math.max(m, Number(r[2])) : m; }, 0);
  return `MYB-${y}-${String(max + 1).padStart(3, '0')}`;
};

export function newAgreement(client: ClientRow | null, all: Agreement[]): Partial<Agreement> {
  return {
    client_id: client?.id || null, number: nextNumber(all), status: 'borrador', currency: 'ARS', start_at: Date.now(), title: '',
    phases: [], monthly: null, monthly_paid: [], includes: [], excludes: EXCLUDES, our_duties: OUR_DUTIES, client_duties: CLIENT_DUTIES, terms: { ...TERMS }, notes: '',
    client_data: { business: client?.name || '', email: client?.contact?.email || '', whatsapp: client?.contact?.whatsapp || '' },
  };
}

// ─── Lo que tiene que pagar el cliente ───
export type DueState = 'pagado' | 'vencido' | 'por_vencer' | 'a_cobrar' | 'futuro';
export interface Due {
  key: string; agreement: Agreement; kind: 'sena' | 'fase' | 'mes'; ref: string; label: string; amount: number; paid: number; left: number;
  due_at: number | null; state: DueState; late: number; paid_at: number | null;
}
export function duesOf(a: Agreement, now = Date.now()): Due[] {
  if (!isLive(a)) return [];
  const out: Due[] = [];
  const push = (d: Omit<Due, 'state' | 'late' | 'left' | 'agreement' | 'key'>, claimable: boolean) => {
    const left = Math.max(0, Math.round((d.amount - d.paid) * 100) / 100);
    const n = d.due_at == null ? 0 : daysTo(d.due_at, now);
    const state: DueState = left <= 0 ? 'pagado' : !claimable ? 'futuro' : n < 0 ? 'vencido' : n <= 3 ? 'por_vencer' : 'a_cobrar';
    out.push({ ...d, key: `${a.id}:${d.kind}:${d.ref}`, agreement: a, left, state, late: state === 'vencido' ? -n : 0 });
  };
  for (const p of a.phases) {
    if (!(p.amount > 0)) continue;
    const sena = p.kind === 'sena';
    const base = sena ? (a.signed_at ?? a.start_at) : p.done_at;
    push({
      kind: p.kind, ref: p.id, label: p.name || (sena ? 'Seña' : 'Fase'), amount: p.amount, paid: paidOf(p),
      due_at: base != null ? addDays(base, p.pay_days) : p.due_at != null ? addDays(p.due_at, p.pay_days) : null,
      paid_at: p.payments.length ? Math.max(...p.payments.map(x => x.at)) : null,
    }, base != null);
  }
  if (a.monthly && a.monthly.amount > 0) {
    const end = a.ended_at ?? now + 31 * DAY;
    const first = new Date(a.monthly.from);
    for (let i = 0; i < 120; i++) {
      const y = first.getFullYear(), m = first.getMonth() + i;
      const due = new Date(y, m, Math.min(a.monthly.day || 1, new Date(y, m + 1, 0).getDate()), 12).getTime();
      if (due < dayStart(a.monthly.from)) continue;
      if (due > end) break;
      const period = ymd(due).slice(0, 7);
      const ps = a.monthly_paid.filter(x => x.period === period);
      push({ kind: 'mes', ref: period, label: `Abono de ${fMonth(due).toLowerCase()}`, amount: a.monthly.amount, paid: ps.reduce((s, x) => s + x.amount, 0), due_at: due, paid_at: ps.length ? Math.max(...ps.map(x => x.at)) : null }, daysTo(due, now) <= 10);
    }
  }
  return out;
}

// ─── Cómo venimos cumpliendo los dos ───
export interface Work { agreement: Agreement; phase: Phase; state: 'a_tiempo' | 'tarde' | 'atrasada' | 'en_curso' | 'sin_fecha'; late: number }
export const worksOf = (a: Agreement, now = Date.now()): Work[] => !isLive(a) ? [] : a.phases.filter(p => p.kind === 'fase').map(phase => {
  if (phase.due_at == null) return { agreement: a, phase, state: phase.done_at ? 'a_tiempo' as const : 'sin_fecha' as const, late: 0 };
  const n = daysTo(phase.done_at ?? now, phase.due_at);
  return { agreement: a, phase, late: Math.max(0, n), state: phase.done_at ? (n > 0 ? 'tarde' : 'a_tiempo') : n > 0 ? 'atrasada' : 'en_curso' };
});
export interface Score { ok: number; late: number; pending: number }
export function scoreOf(list: Agreement[], now = Date.now()): { us: Score; them: Score } {
  const us: Score = { ok: 0, late: 0, pending: 0 }, them: Score = { ok: 0, late: 0, pending: 0 };
  for (const a of list) {
    for (const w of worksOf(a, now)) { if (w.state === 'a_tiempo') us.ok++; else if (w.state === 'tarde' || w.state === 'atrasada') us.late++; }
    for (const d of duesOf(a, now)) {
      if (d.state === 'pagado' && d.due_at != null && d.paid_at != null) { if (daysTo(d.paid_at, d.due_at) > 0) them.late++; else them.ok++; }
      else if (d.state === 'vencido') them.late++;
      else if (d.state !== 'futuro' && d.state !== 'pagado') them.pending++;
    }
  }
  return { us, them };
}

// ─── Cómo viene cada cliente ───
export interface ClientRow extends Row { name: string; contact: { email?: string; whatsapp?: string; instagram?: string }; status: string; content_game?: string }
export interface Touch extends Row { client_id: string | null; prospect_id: string | null; agreement_id: string | null; rule: string; key: string; channel: string; text: string; result: string; at: number; by: string }
export type Health = 'debemos' | 'debe' | 'por_cobrar' | 'frio' | 'al_dia' | 'borrador' | 'sin_acuerdo' | 'terminado';
export const HEALTH: Record<Health, { label: string; hot: boolean; rank: number }> = {
  debemos: { label: 'Le debemos una fase', hot: true, rank: 0 },
  debe: { label: 'Nos debe', hot: true, rank: 1 },
  por_cobrar: { label: 'Hay que cobrarle', hot: true, rank: 2 },
  frio: { label: 'Sin contacto', hot: false, rank: 3 },
  borrador: { label: 'Falta firmar', hot: false, rank: 4 },
  al_dia: { label: 'Al día', hot: false, rank: 5 },
  sin_acuerdo: { label: 'Sin acuerdo', hot: false, rank: 6 },
  terminado: { label: 'Terminado', hot: false, rank: 7 },
};
export interface ClientView {
  client: ClientRow; agreements: Agreement[]; health: Health; why: string; next: { label: string; at: number } | null;
  total: number; paid: number; overdue: Due[]; claim: Due[]; lateWork: Work[]; done: number; phases: number; lastTouch: number | null; monthly: { amount: number; cur: Cur }[];
}
export function viewClient(client: ClientRow, all: Agreement[], touches: Touch[], rate: number, now = Date.now()): ClientView {
  const agreements = all.filter(a => a.client_id === client.id && a.status !== 'cancelado');
  const live = agreements.filter(isLive);
  const dues = live.flatMap(a => duesOf(a, now)), works = live.flatMap(a => worksOf(a, now));
  const overdue = dues.filter(d => d.state === 'vencido'), claim = dues.filter(d => d.state === 'por_vencer' || d.state === 'a_cobrar');
  const lateWork = works.filter(w => w.state === 'atrasada');
  const mine = touches.filter(t => t.client_id === client.id && t.result === 'enviado');
  const lastTouch = mine.length ? Math.max(...mine.map(t => t.at)) : null;
  const active = live.filter(a => a.status === 'firmado');
  const quiet = lastTouch != null ? -daysTo(lastTouch, now) : null;
  const cold = active.length ? (quiet ?? 99) > 10 && active.some(a => -daysTo(a.signed_at ?? a.start_at, now) > 10) : false;
  const health: Health = lateWork.length ? 'debemos' : overdue.length ? 'debe' : claim.some(d => d.state === 'por_vencer') ? 'por_cobrar'
    : cold ? 'frio' : active.length ? 'al_dia' : agreements.some(a => a.status === 'borrador') ? 'borrador' : live.length ? 'terminado' : 'sin_acuerdo';
  const ars = (n: number, c: Cur) => c === 'USD' ? n * rate : n;
  const upcoming = [
    ...works.filter(w => !w.phase.done_at && w.phase.due_at != null).map(w => ({ label: `Entregar ${w.phase.name}`, at: w.phase.due_at! })),
    ...dues.filter(d => d.state !== 'pagado' && d.state !== 'futuro' && d.due_at != null).map(d => ({ label: `Cobrar ${d.label}`, at: d.due_at! })),
  ].sort((x, y) => x.at - y.at);
  const why = health === 'debemos' ? `${lateWork[0].phase.name}: ${plural(lateWork[0].late, 'día', 'días')} de atraso nuestro`
    : health === 'debe' ? `${overdue[0].label}: venció ${when(overdue[0].due_at!, now)}`
    : health === 'por_cobrar' ? `${claim[0].label} vence ${when(claim[0].due_at!, now)}`
    : health === 'frio' ? (quiet == null ? 'Nunca le escribimos desde acá' : `Último mensaje hace ${quiet} días`)
    : health === 'borrador' ? 'El acuerdo todavía es un borrador' : health === 'sin_acuerdo' ? 'Falta armarle un acuerdo'
    : health === 'terminado' ? 'Trabajo entregado y cobrado' : upcoming[0] ? `${upcoming[0].label} ${when(upcoming[0].at, now)}` : 'Todo en orden';
  const oneOff = dues.filter(d => d.kind !== 'mes');
  return {
    client, agreements, health, why, next: upcoming[0] || null, overdue, claim, lateWork, lastTouch,
    total: oneOff.reduce((s, d) => s + ars(d.amount, d.agreement.currency), 0), paid: oneOff.reduce((s, d) => s + ars(Math.min(d.paid, d.amount), d.agreement.currency), 0),
    done: works.filter(w => w.phase.done_at).length, phases: works.length,
    monthly: active.filter(a => a.monthly).map(a => ({ amount: a.monthly!.amount, cur: a.currency })),
  };
}

// ─── Plata ───
export type MoveKind = 'ingreso' | 'gasto' | 'inversion' | 'retiro' | 'aporte' | 'traspaso';
export interface Movement extends Row {
  kind: MoveKind; amount: number; currency: Cur; date: number; concept: string; category: string; account: string; person: string;
  fund_id: string | null; to_fund_id: string | null; splits: { fund_id: string; amount: number }[];
  client_id: string | null; agreement_id: string | null; phase_id: string | null; bill_id: string | null; receipt_path: string | null;
}
export interface Fund extends Row { name: string; kind: string; pct: number; why: string; sort: number; archived: boolean }
export interface Bill extends Row { name: string; amount: number; currency: Cur; due_at: number; repeat: 'no' | 'mes' | 'anio'; fund_id: string | null; active: boolean; notes: string }
export const MOVE: Record<MoveKind, { label: string; sign: 1 | -1 | 0; help: string }> = {
  ingreso: { label: 'Entró', sign: 1, help: 'Un cliente pagó' },
  gasto: { label: 'Gasto', sign: -1, help: 'Se fue en funcionar' },
  inversion: { label: 'Inversión', sign: -1, help: 'Para crecer o desarrollar algo' },
  retiro: { label: 'Retiro', sign: -1, help: 'Se lo llevó uno de los dos' },
  aporte: { label: 'Aporte', sign: 1, help: 'Pusimos plata nosotros' },
  traspaso: { label: 'Mover', sign: 0, help: 'De un sobre a otro' },
};
export const CATEGORIES: Record<MoveKind, string[]> = {
  ingreso: ['Proyecto', 'Abono mensual', 'Otro'], gasto: ['Servidores y dominios', 'Herramientas', 'Impuestos', 'Traslados', 'Otro'],
  inversion: ['Desarrollo de producto', 'Publicidad', 'Equipos', 'Formación', 'Marca y contenido', 'Otro'], retiro: ['Sueldo', 'Otro'], aporte: ['Aporte'], traspaso: ['Traspaso'],
};
export type Purse = Record<Cur, number>;
export const purse = (): Purse => ({ ARS: 0, USD: 0 });
export const inArs = (p: Purse, rate: number) => p.ARS + p.USD * rate;
export const both = (p: Purse) => [p.ARS || !p.USD ? money(Math.round(p.ARS), 'ARS') : '', p.USD ? money(Math.round(p.USD * 100) / 100, 'USD') : ''].filter(Boolean).join(' + ');
export const sumMoves = (list: Movement[], f: (m: Movement) => boolean = () => true) => list.filter(f).reduce((p, m) => { p[m.currency] += m.amount; return p; }, purse());
export const cash = (list: Movement[]) => list.reduce((p, m) => { p[m.currency] += m.amount * MOVE[m.kind].sign; return p; }, purse());
/** Reparte un ingreso según los porcentajes. El redondeo queda en el primer sobre. */
export function splitIncome(amount: number, cur: Cur, funds: Fund[]): { fund_id: string; amount: number }[] {
  const on = funds.filter(f => !f.archived && f.pct > 0);
  const total = on.reduce((s, f) => s + f.pct, 0);
  if (!on.length || !(amount > 0)) return [];
  const unit = cur === 'USD' ? 100 : 1;
  const cap = Math.round(amount * Math.min(100, total) / 100 * unit) / unit;
  const parts = on.map(f => ({ fund_id: f.id, amount: Math.floor(amount * f.pct / Math.max(100, total) * unit) / unit }));
  parts[0].amount = Math.round((parts[0].amount + cap - parts.reduce((s, x) => s + x.amount, 0)) * 100) / 100;
  return parts;
}
export interface FundView { fund: Fund | null; got: Purse; used: Purse; left: Purse }
export function viewFunds(funds: Fund[], moves: Movement[]): FundView[] {
  const map = new Map<string, FundView>();
  const at = (id: string | null) => {
    const f = funds.find(x => x.id === id) || null, k = f?.id || '';
    if (!map.has(k)) map.set(k, { fund: f, got: purse(), used: purse(), left: purse() });
    return map.get(k)!;
  };
  funds.forEach(f => at(f.id));
  for (const m of moves) {
    const sign = MOVE[m.kind].sign;
    if (m.kind === 'traspaso') { at(m.fund_id).got[m.currency] -= m.amount; at(m.to_fund_id).got[m.currency] += m.amount; }
    else if (sign < 0) at(m.fund_id).used[m.currency] += m.amount;
    else {
      let rest = m.amount;
      for (const s of m.splits || []) { at(s.fund_id).got[m.currency] += s.amount; rest -= s.amount; }
      if (Math.abs(rest) > 0.005) at(m.kind === 'aporte' ? m.fund_id : null).got[m.currency] += rest;
    }
  }
  for (const v of map.values()) for (const c of ['ARS', 'USD'] as Cur[]) v.left[c] = Math.round((v.got[c] - v.used[c]) * 100) / 100;
  return [...map.values()].filter(v => v.fund ? !v.fund.archived || v.left.ARS || v.left.USD : v.got.ARS || v.got.USD || v.used.ARS || v.used.USD)
    .sort((a, b) => (a.fund?.sort ?? 999) - (b.fund?.sort ?? 999));
}
export const nextDue = (b: Bill) => b.repeat === 'mes' ? addMonths(b.due_at, 1) : b.repeat === 'anio' ? addMonths(b.due_at, 12) : b.due_at;

// ─── Planificación ───
export interface Objective extends Row {
  title: string; why: string; what_for: string; obstacle: string; plan_b: string; owner: Person | 'ambos'; metric: 'manual' | 'ingresos' | 'clientes' | 'abonos' | 'caja';
  unit: string; currency: Cur; start: number; current: number; target: number; start_at: number; due_at: number | null; status: 'activo' | 'logrado' | 'soltado'; sort: number;
}
export interface PlanItem extends Row {
  title: string; date: string; owner: Person; objective_id: string | null; client_id: string | null; agreement_id: string | null;
  level: 'clave' | 'extra'; top: boolean; when_then: string; first_step: string; minutes: number; spent: number; done_at: number | null; started_at: number | null; stuck: string; sort: number; moved: number;
}
export interface PlanDay extends Row { date: string; owner: Person; proud: string; blocker: string; closed_at: number | null }
export interface PlanWeek extends Row { week: string; owner: Person; objective_id: string | null; success: string; wins: string; blockers: string; change: string; reviewed_at: number | null }
export const METRICS: Record<Objective['metric'], string> = { manual: 'Lo cargo a mano', ingresos: 'Plata que entra', clientes: 'Acuerdos firmados', abonos: 'Abono mensual total', caja: 'Plata que tenemos' };
export function objectiveNow(o: Objective, moves: Movement[], ags: Agreement[], rate: number): number {
  const c = (p: Purse) => o.currency === 'USD' ? (p.USD + p.ARS / rate) : inArs(p, rate);
  if (o.metric === 'ingresos') return c(sumMoves(moves, m => m.kind === 'ingreso' && m.date >= dayStart(o.start_at)));
  if (o.metric === 'caja') return c(cash(moves));
  if (o.metric === 'clientes') return ags.filter(a => isLive(a) && (a.signed_at ?? 0) >= dayStart(o.start_at)).length;
  if (o.metric === 'abonos') return c(ags.filter(a => a.status === 'firmado' && a.monthly).reduce((p, a) => { p[a.currency] += a.monthly!.amount; return p; }, purse()));
  return o.current;
}
export function pace(o: Objective, now: number, at = Date.now()) {
  const span = o.target - o.start;
  const pct = span ? Math.max(0, Math.min(1, (now - o.start) / span)) : now >= o.target ? 1 : 0;
  if (!o.due_at || pct >= 1) return { pct, expected: null, behind: false, perWeek: null, weeks: null };
  const expected = Math.max(0, Math.min(1, (at - o.start_at) / Math.max(DAY, o.due_at - o.start_at)));
  const weeks = Math.max(0, (o.due_at - at) / (7 * DAY));
  return { pct, expected, behind: pct + 0.05 < expected, perWeek: (o.target - now) / Math.max(1, weeks), weeks };
}
export const objValue = (o: Objective, n: number) => o.metric === 'manual' || o.metric === 'clientes' ? `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(n)}${o.unit ? ' ' + o.unit : o.metric === 'clientes' ? ' firmados' : ''}` : money(Math.round(n), o.currency);

// ─── WhatsApp ───
/** Deja el número como lo pide WhatsApp: 549 + característica + número para Argentina. */
export function waNumber(raw?: string): string {
  let d = (raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  const intl = (raw || '').trim().startsWith('+');
  if (intl && !d.startsWith('54')) return d.length >= 8 ? d : '';
  if (d.startsWith('54')) d = d.slice(2);
  else if (d.length > 11 && !d.startsWith('0') && !/^\d{2,4}15\d{6,8}$/.test(d)) return d; // otro país sin el +
  if (d.startsWith('9') && d.length === 11) d = d.slice(1);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 12) { // característica + 15 + número
    for (const n of [2, 3, 4]) if (d.slice(n, n + 2) === '15') { d = d.slice(0, n) + d.slice(n + 2); break; }
  }
  return d.length === 10 ? '549' + d : '';
}
export const waLink = (phone: string, text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
