// Oído local: Whisper en esta compu, para cuando el dictado del navegador no está o no se quiere mandar el audio afuera.
import { spawn } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PY = join(dirname(fileURLToPath(import.meta.url)), 'oido.py');
export const hayOido = () => existsSync(join(homedir(), '.cache/huggingface/hub/models--Systran--faster-whisper-small'));
let p = null, cola = [], listo = null, apagar = null;
function prender() {
  clearTimeout(apagar); apagar = setTimeout(() => p?.kill(), 180000); // libera la memoria si no se usa
  if (p) return listo;
  const c = p = spawn('python', ['-I', PY], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
  let buf = '', arranco;
  listo = new Promise((ok, bad) => { arranco = { ok, bad }; }); listo.catch(() => {});
  c.stdout.setEncoding('utf8');
  c.stdout.on('data', d => { buf += d; for (let i; (i = buf.indexOf('\n')) >= 0;) { const l = buf.slice(0, i); buf = buf.slice(i + 1); try { const r = JSON.parse(l); if (r.listo) arranco.ok(); else cola.shift()?.(r); } catch { /* renglón ajeno */ } } });
  const fin = () => { if (p === c) { p = null; cola.forEach(f => f({ error: 'Se cerró' })); cola = []; } arranco.bad(new Error('No se pudo abrir el oído local')); };
  c.on('error', fin); c.on('exit', fin); c.stdin.on('error', () => {});
  return listo;
}
/** Ruta /api/oido. */
export async function rutaOido({ res, body, json, fail }) {
  if (!hayOido()) throw fail(501, 'Whisper no está instalado en esta compu');
  if (body.preparar) { prender(); return json(res, 200, { ok: true }); }
  const audio = Buffer.from(String(body.audio || ''), 'base64');
  if (audio.length < 800 || audio.length > 12e6) throw fail(400, 'Audio inválido');
  const f = join(tmpdir(), `myb-voz-${randomBytes(6).toString('hex')}.webm`);
  writeFileSync(f, audio);
  try {
    await prender();
    const r = await new Promise((ok, bad) => {
      const t = setTimeout(() => { p?.kill(); bad(fail(504, 'El oído local tardó demasiado')); }, 60000);
      cola.push(x => { clearTimeout(t); ok(x); });
      p.stdin.write(JSON.stringify({ audio: f, pista: String(body.pista || '').slice(0, 600) }) + '\n');
    });
    if (r.error) throw fail(502, 'No se pudo entender el audio');
    json(res, 200, r);
  } catch (e) { throw e.status ? e : fail(502, e.message); } finally { rmSync(f, { force: true }); }
}
process.on('exit', () => p?.kill());
