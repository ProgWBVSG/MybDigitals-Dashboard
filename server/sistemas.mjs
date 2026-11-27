// Sistemas que les vendemos a los negocios e invitaciones digitales: reglas de seguridad del servidor.
// - El estado (activo, suspendido, baja) y la llave del corte sólo se cambian por /api/sistema-estado, que deja registro.
// - El registro no se puede escribir ni borrar desde la pantalla: lo escribe el servidor en la misma operación.
// - /api/servicio/<llave> es lo único público: le dice a la app del negocio si está activa. No da ningún otro dato.
import { randomBytes, randomUUID } from 'node:crypto';

export const SYS = 'sistemas', PAY = 'sistema_pagos', NOTE = 'sistema_notas', LOG = 'sistema_registro', INV = 'invitaciones';
const MINE = new Set([SYS, PAY, NOTE, LOG, INV]);
export const STATES = { prueba: 'En prueba', activo: 'Activo', suspendido: 'Suspendido', baja: 'De baja' };
const INV_STATES = { activa: 'Activa', baja: 'De baja' };
const statesOf = t => t === INV ? INV_STATES : STATES;
const LOCKED = ['status', 'status_at', 'status_reason', 'status_msg', 'status_by', 'service_key', 'ended_at'];
const LABELS = { name: 'nombre', rubro: 'rubro', client_id: 'cliente', owner: 'dueño', city: 'ciudad', plan: 'plan', price: 'precio', currency: 'moneda', bill_day: 'día de cobro', bill_from: 'primer mes', grace_days: 'días de gracia', links: 'accesos', fields: 'datos propios', tags: 'etiquetas', notes: 'notas', event: 'tipo de evento', event_date: 'fecha del evento', style: 'estilo', url: 'link', contact: 'contacto', ends_at: 'hasta cuándo dura' };
export const newKey = () => randomBytes(24).toString('base64url');

const fail = (status, msg) => Object.assign(new Error(msg), { status });
const idOf = f => f?.length === 1 && f[0][0] === 'eq' && f[0][1] === 'id' && f[0][2] != null ? String(f[0][2]) : null;
const fmt = (n, c) => (c === 'USD' ? 'US$' : '$') + new Intl.NumberFormat('es-AR').format(Number(n) || 0);
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const month = p => { const [y, m] = String(p).split('-').map(Number); return `${MONTHS[m - 1] || p} ${y}`; };
const short = (s, n = 300) => String(s ?? '').trim().slice(0, n);

/**
 * Revisa un pedido de la pantalla antes de ejecutarlo. Corrige lo que no se puede mandar,
 * frena lo prohibido y devuelve las líneas de registro que se guardan junto con el cambio.
 */
export async function prepare(core, req, by) {
  const list = req.op === 'batch' ? (Array.isArray(req.list) ? req.list : []) : [req];
  if (!list.some(r => MINE.has(r?.table))) return [];
  const get = async (t, id) => id ? (await core.run({ table: t, op: 'select', filters: [['eq', 'id', id]] })).rows[0] || null : null;
  const audit = [], at = Date.now();
  const add = (s, action, detail) => audit.push({ sistema_id: s?.id ?? null, sistema: s?.name || '', action, detail, by, at });

  for (const r of list) {
    if (!MINE.has(r.table) || r.op === 'select' || !r.op) continue;
    if (r.table === LOG) throw fail(403, 'El registro no se puede cambiar');
    if (r.op === 'upsert') throw fail(403, 'Operación no permitida en sistemas');
    const rows = Array.isArray(r.body) ? r.body : [r.body];

    if (r.table === SYS || r.table === INV) {
      const inv = r.table === INV;
      if (r.op === 'insert') {
        for (const b of rows) {
          if (!b || typeof b !== 'object') throw fail(400, 'Datos inválidos');
          for (const k of LOCKED) delete b[k];
          if (!short(b.name, 120)) throw fail(400, 'Falta el nombre');
          b.id = b.id ? String(b.id) : randomUUID(); // así el registro queda atado a este sistema
          Object.assign(b, { status: inv ? 'activa' : b.trial ? 'prueba' : 'activo', status_at: at, status_by: by, service_key: newKey() });
          delete b.trial;
          if (inv) { b.pagos = []; add(b, 'alta', 'Alta'); } else add(b, 'alta', `Alta como ${STATES[b.status].toLowerCase()}`);
        }
        continue;
      }
      const id = idOf(r.filters);
      if (!id) throw fail(400, 'Se cambia uno por vez');
      const prev = await get(r.table, id);
      if (!prev) throw fail(404, 'No existe');
      if (r.op === 'update') {
        const b = r.body || {};
        if (LOCKED.some(k => k in b)) throw fail(403, 'El estado se cambia con sus botones');
        let changed = Object.keys(b).filter(k => k !== 'updated_at' && JSON.stringify(b[k]) !== JSON.stringify(prev[k]));
        if (inv && changed.includes('pagos')) {
          const was = prev.pagos || [], now = Array.isArray(b.pagos) ? b.pagos : [];
          if (now.some(p => !(Number(p?.amount) > 0))) throw fail(400, 'Monto inválido');
          const added = now.filter(p => !was.some(w => w.id === p.id)), gone = was.filter(w => !now.some(p => p.id === w.id));
          added.forEach(p => add(prev, 'pago', `Pago de ${fmt(p.amount, b.currency || prev.currency)}`));
          gone.forEach(p => add(prev, 'pago', `Deshizo un pago de ${fmt(p.amount, prev.currency)}`));
          changed = changed.filter(k => k !== 'pagos');
        }
        if (changed.length) add(prev, 'datos', 'Cambió ' + [...new Set(changed.map(k => LABELS[k] || k))].join(', '));
      } else if (r.op === 'delete') {
        if (prev.status !== 'baja') throw fail(403, 'Para borrarlo, primero dalo de baja');
        add(prev, 'borrado', inv ? 'Borró la invitación' : 'Borró el sistema con sus pagos y notas');
      } else throw fail(400, 'Operación inválida');
      continue;
    }

    // Pagos y notas: siempre de un sistema que existe
    if (r.op === 'insert') {
      for (const b of rows) {
        const s = await get(SYS, b?.sistema_id ? String(b.sistema_id) : null);
        if (!s) throw fail(400, 'Falta a qué sistema corresponde');
        b.by = by;
        if (r.table === PAY) {
          if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(b.period || ''))) throw fail(400, 'Mes inválido');
          if (!(Number(b.amount) >= 0)) throw fail(400, 'Monto inválido');
          const dup = (await core.run({ table: PAY, op: 'select', filters: [['eq', 'sistema_id', s.id], ['eq', 'period', b.period]] })).count;
          if (dup) throw fail(409, 'Ese mes ya está pago');
          add(s, 'pago', Number(b.amount) > 0 ? `Pago de ${month(b.period)}: ${fmt(b.amount, b.currency)}` : `Bonificó ${month(b.period)}`);
        }
      }
      continue;
    }
    const id = idOf(r.filters);
    if (!id) throw fail(400, 'Se cambia una fila por vez');
    const prev = await get(r.table, id);
    if (!prev) continue;
    const s = await get(SYS, prev.sistema_id);
    if (r.op === 'update') {
      if (r.table === PAY) throw fail(403, 'Un pago no se edita: se deshace y se carga de nuevo');
      if (r.body && 'sistema_id' in r.body) delete r.body.sistema_id;
    } else if (r.op === 'delete') { if (r.table === PAY) add(s, 'pago', `Deshizo el pago de ${month(prev.period)}`); }
    else throw fail(400, 'Operación inválida');
  }
  return audit;
}

/** Suspender, reactivar, dar de baja o cambiar la llave. Todo junto con su registro. */
export async function changeState(core, body, by) {
  const id = String(body?.id || ''), table = body?.table === INV ? INV : SYS, ST = statesOf(table);
  const s = id && (await core.run({ table, op: 'select', filters: [['eq', 'id', id]] })).rows[0];
  if (!s) throw fail(404, 'No existe');
  const at = Date.now();
  let patch, detail;
  if (body.rotate) {
    patch = { service_key: newKey() };
    detail = 'Cambió la llave del corte: la anterior deja de funcionar';
  } else {
    const to = String(body.status || '');
    if (!ST[to]) throw fail(400, 'Estado inválido');
    if (to === s.status) throw fail(409, 'Ya está ' + ST[to].toLowerCase());
    const reason = short(body.reason), msg = short(body.message);
    if (table === SYS && (to === 'suspendido' || to === 'baja') && !reason) throw fail(400, 'Escribí el motivo');
    patch = { status: to, status_at: at, status_by: by, status_reason: reason, status_msg: to === 'suspendido' || to === 'baja' ? msg : '', ended_at: to === 'baja' ? at : null };
    detail = `${ST[s.status] || s.status} a ${ST[to].toLowerCase()}${reason ? `. Motivo: ${reason}` : ''}`;
  }
  await core.run({ op: 'batch', list: [
    { table, op: 'update', body: { ...patch, updated_at: at }, filters: [['eq', 'id', id]] },
    { table: LOG, op: 'insert', body: { sistema_id: id, sistema: s.name, action: body.rotate ? 'llave' : 'estado', detail, by, at } },
  ] });
  return { ok: true };
}

// ─── Lo público: la app del negocio pregunta si está activa ───
const hits = new Map();
function tooMany(ip) {
  const now = Date.now(), h = hits.get(ip);
  if (!h || now - h.t > 60000) { hits.set(ip, { t: now, n: 1 }); if (hits.size > 5000) hits.clear(); return false; }
  return ++h.n > 120;
}
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET', 'access-control-max-age': '86400' };
export async function publicState(core, req, res, key) {
  const head = { 'content-type': 'application/json', 'x-content-type-options': 'nosniff', ...CORS };
  const out = (code, data, cache = 'no-store') => { res.writeHead(code, { ...head, 'cache-control': cache }); res.end(JSON.stringify(data)); };
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (req.method !== 'GET') return out(405, { error: 'No permitido' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x').split(',')[0].trim();
  if (tooMany(ip)) return out(429, { error: 'Demasiados pedidos' });
  if (!/^[A-Za-z0-9_-]{32}$/.test(key)) return out(404, { activo: null });
  const find = t => core.run({ table: t, op: 'select', filters: [['eq', 'service_key', key]] }).then(r => r.rows[0]);
  const s = await find(SYS), i = s ? null : await find(INV);
  if (!s && !i) return out(404, { activo: null });
  const on = s ? s.status === 'activo' || s.status === 'prueba' : i.status === 'activa';
  const def = s ? 'Este servicio está pausado. Comunicate con MYB Digitals.' : 'Esta invitación ya no está disponible.';
  return out(200, { activo: on, mensaje: on ? '' : (s || i).status_msg || def }, 'public, max-age=60');
}
