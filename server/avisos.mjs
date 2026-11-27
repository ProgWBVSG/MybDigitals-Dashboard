// Avisos al celular (Web Push): una vez por día, lo que hay que mirar hoy.
// - Las claves del envío las crea el servidor y quedan en una tabla que la pantalla no puede leer.
// - Sólo se aceptan direcciones de los servicios de avisos de los navegadores (nada de URLs arbitrarias).
// - /api/avisos lo llama el cron de Vercel; aunque alguien lo llame, corre como mucho una vez por día y sólo a la mañana.
import { createHash } from 'node:crypto';

export const PRIVATE = new Set(['push_config', 'push_subs']);
const CFG = 'push_config', SUBS = 'push_subs';
const HOSTS = /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;
const DAY = 86400000, TZ = -3 * 3600000; // Argentina
const fail = (status, msg) => Object.assign(new Error(msg), { status });
const sha = s => createHash('sha256').update(s).digest('hex');

/** La pantalla no puede tocar estas tablas por /api/db. */
export function touchesPrivate(req) {
  const list = req?.op === 'batch' ? (Array.isArray(req.list) ? req.list : []) : [req];
  return list.some(r => PRIVATE.has(r?.table));
}

async function lib(core) {
  const { default: webpush } = await import('web-push');
  let k = (await core.run({ table: CFG, op: 'select', filters: [['eq', 'id', 'vapid']] })).rows[0];
  if (!k) {
    const v = webpush.generateVAPIDKeys();
    k = (await core.run({ table: CFG, op: 'insert', body: { id: 'vapid', publicKey: v.publicKey, privateKey: v.privateKey } })).rows[0];
  }
  webpush.setVapidDetails('mailto:avisos@mybdigitals.com', k.publicKey, k.privateKey);
  return { webpush, publicKey: k.publicKey };
}

async function send(core, webpush, subs, msg) {
  let n = 0;
  for (const s of subs) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(msg), { TTL: 12 * 3600, urgency: 'normal' }); n++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await core.run({ table: SUBS, op: 'delete', filters: [['eq', 'id', s.id]] }); }
  }
  return n;
}

// ─── Lo que hay que mirar hoy ───
const p2 = n => String(n).padStart(2, '0');
const local = t => new Date(t + TZ);
const ymd = t => { const d = local(t); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`; };
const next = p => { const [y, m] = p.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${p2(m + 1)}`; };
const dueOf = (p, day) => { const [y, m] = p.split('-').map(Number); const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return Date.UTC(y, m - 1, Math.min(Math.max(1, day || 1), last), 23, 59) - TZ; };
const fmt = (n, c) => (c === 'USD' ? 'US$' : '$') + new Intl.NumberFormat('es-AR').format(Number(n) || 0);
const days = (a, b) => Math.round((Date.parse(ymd(a)) - Date.parse(ymd(b))) / DAY);

export async function digest(core, now = Date.now()) {
  const all = async t => (await core.run({ table: t, op: 'select' })).rows;
  const [sys, pays, invs, items] = await Promise.all([all('sistemas'), all('sistema_pagos'), all('invitaciones'), all('plan_items')]);
  const shared = [], today = ymd(now), cur = today.slice(0, 7);
  for (const s of sys) {
    if (s.status !== 'activo' || !/^\d{4}-\d\d$/.test(s.bill_from || '')) continue;
    const paid = new Set(pays.filter(p => p.sistema_id === s.id).map(p => p.period));
    const owed = [];
    for (let p = s.bill_from, i = 0; p <= cur && i < 240; p = next(p), i++) {
      const due = dueOf(p, s.bill_day);
      if (paid.has(p) || due >= now) continue;
      if (p === s.bill_from && p === ymd(Number(s.created_at)).slice(0, 7) && due < Number(s.created_at)) continue;
      owed.push(due);
    }
    const late = owed.length ? Math.floor((now - owed[0]) / DAY) : 0;
    if (owed.length && late > (s.grace_days ?? 5)) shared.push({ text: `${s.name} debe ${owed.length === 1 ? 'un mes' : owed.length + ' meses'}: para suspender`, tab: 'sistemas', hot: 1 });
    else if (!paid.has(cur) && ymd(dueOf(cur, s.bill_day)) === today && cur >= s.bill_from) shared.push({ text: `${s.name}: hoy vence el abono`, tab: 'sistemas', hot: 0 });
  }
  for (const i of invs) {
    if (i.status !== 'activa') continue;
    const owe = Math.max(0, (i.price || 0) - (i.pagos || []).reduce((a, p) => a + (p.amount || 0), 0));
    if (i.ends_at && i.ends_at < now) shared.push({ text: `Invitación de ${i.name}: terminó su tiempo, darla de baja`, tab: 'invitaciones', hot: 1 });
    else if (i.ends_at && days(i.ends_at, now) === 1) shared.push({ text: `Invitación de ${i.name}: termina mañana`, tab: 'invitaciones', hot: 0 });
    if (owe > 0 && i.event_date && days(i.event_date, now) >= 0 && days(i.event_date, now) <= 7) shared.push({ text: `${i.name}: evento en ${days(i.event_date, now)} días y debe ${fmt(owe, i.currency)}`, tab: 'invitaciones', hot: 1 });
  }
  const per = {};
  for (const who of ['benja', 'mati']) {
    const mine = items.filter(x => x.owner === who && x.date === today && !x.done_at).length;
    per[who] = [...shared.sort((a, b) => b.hot - a.hot), ...(mine ? [{ text: `Tenés ${mine === 1 ? 'una tarea' : mine + ' tareas'} para hoy`, tab: 'hoy', hot: 0 }] : [])];
  }
  return per;
}

const message = list => ({
  title: list.length === 1 ? 'MYB: una cosa para hoy' : `MYB: ${list.length} cosas para hoy`,
  body: list.slice(0, 4).map(x => x.text).join('\n') + (list.length > 4 ? `\ny ${list.length - 4} más` : ''),
  url: '/#' + (new Set(list.map(x => x.tab)).size === 1 ? list[0].tab : 'hoy'),
});

/** Cron diario. Corre una sola vez por día y sólo entre las 7 y las 12 de Argentina. */
export async function runDaily(core, now = Date.now(), force = false) {
  const h = local(now).getUTCHours();
  const last = (await core.run({ table: CFG, op: 'select', filters: [['eq', 'id', 'ultimo']] })).rows[0];
  if (!force && (h < 7 || h >= 12 || (last && now - last.at < 20 * 3600000))) return { enviados: 0, salteado: true };
  await core.run({ table: CFG, op: 'upsert', body: { id: 'ultimo', at: now } });
  const subs = (await core.run({ table: SUBS, op: 'select' })).rows;
  if (!subs.length) return { enviados: 0 };
  const per = await digest(core, now), { webpush } = await lib(core);
  let n = 0;
  for (const [who, list] of Object.entries(per)) if (list.length) n += await send(core, webpush, subs.filter(s => s.user === who), message(list));
  return { enviados: n };
}

/** Rutas con sesión: clave pública, alta, baja y prueba. */
export async function pushRoute(core, path, body, by) {
  if (path === '/api/push/clave') return { publicKey: (await lib(core)).publicKey };
  if (!by) throw fail(403, 'Elegí quién sos para activar los avisos');
  if (path === '/api/push/alta') {
    const s = body?.subscription, ep = String(s?.endpoint || '');
    let u; try { u = new URL(ep); } catch { throw fail(400, 'Suscripción inválida'); }
    if (u.protocol !== 'https:' || !HOSTS.test(u.hostname) || ep.length > 1000) throw fail(400, 'Ese servicio de avisos no está permitido');
    const keys = { p256dh: String(s?.keys?.p256dh || '').slice(0, 200), auth: String(s?.keys?.auth || '').slice(0, 100) };
    if (!keys.p256dh || !keys.auth) throw fail(400, 'Suscripción inválida');
    await core.run({ table: SUBS, op: 'upsert', body: { id: sha(ep), user: by, endpoint: ep, keys, device: String(body.device || '').slice(0, 80), at: Date.now() } });
    return { ok: true };
  }
  if (path === '/api/push/baja') { await core.run({ table: SUBS, op: 'delete', filters: [['eq', 'id', sha(String(body?.endpoint || ''))]] }); return { ok: true }; }
  if (path === '/api/push/probar') {
    const subs = (await core.run({ table: SUBS, op: 'select', filters: [['eq', 'user', by]] })).rows;
    if (!subs.length) throw fail(404, 'Este celular no tiene los avisos activados');
    const { webpush } = await lib(core);
    const list = (await digest(core))[by] || [];
    const n = await send(core, webpush, subs, list.length ? message(list) : { title: 'MYB: avisos activados', body: 'Cada mañana te llega lo que hay que mirar ese día.', url: '/#hoy' });
    return { enviados: n };
  }
  throw fail(404, 'No existe');
}
