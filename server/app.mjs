// El servidor en sí: pedidos, archivos, acceso y seguridad. Lo usan la compu (index.mjs) y la nube (api/index.mjs).
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { checkDump, createCore } from './core.mjs';
import { changeState, LOG, prepare, publicInvitation, publicState } from './sistemas.mjs';

const scrypt = promisify(scryptCb);
export const USERS = { benja: 'Benjamín', mati: 'Matías' };
const fail = (status, msg) => Object.assign(new Error(msg), { status });
const sha = s => createHash('sha256').update(s).digest('hex');
export const TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', heic: 'image/heic', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', pdf: 'application/pdf' };

export async function hashPass(pass) {
  const salt = randomBytes(16);
  return salt.toString('hex') + ':' + (await scrypt(pass, salt, 64)).toString('hex');
}
async function checkPass(pass, saved) {
  const [salt, hash] = saved.split(':');
  const got = await scrypt(pass, Buffer.from(salt, 'hex'), 64);
  return timingSafeEqual(got, Buffer.from(hash, 'hex'));
}

const json = (res, code, data, head = {}) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store', ...head }); res.end(JSON.stringify(data)); };
const readBody = (req, max) => new Promise((ok, bad) => {
  const parts = []; let n = 0;
  req.on('data', c => { n += c.length; if (n > max) { bad(fail(413, 'El archivo es demasiado grande')); req.resume(); } else parts.push(c); });
  req.on('end', () => ok(Buffer.concat(parts))); req.on('error', bad);
});
function filePath(s) {
  let parts;
  try { parts = s.split('/').map(decodeURIComponent); } catch { throw fail(400, 'Ruta inválida'); }
  if (parts.length < 2 || parts.some(p => !p || p === '.' || p === '..' || /[<>:"|?*\\/\x00-\x1f]/.test(p))) throw fail(400, 'Ruta inválida');
  return parts.join('/');
}

/**
 * store: dónde se guarda. files: { get, put, count }. cloud: pide contraseña.
 * extra: rutas propias de la compu (copias, PDF). onChange: se llama tras cada cambio.
 */
export function createApp({ store, files, cloud = false, setupCode = '', maxFile = 200 * 1024 * 1024, extra = {}, onChange = () => {}, info = () => ({}) }) {
  const core = createCore(store);
  let ready = null;
  const init = () => (ready ??= (async () => { await store.ready(); await core.init(); })().catch(e => { ready = null; throw e; }));

  // ─── Acceso (sólo en la nube) ───
  const cookie = (token, age) => `myb=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
  async function who(req) {
    if (!cloud) return { id: '', local: true };
    const t = /(?:^|;\s*)myb=([a-f0-9]{64})/.exec(req.headers.cookie || '')?.[1];
    if (!t) return null;
    const r = (await store.query('select u.id, u.nombre from myb.sesiones s join myb.usuarios u on u.id = s.usuario where s.huella = $1 and s.vence > now()', [sha(t)]))[0];
    return r ? { id: r.id, name: r.nombre } : null;
  }
  const hasUsers = async () => (await store.query('select count(*)::int as c from myb.usuarios'))[0].c > 0;
  async function limited(key, max) {
    await store.query("delete from myb.intentos where cuando < now() - interval '15 minutes'");
    const c = (await store.query('select count(*)::int as c from myb.intentos where clave = $1', [key]))[0].c;
    if (c >= max) throw fail(429, 'Demasiados intentos. Esperá 15 minutos.');
    await store.query('insert into myb.intentos (clave) values ($1)', [key]);
  }
  async function login(res, user) {
    const token = randomBytes(32).toString('hex');
    await store.query("insert into myb.sesiones (huella, usuario, vence) values ($1, $2, now() + interval '60 days')", [sha(token), user]);
    await store.query('delete from myb.sesiones where vence < now()');
    json(res, 200, { id: user, name: USERS[user] }, { 'set-cookie': cookie(token, 60 * 86400) });
  }

  async function handle(req, res, path) {
    await init();
    // Lo único público: la app de cada negocio pregunta si su servicio sigue activo
    if (path.startsWith('/api/servicio/')) return publicState(core, req, res, path.slice(14));
    if (path === '/api/invitacion-estado') return publicInvitation(core, req, res, new URL(req.url, 'http://x').searchParams.get('slug'));
    const isFile = path.startsWith('/api/archivos/');
    // Una página ajena no puede mandar este encabezado: evita que otra web use la base con tu sesión
    if (!(isFile && req.method === 'GET') && req.headers['x-myb'] !== '1') throw fail(403, 'No permitido');
    const me = await who(req);
    const p = String(req.headers['x-myb-persona'] || '');
    const by = cloud ? me?.id || '' : USERS[p] ? p : ''; // en la nube manda la sesión, no lo que diga la pantalla

    if (path === '/api/yo') return json(res, 200, me ? { user: me, cloud } : { user: null, cloud, first: cloud && !(await hasUsers()), users: USERS });
    if (cloud && !me) {
      if (req.method !== 'POST') throw fail(401, 'Entrá con tu contraseña');
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
      if (path === '/api/crear-claves') {
        const b = JSON.parse((await readBody(req, 10000)).toString());
        await limited('crear:' + ip, 8);
        if (!setupCode || sha(String(b.code || '')) !== sha(setupCode)) throw fail(403, 'El código de instalación no es correcto');
        if (await hasUsers()) throw fail(409, 'Las contraseñas ya están creadas');
        for (const u of Object.keys(USERS)) if (String(b[u] || '').length < 10) throw fail(400, 'Cada contraseña necesita al menos 10 caracteres');
        for (const [u, n] of Object.entries(USERS)) await store.query('insert into myb.usuarios (id, nombre, clave) values ($1, $2, $3)', [u, n, await hashPass(String(b[u]))]);
        return json(res, 200, { ok: true });
      }
      if (path === '/api/entrar') {
        const b = JSON.parse((await readBody(req, 10000)).toString());
        const u = String(b.user || '');
        await limited('ip:' + ip, 20); await limited('u:' + u, 10);
        const r = (await store.query('select clave from myb.usuarios where id = $1', [u]))[0];
        if (!r || !(await checkPass(String(b.pass || ''), r.clave))) throw fail(401, 'La contraseña no es correcta');
        await store.query('delete from myb.intentos where clave = $1', ['u:' + u]);
        return login(res, u);
      }
      throw fail(401, 'Entrá con tu contraseña');
    }

    if (isFile && req.method === 'GET') {
      const f = await files.get(filePath(path.slice(14)), req);
      if (!f) throw fail(404, 'No está ese archivo');
      const head = { 'content-type': f.type, 'x-content-type-options': 'nosniff', 'cache-control': 'private, max-age=3600', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox", 'cross-origin-resource-policy': 'same-origin', 'accept-ranges': 'bytes' };
      const size = f.data.length, m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (m && (m[1] || m[2])) {
        const a = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2])), z = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
        if (a > z || a >= size) { res.writeHead(416, { 'content-range': `bytes */${size}` }); return res.end(); }
        res.writeHead(206, { ...head, 'content-range': `bytes ${a}-${z}/${size}`, 'content-length': z - a + 1 }); return res.end(f.data.subarray(a, z + 1));
      }
      res.writeHead(200, { ...head, 'content-length': size }); return res.end(f.data);
    }
    if (isFile && req.method === 'POST') {
      const p = filePath(path.slice(14));
      const type = TYPES[p.split('.').pop().toLowerCase()] || 'application/octet-stream';
      if (!(await files.put(p, type, await readBody(req, maxFile), req.headers['x-reemplazar'] === '1'))) throw fail(409, 'Ese archivo ya existe');
      onChange(); return json(res, 200, { ok: true });
    }
    if (req.method === 'GET') {
      if (path === '/api/cambios') { const d = new URL(req.url, 'http://x').searchParams.get('desde'); return json(res, 200, await core.since(d == null || d === '' ? null : Number(d))); }
      if (path === '/api/estado') return json(res, 200, { app: 'myb-dashboard', cloud, counts: await core.counts(), files: await files.count(), ...info() });
      if (path === '/api/papelera') return json(res, 200, await core.trash());
      if (path === '/api/copia') return json(res, 200, await core.dump());
      throw fail(404, 'No existe');
    }
    if (req.method !== 'POST') throw fail(405, 'No permitido');
    if (path === '/api/salir') {
      const t = /(?:^|;\s*)myb=([a-f0-9]{64})/.exec(req.headers.cookie || '')?.[1];
      if (cloud && t) await store.query('delete from myb.sesiones where huella = $1', [sha(t)]);
      return json(res, 200, { ok: true }, { 'set-cookie': cookie('', 0) });
    }
    let body;
    try { body = JSON.parse((await readBody(req, 64 * 1024 * 1024)).toString('utf8') || '{}'); }
    catch (e) { throw e.status ? e : fail(400, 'Pedido inválido'); }
    if (path === '/api/db') {
      const audit = await prepare(core, body, by);
      let r;
      if (!audit.length) r = await core.run(body);
      else { // el registro entra en la misma operación: o se guarda todo o nada
        const single = body.op !== 'batch';
        const all = await core.run({ op: 'batch', list: [...(single ? [body] : body.list), { table: LOG, op: 'insert', body: audit }] });
        const rows = all.rows.slice(0, -1);
        r = { ...all, rows: single ? rows[0] : rows, count: single ? rows[0].length : rows.length };
      }
      if (r.touched.length) onChange();
      return json(res, 200, r);
    }
    if (path === '/api/sistema-estado') { await changeState(core, body, by); onChange(); return json(res, 200, { ok: true }); }
    if (path === '/api/deshacer') { await core.undelete(String(body.group)); onChange(); return json(res, 200, { ok: true }); }
    const own = extra[path];
    if (own) return own({ req, res, body, core, json, fail, checkDump, onChange });
    if (path === '/api/restaurar' && body.dump) { checkDump(body.dump); await core.restore(body.dump); onChange(); return json(res, 200, { ok: true }); }
    throw fail(404, 'No existe');
  }

  const onRequest = async (req, res, path) => {
    try { await handle(req, res, path); }
    catch (e) {
      if (!e.status && !e.code && e.constructor !== Error) console.error(e);
      const db = /^[0-9A-Z]{5}$/.test(e.code || '') && e.code !== '23505';
      if (db) console.error('Base:', e.message);
      if (!res.headersSent) json(res, e.status || (e.code === '23505' ? 409 : db ? 500 : 400), { error: db ? 'La base no pudo guardar. Probá de nuevo.' : e.message, code: e.code });
      else res.end();
    }
  };
  return { onRequest, core, init, json };
}
