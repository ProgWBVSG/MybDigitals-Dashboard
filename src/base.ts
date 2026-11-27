// Conexión con la base propia (server/). La usan todas las secciones.
import { useEffect, useMemo, useSyncExternalStore } from 'react';

export type Err = { message: string; code?: string };
type Filter = [string, string, unknown];
type Req = { table: string; op: string; body?: unknown; filters: Filter[]; order: { col: string; asc: boolean; nullsFirst?: boolean }[]; limit?: number; offset?: number };

// ─── Cartel si se corta ───
let bar: HTMLElement | null = null;
function offline(on: boolean) {
  if (on && !bar) {
    bar = document.createElement('div');
    bar.setAttribute('role', 'alert');
    bar.className = 'offline-bar';
    bar.textContent = cloud ? 'Sin conexión: lo que hagas ahora no se guarda.' : 'No se está guardando: se cerró MYB Dashboard. Abrilo de nuevo desde la carpeta MYB Digitals.';
    document.body.append(bar);
  } else if (!on && bar) { bar.remove(); bar = null; }
}

let cloud = false;
export async function api<T = any>(path: string, init: RequestInit = {}): Promise<{ data: T | null; error: Err | null }> {
  let res: Response;
  try { res = await fetch('/api/' + path, { ...init, headers: { 'x-myb': '1', 'x-myb-persona': getPerson(), ...(init.headers || {}) } }); }
  catch { offline(true); return { data: null, error: { message: 'No hay conexión con la base' } }; }
  offline(false);
  const data = await res.json().catch(() => null);
  if (res.status === 401 && path !== 'entrar') window.dispatchEvent(new Event('myb-salir'));
  if (!res.ok) return { data: null, error: { message: data?.error || 'Error ' + res.status, code: data?.code } };
  return { data, error: null };
}
export const post = <T = any>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

// ─── Quién está usando el dashboard ───
export type Person = 'benja' | 'mati';
export const PEOPLE: Record<Person, string> = { benja: 'Benjamín', mati: 'Matías' };
export type Me = { user: { id: string; local?: boolean; name?: string } | null; cloud: boolean; first?: boolean };
export async function whoAmI(): Promise<Me | null> {
  const { data } = await api<Me>('yo');
  if (data) cloud = data.cloud;
  if (data?.user?.id) localStorage.setItem('myb_persona', data.user.id);
  return data;
}
export const isCloud = () => cloud;
const personSubs = new Set<() => void>();
export const getPerson = (): Person => (localStorage.getItem('myb_persona') === 'mati' ? 'mati' : 'benja');
export const setPerson = (p: Person) => { localStorage.setItem('myb_persona', p); personSubs.forEach(f => f()); };
export const usePerson = (): Person => useSyncExternalStore(f => { personSubs.add(f); return () => { personSubs.delete(f); }; }, getPerson);

// ─── Cambios de otras pestañas o del socio ───
type Sub = { table: string; cb: (p: unknown) => void };
const subs = new Set<Sub>();
const fire = (tables: string[] | null) => [...subs].forEach(s => { if (!tables || tables.includes(s.table)) s.cb({ eventType: '*', table: s.table }); });
let seen: number | null = null, epoch = '', timer: ReturnType<typeof setTimeout> | undefined, asking = false;
async function poll() {
  clearTimeout(timer);
  if (document.hidden || asking || !subs.size) { timer = setTimeout(poll, 4000); return; }
  asking = true;
  const { data } = await api<{ n: number; epoch: string; tables: string[] }>('cambios?desde=' + (seen ?? ''));
  asking = false;
  if (data) {
    if (epoch && data.epoch !== epoch) fire(null);       // se reinició el servidor: refrescar todo
    else if (data.tables.length) fire(data.tables);
    seen = data.n; epoch = data.epoch;
  }
  timer = setTimeout(poll, cloud ? 12000 : 2500);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
timer = setTimeout(poll, 1500);

async function send(body: object) {
  const r = await post<{ rows: any; count: number; touched: string[] }>('db', body);
  if (r.data?.touched?.length) fire(r.data.touched);
  return r;
}

// ─── Consultas encadenadas (las usan las secciones de siempre) ───
function query(table: string): any {
  const r: Req = { table, op: 'select', filters: [], order: [] };
  let one: '' | 'single' | 'maybe' = '', returning = false, head = false, wantCount = false;
  const run = async () => {
    const { data, error } = await send(r);
    if (error || !data) return { data: null, error, count: null };
    const rows = data.rows as any[], count = wantCount ? data.count : null;
    if ((r.op !== 'select' && !returning) || head) return { data: null, error: null, count };
    if (!one) return { data: rows, error: null, count };
    if (rows.length === 1) return { data: rows[0], error: null, count };
    if (!rows.length && one === 'maybe') return { data: null, error: null, count };
    return { data: null, error: { message: rows.length ? 'Hay más de una fila' : 'No se encontró', code: 'PGRST116' }, count };
  };
  let p: Promise<any> | null = null;
  const go = () => (p ??= run());
  const b: any = {
    select: (_c?: string, o?: { count?: string; head?: boolean }) => { returning = true; head = !!o?.head; wantCount = !!o?.count; return b; },
    order: (col: string, o: { ascending?: boolean; nullsFirst?: boolean } = {}) => { r.order.push({ col, asc: o.ascending !== false, nullsFirst: o.nullsFirst }); return b; },
    limit: (n: number) => { r.limit = n; return b; },
    single: () => { one = 'single'; return b; },
    maybeSingle: () => { one = 'maybe'; return b; },
    then: (a: any, z: any) => go().then(a, z),
    catch: (f: any) => go().catch(f),
    finally: (f: any) => go().finally(f),
  };
  for (const op of ['insert', 'upsert', 'update', 'delete']) b[op] = (body?: unknown) => { r.op = op; r.body = body; return b; };
  for (const f of ['eq', 'neq', 'is', 'in', 'gt', 'gte', 'lt', 'lte']) b[f] = (c: string, v: unknown) => { r.filters.push([f, c, v]); return b; };
  return b;
}
function channel() {
  const mine: Sub[] = [];
  const c: any = {
    on: (_t: string, f: { table: string }, cb: Sub['cb']) => { mine.push({ table: f.table, cb }); return c; },
    subscribe: () => { mine.forEach(s => subs.add(s)); return c; },
    unsubscribe: async () => { mine.forEach(s => subs.delete(s)); },
  };
  return c;
}
const enc = (bucket: string, path: string) => [bucket, ...path.split('/')].map(encodeURIComponent).join('/');
const bucket = (name: string) => ({
  upload: async (path: string, file: Blob, o: { upsert?: boolean } & Record<string, unknown> = {}) => {
    const { error } = await api('archivos/' + enc(name, path), { method: 'POST', body: file, headers: { 'content-type': 'application/octet-stream', ...(o.upsert ? { 'x-reemplazar': '1' } : {}) } });
    return { data: error ? null : { path }, error };
  },
  createSignedUrl: async (path: string, _s?: number) => ({ data: { signedUrl: '/api/archivos/' + enc(name, path) }, error: null }),
  getPublicUrl: (path: string) => ({ data: { publicUrl: location.origin + '/api/archivos/' + enc(name, path) } }),
});

export const db: any = {
  from: query, channel,
  removeChannel: (c: any) => c.unsubscribe(),
  storage: { from: bucket },
  functions: { invoke: async () => ({ data: null, error: { message: 'Esta función con IA todavía no está conectada a la base nueva' } }) },
};

// ─── Tablas vivas (las usan las secciones nuevas) ───
export interface Row { id: string; created_at?: number | string; updated_at?: number | string }
type Cache = { rows: any[]; ready: boolean; error: string; loading: Promise<void> | null; again: boolean; subs: Set<() => void>; snap: object };
const caches = new Map<string, Cache>();
function cacheOf(table: string): Cache {
  let c = caches.get(table);
  if (!c) { c = { rows: [], ready: false, error: '', loading: null, again: false, subs: new Set(), snap: {} }; caches.set(table, c); }
  return c;
}
const emit = (c: Cache) => { c.snap = {}; c.subs.forEach(f => f()); };
function load(table: string): Promise<void> {
  const c = cacheOf(table);
  if (c.loading) { c.again = true; return c.loading; }
  c.loading = (async () => {
    do {
      c.again = false;
      const { data, error } = await post<{ rows: any[] }>('db', { table, op: 'select' });
      if (data) { c.rows = data.rows; c.error = ''; } else c.error = error?.message || 'No se pudo leer';
    } while (c.again);
    c.ready = true; c.loading = null; emit(c);
  })();
  return c.loading;
}
export const reload = (table: string) => load(table);

export type Op = { table: string; op: 'insert' | 'update' | 'delete' | 'upsert'; body?: unknown; filters?: Filter[] };
/** Guarda varias cosas juntas: o entran todas o ninguna. */
export async function saveAll(list: Op[]): Promise<string> {
  const { error } = await send({ op: 'batch', list });
  if (error) return error.message;
  await Promise.all([...new Set(list.map(o => o.table))].filter(t => caches.has(t)).map(load));
  return '';
}
export const insertOp = (table: string, body: object): Op => ({ table, op: 'insert', body });
export const updateOp = (table: string, id: string, body: object): Op => ({ table, op: 'update', body: { ...body, updated_at: Date.now() }, filters: [['eq', 'id', id]] });
export const deleteOp = (table: string, id: string): Op => ({ table, op: 'delete', filters: [['eq', 'id', id]] });

export function useTable<T extends Row>(table: string) {
  const c = cacheOf(table);
  useSyncExternalStore(f => { c.subs.add(f); return () => { c.subs.delete(f); }; }, () => c.snap);
  useEffect(() => {
    load(table);
    const s: Sub = { table, cb: () => load(table) };
    subs.add(s); return () => { subs.delete(s); };
  }, [table]);
  return useMemo(() => ({
    rows: c.rows as T[], ready: c.ready, error: c.error,
    add: async (row: Partial<T>): Promise<T | null> => {
      const r = await send({ table, op: 'insert', body: row });
      if (r.error) { fail(r.error.message); return null; }
      await load(table); return r.data!.rows[0] as T;
    },
    update: async (id: string, patch: Partial<T>): Promise<boolean> => {
      c.rows = c.rows.map(x => x.id === id ? { ...x, ...patch } : x); emit(c); // se ve al instante
      const r = await send({ table, op: 'update', body: { ...patch, updated_at: Date.now() }, filters: [['eq', 'id', id]] });
      if (r.error) { fail(r.error.message); await load(table); return false; }
      return true;
    },
    remove: async (id: string): Promise<boolean> => {
      const r = await send({ table, op: 'delete', filters: [['eq', 'id', id]] });
      if (r.error) { fail(r.error.message); return false; }
      await load(table); return true;
    },
  }), [c.snap, c.ready, table]);
}
let onFail: (m: string) => void = () => {};
export const setFailHandler = (f: (m: string) => void) => { onFail = f; };
const fail = (m: string) => onFail('No se pudo guardar: ' + m);
