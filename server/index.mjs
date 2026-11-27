// MYB Dashboard en esta computadora: sirve la pantalla, guarda los datos, hace las copias y los PDF.
// Sólo responde a esta compu (127.0.0.1). Con DATABASE_URL usa Postgres; si no, SQLite en el disco.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { copyFileSync, createReadStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createApp, TYPES } from './app.mjs';
import { motores, rutaVoz } from './cerebro.mjs';
import { hayOido, rutaOido } from './oido.mjs';
import { connectPg, pgStore, sqliteStore } from './stores.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.MYB_PORT || 4400);
const DATA = process.env.MYB_DATA || join(homedir(), 'MYB Dashboard Datos');     // base viva: fuera de OneDrive para que no la trabe
const COPIES = process.env.MYB_COPIES || resolve(ROOT, '..', 'dashboard-copias'); // copias: dentro de OneDrive, quedan también en la nube
const DIST = join(ROOT, 'dist');
const FILES = join(DATA, 'archivos');
const KEEP = 60;

const open = await fetch(`http://127.0.0.1:${PORT}/api/estado`, { headers: { 'x-myb': '1' } }).then(r => r.json()).catch(() => null);
if (open?.app === 'myb-dashboard') { console.log(`Ya estaba abierto: http://localhost:${PORT}`); process.exit(0); }

const pg = process.env.DATABASE_URL ? await connectPg(process.env.DATABASE_URL) : null;
const store = pg ? pgStore(pg) : await sqliteStore(DATA);
mkdirSync(FILES, { recursive: true });

const inside = (base, path) => { const f = resolve(base, path); if (f !== base && !f.startsWith(base + sep)) throw Object.assign(new Error('Ruta inválida'), { status: 400 }); return f; };
function fileList(dir, base = '') {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? fileList(join(dir, e.name), base + e.name + '/') : e.name.endsWith('.tmp') ? [] : [base + e.name]);
}
const diskFiles = {
  get: async p => { const f = inside(FILES, p); return existsSync(f) && statSync(f).isFile() ? { type: TYPES[extname(f).slice(1).toLowerCase()] || 'application/octet-stream', data: readFileSync(f) } : null; },
  put: async (p, _type, data, over) => {
    const f = inside(FILES, p);
    if (existsSync(f) && !over) return false;
    mkdirSync(dirname(f), { recursive: true });
    const tmp = `${f}.${randomBytes(4).toString('hex')}.tmp`;
    writeFileSync(tmp, data); renameSync(tmp, f); return true;
  },
  count: async () => fileList(FILES).length,
};

// ─── Copias de seguridad ───
let lastHash = '', lastCopy = null, copyError = '', timer = null;
const copyList = () => existsSync(COPIES) ? readdirSync(COPIES).filter(f => /^\d{4}-\d\d-\d\d.*\.json$/.test(f)).sort().reverse() : [];
async function backup(tag = '') {
  try {
    const d = await app.core.dump();
    const files = pg ? [] : fileList(FILES);
    const hash = createHash('sha1').update(JSON.stringify([d.tables, files])).digest('hex');
    if (hash === lastHash && !tag) return true;
    // Una base recién creada no pisa la copia de hoy
    if (!tag && !Object.keys(d.tables).some(t => t !== 'app_settings')) return true;
    mkdirSync(COPIES, { recursive: true });
    const t = new Date(), p = n => String(n).padStart(2, '0');
    const day = `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
    const name = tag ? `${day} ${p(t.getHours())}.${p(t.getMinutes())}.${p(t.getSeconds())} ${tag}.json` : `${day}.json`;
    const tmp = join(COPIES, name + '.tmp');
    writeFileSync(tmp, JSON.stringify(d, null, 1)); renameSync(tmp, join(COPIES, name));
    for (const f of files) {
      const to = join(COPIES, 'archivos', f);
      if (!existsSync(to)) { mkdirSync(dirname(to), { recursive: true }); copyFileSync(join(FILES, f), to); }
    }
    copyList().slice(KEEP).forEach(f => rmSync(join(COPIES, f)));
    lastHash = hash; lastCopy = Date.now(); copyError = '';
    return true;
  } catch (e) { copyError = e.message; console.error('Copia:', e.message); return false; }
}
const backupSoon = () => { timer ??= setTimeout(() => { timer = null; backup(); }, Number(process.env.MYB_COPY_MS || 60000)); };

// ─── PDF: usa el Edge o el Chrome que ya está instalado ───
const BROWSER = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean)
  .flatMap(d => [join(d, 'Microsoft/Edge/Application/msedge.exe'), join(d, 'Google/Chrome/Application/chrome.exe')]).find(existsSync);
async function makePdf(html) {
  if (!BROWSER) throw Object.assign(new Error('No encontré Edge ni Chrome para armar el PDF'), { status: 501 });
  const dir = mkdtempSync(join(tmpdir(), 'myb-pdf-'));
  try {
    // Sin scripts ni pedidos a otro lado: sólo el documento y su tipografía
    const safe = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:">`;
    writeFileSync(join(dir, 'a.html'), html.replace('<head>', '<head>' + safe));
    const out = join(dir, 'a.pdf');
    await new Promise((ok, bad) => {
      const c = spawn(BROWSER, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', `--user-data-dir=${join(dir, 'perfil')}`, '--no-pdf-header-footer', '--virtual-time-budget=6000', `--print-to-pdf=${out}`, pathToFileURL(join(dir, 'a.html')).href], { stdio: 'ignore', windowsHide: true });
      const t = setTimeout(() => { c.kill(); bad(new Error('El PDF tardó demasiado')); }, 45000);
      c.on('error', e => { clearTimeout(t); bad(e); }); c.on('exit', () => { clearTimeout(t); ok(); });
    });
    for (let i = 0; i < 40 && !existsSync(out); i++) await new Promise(r => setTimeout(r, 100));
    if (!existsSync(out)) throw new Error('No se pudo armar el PDF');
    return readFileSync(out);
  } finally { try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* lo limpia Windows */ } }
}

const app = createApp({
  store, files: pg ? store.files : diskFiles, onChange: backupSoon,
  info: () => ({ lastCopy, copyError, engine: pg ? 'Postgres' : 'SQLite', data: pg ? 'Postgres en la nube' : DATA, copies: COPIES, list: copyList().slice(0, 12), pdf: !!BROWSER }),
  extra: {
    '/api/voz': async c => c.body.estado ? c.json(c.res, 200, { motores: motores(true), oido: hayOido() }) : rutaVoz(true)(c),
    '/api/oido': rutaOido,
    '/api/copiar': async ({ res, json }) => await backup('manual') ? json(res, 200, { lastCopy }) : json(res, 500, { error: 'No se pudo copiar: ' + copyError }),
    '/api/restaurar': async ({ res, body, core, json, fail, checkDump, onChange }) => {
      if (body.file && !copyList().includes(body.file)) throw fail(404, 'No está esa copia');
      const d = body.file ? JSON.parse(readFileSync(join(COPIES, body.file), 'utf8')) : body.dump;
      checkDump(d);
      if (!(await backup('antes de restaurar'))) throw fail(500, 'No restauré porque antes no pude guardar una copia: ' + copyError);
      await core.restore(d); onChange(); json(res, 200, { ok: true });
    },
    '/api/pdf': async ({ res, body, fail }) => {
      if (typeof body.html !== 'string' || body.html.length > 5e6) throw fail(400, 'Documento inválido');
      const pdf = await makePdf(body.html);
      res.writeHead(200, { 'content-type': 'application/pdf', 'content-length': pdf.length, 'cache-control': 'no-store' }); res.end(pdf);
    },
  },
});
await app.init();
await backup();

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
const send = (res, file, cache) => { res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'content-length': statSync(file).size, 'cache-control': cache, 'x-content-type-options': 'nosniff' }); createReadStream(file).pipe(res); };
const server = http.createServer((req, res) => {
  try {
    if (!HOSTS.has(req.headers.host || '')) { res.writeHead(403); return res.end(); }
    const path = new URL(req.url, 'http://x').pathname;
    if (path.startsWith('/api/')) return void app.onRequest(req, res, path);
    if (!existsSync(join(DIST, 'index.html'))) { res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Falta armar la pantalla: npm run build'); }
    const f = inside(DIST, '.' + decodeURIComponent(path));
    if (existsSync(f) && statSync(f).isFile()) return send(res, f, path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
    if (path.startsWith('/assets/')) { res.writeHead(404); return res.end(); }
    send(res, join(DIST, 'index.html'), 'no-cache');
  } catch { if (!res.headersSent) { res.writeHead(400); } res.end(); }
});
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `El puerto ${PORT} está ocupado por otro programa.` : e.message); process.exit(1); });
server.listen(PORT, '127.0.0.1', () => console.log(`MYB Dashboard: http://localhost:${PORT}\nBase: ${pg ? 'Postgres' : DATA}\nCopias: ${COPIES}`));
const stop = async () => { await backup(); try { store.close?.(); await pg?.end(); } catch { /* ya cerrada */ } process.exit(0); };
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(s => process.on(s, stop));
