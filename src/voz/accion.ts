// Qué se puede hacer hablando, qué le falta a cada cosa y cómo se guarda o se deshace.
import type { Op, Person } from '../base';
import type { Service, SvcPrice } from '../services';
import { money } from '../services';
import {
  addDays, both, cash, dayStart, daysTo, duesOf, fDate, MOVE, newAgreement, newPhase, nextDue, splitIncome, viewFunds, waNumber, when, ymd,
  type Agreement, type Bill, type ClientRow, type Cur, type Due, type Fund, type MoveKind, type Movement, type PlanItem,
} from '../negocio';

export type Tipo = 'plata' | 'vencimiento' | 'tarea' | 'hecha' | 'entrega' | 'cliente' | 'prospecto' | 'nota' | 'evento' | 'mensaje' | 'acuerdo' | 'precio' | 'consulta' | 'ir' | 'deshacer';
export const TIPOS: Record<Tipo, string> = {
  plata: 'Plata', vencimiento: 'Pago a futuro', tarea: 'Tarea', hecha: 'Tarea terminada', entrega: 'Fase entregada', cliente: 'Cliente', prospecto: 'Posible cliente', nota: 'Nota',
  evento: 'Reunión', mensaje: 'Mensaje de WhatsApp', acuerdo: 'Acuerdo nuevo', precio: 'Precio', consulta: 'Consulta', ir: 'Ir a', deshacer: 'Deshacer',
};
export interface Accion {
  id: string; tipo: Tipo; texto: string; origen: 'reglas' | 'ia';
  clase: MoveKind; monto: number; moneda: Cur; fecha: number; hora: string;
  titulo: string; detalle: string; categoria: string; cuenta: string; persona: Person | '';
  cliente_id: string | null; cliente_nuevo: string; agregar: boolean; opciones: string[];
  ref: string; fondo: string | null; fondo2: string | null;
  repite: 'no' | 'mes' | 'anio'; minutos: number; top: boolean; telefono: string;
  fases: { nombre: string; monto: number; fecha: number | null }[]; abono: number;
  /** Lo que cambió a mano la persona: nada lo pisa después. */
  fijo: string[];
  /** La IA puso un monto que no se escuchó tal cual. */
  duda?: boolean;
}
export interface Servicio extends Service { id: string }
export interface Memoria { id: string; oido: string; cliente_id: string }
export interface Datos {
  clients: ClientRow[]; agreements: Agreement[]; movements: Movement[]; funds: Fund[]; bills: Bill[]; items: PlanItem[]; services: Servicio[];
  prospects: { id: string; name: string; business?: string; contact?: { whatsapp?: string } }[]; memoria: Memoria[]; rate: number; yo: Person; now: number; cuenta: string;
}
export const NOMBRE: Record<Person, string> = { benja: 'Benjamín', mati: 'Matías' };
let seq = 0;
export const nueva = (tipo: Tipo, d: Datos, p: Partial<Accion> = {}): Accion => ({
  id: `v${++seq}`, tipo, texto: '', origen: 'reglas', clase: 'gasto', monto: 0, moneda: 'ARS', fecha: d.now, hora: '', titulo: '', detalle: '', categoria: '', cuenta: '', persona: '',
  cliente_id: null, cliente_nuevo: '', agregar: false, opciones: [], ref: '', fondo: null, fondo2: null, repite: 'no', minutos: 0, top: false, telefono: '', fases: [], abono: 0, fijo: [], ...p,
});

// ─── Lo que ya está cargado y se puede enganchar ───
export const cobrables = (d: Datos, cliente: string | null): Due[] => d.agreements.filter(a => !cliente || a.client_id === cliente).flatMap(a => duesOf(a, d.now)).filter(x => x.state !== 'pagado');
export const dueDe = (d: Datos, ref: string) => ref.startsWith('due:') ? cobrables(d, null).find(x => x.key === ref.slice(4)) || null : null;
export const billDe = (d: Datos, ref: string) => ref.startsWith('bill:') ? d.bills.find(b => b.id === ref.slice(5)) || null : null;
export const faseDe = (d: Datos, ref: string) => {
  if (!ref.startsWith('fase:')) return null;
  const [, a, f] = ref.split(':'), ag = d.agreements.find(x => x.id === a), ph = ag?.phases.find(x => x.id === f);
  return ag && ph ? { ag, ph } : null;
};
export const itemDe = (d: Datos, ref: string) => ref.startsWith('item:') ? d.items.find(x => x.id === ref.slice(5)) || null : null;
export const servDe = (d: Datos, ref: string) => ref.startsWith('serv:') ? d.services.find(x => x.id === ref.slice(5)) || null : null;
export const clienteDe = (d: Datos, id: string | null) => id ? d.clients.find(c => c.id === id) || null : null;
export const telDe = (d: Datos, a: Accion) => waNumber(a.telefono || clienteDe(d, a.cliente_id)?.contact?.whatsapp || '');

/** Teléfono escrito prolijo, para guardar. */
const tel = (t: string) => t.trim();

// ─── Qué falta ───
export interface Falta { campo: 'monto' | 'cliente' | 'titulo' | 'ref' | 'fondo2' | 'telefono' | 'fecha'; pregunta: string }
export function falta(a: Accion, d: Datos): Falta | null {
  const p = (campo: Falta['campo'], pregunta: string): Falta => ({ campo, pregunta });
  switch (a.tipo) {
    case 'plata':
      if (!(a.monto > 0)) return p('monto', a.clase === 'ingreso' ? '¿Cuánto entró?' : '¿Cuánto fue?');
      if (a.opciones.length > 1 && !a.cliente_id) return p('cliente', `¿De cuál: ${a.opciones.map(id => clienteDe(d, id)?.name).filter(Boolean).join(' o ')}?`);
      if (a.clase === 'traspaso' && (a.fondo2 || null) === (a.fondo || null)) return p('fondo2', '¿A qué sobre va?');
      return null;
    case 'vencimiento': return !a.titulo ? p('titulo', '¿Qué hay que pagar?') : !(a.monto > 0) ? p('monto', '¿De cuánto es?') : null;
    case 'tarea': case 'nota': case 'evento': return a.titulo ? null : p('titulo', a.tipo === 'nota' ? '¿Qué anoto?' : a.tipo === 'evento' ? '¿Con quién es?' : '¿Qué hay que hacer?');
    case 'hecha': return itemDe(d, a.ref) ? null : p('ref', '¿Cuál tarea terminaste?');
    case 'entrega': return faseDe(d, a.ref) ? null : p('ref', '¿Qué fase entregamos?');
    case 'cliente': case 'prospecto': return a.cliente_id || a.titulo ? null : p('titulo', '¿Cómo se llama?');
    case 'mensaje': return !a.cliente_id && !a.telefono ? p('cliente', '¿A quién se lo mando?') : !telDe(d, a) ? p('telefono', `¿Cuál es el WhatsApp${a.cliente_id ? ' de ' + clienteDe(d, a.cliente_id)?.name : ''}?`) : !a.detalle ? p('titulo', '¿Qué le digo?') : null;
    case 'acuerdo': return !a.cliente_id && !a.cliente_nuevo ? p('cliente', '¿Con qué cliente es?') : !(a.monto > 0) && !(a.abono > 0) ? p('monto', '¿En cuánto se cerró?') : null;
    case 'precio': return !servDe(d, a.ref) ? p('ref', '¿De qué servicio?') : !(a.monto > 0) ? p('monto', '¿Cuánto sale ahora?') : null;
    default: return null;
  }
}

// ─── Avisos: lo que una persona atenta notaría ───
export function avisos(a: Accion, d: Datos, todas: Accion[] = []): string[] {
  const out: string[] = [];
  if (a.tipo !== 'plata' || !(a.monto > 0)) {
    if (a.tipo === 'cliente' && !a.cliente_id && a.titulo && d.clients.some(c => c.name.toLowerCase().trim() === a.titulo.toLowerCase().trim())) out.push('Ya hay un cliente con ese nombre.');
    return out;
  }
  const same = d.movements.find(m => m.kind === a.clase && m.amount === a.monto && m.currency === a.moneda && Math.abs(daysTo(m.date, a.fecha)) <= 2 && (!a.cliente_id || m.client_id === a.cliente_id));
  if (same) out.push(`Ya hay uno igual: ${same.concept}, ${when(same.date, d.now)}.`);
  if (a.duda) out.push('Revisá el monto: no lo escuché tal cual.');
  if (a.moneda === 'ARS' && a.monto < 1000 && !a.fijo.includes('monto')) out.push(`Son ${money(a.monto, 'ARS')}. ¿O eran ${money(a.monto * 1000, 'ARS')}?`);
  const due = dueDe(d, a.ref);
  if (due) {
    if (due.agreement.currency !== a.moneda) out.push(`El acuerdo está en ${due.agreement.currency === 'USD' ? 'dólares' : 'pesos'}: no se va a marcar ese pago.`);
    else if (a.monto < due.left) out.push(`Queda debiendo ${money(due.left - a.monto, a.moneda)} de ${due.label.toLowerCase()}.`);
    else if (a.monto > due.left) out.push(`Pagó ${money(a.monto - due.left, a.moneda)} de más sobre ${due.label.toLowerCase()}.`);
  }
  if (a.clase !== 'ingreso' && a.clase !== 'aporte' && a.fondo) {
    const antes = todas.slice(0, Math.max(0, todas.indexOf(a))).filter(x => x.tipo === 'plata' && x.fondo === a.fondo && x.moneda === a.moneda && MOVE[x.clase].sign <= 0).reduce((s, x) => s + x.monto, 0);
    const f = viewFunds(d.funds, d.movements).find(v => v.fund?.id === a.fondo);
    const queda = (f?.left[a.moneda] ?? 0) - antes - a.monto;
    if (f && queda < 0) out.push(`El sobre ${f.fund!.name} queda en ${money(queda, a.moneda)}.`);
  }
  if (a.fecha > addDays(d.now, 1)) out.push(`La fecha es ${when(a.fecha, d.now)}: todavía no pasó.`);
  return out;
}

// ─── Cómo queda después ───
export function despues(lista: Accion[], d: Datos): string {
  const l = lista.filter(a => a.tipo === 'plata' && a.monto > 0 && MOVE[a.clase].sign);
  if (!l.length) return '';
  const p = cash(d.movements);
  for (const a of l) p[a.moneda] += a.monto * MOVE[a.clase].sign;
  return `Después de esto tenemos ${both(p)}`;
}

// ─── Guardar ───
const ins = (table: string, body: object): Op => ({ table, op: 'insert', body });
const upd = (table: string, id: string, body: object): Op => ({ table, op: 'update', body: { ...body, updated_at: Date.now() }, filters: [['eq', 'id', id]] });
const del = (table: string, id: string): Op => ({ table, op: 'delete', filters: [['eq', 'id', id]] });
const uid = () => crypto.randomUUID();
const cap = (s: string) => s ? s[0].toUpperCase() + s.slice(1) : s;

/** Cómo volver atrás. Se aplica sobre los datos de ese momento, no sobre una foto vieja. */
export type Vuelta =
  | { que: 'borrar'; tabla: string; id: string }
  | { que: 'pago'; acuerdo: string; mov: string }
  | { que: 'fase'; acuerdo: string; fase: string }
  | { que: 'volver'; tabla: string; id: string; antes: Record<string, unknown>; puse: Record<string, unknown> };
export interface Guardado { ops: Op[]; vuelta: Vuelta[]; links: { label: string; to: string }[]; resumen: string[]; mensajes: { phone: string; text: string; client_id: string | null; nombre: string }[] }

export function guardar(lista: Accion[], d: Datos): Guardado {
  const g: Guardado = { ops: [], vuelta: [], links: [], resumen: [], mensajes: [] };
  // Copias de trabajo: si la misma frase toca dos veces un acuerdo, el segundo cambio parte del primero
  const ags = new Map(d.agreements.map(a => [a.id, a]));
  const bills = new Map(d.bills.map(b => [b.id, b]));
  const nuevos = new Map<string, string>(); // nombre dicho → cliente creado en esta misma tanda
  let sacarTop = false;
  const crearCliente = (nombre: string, contacto: object = {}) => {
    const k = nombre.trim().toLowerCase();
    const ya = nuevos.get(k) || d.clients.find(c => c.name.trim().toLowerCase() === k)?.id; if (ya) return ya;
    const id = uid(); nuevos.set(k, id);
    g.ops.push(ins('clients', { id, name: cap(nombre.trim()), status: 'active', contact: { email: '', whatsapp: '', instagram: '', ...contacto } }));
    g.vuelta.push({ que: 'borrar', tabla: 'clients', id });
    return id;
  };
  for (const a of lista) {
    const cliente = a.cliente_id || (a.cliente_nuevo && (a.agregar || a.tipo === 'acuerdo' || nuevos.has(a.cliente_nuevo.trim().toLowerCase())) ? crearCliente(a.cliente_nuevo) : null);
    const quien = clienteDe(d, cliente)?.name || a.cliente_nuevo;
    switch (a.tipo) {
      case 'plata': {
        const id = uid(), due = dueDe(d, a.ref), bill = billDe(d, a.ref), ok = due && due.agreement.currency === a.moneda && a.clase === 'ingreso';
        const concepto = (ok ? `${due!.label}, ${due!.agreement.title}` : a.titulo || a.categoria || MOVE[a.clase].label) + (!cliente && a.cliente_nuevo && !a.titulo.includes(a.cliente_nuevo) ? `, ${a.cliente_nuevo}` : '');
        g.ops.push(ins('movements', {
          id, kind: a.clase, amount: a.monto, currency: a.moneda, date: a.fecha, concept: concepto, category: ok ? (due!.kind === 'mes' ? 'Abono mensual' : 'Proyecto') : a.categoria, account: a.cuenta,
          person: a.clase === 'retiro' || a.clase === 'aporte' ? a.persona || d.yo : a.persona, splits: a.clase === 'ingreso' ? splitIncome(a.monto, a.moneda, d.funds) : [],
          fund_id: a.clase === 'ingreso' ? null : a.fondo, to_fund_id: a.clase === 'traspaso' ? a.fondo2 : null, client_id: ok ? due!.agreement.client_id : cliente, agreement_id: ok ? due!.agreement.id : null, phase_id: ok ? due!.ref : null, bill_id: bill?.id || null,
        }));
        g.vuelta.push({ que: 'borrar', tabla: 'movements', id });
        if (ok) {
          const x = ags.get(due!.agreement.id)!, pay = { id: uid(), at: a.fecha, amount: a.monto, movement_id: id };
          const patch: Partial<Agreement> = due!.kind === 'mes' ? { monthly_paid: [...x.monthly_paid, { ...pay, period: due!.ref }] } : { phases: x.phases.map(p => p.id === due!.ref ? { ...p, payments: [...p.payments, pay] } : p) };
          ags.set(x.id, { ...x, ...patch }); g.ops.push(upd('agreements', x.id, patch)); g.vuelta.push({ que: 'pago', acuerdo: x.id, mov: id });
        }
        if (bill) {
          const b = bills.get(bill.id)!, puse = b.repeat === 'no' ? { active: false } : { due_at: nextDue(b), amount: a.moneda === b.currency ? a.monto : b.amount };
          bills.set(b.id, { ...b, ...puse }); g.ops.push(upd('bills', b.id, puse));
          g.vuelta.push({ que: 'volver', tabla: 'bills', id: b.id, antes: Object.fromEntries(Object.keys(puse).map(k => [k, (b as any)[k]])), puse });
        }
        g.resumen.push(`${MOVE[a.clase].label} ${money(a.monto, a.moneda)}${quien && a.clase === 'ingreso' ? ' de ' + quien : ''}: ${ok ? due!.label : a.titulo || a.categoria}`);
        g.links.push({ label: 'Ver en Plata', to: 'plata' }); break;
      }
      case 'vencimiento': {
        const id = uid();
        g.ops.push(ins('bills', { id, name: a.titulo, amount: a.monto, currency: a.moneda, due_at: a.fecha, repeat: a.repite, fund_id: a.fondo, active: true, notes: '' }));
        g.vuelta.push({ que: 'borrar', tabla: 'bills', id }); g.resumen.push(`Pagar ${a.titulo}: ${money(a.monto, a.moneda)}, ${fDate(a.fecha)}`); g.links.push({ label: 'Ver en Plata', to: 'plata' }); break;
      }
      case 'tarea': {
        const id = uid(), owner = a.persona || d.yo, date = ymd(a.fecha);
        if (a.top) {
          for (const x of d.items.filter(x => x.top && x.owner === owner && x.date === date)) { g.ops.push(upd('plan_items', x.id, { top: false })); g.vuelta.push({ que: 'volver', tabla: 'plan_items', id: x.id, antes: { top: true }, puse: { top: false } }); }
        }
        g.ops.push(ins('plan_items', { id, title: a.titulo, date, owner, client_id: cliente, level: 'clave', top: a.top && !sacarTop, minutes: a.minutos || 45, when_then: a.hora ? `A las ${a.hora}${a.detalle ? ', ' + a.detalle : ''}` : a.detalle, sort: Date.now() % 1e9 }));
        if (a.top) sacarTop = true;
        g.vuelta.push({ que: 'borrar', tabla: 'plan_items', id }); g.resumen.push(`${a.titulo}, ${when(a.fecha, d.now)}${owner !== d.yo ? ', para ' + NOMBRE[owner] : ''}`);
        g.links.push(date === ymd(d.now) ? { label: 'Ver en Hoy', to: 'hoy' } : { label: 'Ver en Semana', to: 'semana' }); break;
      }
      case 'hecha': {
        const it = itemDe(d, a.ref)!, puse = { done_at: d.now };
        g.ops.push(upd('plan_items', it.id, puse)); g.vuelta.push({ que: 'volver', tabla: 'plan_items', id: it.id, antes: { done_at: it.done_at }, puse });
        g.resumen.push(`Terminada: ${it.title}`); g.links.push({ label: 'Ver en Hoy', to: 'hoy' }); break;
      }
      case 'entrega': {
        const { ag, ph } = faseDe(d, a.ref)!, x = ags.get(ag.id)!, patch = { phases: x.phases.map(p => p.id === ph.id ? { ...p, done_at: a.fecha } : p) };
        ags.set(x.id, { ...x, ...patch }); g.ops.push(upd('agreements', x.id, patch)); g.vuelta.push({ que: 'fase', acuerdo: x.id, fase: ph.id });
        g.resumen.push(`Entregada: ${ph.name}`); g.links.push({ label: 'Ver el cliente', to: `clients/${ag.client_id}` }); break;
      }
      case 'cliente': {
        if (a.cliente_id) {
          const c = clienteDe(d, a.cliente_id)!, puse: Record<string, unknown> = {};
          if (a.telefono) puse.contact = { ...c.contact, whatsapp: tel(a.telefono) };
          if (Object.keys(puse).length) { g.ops.push(upd('clients', c.id, puse)); g.vuelta.push({ que: 'volver', tabla: 'clients', id: c.id, antes: { contact: c.contact }, puse }); }
          if (a.detalle) { const id = uid(); g.ops.push(ins('client_notes', { id, client_id: c.id, content: a.detalle })); g.vuelta.push({ que: 'borrar', tabla: 'client_notes', id }); }
          g.resumen.push(`Actualizado: ${c.name}`); g.links.push({ label: 'Ver el cliente', to: `clients/${c.id}` });
        } else {
          const id = crearCliente(a.titulo, a.telefono ? { whatsapp: tel(a.telefono) } : {});
          if (a.detalle) { const n = uid(); g.ops.push(ins('client_notes', { id: n, client_id: id, content: a.detalle })); g.vuelta.push({ que: 'borrar', tabla: 'client_notes', id: n }); }
          g.resumen.push(`Cliente nuevo: ${cap(a.titulo)}`); g.links.push({ label: 'Ver el cliente', to: `clients/${id}` });
        }
        break;
      }
      case 'prospecto': {
        const id = uid();
        g.ops.push(ins('prospects', { id, name: cap(a.titulo), business: a.categoria, source: 'Voz', contact: a.telefono ? { whatsapp: tel(a.telefono) } : {}, notes: a.detalle }));
        g.vuelta.push({ que: 'borrar', tabla: 'prospects', id }); g.resumen.push(`Posible cliente: ${cap(a.titulo)}`); g.links.push({ label: 'Ver en Pre-venta', to: 'preventa' }); break;
      }
      case 'nota': {
        const id = uid(), texto = [a.titulo, a.detalle].filter(Boolean).join('. ');
        if (cliente) { g.ops.push(ins('client_notes', { id, client_id: cliente, content: texto })); g.vuelta.push({ que: 'borrar', tabla: 'client_notes', id }); g.links.push({ label: 'Ver el cliente', to: `clients/${cliente}` }); }
        else { g.ops.push(ins('notes', { id, title: a.titulo.slice(0, 80), content: texto })); g.vuelta.push({ que: 'borrar', tabla: 'notes', id }); g.links.push({ label: 'Ver en Ideas', to: 'notas' }); }
        g.resumen.push(`Nota: ${a.titulo}`); break;
      }
      case 'evento': {
        const id = uid(), [h, m] = (a.hora || '10:00').split(':').map(Number), t = dayStart(a.fecha) + (h * 60 + m) * 60000;
        g.ops.push(ins('calendar_events', { id, title: a.titulo, description: a.detalle, start_date: new Date(t).toISOString(), end_date: new Date(t + (a.minutos || 60) * 60000).toISOString(), type: 'meeting', all_day: !a.hora }));
        g.vuelta.push({ que: 'borrar', tabla: 'calendar_events', id }); g.resumen.push(`${a.titulo}, ${when(a.fecha, d.now)}${a.hora ? ' a las ' + a.hora : ''}`); g.links.push({ label: 'Ver en Calendario', to: 'calendar' }); break;
      }
      case 'mensaje': g.mensajes.push({ phone: telDe(d, a), text: a.detalle, client_id: cliente, nombre: quien || a.telefono }); g.resumen.push(`Mensaje para ${quien || a.telefono}`); break;
      case 'acuerdo': {
        const id = uid(), c = clienteDe(d, cliente) || { id: cliente!, name: cap(a.cliente_nuevo), contact: {} } as ClientRow, serv = servDe(d, a.ref);
        const base = newAgreement(c, [...ags.values()]);
        const phases = a.fases.length ? a.fases.map((f, i) => newPhase({ kind: /se[nñ]a|anticipo/i.test(f.nombre) ? 'sena' : 'fase', name: cap(f.nombre) || `Fase ${i + 1}`, amount: f.monto, due_at: f.fecha, pay_days: i ? 3 : 2 }))
          : a.monto > 0 ? [newPhase({ name: 'Entrega final', amount: a.monto, due_at: a.fecha > d.now + 3600000 ? a.fecha : addDays(d.now, 30) })] : [];
        const row = { ...base, id, client_id: c.id, title: cap(a.titulo) || serv?.name || 'Trabajo', service_id: serv?.id || null, includes: serv?.includes || [], currency: a.moneda, phases, start_at: d.now, monthly: a.abono > 0 ? { amount: a.abono, day: 10, from: addDays(d.now, 30), cancel_days: 30, covers: '' } : null, notes: a.detalle };
        ags.set(id, row as Agreement); g.ops.push(ins('agreements', row)); g.vuelta.push({ que: 'borrar', tabla: 'agreements', id });
        g.resumen.push(`Acuerdo en borrador: ${row.title}, ${c.name}`); g.links.push({ label: 'Revisar el acuerdo', to: `clients/${c.id}/${id}` }); break;
      }
      case 'precio': {
        const s = servDe(d, a.ref)!, per = a.repite === 'no' ? 'unico' : a.repite, i = s.prices.findIndex(p => p.period === per && !p.optional && p.currency === a.moneda);
        const j = i >= 0 ? i : s.prices.findIndex(p => p.period === per && !p.optional && !(p.amount > 0));
        const nuevo: SvcPrice = { id: uid(), label: '', amount: a.monto, max: null, before: null, currency: a.moneda, period: per };
        const prices = j >= 0 ? s.prices.map((p, k) => k === j ? { ...p, amount: a.monto, max: null, currency: a.moneda } : p) : [...s.prices, nuevo];
        const hist = (s as any).price_history || [];
        g.ops.push(upd('services', s.id, { prices, price_history: [{ at: Date.now(), prices: s.prices }, ...hist].slice(0, 30) })); g.vuelta.push({ que: 'volver', tabla: 'services', id: s.id, antes: { prices: s.prices, price_history: hist }, puse: { prices } });
        g.resumen.push(`${s.name}: ${money(a.monto, a.moneda)}`); g.links.push({ label: 'Ver en Servicios', to: 'servicios' }); break;
      }
      default: break;
    }
  }
  g.links = g.links.filter((l, i) => g.links.findIndex(x => x.to === l.to) === i);
  return g;
}

/** Deshace lo guardado. Devuelve las operaciones y, si algo cambió después, qué se dejó como está. */
export function deshacer(vuelta: Vuelta[], filas: (tabla: string, id: string) => any): { ops: Op[]; quedo: string[] } {
  const ops: Op[] = [], quedo: string[] = [], ags = new Map<string, Agreement>();
  const ag = (id: string): Agreement | null => ags.get(id) || filas('agreements', id) || null;
  const creados = new Set(vuelta.filter(v => v.que === 'borrar').map(v => (v as { id: string }).id));
  for (const v of [...vuelta].reverse()) {
    if (v.que === 'borrar') { if (filas(v.tabla, v.id)) ops.push(del(v.tabla, v.id)); }
    else if (v.que === 'pago' || v.que === 'fase') {
      const a = ag(v.acuerdo); if (!a || creados.has(a.id)) continue;
      const patch: Partial<Agreement> = v.que === 'pago' ? { phases: a.phases.map(p => ({ ...p, payments: p.payments.filter(x => x.movement_id !== v.mov) })), monthly_paid: a.monthly_paid.filter(x => x.movement_id !== v.mov) } : { phases: a.phases.map(p => p.id === v.fase ? { ...p, done_at: null } : p) };
      ags.set(a.id, { ...a, ...patch }); ops.push(upd('agreements', a.id, patch));
    } else {
      const r = filas(v.tabla, v.id); if (!r || creados.has(v.id)) continue;
      if (Object.entries(v.puse).every(([k, x]) => JSON.stringify(r[k]) === JSON.stringify(x))) ops.push(upd(v.tabla, v.id, v.antes)); else quedo.push(r.name || r.title || v.tabla);
    }
  }
  return { ops, quedo };
}
