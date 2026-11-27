// Las mismas pruebas sobre los dos motores. Correr: node server/pruebas/base.mjs
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { createCore } from '../core.mjs';
import { createApp } from '../app.mjs';
import { digest, runDaily } from '../avisos.mjs';
import { pgStore, sqliteStore } from '../stores.mjs';

let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('  FALLA', m); } };
const throws = async (f, m) => { try { await f(); ok(false, m); } catch { ok(true); } };

async function suite(name, store) {
  console.log(name);
  await store.ready();
  const c = createCore(store); await c.init();
  const q = (table, op, o = {}) => c.run({ table, op, ...o });
  const cl = (await q('clients', 'insert', { body: [{ name: "O'Brien; drop table x --", nota: 'ñandú 🎉' }] })).rows[0];
  ok(cl.id && cl.status === 'prospect' && typeof cl.created_at === 'string', 'valores por defecto');
  ok((await q('clients', 'select')).rows[0].nota === 'ñandú 🎉', 'acentos');
  const ag = (await q('agreements', 'insert', { body: { client_id: cl.id, title: 'A', phases: [{ id: 'f1' }] } })).rows[0];
  ok(ag.status === 'borrador' && typeof ag.created_at === 'number' && Array.isArray(ag.includes), 'acuerdo');
  await q('movements', 'insert', { body: { kind: 'ingreso', amount: 10, client_id: cl.id, agreement_id: ag.id } });
  await throws(() => q('clients', 'update', { body: { name: 'x' } }), 'cambio sin filtro');
  await throws(() => q('clients', 'delete'), 'borrado sin filtro');
  await throws(() => q("x'; drop", 'select'), 'tabla inválida');
  await throws(() => q('clients', 'insert', { body: { id: cl.id } }), 'id repetido');
  ok((await q('clients', 'update', { body: { name: 'Z', id: 'otro' }, filters: [['eq', 'id', cl.id]] })).rows[0].id === cl.id, 'el id no cambia');
  // juntos: o todos o ninguno
  await throws(() => c.run({ op: 'batch', list: [{ table: 'movements', op: 'insert', body: { amount: 99 } }, { table: 'agreements', op: 'update', body: {} }] }), 'lote inválido');
  ok((await q('movements', 'select')).count === 1, 'lote deshecho');
  const b = await c.run({ op: 'batch', list: [{ table: 'movements', op: 'insert', body: { amount: 5 } }, { table: 'agreements', op: 'update', body: { title: 'B' }, filters: [['eq', 'id', ag.id]] }] });
  ok(b.touched.length === 2 && (await q('agreements', 'select')).rows[0].title === 'B', 'lote');
  // a la vez
  await Promise.all(Array.from({ length: 30 }, (_, i) => q('tasks', 'insert', { body: { title: 't' + i } })));
  ok((await q('tasks', 'select')).count === 30, 'treinta a la vez');
  await q('notes', 'insert', { body: [{ title: 'a', pinned: false }, { title: 'b', pinned: true }, { title: 'c' }] });
  ok((await q('notes', 'select', { order: [{ col: 'pinned', asc: false }, { col: 'title', asc: true }] })).rows.map(r => r.title).join('') === 'bac', 'orden');
  const s0 = await c.since(null);
  await q('notes', 'update', { body: { title: 'd' }, filters: [['eq', 'title', 'c']] });
  const s1 = await c.since(s0.n); ok(s1.tables.join() === 'notes' && s1.n > s0.n, 'avisa cambios'); ok((await c.since(s1.n)).tables.length === 0, 'sin cambios nuevos');
  await q('clients', 'delete', { filters: [['eq', 'id', cl.id]] });
  ok((await q('agreements', 'select')).count === 0, 'borra lo que depende');
  const m = (await q('movements', 'select')).rows.find(x => x.amount === 10); ok(m && m.client_id === null && m.agreement_id === null, 'la plata no se borra');
  const t = (await c.trash())[0]; ok(t.name === 'Z' && t.extra === 1, 'papelera'); await c.undelete(t.group); ok((await q('agreements', 'select')).count === 1, 'recuperar');
  const d = await c.dump(); await q('tasks', 'delete', { filters: [['neq', 'title', '']] }); await c.restore(JSON.parse(JSON.stringify(d))); ok((await q('tasks', 'select')).count === 30, 'restaurar');
  await throws(() => c.restore({ app: 'otra' }), 'copia falsa');
}

const dir = mkdtempSync(join(tmpdir(), 'myb-prueba-'));
const lite = await sqliteStore(dir); await suite('SQLite', lite); lite.close(); rmSync(dir, { recursive: true, force: true });

const db = new PGlite();
const adapter = { query: async (s, p) => (await db.query(s, p)).rows, exec: s => db.exec(s), tx: fn => db.transaction(t => fn(async (s, p) => (await t.query(s, p)).rows)) };
const store = pgStore(adapter); await suite('Postgres', store);

console.log('Acceso en la nube');
const app = createApp({ store, files: store.files, cloud: true, setupCode: 'codigo', maxFile: 1000 });
const srv = http.createServer((q, r) => app.onRequest(q, r, new URL(q.url, 'http://x').pathname)); await new Promise(r => srv.listen(0, r));
const B = 'http://127.0.0.1:' + srv.address().port;
const go = async (path, body, cookie, h = { 'x-myb': '1' }) => { const r = await fetch(B + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...h, ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }); return { s: r.status, cookie: (r.headers.get('set-cookie') || '').split(';')[0], raw: r.headers.get('set-cookie') || '', d: await r.json().catch(() => null) }; };
ok((await go('/api/yo')).d.first === true, 'primera vez');
ok((await go('/api/db', { table: 'clients' })).s === 401, 'sin entrar no lee'); ok((await go('/api/copia')).s === 401, 'sin entrar no baja la copia'); ok((await go('/api/archivos/a/b.png')).s === 401, 'sin entrar no ve archivos');
const P = { benja: 'prueba-larga-1', mati: 'prueba-larga-2' };
ok((await go('/api/crear-claves', { code: 'mal', ...P })).s === 403, 'código malo'); ok((await go('/api/crear-claves', { code: 'codigo', benja: 'corta', mati: 'corta' })).s === 400, 'clave corta');
ok((await go('/api/crear-claves', { code: 'codigo', ...P })).s === 200, 'crea claves'); ok((await go('/api/crear-claves', { code: 'codigo', ...P })).s === 409, 'no se crean dos veces');
ok((await go('/api/entrar', { user: 'benja', pass: 'x' })).s === 401, 'clave mala');
const e = await go('/api/entrar', { user: 'benja', pass: P.benja }); ok(e.s === 200 && /HttpOnly; Secure; SameSite=Lax/.test(e.raw), 'entra');
ok((await go('/api/yo', undefined, e.cookie)).d.user.id === 'benja', 'sabe quién es'); ok((await go('/api/db', { table: 'tasks' }, e.cookie)).d.count === 30, 'lee');
ok((await go('/api/db', { table: 'tasks' }, e.cookie, {})).s === 403, 'otra web no puede usar la sesión');
ok((await go('/api/archivos/receipts/a.png', 'hola', e.cookie)).s === 200, 'sube'); ok((await go('/api/archivos/receipts/a.png', 'x', e.cookie)).s === 409, 'no pisa'); ok((await go('/api/archivos/receipts/b.png', 'x'.repeat(2000), e.cookie)).s === 413, 'tope de tamaño');
ok((await go('/api/archivos/receipts/..%2fx', undefined, e.cookie)).s === 400, 'ruta rara');
// Sistemas: estado, llave y registro sólo por el servidor
const db1 = b => go('/api/db', b, e.cookie);
const sy = (await db1({ table: 'sistemas', op: 'insert', body: { name: 'Barbería X', status: 'suspendido', service_key: 'mia' } })).d.rows[0];
ok(sy.status === 'activo' && sy.service_key.length === 32, 'el estado y la llave los pone el servidor');
ok((await db1({ table: 'sistemas', op: 'update', body: { status: 'activo' }, filters: [['eq', 'id', sy.id]] })).s === 403, 'el estado no se cambia por la base');
ok((await db1({ table: 'sistemas', op: 'update', body: { plan: 'x' }, filters: [['neq', 'id', '']] })).s === 400, 'no cambia varios juntos');
ok((await db1({ table: 'sistema_registro', op: 'insert', body: { detail: 'falso' } })).s === 403, 'el registro no se escribe a mano');
ok((await db1({ op: 'batch', list: [{ table: 'tasks', op: 'insert', body: { title: 'z' } }, { table: 'sistema_registro', op: 'delete', filters: [['neq', 'id', '']] }] })).s === 403, 'ni dentro de un lote');
const pub = k => fetch(B + '/api/servicio/' + k).then(async r => ({ s: r.status, d: await r.json(), cors: r.headers.get('access-control-allow-origin') }));
let p1 = await pub(sy.service_key); ok(p1.s === 200 && p1.d.activo === true && p1.cors === '*' && Object.keys(p1.d).join() === 'activo,mensaje', 'la app ve que está activa y nada más');
ok((await pub('x'.repeat(32))).s === 404 && (await pub('corta')).s === 404, 'llave falsa');
ok((await go('/api/sistema-estado', { id: sy.id, status: 'suspendido' }, e.cookie)).s === 400, 'suspender pide motivo');
ok((await go('/api/sistema-estado', { id: sy.id, status: 'suspendido', reason: 'Debe 2 meses', message: 'Pausado' })).s === 401, 'sin entrar no suspende');
ok((await go('/api/sistema-estado', { id: sy.id, status: 'suspendido', reason: 'Debe 2 meses', message: 'Pausado' }, e.cookie)).s === 200, 'suspende');
p1 = await pub(sy.service_key); ok(p1.d.activo === false && p1.d.mensaje === 'Pausado', 'la app se corta');
const pay = { table: 'sistema_pagos', op: 'insert', body: { sistema_id: sy.id, period: '2026-11', amount: 100 } };
ok((await db1(pay)).s === 200 && (await db1(pay)).s === 409, 'no se cobra dos veces el mismo mes');
ok((await db1({ table: 'sistema_pagos', op: 'insert', body: { sistema_id: 'nada', period: '2026-11', amount: 1 } })).s === 400, 'pago sin sistema');
ok((await db1({ table: 'sistemas', op: 'delete', filters: [['eq', 'id', sy.id]] })).s === 403, 'no se borra si no está de baja');
await go('/api/sistema-estado', { id: sy.id, status: 'baja', reason: 'Cerró' }, e.cookie);
ok((await db1({ table: 'sistemas', op: 'delete', filters: [['eq', 'id', sy.id]] })).s === 200, 'borra de baja');
const reg = (await db1({ table: 'sistema_registro' })).d.rows;
ok(reg.length === 5 && reg.every(r => r.by === 'benja') && reg.some(r => r.action === 'borrado'), 'registro completo y con quién');
ok((await db1({ table: 'sistema_pagos' })).d.count === 0, 'se fueron sus pagos');
// Invitaciones: mismo candado, corte y registro
const iv = (await db1({ table: 'invitaciones', op: 'insert', body: { name: 'Sofi y Juan', status: 'baja', pagos: [{ id: 'x', amount: 999 }] } })).d.rows[0];
ok(iv.status === 'activa' && iv.pagos.length === 0 && iv.price === 60 && iv.currency === 'USD', 'invitación nueva');
ok((await db1({ table: 'invitaciones', op: 'update', body: { status: 'baja' }, filters: [['eq', 'id', iv.id]] })).s === 403, 'la baja no va por la base');
ok((await db1({ table: 'invitaciones', op: 'update', body: { pagos: [{ id: 'p', amount: -5 }] }, filters: [['eq', 'id', iv.id]] })).s === 400, 'pago negativo');
ok((await db1({ table: 'invitaciones', op: 'update', body: { pagos: [{ id: 'p', amount: 30, at: 1 }] }, filters: [['eq', 'id', iv.id]] })).s === 200, 'seña');
ok((await pub(iv.service_key)).d.activo === true, 'invitación online');
ok((await go('/api/sistema-estado', { id: iv.id, table: 'invitaciones', status: 'baja' }, e.cookie)).s === 200, 'baja sin motivo');
p1 = await pub(iv.service_key); ok(p1.d.activo === false && p1.d.mensaje === 'Esta invitación ya no está disponible.', 'invitación cortada');
const ri = (await db1({ table: 'sistema_registro', filters: [['eq', 'sistema_id', iv.id]] })).d.rows.map(r => r.detail).join('|');
await db1({ table: 'invitaciones', op: 'update', body: { url: 'https://www.mybdigitals.com/tuinvitaciondigital/i/sofi-y-juan' }, filters: [['eq', 'id', iv.id]] });
const bySlug = s => fetch(B + '/api/invitacion-estado?slug=' + s).then(async r => ({ s: r.status, d: await r.json() }));
let bs = await bySlug('sofi-y-juan'); ok(bs.s === 200 && bs.d.activo === false, 'la web pregunta por el link');
ok((await bySlug('otra')).s === 404 && (await bySlug('../x')).s === 404, 'link desconocido o raro');
await go('/api/sistema-estado', { id: iv.id, table: 'invitaciones', status: 'activa' }, e.cookie);
ok((await bySlug('SOFI-Y-JUAN')).d.activo === true, 'vuelve online');
ok(ri.includes('Alta') && ri.includes('Pago de US$30') && ri.includes('Activa a de baja'), 'registro de la invitación');
// Avisos al celular
ok((await db1({ table: 'push_subs' })).s === 403 && (await db1({ table: 'push_config' })).s === 403, 'la pantalla no ve las claves de avisos');
ok((await db1({ op: 'batch', list: [{ table: 'push_subs', op: 'insert', body: { endpoint: 'x' } }] })).s === 403, 'ni las escribe');
ok((await go('/api/push/alta', { subscription: { endpoint: 'https://evil.example.com/x', keys: { p256dh: 'a', auth: 'b' } } }, e.cookie)).s === 400, 'sólo servicios de avisos conocidos');
ok((await go('/api/push/alta', { subscription: { endpoint: 'http://fcm.googleapis.com/x', keys: { p256dh: 'a', auth: 'b' } } }, e.cookie)).s === 400, 'sólo https');
ok((await go('/api/push/alta', { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'a', auth: 'b' } } })).s === 401, 'sin entrar no se suscribe');
ok((await go('/api/push/alta', { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'a', auth: 'b' } } }, e.cookie)).s === 200, 'se suscribe');
const pk = await go('/api/push/clave', {}, e.cookie); ok(pk.s === 200 && pk.d.publicKey.length > 60, 'clave pública de avisos');
const deudor = (await db1({ table: 'sistemas', op: 'insert', body: { name: 'Barbería Morosa', price: 100, bill_from: '2026-01', bill_day: 1, grace_days: 5 } })).d.rows[0];
await db1({ table: 'plan_items', op: 'insert', body: { title: 'Llamar', owner: 'mati', date: new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10) } });
const dg = await digest(app.core);
ok(dg.benja.some(x => x.text.startsWith('Barbería Morosa debe') && x.hot) && !dg.benja.some(x => x.tab === 'hoy') && dg.mati.some(x => x.text.includes('una tarea')), 'avisos del día por persona');
const noche = Date.UTC(2026, 10, 27, 5); // 2 de la mañana en Argentina
ok((await runDaily(app.core, noche)).salteado === true, 'el cron no corre de noche');
const r1 = await runDaily(app.core, Date.UTC(2026, 10, 27, 12), false), r2 = await runDaily(app.core, Date.UTC(2026, 10, 27, 13), false);
ok(!r1.salteado && r2.salteado === true, 'el cron corre una vez por día');
ok((await go('/api/avisos')).s === 200, 'el cron entra sin sesión');
await go('/api/salir', {}, e.cookie); ok((await go('/api/yo', undefined, e.cookie)).d.user === null, 'sale');
let last; for (let i = 0; i < 12; i++) last = await go('/api/entrar', { user: 'mati', pass: 'x' }); ok(last.s === 429, 'frena intentos');
srv.close();
console.log(`${n - bad}/${n} bien`); process.exit(bad ? 1 : 0);
