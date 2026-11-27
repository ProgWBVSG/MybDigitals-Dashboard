// Lee lo que viene de Excel (.xlsx, .csv o pegado) y lo convierte en servicios. Sin librerías.
import { uuid } from './utils';
import { SVC_PERIODS, SVC_STATUSES, type Service, type ServiceInput, type SvcCurrency, type SvcPeriod, type SvcPrice, type SvcStatus } from './services';

export type Grid = string[][];
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// ─── Texto pegado o CSV (respeta celdas entre comillas con saltos de línea) ───
export function parseDelimited(text: string): Grid {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const first = src.split('\n', 1)[0];
  const sep = first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
  const rows: Grid = []; let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"' && cell === '') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell); rows.push(row);
  return rows.map(r => r.map(c => c.trim())).filter(r => r.some(Boolean));
}

// ─── .xlsx: es un zip con XML adentro ───
async function unzip(buf: ArrayBuffer): Promise<Map<string, () => Promise<string>>> {
  const v = new DataView(buf); const files = new Map<string, () => Promise<string>>();
  let e = buf.byteLength - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('El archivo no es un Excel válido.');
  const n = v.getUint16(e + 10, true); let o = v.getUint32(e + 16, true);
  for (let i = 0; i < n; i++) {
    const method = v.getUint16(o + 10, true), size = v.getUint32(o + 20, true);
    const nl = v.getUint16(o + 28, true), xl = v.getUint16(o + 30, true), cl = v.getUint16(o + 32, true), lo = v.getUint32(o + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(buf, o + 46, nl));
    files.set(name, async () => {
      const start = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true);
      const raw = new Blob([new Uint8Array(buf, start, size)]);
      const stream = method === 8 ? raw.stream().pipeThrough(new DecompressionStream('deflate-raw')) : raw.stream();
      return new Response(stream).text();
    });
    o += 46 + nl + xl + cl;
  }
  return files;
}
const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
const els = (n: Document | Element, tag: string) => Array.from(n.getElementsByTagNameNS('*', tag));

export async function parseXlsx(buf: ArrayBuffer): Promise<{ name: string; grid: Grid }[]> {
  const z = await unzip(buf);
  const read = async (f: string) => { const g = z.get(f); return g ? xml(await g()) : null; };
  const ss = await read('xl/sharedStrings.xml');
  const strings = ss ? els(ss, 'si').map(si => els(si, 't').filter(t => t.parentElement?.localName !== 'rPh').map(t => t.textContent || '').join('')) : [];
  const wb = await read('xl/workbook.xml'); const rels = await read('xl/_rels/workbook.xml.rels');
  if (!wb || !rels) throw new Error('El archivo no es un Excel válido.');
  const target = new Map(els(rels, 'Relationship').map(r => [r.getAttribute('Id'), r.getAttribute('Target') || '']));

  // Formatos de número: Excel guarda "45000" y la moneda sólo está en el formato de la celda
  const st = await read('xl/styles.xml');
  const fmts = new Map(st ? els(st, 'numFmt').map(f => [f.getAttribute('numFmtId'), f.getAttribute('formatCode') || '']) : []);
  const xfsRoot = st ? els(st, 'cellXfs')[0] : null;
  const usd = xfsRoot ? els(xfsRoot, 'xf').map(x => /USD|US\$|u\$s|\[\$\$-(en-US|409)/i.test(fmts.get(x.getAttribute('numFmtId')) || '')) : [];

  const out: { name: string; grid: Grid }[] = [];
  for (const sh of els(wb, 'sheet')) {
    const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const t = (target.get(rid) || '').replace(/^\//, '');
    const doc = await read(t.startsWith('xl/') ? t : 'xl/' + t);
    if (!doc) continue;
    const grid: Grid = [];
    els(doc, 'row').forEach(r => {
      const row: string[] = [];
      els(r, 'c').forEach((c, i) => {
        const ref = (c.getAttribute('r') || '').replace(/\d+/g, '');
        const col = ref ? [...ref].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1 : i;
        const type = c.getAttribute('t'); const val = els(c, 'v')[0]?.textContent ?? '';
        let text = type === 's' ? strings[Number(val)] ?? '' : type === 'inlineStr' ? els(c, 't').map(x => x.textContent || '').join('') : val;
        // el número de Excel usa punto decimal: pasarlo a formato argentino para leerlo igual que lo pegado
        if (type !== 's' && type !== 'inlineStr' && type !== 'str' && /^-?\d+(\.\d+)?(e-?\d+)?$/i.test(text)) {
          text = String(Math.round(Number(text) * 100) / 100).replace('.', ',');
          if (usd[Number(c.getAttribute('s'))]) text = 'US$' + text;
        }
        row[col] = text.trim();
      });
      const full = Array.from(row, c => c || '');
      if (full.some(Boolean)) grid.push(full);
    });
    if (grid.length) out.push({ name: sh.getAttribute('name') || 'Hoja', grid });
  }
  return out;
}

// ─── Qué es cada columna ───
export type ColKind = 'ignorar' | 'nombre' | 'rubro' | 'estado' | 'descripcion' | 'unico' | 'mes' | 'anio' | 'incluye' | 'entrega' | 'notas' | 'costo';
export const COL_KINDS: { key: ColKind; label: string }[] = [
  { key: 'ignorar', label: 'No importar' }, { key: 'nombre', label: 'Servicio' }, { key: 'rubro', label: 'Rubro' },
  { key: 'estado', label: 'Estado' }, { key: 'descripcion', label: 'Descripción' }, { key: 'unico', label: 'Precio para empezar' },
  { key: 'mes', label: 'Precio por mes' }, { key: 'anio', label: 'Precio por año' }, { key: 'incluye', label: 'Qué incluye' },
  { key: 'entrega', label: 'Entrega' }, { key: 'costo', label: 'Costo nuestro por mes' }, { key: 'notas', label: 'Notas' },
];
const GUESS: [RegExp, ColKind][] = [
  [/costo|gasto/, 'costo'], [/mensual|por mes|\bmes\b|abono|suscrip|mantenim/, 'mes'], [/anual|por ano|\bano\b/, 'anio'],
  [/incluye|que tiene|lo que tiene|contiene|caracter|funcion|detalle|beneficio/, 'incluye'],
  [/precio|valor|inicial|unico|desarrollo|setup|instalacion|tarifa|implementacion|para empezar/, 'unico'],
  [/rubro|area|categoria|nicho|tipo|sector/, 'rubro'], [/estado|situacion/, 'estado'],
  [/entrega|plazo|tiempo|demora/, 'entrega'], [/nota|observ|comentario/, 'notas'],
  [/descrip|resumen|que es/, 'descripcion'], [/servicio|producto|nombre|paquete|plan|software|sistema/, 'nombre'],
];
export function guessColumns(header: string[]): ColKind[] {
  const used = new Set<ColKind>();
  return header.map(h => {
    const k = GUESS.find(([re]) => re.test(norm(h)))?.[1] ?? 'ignorar';
    if (k === 'nombre' && used.has('nombre')) return 'descripcion';
    used.add(k); return k;
  });
}
export const looksLikeHeader = (row: string[]) => guessColumns(row).filter(k => k !== 'ignorar').length >= 2 && !row.some(c => /\d{3,}/.test(c));

// ─── Precios escritos a mano: "$45.000", "US$ 50-70", "usd 250" ───
export function parseNumber(s: string): number | null {
  let t = s.replace(/[^\d.,]/g, '').replace(/^[.,]+|[.,]+$/g, '');
  if (!t) return null;
  if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (t.includes(',')) t = /,\d{3}(,|$)/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  else if (/\.\d{3}(\.|$)/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t); return Number.isFinite(n) ? n : null;
}
const isUSD = (s: string) => /usd|us\$|u\$s|u\$d|dolar/i.test(norm(s));
export function parsePrices(cell: string, period: SvcPeriod, header = ''): SvcPrice[] {
  return cell.split(/\n|\s\+\s|\s\/\s|\s[yo]\s/).map(part => {
    const nums = (part.match(/\d[\d.,]*/g) || []).map(parseNumber).filter((n): n is number => n !== null && n > 0);
    if (!nums.length) return null;
    const currency: SvcCurrency = isUSD(part) || (isUSD(header) && !/ars|pesos/i.test(part)) ? 'USD' : 'ARS';
    const range = nums.length > 1 && /-|–| a | hasta /.test(part);
    return { id: uuid(), label: '', amount: nums[0], max: range ? nums[1] : null, currency, period } as SvcPrice;
  }).filter((x): x is SvcPrice => !!x);
}
const parseIncludes = (s: string) => s.split(/\n|;|•|·|(?:^|\s)[-–✓✔]\s|,\s(?=[A-ZÁÉÍÓÚÑ])/).map(x => x.replace(/^[-–*\s]+/, '').trim()).filter(Boolean);
const parseStatus = (s: string): SvcStatus | null => {
  const t = norm(s); if (!t) return null;
  return SVC_STATUSES.find(x => norm(x.label) === t)?.key
    ?? (/venta|activo|listo|disponible/.test(t) ? 'en_venta' : /desarroll|proceso|prueba|demo/.test(t) ? 'en_desarrollo' : /cotiza|medida/.test(t) ? 'se_cotiza' : /idea|futuro/.test(t) ? 'idea' : /paus|baja|no /.test(t) ? 'pausado' : null);
};

export type ImportRow = { name: string; patch: Partial<ServiceInput>; match: Service | null };
export function buildRows(grid: Grid, kinds: ColKind[], header: string[], existing: Service[]): ImportRow[] {
  const byName = new Map(existing.map(s => [norm(s.name), s]));
  const rows: ImportRow[] = [];
  for (const r of grid) {
    const name = (r[kinds.indexOf('nombre')] || '').replace(/\s*\n\s*/g, ' ').trim();
    if (!name) {
      // fila sin nombre = continuación de "qué incluye" de la de arriba
      const extra = kinds.flatMap((k, i) => k === 'incluye' && r[i] ? parseIncludes(r[i]) : []);
      const last = rows[rows.length - 1];
      if (extra.length && last) last.patch.includes = [...(last.patch.includes || []), ...extra];
      continue;
    }
    const patch: Partial<ServiceInput> = { name }; const prices: SvcPrice[] = []; const includes: string[] = [];
    kinds.forEach((k, i) => {
      const c = (r[i] || '').trim(); if (!c) return;
      if (k === 'rubro') patch.area = c;
      else if (k === 'estado') { const st = parseStatus(c); if (st) patch.status = st; }
      else if (k === 'descripcion') patch.summary = c;
      else if (k === 'entrega') patch.delivery = c;
      else if (k === 'notas') patch.notes = c;
      else if (k === 'incluye') includes.push(...parseIncludes(c));
      else if (k === 'costo') { const n = parseNumber(c); if (n !== null) patch.costMonthly = n; }
      else if (k === 'unico' || k === 'mes' || k === 'anio') prices.push(...parsePrices(c, k, header[i] || ''));
    });
    if (prices.length) patch.prices = prices;
    if (includes.length) patch.includes = includes;
    rows.push({ name, patch, match: byName.get(norm(name)) || null });
  }
  return rows;
}

/** Al actualizar: pisa los precios del mismo período y moneda, conserva el resto. */
export function mergePrices(old: SvcPrice[], next: SvcPrice[]): SvcPrice[] {
  const key = (p: SvcPrice) => p.period + p.currency;
  const nk = new Set(next.map(key));
  return [...next.map(n => { const o = old.find(x => key(x) === key(n) && !x.optional); return o ? { ...o, ...n, id: o.id, label: o.label } : n; }), ...old.filter(o => o.optional || !nk.has(key(o)))];
}

export function exportCsv(list: Service[]): string {
  const esc = (s: string) => /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const cell = (s: Service, per: SvcPeriod) => s.prices.filter(p => p.period === per && p.amount > 0 && !p.optional)
    .map(p => `${p.currency === 'USD' ? 'US$' : '$'}${p.amount}${p.max ? `-${p.max}` : ''}`).join('\n');
  const head = ['Servicio', 'Rubro', 'Estado', 'Descripción', ...SVC_PERIODS.map(p => p.key === 'unico' ? 'Precio para empezar' : 'Precio ' + p.label.toLowerCase()), 'Qué incluye', 'Entrega', 'Costo nuestro por mes (US$)', 'Notas'];
  const rows = list.map(s => [s.name, s.area, SVC_STATUSES.find(x => x.key === s.status)?.label || '', s.summary, ...SVC_PERIODS.map(p => cell(s, p.key)), s.includes.join('\n'), s.delivery, s.costMonthly == null ? '' : String(s.costMonthly), s.notes]);
  return '﻿' + [head, ...rows].map(r => r.map(esc).join(';')).join('\r\n');
}
