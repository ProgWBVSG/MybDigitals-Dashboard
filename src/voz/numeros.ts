// Números, plata y fechas como se dicen acá: "14 lucas", "medio palo", "doscientos dólares", "el lunes pasado".
import { addDays, addMonths, type Cur } from '../negocio';

/** Sin acentos ni mayúsculas, con el mismo largo que el original para poder marcar dónde está cada cosa. */
export const plano = (s: string) => s.normalize('NFC').split('').map(c => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()[0] ?? c).join('');

export interface Tramo { ini: number; fin: number }
export interface Cantidad extends Tramo { valor: number; moneda: '' | Cur; clase: 'plata' | 'quizas' | 'pct' | 'tiempo' | 'fecha' | 'otra'; unidad: string; enLetras: boolean }

const U: Record<string, number> = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29 };
const D: Record<string, number> = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
const C: Record<string, number> = { cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900 };
const MULT: Record<string, number> = { mil: 1e3, k: 1e3, luca: 1e3, lucas: 1e3, millon: 1e6, millones: 1e6, palo: 1e6, palos: 1e6, gamba: 100, gambas: 100 };
const SLANG = /^(lucas?|palos?|gambas?)$/;
const CUR: Record<string, Cur> = { peso: 'ARS', pesos: 'ARS', mango: 'ARS', mangos: 'ARS', ars: 'ARS', $: 'ARS', dolar: 'USD', dolares: 'USD', usd: 'USD', verde: 'USD', verdes: 'USD', us$: 'USD', u$s: 'USD', u$d: 'USD' };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const mesDe = (w: string) => { const i = MESES.indexOf(w === 'setiembre' ? 'septiembre' : w); return i; };
const TIEMPO = /^(dias?|semanas?|mes|meses|anos?|horas?|hs|h|minutos?|min)$/;

interface Tok extends Tramo { t: string }
export const partes = (p: string): Tok[] => [...p.matchAll(/us\$|u\$s|u\$d|\$|\d+(?:[.,]\d+)*|%|[a-z]+/g)].map(m => ({ t: m[0], ini: m.index!, fin: m.index! + m[0].length }));
export function cifra(t: string): number {
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(,\d{3})+$/.test(t)) return Number(t.replace(/,/g, ''));
  return Number(t.replace(',', '.'));
}
const esNum = (t?: string) => !!t && /^\d/.test(t);

/** Un número menor a mil dicho en palabras. */
function chico(k: Tok[], i: number): { v: number; i: number } | null {
  let v = 0, any = false;
  if (k[i] && C[k[i].t] != null) { v += C[k[i].t]; i++; any = true; }
  if (k[i] && D[k[i].t] != null) {
    v += D[k[i].t]; i++; any = true;
    if (k[i]?.t === 'y' && k[i + 1] && U[k[i + 1].t] > 0 && U[k[i + 1].t] < 10) { v += U[k[i + 1].t]; i += 2; }
  } else if (k[i] && U[k[i].t] != null) { v += U[k[i].t]; i++; any = true; }
  return any ? { v, i } : null;
}

/** Encuentra todas las cantidades de una frase y dice qué es cada una. */
export function cantidades(texto: string): Cantidad[] {
  const p = plano(texto), k = partes(p), out: Cantidad[] = [];
  for (let i = 0; i < k.length;) {
    const ini0 = i;
    let moneda: '' | Cur = '', j = i, v: number | null = null, letras = false, mult = false;
    if (CUR[k[j].t] && /\$|usd/.test(k[j].t) && (esNum(k[j + 1]?.t) || chico(k, j + 1))) { moneda = CUR[k[j].t]; j++; }
    const media = /^medi[oa]$/.test(k[j].t) && MULT[k[j + 1]?.t] >= 1e3;
    if (media) { v = MULT[k[j + 1].t] / 2; mult = true; if (SLANG.test(k[j + 1].t)) moneda ||= 'ARS'; j += 2; }
    else {
      let total = 0, cur: number | null = null, last = 0;
      for (;;) {
        const t = k[j]?.t;
        if (esNum(t) && cur == null) {
          if (last && (cifra(t) >= 1000 || last < 1e3)) break;
          cur = cifra(t); j++;
        } else if (cur == null && t && t !== 'mil' && chico(k, j)) {
          const c = chico(k, j)!;
          // "una web" no es una cantidad: "un" sólo cuenta si sigue una unidad
          if (/^(un|una|uno)$/.test(t) && c.i === j + 1) { const n = k[c.i]?.t; if (!(n && (MULT[n] || CUR[n] || TIEMPO.test(n) || n === 'medio'))) break; }
          cur = c.v; letras = true; j = c.i;
        } else if (t && MULT[t] && (cur != null || t === 'mil') && !(last && MULT[t] >= last)) {
          const m = MULT[t];
          total += (cur ?? 1) * m; cur = null; last = m; mult = true; j++;
          if (SLANG.test(t)) { if (/^palo/.test(t) && /^verdes?$/.test(k[j]?.t || '')) { moneda = 'USD'; j++; } else moneda ||= 'ARS'; }
          if (k[j]?.t === 'y' && /^medi[oa]$/.test(k[j + 1]?.t || '')) { total += m / 2; j += 2; break; }
          if (/^palo/.test(t) && !MULT[k[j + 1]?.t]) { // "un palo doscientos"
            const c = chico(k, j) || (esNum(k[j]?.t) && cifra(k[j].t) < 1000 ? { v: cifra(k[j].t), i: j + 1 } : null);
            if (c && c.v >= 10 && !CUR[k[c.i]?.t] && !TIEMPO.test(k[c.i]?.t || '')) { total += c.v * 1e3; j = c.i; break; }
          }
        } else break;
      }
      if (cur != null || total) {
        // "mil" suelto después de "cien" ya quedó adentro; lo que sobra son las unidades
        v = total + (cur ?? 0);
      }
    }
    if (v == null || j === ini0 || (j === i + 1 && moneda && k[i].t in CUR)) { i = ini0 + 1; continue; }
    if (k[j]?.t === 'y' && /^medi[oa]$/.test(k[j + 1]?.t || '') && !TIEMPO.test(k[j + 2]?.t || '') && TIEMPO.test(k[j - 1]?.t || '')) j += 2;
    let clase: Cantidad['clase'] = 'quizas', unidad = '';
    const n = k[j]?.t || '', n2 = k[j + 1]?.t || '', prev = k[ini0 - 1]?.t || '', prev2 = k[ini0 - 2]?.t || '';
    if (CUR[n] && !/\$/.test(n)) { moneda = CUR[n]; j++; }
    else if (n === 'de' && CUR[n2]) { moneda = CUR[n2]; j += 2; }
    if (moneda || mult) clase = 'plata';
    else if (n === '%') { clase = 'pct'; j++; }
    else if (n === 'por' && n2 === 'ciento') { clase = 'pct'; j += 2; }
    else if (TIEMPO.test(n)) {
      clase = 'tiempo'; unidad = /^(hs|h)$/.test(n) ? 'hora' : /^min/.test(n) ? 'minuto' : n === 'mes' || n === 'meses' ? 'mes' : /^ano/.test(n) ? 'ano' : n.replace(/s$/, ''); j++;
      if (unidad === 'hora' && k[j]?.t === 'y' && k[j + 1]?.t === 'media') { v += 0.5; j += 2; }
    } else if ((n === 'de' && mesDe(n2) >= 0) || /^(las?|dia)$/.test(prev) && v <= 31 && (prev === 'dia' || /^(a|para|desde|tipo)$/.test(prev2)) || (prev === 'el' && v >= 1 && v <= 31 && Number.isInteger(v))) clase = 'fecha';
    else if (/^(cuotas?|fases?|veces|clientes?|personas?|unidades|paginas?|videos?|reels?|reuniones)$/.test(n)) { clase = 'otra'; unidad = n; }
    else if (!letras && v >= 1e7 && /^\d+$/.test(k[ini0].t)) clase = 'otra'; // un teléfono
    out.push({ ini: k[ini0].ini, fin: k[j - 1].fin, valor: Math.round(v * 100) / 100, moneda, clase, unidad, enLetras: letras && !mult });
    i = j;
  }
  return out;
}
/** La plata más probable de la frase. */
export function plata(texto: string): Cantidad | null {
  const c = cantidades(texto).filter(x => x.valor > 0);
  return c.find(x => x.clase === 'plata') || c.find(x => x.clase === 'quizas' && !x.enLetras) || c.find(x => x.clase === 'quizas' && x.valor >= 20) || null;
}

// ─── Fechas ───
export interface Fecha extends Tramo { at: number; hora: string }
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const noon = (t: number) => { const d = new Date(t); d.setHours(12, 0, 0, 0); return d.getTime(); };

/** Busca una fecha y una hora. "lado": hacia dónde mirar si no lo dice (la plata mira atrás, las tareas adelante). */
export function fecha(texto: string, now: number, lado: 'antes' | 'despues'): Fecha | null {
  // Los números en palabras pasan a cifras, sin perder dónde estaban
  let p = plano(texto);
  for (const c of cantidades(texto)) if (c.enLetras && c.valor < 100 && Number.isInteger(c.valor)) {
    const largo = c.clase === 'tiempo' ? p.slice(c.ini, c.fin).lastIndexOf(' ') : c.fin - c.ini, s = String(c.valor);
    if (largo >= s.length) p = p.slice(0, c.ini) + s.padEnd(largo, ' ') + p.slice(c.ini + largo);
  }
  const hoy = noon(now), tramos: Tramo[] = [];
  let at: number | null = null, hora = '';
  const prueba = (re: RegExp, f: (m: RegExpExecArray) => number | null) => {
    if (at != null) return;
    const m = re.exec(p); if (!m) return;
    const r = f(m); if (r == null) return;
    at = r; tramos.push({ ini: m.index, fin: m.index + m[0].length });
  };
  const en = (y: number, m: number, d: number) => { const t = new Date(y, m, d, 12); return t.getDate() === d ? t.getTime() : null; };
  const n0 = new Date(hoy);
  prueba(/\b(antes de ayer|anteayer|antier)\b/, () => addDays(hoy, -2));
  prueba(/\bpasado\s+manana\b/, () => addDays(hoy, 2));
  prueba(/\bayer\b(\s+a la (manana|tarde|noche))?/, () => addDays(hoy, -1));
  prueba(/(?<!\b(?:a|por|de) la )(?<!\besta )\bmanana\b/, () => addDays(hoy, 1));
  prueba(/\b(?:el\s+)?(?:dia\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+(?:de|del)\s+(\d{4}))?/, m => {
    const mes = mesDe(m[2]), d = Number(m[1]); if (m[3]) return en(Number(m[3]), mes, d);
    const t = en(n0.getFullYear(), mes, d); if (t == null) return null;
    if (lado === 'antes' && t > addDays(hoy, 1)) return en(n0.getFullYear() - 1, mes, d);
    if (lado === 'despues' && t < addDays(hoy, -1)) return en(n0.getFullYear() + 1, mes, d);
    return t;
  });
  prueba(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, m => en(m[3] ? Number(m[3]) + (m[3].length === 2 ? 2000 : 0) : n0.getFullYear(), Number(m[2]) - 1, Number(m[1])));
  prueba(/\bhace\s+(\d+|un|una)\s+(dia|semana|mes|ano)(?:s|es)?\b/, m => { const n = Number(m[1]) || 1; return m[2] === 'mes' ? addMonths(hoy, -n) : m[2] === 'ano' ? addMonths(hoy, -12 * n) : addDays(hoy, -n * (m[2] === 'semana' ? 7 : 1)); });
  prueba(/\b(?:en|dentro de)\s+(\d+|un|una)\s+(dia|semana|mes|ano)(?:s|es)?\b/, m => { const n = Number(m[1]) || 1; return m[2] === 'mes' ? addMonths(hoy, n) : m[2] === 'ano' ? addMonths(hoy, 12 * n) : addDays(hoy, n * (m[2] === 'semana' ? 7 : 1)); });
  prueba(/\b(el|este|proximo|pasado)?\s*(proximo|pasado)?\s*\b(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b(?:\s+(pasado|que viene|proximo|que paso))?/, m => {
    const q = [m[1], m[2], m[4]].join(' '), w = DIAS.indexOf(m[3]), dif = (w - n0.getDay() + 7) % 7;
    const atras = /pas/.test(q) || (lado === 'antes' && !/prox|viene/.test(q));
    return atras ? addDays(hoy, -((7 - dif) % 7 || 7)) : addDays(hoy, dif || 7);
  });
  prueba(/\b(?:a |para )?(?:la )?semana (que viene|proxima)\b|\bla proxima semana\b/, () => addDays(hoy, ((8 - n0.getDay()) % 7) || 7));
  prueba(/\bla semana pasada\b/, () => addDays(hoy, -7));
  prueba(/\bel mes pasado\b/, () => addMonths(hoy, -1));
  prueba(/\b(el )?mes que viene\b|\bel proximo mes\b/, () => addMonths(hoy, 1));
  prueba(/\b(a )?fin(es)? de mes\b/, () => { const t = en(n0.getFullYear(), n0.getMonth() + 1, 0) ?? new Date(n0.getFullYear(), n0.getMonth() + 1, 0, 12).getTime(); return t; });
  prueba(/\b(a )?principios? de mes\b/, () => lado === 'antes' ? en(n0.getFullYear(), n0.getMonth(), 1) : en(n0.getFullYear(), n0.getMonth() + 1, 1));
  prueba(/\b(a )?fin(es)? de ano\b/, () => en(n0.getFullYear(), 11, 31));
  prueba(/\b(?:el|para el|dia|el dia)\s+(?:dia\s+)?(\d{1,2})\b(?!\s*(?:%|por ciento|mil\b|k\b|lucas?|palos?|pesos|dolares|usd|de cada|de todos|dias|horas|minutos|semanas|\.\d|,\d))/, m => {
    const d = Number(m[1]); if (d < 1 || d > 31) return null;
    for (let i = 0; i < 14; i++) { const t = en(n0.getFullYear(), n0.getMonth() + (lado === 'antes' ? -i : i), d); if (t != null && (lado === 'antes' ? t <= hoy : t >= hoy)) return t; }
    return null;
  });
  prueba(/\bhoy\b|\besta (manana|tarde|noche)\b|\brecien\b/, () => hoy);
  const h = /\b(?:a|para|desde|tipo)\s+las?\s+(\d{1,2})(?:(?::|\s*y\s+)(\d{2}|media|cuarto))?(?:\s*(?:hs|horas))?(?:\s+(?:de la\s+)?(manana|tarde|noche|am|pm))?/.exec(p);
  if (h && Number(h[1]) < 25) {
    let H = Number(h[1]) % 24; const M = h[2] === 'media' ? 30 : h[2] === 'cuarto' ? 15 : Number(h[2]) || 0;
    if (H < 12 && /tarde|noche|pm/.test(h[3] || '')) H += 12; else if (!h[3] && H >= 1 && H <= 7) H += 12;
    hora = `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`;
    tramos.push({ ini: h.index, fin: h.index + h[0].length });
  }
  if (!tramos.length) return null;
  return { at: at ?? hoy, hora, ini: Math.min(...tramos.map(t => t.ini)), fin: Math.max(...tramos.map(t => t.fin)), ...(tramos.length > 1 ? { tramos } : {}) } as Fecha;
}
export const tramosDe = (f: Fecha): Tramo[] => (f as any).tramos || [{ ini: f.ini, fin: f.fin }];
