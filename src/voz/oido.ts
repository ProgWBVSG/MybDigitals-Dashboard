// El micrófono: dictado del navegador (texto en vivo) o Whisper en esta compu. Corta solo cuando hacés una pausa.
import { post } from '../base';

export interface Escucha { parcial: (t: string) => void; frase: (t: string) => void; nivel: (n: number) => void; estado: (s: 'abriendo' | 'oyendo' | 'escribiendo' | 'apagado') => void; error: (m: string, probarLocal?: boolean, sigue?: boolean) => void }
export interface Oido { parar: () => void; pausa: (on: boolean) => void; cerrarFrase: () => void }

const SR: any = typeof window === 'undefined' ? null : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
export const hayDictado = () => !!SR;
const movil = () => /Android|iPhone|iPad/i.test(navigator.userAgent);
const MIC: Record<string, string> = {
  NotAllowedError: 'El navegador no tiene permiso para usar el micrófono. Tocá el ícono al lado de la dirección y permitilo.',
  NotFoundError: 'No encontré ningún micrófono conectado.', NotReadableError: 'Otro programa está usando el micrófono.',
};
const PAUSA = 1500;

/** Mide el volumen para que se vea que está oyendo. */
async function medidor(nivel: (n: number) => void) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const ac = new AudioContext(), an = ac.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.5;
  ac.createMediaStreamSource(stream).connect(an);
  const buf = new Float32Array(an.fftSize); let raf = 0, vivo = true;
  const paso = () => { if (!vivo) return; an.getFloatTimeDomainData(buf); let s = 0; for (const x of buf) s += x * x; nivel(Math.sqrt(s / buf.length)); raf = requestAnimationFrame(paso); };
  paso();
  return { stream, cerrar: () => { vivo = false; cancelAnimationFrame(raf); stream.getTracks().forEach(t => t.stop()); ac.close().catch(() => {}); } };
}

export function escuchar(e: Escucha, modo: 'navegador' | 'local', pista: string): Oido {
  return modo === 'local' || !SR ? conWhisper(e, pista) : conDictado(e);
}

function conDictado(e: Escucha): Oido {
  let vivo = true, pausado = false, rec: any = null, texto = '', reloj = 0, med: Awaited<ReturnType<typeof medidor>> | null = null, caidas = 0, oyo = false, voz = 0, antes = 0;
  // Hay voz pero el dictado no devuelve nada: en algunos navegadores existe y no anda
  const vigilar = (n: number) => { e.nivel(n); const t = performance.now(), dt = Math.min(100, t - antes); antes = t; if (oyo || pausado || !vivo) return; if (n > 0.02) voz += dt; if (voz > 3000) { vivo = false; try { rec?.abort(); } catch { /* nada */ } med?.cerrar(); e.error('El dictado del navegador no responde. Probá con Chrome o Edge.', true); } };
  const emitir = () => { clearTimeout(reloj); const t = texto.trim(); texto = ''; if (t) e.frase(t); };
  const abrir = () => {
    if (!vivo || pausado) return;
    const r = rec = new SR();
    r.lang = 'es-AR'; r.continuous = !movil(); r.interimResults = true; r.maxAlternatives = 1;
    r.onstart = () => { e.estado('oyendo'); };
    r.onresult = (ev: any) => {
      caidas = 0; oyo = true;
      let t = ''; for (let i = 0; i < ev.results.length; i++) t += (t && !/\s$/.test(t) ? ' ' : '') + ev.results[i][0].transcript.trim();
      texto = t; e.parcial(t);
      clearTimeout(reloj); reloj = window.setTimeout(() => { try { r.stop(); } catch { /* ya cerró */ } }, PAUSA);
    };
    r.onerror = (ev: any) => {
      if (ev.error === 'no-speech' || ev.error === 'aborted') return;
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { vivo = false; e.error(MIC.NotAllowedError); }
      else if (ev.error === 'audio-capture') { vivo = false; e.error(MIC.NotFoundError); }
      else if (ev.error === 'network') { if (++caidas > 2) { vivo = false; e.error('El dictado del navegador no responde.', true); } }
    };
    r.onend = () => { if (rec === r) rec = null; emitir(); if (vivo && !pausado) window.setTimeout(abrir, caidas ? 900 : 120); else if (!vivo) e.estado('apagado'); };
    try { r.start(); } catch { window.setTimeout(abrir, 400); }
  };
  e.estado('abriendo');
  (async () => {
    // En el celular el dictado y el medidor no pueden usar el micrófono a la vez
    if (!movil()) { try { const m = await medidor(vigilar); if (vivo) med = m; else m.cerrar(); } catch (x) { const n = (x as Error).name; if (MIC[n]) { vivo = false; e.error(MIC[n]); e.estado('apagado'); return; } } }
    abrir();
  })();
  return {
    parar: () => { vivo = false; clearTimeout(reloj); try { rec?.stop(); } catch { /* nada */ } med?.cerrar(); e.nivel(0); e.estado('apagado'); },
    pausa: on => { pausado = on; if (on) { texto = ''; try { rec?.abort(); } catch { /* nada */ } } else if (vivo && !rec) abrir(); },
    cerrarFrase: () => { try { rec?.stop(); } catch { /* nada */ } },
  };
}

function conWhisper(e: Escucha, pista: string): Oido {
  let vivo = true, pausado = false, med: Awaited<ReturnType<typeof medidor>> | null = null, mr: MediaRecorder | null = null;
  let hablando = false, voz = 0, ultimo = 0, desde = 0, piso = 0.008, cola: Promise<void> = Promise.resolve();
  post('oido', { preparar: true });
  const grabar = () => {
    if (!vivo || !med) return;
    hablando = false; voz = 0; desde = performance.now();
    const r = mr = new MediaRecorder(med.stream, MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus' } : undefined);
    let sirve = false;
    (r as any).usar = () => { sirve = true; };
    const mias: Blob[] = [];
    r.ondataavailable = x => { if (x.data.size) mias.push(x.data); };
    r.onstop = () => { if (sirve && mias.length) { const b = new Blob(mias, { type: r.mimeType }); cola = cola.then(() => enviar(b)); } };
    r.start(250);
  };
  const cortar = (usar: boolean) => { if (mr && mr.state !== 'inactive') { if (usar) (mr as any).usar(); mr.stop(); } mr = null; if (vivo) grabar(); };
  const enviar = async (b: Blob) => {
    e.estado('escribiendo');
    const audio = await new Promise<string>(ok => { const f = new FileReader(); f.onload = () => ok(String(f.result).split(',')[1] || ''); f.readAsDataURL(b); });
    const { data, error } = await post<{ texto: string }>('oido', { audio, pista });
    if (vivo) e.estado('oyendo');
    if (error) e.error(error.message, false, true); else if (data?.texto) e.frase(data.texto);
  };
  const oir = (n: number) => {
    e.nivel(n); if (pausado || !mr) return;
    const t = performance.now();
    if (!hablando) piso = Math.min(0.03, piso * 0.98 + n * 0.02);
    if (n > Math.max(0.012, piso * 2.6)) { voz = voz || t; ultimo = t; if (!hablando && t - voz > 140) { hablando = true; e.parcial('…'); } }
    else if (!hablando && t - ultimo > 250) voz = 0;
    if (hablando && (t - ultimo > PAUSA || t - desde > 55000)) cortar(true);
    else if (!hablando && t - desde > 12000) cortar(false); // silencio: se tira y se empieza de nuevo
  };
  e.estado('abriendo');
  medidor(oir).then(m => { if (!vivo) { m.cerrar(); return; } med = m; grabar(); e.estado('oyendo'); }).catch(x => { vivo = false; e.error(MIC[(x as Error).name] || 'No se pudo abrir el micrófono.'); e.estado('apagado'); });
  return {
    parar: () => { const h = hablando; vivo = false; if (mr && mr.state !== 'inactive') { if (h) (mr as any).usar(); mr.stop(); } med?.cerrar(); e.nivel(0); e.estado('apagado'); },
    pausa: on => { pausado = on; cortar(false); },
    cerrarFrase: () => { if (hablando) cortar(true); },
  };
}

// ─── Hablar ───
export function decir(t: string, al: (hablando: boolean) => void) {
  const s = window.speechSynthesis; if (!s || !t) return;
  s.cancel();
  const u = new SpeechSynthesisUtterance(t.replace(/US\$\s?([\d.,]+)/g, '$1 dólares').replace(/\$\s?([\d.,]+)/g, '$1 pesos'));
  const v = s.getVoices(); u.voice = v.find(x => x.lang === 'es-AR') || v.find(x => /^es-(419|MX|US)/.test(x.lang)) || v.find(x => x.lang.startsWith('es')) || null;
  u.lang = u.voice?.lang || 'es-AR'; u.rate = 1.08;
  u.onstart = () => al(true); u.onend = u.onerror = () => window.setTimeout(() => al(false), 250);
  s.speak(u);
}
