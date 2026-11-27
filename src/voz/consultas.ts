// Responde preguntas con los datos de verdad. Las cuentas las hace el dashboard, nunca la IA.
import { money } from '../services';
import {
  addDays, addMonths, both, cash, daysTo, duesOf, fDate, fMonth, fromYmd, inArs, plural, purse, sumMoves, viewClient, viewFunds, when, worksOf, ymd,
  type Movement, type Purse,
} from '../negocio';
import { clienteDe, type Datos } from './accion';
import { buscar, listaClientes, mejorTexto } from './entender';
import { fecha, plano } from './numeros';

export type Tema = 'caja' | 'ingresos' | 'gastos' | 'inversiones' | 'retiros' | 'balance' | 'nos_deben' | 'hay_que_pagar' | 'sobres' | 'cliente' | 'tareas' | 'entregas' | 'abonos' | 'precio' | 'otra';
export interface Pregunta { tema: Tema; desde: number | null; hasta: number | null; cliente_id: string | null; ref: string; periodo: string }
export interface Respuesta { texto: string; filas: { a: string; b: string; c?: string }[]; to: string }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function pregunta(texto: string, d: Datos): Pregunta {
  const p = plano(texto), c = buscar(texto, listaClientes(d))[0]?.id ?? null;
  let desde: number | null = null, hasta: number | null = null, periodo = '';
  const h = new Date(d.now), y = h.getFullYear(), m = h.getMonth();
  const mk = (a: Date, b: Date, t: string) => { desde = a.getTime(); hasta = b.getTime(); periodo = t; };
  const lunes = addDays(new Date(y, m, h.getDate()).getTime(), -((h.getDay() + 6) % 7));
  const mes = new RegExp(`\\b(${MESES.join('|')})\\b`).exec(p);
  if (/\bmes pasado\b/.test(p)) mk(new Date(y, m - 1, 1), new Date(y, m, 1), 'el mes pasado');
  else if (/\b(este|en el|del) mes\b/.test(p)) mk(new Date(y, m, 1), new Date(y, m + 1, 1), 'este mes');
  else if (/\besta semana\b/.test(p)) mk(new Date(lunes), new Date(addDays(lunes, 7)), 'esta semana');
  else if (/\bsemana pasada\b/.test(p)) mk(new Date(addDays(lunes, -7)), new Date(lunes), 'la semana pasada');
  else if (/\beste ano\b/.test(p)) mk(new Date(y, 0, 1), new Date(y + 1, 0, 1), 'este año');
  else if (mes) { const k = MESES.indexOf(mes[1]), yy = k > m ? y - 1 : y; mk(new Date(yy, k, 1), new Date(yy, k + 1, 1), 'en ' + fMonth(new Date(yy, k, 1, 12).getTime()).toLowerCase()); }
  else { const f = fecha(texto, d.now, /\b(tengo|hacer|tareas?|pagar|entregar)\b/.test(p) ? 'despues' : 'antes'); if (f) { const x = new Date(f.at); mk(new Date(x.getFullYear(), x.getMonth(), x.getDate()), new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1), when(f.at, d.now)); } }
  const serv = /\b(sale|vale|cuesta|cobramos|precio|cobrar por)\b/.test(p) ? mejorTexto(texto, d.services.map(s => ({ id: s.id, n: s.name }))) : '';
  const tema: Tema = /\b(alcanza|conviene|podemos|deberia|deberiamos|por que|como hago|que hago para)\b/.test(p) ? 'otra'
    : serv ? 'precio'
    : /\b(debe|deben|deuda|deudas|adeuda|cobrar|falta cobrar)\b/.test(p) && !/\b(debo|debemos)\b/.test(p) ? 'nos_deben'
    : /\b(hay que pagar|tengo que pagar|tenemos que pagar|vence|vencen|vencimientos?|debemos)\b/.test(p) && !/entreg/.test(p) ? 'hay_que_pagar'
    : /\b(entregar|entregas?|entregamos|fases?)\b/.test(p) ? 'entregas'
    : /\bsobres?\b/.test(p) ? 'sobres'
    : /\b(abonos?|mensual|mensuales|todos los meses)\b/.test(p) ? 'abonos'
    : /\b(invertimos|invertido|inversion|inversiones|inverti)\b/.test(p) ? 'inversiones'
    : /\b(gaste|gastamos|gasto|gastos|gastado|salio|se fue)\b/.test(p) ? 'gastos'
    : /\b(retire|retiramos|retiros|llevamos|lleve|llevo)\b/.test(p) ? 'retiros'
    : /\b(entro|entraron|ingreso|ingresos|facturamos|cobramos|ganamos|juntamos|vendimos)\b/.test(p) ? 'ingresos'
    : /\b(hacer|tareas?|pendientes?|falta|agenda|por donde)\b/.test(p) ? 'tareas'
    : c ? 'cliente'
    : /\b(balance|venimos|vamos|resumen|resumime)\b/.test(p) ? 'balance'
    : /\b(tenemos|tengo|hay|plata|caja|queda|quedan)\b/.test(p) ? 'caja' : 'otra';
  return { tema, desde, hasta, cliente_id: c, ref: serv ? 'serv:' + serv : '', periodo };
}

export function responder(q: Pregunta, d: Datos): Respuesta | null {
  const dentro = (m: Movement) => (q.desde == null || m.date >= q.desde) && (q.hasta == null || m.date < q.hasta) && (!q.cliente_id || m.client_id === q.cliente_id);
  const nom = (id: string | null) => clienteDe(d, id)?.name || 'Sin cliente';
  const per = q.periodo ? q.periodo[0].toUpperCase() + q.periodo.slice(1) : 'En toda la historia';
  const total = (p: Purse) => p.USD ? `${both(p)} (${money(Math.round(inArs(p, d.rate)), 'ARS')} en total)` : both(p);
  const movs = (k: Movement['kind'], verbo: string): Respuesta => {
    const l = d.movements.filter(m => m.kind === k && dentro(m)), s = sumMoves(l), por = new Map<string, Purse>();
    for (const m of l) { const n = k === 'ingreso' ? (m.client_id ? nom(m.client_id) : m.concept) : m.category || m.concept; if (!por.has(n)) por.set(n, purse()); por.get(n)![m.currency] += m.amount; }
    const de = q.cliente_id ? ' de ' + nom(q.cliente_id) : '';
    return { texto: l.length ? `${per} ${verbo} ${total(s)}${de}, en ${plural(l.length, 'movimiento', 'movimientos')}.` : `${per} no hay nada cargado${de}.`, filas: [...por].sort((a, b) => inArs(b[1], d.rate) - inArs(a[1], d.rate)).slice(0, 6).map(([a, b]) => ({ a, b: both(b) })), to: 'plata' };
  };
  const suma = <T,>(l: T[], f: (x: T) => [number, 'ARS' | 'USD']) => l.reduce((p, x) => { const [n, c] = f(x); p[c] += n; return p; }, purse());
  switch (q.tema) {
    case 'caja': { const v = viewFunds(d.funds, d.movements).filter(x => x.left.ARS || x.left.USD); return { texto: `Tenemos ${total(cash(d.movements))}.`, filas: v.map(x => ({ a: x.fund?.name || 'Sin asignar', b: both(x.left) })), to: 'plata' }; }
    case 'sobres': { const v = viewFunds(d.funds, d.movements); return { texto: v.length ? 'Así están los sobres.' : 'Todavía no hay sobres armados.', filas: v.map(x => ({ a: x.fund?.name || 'Sin asignar', b: both(x.left), c: `usado ${both(x.used)}` })), to: 'plata' }; }
    case 'ingresos': return movs('ingreso', 'entraron');
    case 'gastos': return movs('gasto', 'gastamos');
    case 'inversiones': return movs('inversion', 'invertimos');
    case 'retiros': return movs('retiro', 'retiramos');
    case 'balance': {
      const s = (k: Movement['kind']) => both(sumMoves(d.movements, m => m.kind === k && dentro(m)));
      const deben = d.agreements.flatMap(a => duesOf(a, d.now)).filter(x => x.state === 'vencido').length, late = d.agreements.flatMap(a => worksOf(a, d.now)).filter(w => w.state === 'atrasada').length;
      return { texto: `Tenemos ${total(cash(d.movements))}. ${deben ? plural(deben, 'cobro vencido', 'cobros vencidos') : 'Ningún cobro vencido'} y ${late ? plural(late, 'entrega atrasada', 'entregas atrasadas') : 'ninguna entrega atrasada'}.`, filas: [{ a: 'Entró', b: s('ingreso'), c: q.periodo }, { a: 'Invertimos', b: s('inversion') }, { a: 'Gastamos', b: s('gasto') }, { a: 'Retiramos', b: s('retiro') }], to: 'plata' };
    }
    case 'nos_deben': {
      const l = d.agreements.filter(a => !q.cliente_id || a.client_id === q.cliente_id).flatMap(a => duesOf(a, d.now)).filter(x => x.state !== 'pagado' && x.state !== 'futuro').sort((a, b) => (a.due_at ?? 0) - (b.due_at ?? 0));
      const s = suma(l, x => [x.left, x.agreement.currency]), n = q.cliente_id ? nom(q.cliente_id) : '';
      return { texto: l.length ? `${n ? n + ' nos debe' : 'Nos deben'} ${total(s)}.` : `${n ? n + ' no nos debe' : 'Nadie nos debe'} nada ahora.`, filas: l.slice(0, 8).map(x => ({ a: nom(x.agreement.client_id), b: money(x.left, x.agreement.currency), c: `${x.label}, ${x.state === 'vencido' ? 'venció' : 'vence'} ${when(x.due_at!, d.now)}` })), to: q.cliente_id ? `clients/${q.cliente_id}` : 'plata' };
    }
    case 'hay_que_pagar': {
      const l = d.bills.filter(b => b.active && (q.hasta == null ? daysTo(b.due_at, d.now) <= 30 : b.due_at < q.hasta)).sort((a, b) => a.due_at - b.due_at);
      return { texto: l.length ? `Hay que pagar ${total(suma(l, b => [b.amount, b.currency]))} ${q.periodo || 'en los próximos 30 días'}.` : `No hay pagos cargados ${q.periodo ? 'para ' + q.periodo : 'para los próximos 30 días'}.`, filas: l.slice(0, 8).map(b => ({ a: b.name, b: money(b.amount, b.currency), c: `${daysTo(b.due_at, d.now) < 0 ? 'venció' : 'vence'} ${when(b.due_at, d.now)}` })), to: 'plata' };
    }
    case 'cliente': {
      const c = clienteDe(d, q.cliente_id); if (!c) return null;
      const v = viewClient(c, d.agreements, [], d.rate, d.now);
      return { texto: `${c.name}: ${v.why[0].toLowerCase()}${v.why.slice(1)}.`, filas: [...v.lateWork.map(w => ({ a: w.phase.name, b: plural(w.late, 'día de atraso', 'días de atraso') })), ...[...v.overdue, ...v.claim].map(x => ({ a: x.label, b: money(x.left, x.agreement.currency), c: x.due_at ? when(x.due_at, d.now) : '' })), ...(v.next ? [{ a: 'Lo que sigue', b: v.next.label, c: when(v.next.at, d.now) }] : [])].slice(0, 6), to: `clients/${c.id}` };
    }
    case 'tareas': {
      const rango = q.desde != null && q.hasta != null && q.hasta - q.desde > 2 * 864e5, dia = ymd(q.desde ?? d.now);
      const l = d.items.filter(x => !x.done_at && x.owner === d.yo && (rango ? fromYmd(x.date) >= q.desde! && fromYmd(x.date) < q.hasta! : x.date === dia)).sort((a, b) => Number(b.top) - Number(a.top) || a.sort - b.sort);
      const cuando = q.periodo && !/^hoy$/.test(q.periodo) ? 'para ' + q.periodo : 'para hoy';
      return { texto: l.length ? `Tenés ${plural(l.length, 'tarea', 'tareas')} ${cuando}. ${l[0].top ? 'Lo más importante' : 'Empezá por'}: ${l[0].title}.` : `No tenés tareas ${cuando}.`, filas: l.slice(0, 8).map(x => ({ a: x.title, b: x.when_then || `${x.minutes} min` })), to: 'hoy' };
    }
    case 'entregas': {
      const l = d.agreements.filter(a => a.status === 'firmado' && (!q.cliente_id || a.client_id === q.cliente_id)).flatMap(a => worksOf(a, d.now)).filter(w => !w.phase.done_at).sort((a, b) => (a.phase.due_at ?? 9e15) - (b.phase.due_at ?? 9e15));
      return { texto: l.length ? `${plural(l.length, 'entrega pendiente', 'entregas pendientes')}. La primera: ${l[0].phase.name}, ${nom(l[0].agreement.client_id)}${l[0].phase.due_at ? ', ' + when(l[0].phase.due_at, d.now) : ''}.` : 'No debemos ninguna entrega.', filas: l.slice(0, 8).map(w => ({ a: `${w.phase.name}, ${nom(w.agreement.client_id)}`, b: w.phase.due_at ? fDate(w.phase.due_at) : 'Sin fecha', c: w.late ? plural(w.late, 'día de atraso', 'días de atraso') : '' })), to: 'clients' };
    }
    case 'abonos': {
      const l = d.agreements.filter(a => a.status === 'firmado' && a.monthly?.amount);
      return { texto: l.length ? `Por mes entran ${total(suma(l, a => [a.monthly!.amount, a.currency]))} de ${plural(l.length, 'abono', 'abonos')}.` : 'No hay abonos en marcha.', filas: l.map(a => ({ a: nom(a.client_id), b: money(a.monthly!.amount, a.currency), c: `día ${a.monthly!.day}` })), to: 'clients' };
    }
    case 'precio': {
      const s = d.services.find(x => 'serv:' + x.id === q.ref); if (!s) return null;
      const l = s.prices.filter(p => p.amount > 0);
      return { texto: l.length ? `${s.name} sale ${l.map(p => money(p.amount, p.currency) + (p.period === 'mes' ? ' por mes' : p.period === 'anio' ? ' por año' : '')).join(' y ')}.` : `${s.name} todavía no tiene precio.`, filas: [], to: 'servicios' };
    }
    default: return null;
  }
}

/** Los números que se le pasan a la IA para preguntas abiertas. Sin teléfonos, mails ni documentos. */
export function panorama(d: Datos) {
  const n = (id: string | null) => clienteDe(d, id)?.name || '';
  const dues = d.agreements.flatMap(a => duesOf(a, d.now));
  return {
    dolar_blue: d.rate, tenemos: cash(d.movements),
    meses: Array.from({ length: 3 }, (_, i) => ymd(addMonths(d.now, -i)).slice(0, 7)).map(m => ({ mes: m, ...Object.fromEntries(['ingreso', 'gasto', 'inversion', 'retiro'].map(k => [k, sumMoves(d.movements, x => x.kind === k && ymd(x.date).startsWith(m))])) })),
    sobres: viewFunds(d.funds, d.movements).map(v => ({ sobre: v.fund?.name || 'Sin asignar', queda: v.left })),
    nos_deben: dues.filter(x => x.state !== 'pagado' && x.state !== 'futuro').map(x => ({ cliente: n(x.agreement.client_id), que: x.label, monto: x.left, moneda: x.agreement.currency, vence: x.due_at ? ymd(x.due_at) : '' })),
    a_cobrar_al_entregar: dues.filter(x => x.state === 'futuro' && x.kind !== 'mes').map(x => ({ cliente: n(x.agreement.client_id), monto: x.left, moneda: x.agreement.currency })),
    hay_que_pagar: d.bills.filter(b => b.active && daysTo(b.due_at, d.now) <= 45).map(b => ({ que: b.name, monto: b.amount, moneda: b.currency, vence: ymd(b.due_at) })),
    entregas: d.agreements.flatMap(a => worksOf(a, d.now)).filter(w => !w.phase.done_at).map(w => ({ cliente: n(w.agreement.client_id), fase: w.phase.name, para: w.phase.due_at ? ymd(w.phase.due_at) : '', dias_tarde: w.late })),
  };
}
