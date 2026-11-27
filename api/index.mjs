// La misma base, en la nube (Vercel + Postgres). Necesita DATABASE_URL y SETUP_CODE en las variables del proyecto.
import { createApp } from '../server/app.mjs';
import { rutaVoz } from '../server/cerebro.mjs';
import { connectPg, pgStore } from '../server/stores.mjs';

export const config = { api: { bodyParser: false }, maxDuration: 30 };

let app = null;
async function start() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  const store = pgStore(await connectPg(url));
  return createApp({ store, files: store.files, cloud: true, setupCode: process.env.SETUP_CODE || '', maxFile: 4 * 1024 * 1024, extra: { '/api/voz': rutaVoz(false) }, info: () => ({ engine: 'Postgres', data: 'Postgres en la nube', copies: '', list: [], pdf: false }) });
}

export default async function handler(req, res) {
  app ??= await start();
  if (!app) { res.writeHead(503, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: 'Falta conectar la base: cargá DATABASE_URL en Vercel' })); }
  const u = new URL(req.url, 'http://x');
  const r = u.searchParams.get('ruta');
  await app.onRequest(req, res, r ? '/api/' + r.replace(/^\/+/, '') : u.pathname);
}
