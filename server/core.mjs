// Reglas de la base: valores por defecto, filtros, orden, borrado en cadena, papelera y copias.
// No sabe dónde se guarda: eso lo resuelve el "almacén" (SQLite en la compu o Postgres en la nube).
import { randomUUID } from 'node:crypto';
import { DEFAULTS, NUMERIC_DATES, ON_DELETE } from './schema.mjs';

export const TABLE = /^[a-z][a-z0-9_]{0,40}$/;

const stampNow = t => NUMERIC_DATES.has(t) ? Date.now() : new Date().toISOString();
function fixDates(t, row) {
  for (const k of ['created_at', 'updated_at']) {
    const v = row[k];
    if (v === undefined) continue;
    const ms = typeof v === 'number' ? v : Date.parse(v ?? '');
    if (Number.isNaN(ms)) delete row[k];
    else row[k] = NUMERIC_DATES.has(t) ? ms : new Date(ms).toISOString();
  }
  return row;
}
function clean(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('Datos inválidos');
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}
function create(t, input) {
  const row = fixDates(t, { ...(DEFAULTS[t]?.() || {}), ...clean(input) });
  row.id = row.id ? String(row.id) : randomUUID();
  row.created_at ??= stampNow(t);
  row.updated_at ??= row.created_at;
  return row;
}

const same = (a, b) => a === b || (typeof a !== 'object' && typeof b !== 'object' && String(a) === String(b));
function test(row, [op, col, val]) {
  const v = row[col] ?? null;
  if (op === 'is') return v === (val ?? null);
  if (v === null) return false;
  switch (op) {
    case 'eq': return val != null && same(v, val);
    case 'neq': return !same(v, val);
    case 'in': return Array.isArray(val) && val.some(x => same(v, x));
    case 'gt': return v > val;
    case 'gte': return v >= val;
    case 'lt': return v < val;
    case 'lte': return v <= val;
    default: throw new Error('Filtro no soportado: ' + op);
  }
}
const cmp = (a, b) => typeof a === 'string' && typeof b === 'string' ? (a < b ? -1 : a > b ? 1 : 0) : Number(a) - Number(b);
const sorter = order => (x, y) => {
  for (const { col, asc, nullsFirst } of order) {
    const a = x[col] ?? null, b = y[col] ?? null;
    if (a === null && b === null) continue;
    if (a === null || b === null) return (a === null) === (nullsFirst ?? !asc) ? -1 : 1;
    const c = cmp(a, b);
    if (c) return asc ? c : -c;
  }
  return 0;
};

export function checkDump(d) {
  if (!d || d.app !== 'myb-dashboard' || !d.tables || typeof d.tables !== 'object') throw new Error('El archivo no es una copia de MYB Dashboard');
  for (const [t, list] of Object.entries(d.tables)) {
    if (!TABLE.test(t) || !Array.isArray(list) || list.some(r => !r || typeof r !== 'object' || r.id == null)) throw new Error('La copia está dañada');
  }
}

export function createCore(store) {
  async function removeRow(s, t, row, group, touched) {
    for (const [child, col, what] of ON_DELETE[t] || []) {
      for (const r of await s.all(child)) {
        if (r[col] == null || String(r[col]) !== String(row.id)) continue;
        if (what === 'borrar') await removeRow(s, child, r, group, touched);
        else { await s.put(child, { ...r, [col]: null }); touched.add(child); }
      }
    }
    await s.trash(t, row, group);
    await s.del(t, String(row.id));
    touched.add(t);
  }

  const match = async (s, table, filters) => (await s.all(table)).filter(r => filters.every(f => test(r, f)));

  async function apply(s, { table, op, body, filters = [] }, touched) {
    if (!TABLE.test(table || '')) throw new Error('Tabla inválida');
    let out = [];
    const list = Array.isArray(body) ? body : [body];
    if (op === 'insert') {
      out = list.map(b => create(table, b));
      for (const r of out) {
        if (await s.get(table, r.id)) throw Object.assign(new Error('Ya existe una fila con ese id'), { code: '23505' });
        await s.put(table, r);
      }
    } else if (op === 'upsert') {
      for (const b of list) {
        const prev = b?.id != null ? await s.get(table, String(b.id)) : null;
        const row = prev ? fixDates(table, { ...prev, ...clean(b) }) : create(table, b);
        await s.put(table, row); out.push(row);
      }
    } else if (op === 'update' || op === 'delete') {
      if (!filters.length) throw new Error('Falta decir qué fila cambiar'); // nunca toda la tabla
      out = await match(s, table, filters);
      if (op === 'update') {
        const patch = fixDates(table, clean(body)); delete patch.id;
        out = out.map(r => ({ ...r, ...patch }));
        for (const r of out) await s.put(table, r);
      } else {
        const group = randomUUID();
        for (const r of out) if (await s.get(table, String(r.id))) await removeRow(s, table, r, group, touched);
      }
    } else throw new Error('Operación inválida');
    if (out.length) touched.add(table);
    return out;
  }

  /** Ejecuta un pedido del dashboard, o varios juntos (batch): o se guardan todos o ninguno. */
  async function run(req) {
    const { table, op = 'select', filters = [], order = [], limit, offset } = req;
    if (op === 'select') {
      if (!TABLE.test(table || '')) throw new Error('Tabla inválida');
      let out = await match(store, table, filters);
      const count = out.length;
      if (order.length) out.sort(sorter(order));
      if (offset) out = out.slice(offset);
      if (limit != null) out = out.slice(0, limit);
      return { rows: out, count, touched: [] };
    }
    const touched = new Set();
    const rows = await store.tx(async s => {
      if (op !== 'batch') return apply(s, req, touched);
      const all = [];
      for (const r of req.list || []) all.push(await apply(s, r, touched));
      return all;
    });
    if (touched.size) await store.bump([...touched]);
    return { rows, count: rows.length, touched: [...touched] };
  }

  async function dump() {
    const tables = {};
    for (const { tabla, datos } of await store.everything()) (tables[tabla] ??= []).push(datos);
    return { app: 'myb-dashboard', version: 1, at: new Date().toISOString(), tables };
  }
  async function restore(d) {
    checkDump(d);
    const before = Object.keys(await store.counts());
    await store.tx(async s => { await s.wipe(); for (const [t, list] of Object.entries(d.tables)) for (const r of list) await s.put(t, r); });
    await store.bump([...new Set([...before, ...Object.keys(d.tables)])]);
  }
  async function undelete(group) {
    const tables = await store.tx(async s => {
      const list = await s.trashGroup(group);
      for (const r of list) if (!(await s.get(r.tabla, r.id))) await s.put(r.tabla, r.datos);
      await s.untrash(group);
      return [...new Set(list.map(r => r.tabla))];
    });
    await store.bump(tables);
  }
  async function trash() {
    const seen = new Map(); // el último de cada grupo es lo que se borró; lo demás se fue con él
    for (const r of await store.trashList()) {
      const g = seen.get(r.grupo);
      if (g) { g.extra++; continue; }
      const d = r.datos;
      seen.set(r.grupo, { group: r.grupo, table: r.tabla, at: Number(r.cuando), extra: 0, name: String(d.name || d.title || d.concept || d.text || d.description || d.label || 'Sin nombre').slice(0, 80) });
    }
    return [...seen.values()].slice(0, 60);
  }
  async function init() {
    if (!(await store.get('app_settings', 'global'))) await store.put('app_settings', { id: 'global', data: {}, updated_at: Date.now() });
  }
  return { run, dump, restore, undelete, trash, init, counts: () => store.counts(), since: n => store.since(n) };
}
