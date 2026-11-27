// Arma lo que se le cuenta a la IA y revisa todo lo que devuelve antes de mostrarlo.
import { CATEGORIES, duesOf, fDate, fromYmd, type MoveKind } from '../negocio';
import { ACCOUNTS } from '../plataTxt';
import { money } from '../services';
import { clienteDe, nueva, type Accion, type Datos, type Falta, type Tipo } from './accion';
import type { Pregunta, Tema } from './consultas';
import { panorama } from './consultas';
import { enganchar } from './entender';
import { cantidades, plano } from './numeros';

export interface Salida { acciones: any[]; consulta: { tema: string; desde: string; hasta: string; cliente: string; servicio: string; respuesta: string }; pregunta: string }
type Codigos = Map<string, string>; // código corto → id de verdad

export function contexto(frase: string, d: Datos, pantalla: Accion[], hecha: Falta | null): { ctx: object; cod: Codigos } {
  const cod: Codigos = new Map(), al = new Map<string, string>();
  const c = (pre: string, id: string) => { const k = al.get(pre + id) || `${pre}${[...cod.keys()].filter(x => x.startsWith(pre) && /^\d+$/.test(x.slice(pre.length))).length + 1}`; cod.set(k, id); al.set(pre + id, k); return k; };
  const pregunton = /\?|\b(cuanto|quien|que|como|cual|cuando|por que|alcanza|conviene)\b/.test(plano(frase));
  const clientes = d.clients.slice(0, 400).map(x => ({ id: c('c', x.id), nombre: x.name, ...(d.memoria.some(m => m.cliente_id === x.id) ? { tambien: d.memoria.filter(m => m.cliente_id === x.id).map(m => m.oido) } : {}) }));
  const cli = (id: string | null) => (id && al.get('c' + id)) || '';
  const sob = d.funds.filter(f => !f.archived).map(f => ({ id: c('s', f.id), nombre: f.name }));
  const ctx = {
    frase, hoy: new Date(d.now).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), hoy_iso: new Date(d.now - new Date(d.now).getTimezoneOffset() * 60000).toISOString().slice(0, 10),
    habla: d.yo, dolar_blue: d.rate, clientes,
    cobros: d.agreements.flatMap(a => duesOf(a, d.now)).filter(x => x.state !== 'pagado').slice(0, 120).map(x => ({ id: c('k', 'due:' + x.key), cliente: cli(x.agreement.client_id), que: x.label, trabajo: x.agreement.title, monto: x.left, moneda: x.agreement.currency, estado: x.state })),
    pagos_fijos: d.bills.filter(b => b.active).map(b => ({ id: c('p', 'bill:' + b.id), que: b.name, monto: b.amount, moneda: b.currency })),
    fases: d.agreements.filter(a => a.status === 'firmado').flatMap(a => a.phases.filter(f => f.kind === 'fase' && !f.done_at).map(f => ({ id: c('f', `fase:${a.id}:${f.id}`), cliente: cli(a.client_id), fase: f.name }))),
    tareas: d.items.filter(x => !x.done_at).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60).map(x => ({ id: c('t', 'item:' + x.id), titulo: x.title, de: x.owner, dia: x.date })),
    servicios: d.services.map(x => ({ id: c('v', 'serv:' + x.id), nombre: x.name, ...(pregunton ? { precios: x.prices.filter(p => p.amount > 0).map(p => `${money(p.amount, p.currency)} ${p.period}`) } : {}) })),
    sobres: sob, cuentas: [...new Set([...ACCOUNTS, 'Tarjeta', ...d.movements.map(m => m.account).filter(Boolean)])].slice(0, 20), categorias: CATEGORIES,
    ultimos: [...d.movements].sort((a, b) => b.date - a.date).slice(0, 12).map(m => ({ clase: m.kind, concepto: m.concept, categoria: m.category, sobre: (m.fund_id && al.get('s' + m.fund_id)) || '', cuenta: m.account })),
    en_pantalla: pantalla.map(a => ({ tipo: a.tipo, clase: a.tipo === 'plata' ? a.clase : '', monto: a.monto, moneda: a.moneda, fecha: new Date(a.fecha - new Date(a.fecha).getTimezoneOffset() * 60000).toISOString().slice(0, 10), hora: a.hora, titulo: a.titulo, detalle: a.detalle, categoria: a.categoria, cuenta: a.cuenta, persona: a.persona, cliente: cli(a.cliente_id), cliente_nuevo: a.cliente_nuevo, ref: [...cod].find(([, v]) => v === a.ref)?.[0] || '', sobre: (a.fondo && al.get('s' + a.fondo)) || '', fijo: a.fijo })),
    pregunta_hecha: hecha?.pregunta || '',
    ...(pregunton ? { panorama: panorama(d) } : {}),
  };
  return { ctx, cod };
}

const TIPOS_OK = new Set<Tipo>(['plata', 'vencimiento', 'tarea', 'hecha', 'entrega', 'cliente', 'prospecto', 'nota', 'evento', 'mensaje', 'acuerdo', 'precio', 'ir', 'deshacer']);
const txt = (x: unknown, max = 160) => typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x > 0 && x < 1e12 ? Math.round(x * 100) / 100 : 0;
const dia = (x: unknown) => typeof x === 'string' && /^20\d\d-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(x) ? fromYmd(x) : null;
const PREF: Partial<Record<Tipo, string[]>> = { plata: ['due:', 'bill:'], hecha: ['item:'], entrega: ['fase:'], acuerdo: ['serv:'], precio: ['serv:'] };

/** Lo que dijo la IA, revisado campo por campo. "oido" es todo lo que se habló: sirve para comprobar los montos. */
export function desdeIA(s: Salida, cod: Codigos, d: Datos, previas: Accion[], oido: string): Accion[] {
  const dichos = new Set(cantidades(oido).flatMap(x => [x.valor, x.valor * 1000]));
  const id = (k: unknown, pre: string) => { const v = typeof k === 'string' && k.startsWith(pre) ? cod.get(k) : undefined; return v ?? null; };
  const out: Accion[] = [];
  for (const [i, x] of (Array.isArray(s?.acciones) ? s.acciones.slice(0, 12) : []).entries()) {
    if (!TIPOS_OK.has(x?.tipo)) continue;
    const tipo = x.tipo as Tipo, a = nueva(tipo, d, { origen: 'ia', texto: oido });
    a.clase = (Object.keys(CATEGORIES) as MoveKind[]).includes(x.clase) ? x.clase : 'gasto';
    a.monto = num(x.monto); a.moneda = x.moneda === 'USD' ? 'USD' : 'ARS'; a.abono = num(x.abono); a.minutos = Math.min(600, Math.round(num(x.minutos)));
    a.fecha = dia(x.fecha) ?? d.now; a.hora = /^([01]\d|2[0-3]):[0-5]\d$/.test(x.hora) ? x.hora : '';
    a.titulo = txt(x.titulo, 120); a.detalle = txt(x.detalle, 900); a.cuenta = txt(x.cuenta, 40); a.telefono = /\d{6}/.test(String(x.telefono).replace(/\D/g, '')) ? txt(x.telefono, 30) : '';
    a.persona = x.persona === 'mati' || x.persona === 'benja' ? x.persona : ''; if (tipo === 'tarea' && !a.persona) a.persona = d.yo;
    a.categoria = tipo === 'plata' ? (CATEGORIES[a.clase].includes(x.categoria) ? x.categoria : '') : txt(x.categoria, 60);
    a.cliente_id = id(x.cliente, 'c'); a.cliente_nuevo = a.cliente_id ? '' : txt(x.cliente_nuevo, 60);
    a.fondo = id(x.sobre, 's'); a.fondo2 = id(x.sobre_destino, 's'); a.repite = x.repite === 'mes' || x.repite === 'anio' ? x.repite : 'no'; a.top = x.importante === true;
    const r = typeof x.ref === 'string' ? cod.get(x.ref) || '' : '';
    a.ref = (PREF[tipo] || []).some(p => r.startsWith(p)) ? r : '';
    if (a.ref.startsWith('due:') && a.clase !== 'ingreso') a.ref = '';
    a.fases = Array.isArray(x.fases) ? x.fases.slice(0, 12).map((f: any) => ({ nombre: txt(f?.nombre, 60), monto: num(f?.monto), fecha: dia(f?.fecha) })).filter((f: any) => f.nombre || f.monto) : [];
    // Lo que la persona ya cambió a mano queda como lo dejó
    const p = previas[i];
    if (p && p.tipo === tipo && p.fijo.length) {
      const k: Record<string, (keyof Accion)[]> = { cliente: ['cliente_id', 'cliente_nuevo', 'opciones', 'agregar'], fecha: ['fecha', 'hora'], fondo: ['fondo'], fondo2: ['fondo2'] };
      for (const f of p.fijo) for (const c of k[f] || [f as keyof Accion]) (a as any)[c] = p[c];
      a.fijo = [...p.fijo];
    }
    if (p && p.tipo === tipo) a.id = p.id;
    const ref = a.ref; enganchar(a, d); if (ref && !a.fijo.includes('ref')) a.ref = ref;
    // Un monto que nadie dijo y no sale de un cobro o un pago cargado se marca para mirar
    if (a.monto && !dichos.has(a.monto) && !a.fijo.includes('monto')) {
      const sale = d.agreements.some(g => duesOf(g, d.now).some(u => u.left === a.monto || u.amount === a.monto)) || d.bills.some(b => b.amount === a.monto) || d.services.some(v => v.prices.some(q => q.amount === a.monto));
      const cuenta = [...dichos].some(v => [2, 3, 4].some(k => Math.abs(v / k - a.monto) < 1 || v * k === a.monto)) || [...dichos].some(v => [...dichos].some(w => v + w === a.monto));
      if (!sale && !cuenta) a.duda = true;
    }
    out.push(a);
  }
  return out;
}
export function preguntaIA(s: Salida, cod: Codigos, d: Datos): (Pregunta & { respuesta: string }) | null {
  const c = s?.consulta; if (!c?.tema) return null;
  const desde = dia(c.desde), hasta = dia(c.hasta), h = hasta == null ? null : hasta + 12 * 36e5;
  const id = cod.get(c.cliente) || null;
  return { tema: c.tema as Tema, desde: desde == null ? null : desde - 12 * 36e5, hasta: h, cliente_id: id && clienteDe(d, id) ? id : null, ref: cod.get(c.servicio) || '', periodo: desde != null ? (hasta != null && hasta - desde > 864e5 ? `del ${fDate(desde)} al ${fDate(hasta)}` : fDate(desde)) : '', respuesta: txt(c.respuesta, 700) };
}
