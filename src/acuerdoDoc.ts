// El acuerdo como documento: una sola estructura que sale como PDF, Word o texto con formato para Google Docs.
import { fDate, firstMonthly, fLong, plural, projectTotal, TERMS, type Agreement, type Terms } from './negocio';
import { money } from './services';

type Cell = string;
type Block =
  | { t: 'h'; x: string } | { t: 'p'; x: string } | { t: 'ul'; x: string[]; cols?: boolean }
  | { t: 'two'; a: { h: string; x: string[] }; b: { h: string; x: string[] }; mark?: boolean }
  | { t: 'table'; head: Cell[]; rows: Cell[][]; right: number[]; foot?: Cell[] }
  | { t: 'facts'; x: [string, string][] } | { t: 'sign' };
export interface Doc { title: string; sub: string; number: string; date: string; client: string; blocks: Block[]; a: Agreement }

export const termsOf = (a: Agreement): Terms => ({ ...TERMS, ...a.terms });
const days = (n: number) => n === 0 ? 'en el momento' : `dentro de ${plural(n, 'día', 'días')}`;

export function buildDoc(a: Agreement): Doc {
  const T = termsOf(a), m = (n: number) => money(n, a.currency);
  const c = a.client_data, client = c.business || c.name || 'El cliente';
  const work = a.title || 'el trabajo acordado';
  const total = projectTotal(a);
  const sena = a.phases.some(p => p.kind === 'sena' && p.amount > 0);
  const phases = a.phases.filter(p => p.kind === 'fase'), dated = phases.filter(p => p.due_at != null);

  const last = dated.length ? Math.max(...dated.map(p => p.due_at!)) : null;
  const blocks: Block[] = [];

  const facts: [string, string][] = [];
  if (total > 0) facts.push(['Valor del trabajo', m(total)]);
  if (a.monthly) facts.push(['Abono mensual', m(a.monthly.amount)]);
  if (phases.length) facts.push(['Fases', String(phases.length)]);
  if (last) facts.push(['Entrega final', fDate(last)]);
  if (facts.length) blocks.push({ t: 'facts', x: facts });
  blocks.push({ t: 'p', x: `Este acuerdo deja por escrito qué hacemos, cuándo lo entregamos, cuánto cuesta y cuándo se paga. Las dos partes se comprometen a cumplirlo.` });

  blocks.push({ t: 'two',
    a: { h: 'Cliente', x: [client, c.business && c.name ? c.name : '', c.dni ? `DNI o CUIT: ${c.dni}` : '', c.address || '', c.whatsapp ? `WhatsApp: ${c.whatsapp}` : '', c.email || ''].filter(Boolean) },
    b: { h: 'MYB Digitals', x: ['Benjamín Vidal y Matías König', 'digitalmatiybenja@gmail.com', `${T.city}, Argentina`] } });

  if (a.includes.length) blocks.push({ t: 'h', x: 'Qué incluye' }, { t: 'ul', x: a.includes, cols: a.includes.length > 5 });
  if (a.excludes.length) blocks.push({ t: 'h', x: 'Qué no incluye' }, { t: 'ul', x: a.excludes });

  if (a.phases.length) {
    blocks.push({ t: 'h', x: 'Fases, fechas y pagos' });
    blocks.push({ t: 'table', right: [3], head: ['Fase', 'Qué se entrega', 'Entrega', 'Pago', 'Se paga'],
      rows: a.phases.map(p => [p.name || (p.kind === 'sena' ? 'Seña' : 'Fase'), p.deliverable || (p.kind === 'sena' ? 'Reserva el lugar y da inicio al trabajo' : ''), p.kind === 'sena' ? 'Al firmar' : p.due_at ? fDate(p.due_at) : 'A definir', p.amount > 0 ? m(p.amount) : 'Sin pago', p.amount > 0 ? (p.kind === 'sena' ? `${days(p.pay_days)} de firmar` : `${days(p.pay_days)} de entregada`) : '']),
      foot: total > 0 ? ['Total', '', last ? fDate(last) : '', m(total), ''] : undefined });
    blocks.push({ t: 'p', x: `${sena ? 'Fuera de la seña, cada' : 'Cada'} fase se paga recién cuando está terminada y mostrada. Con el pago de una fase empieza la siguiente.` });
  }
  if (a.monthly) {
    blocks.push({ t: 'h', x: 'Abono mensual' });
    blocks.push({ t: 'p', x: `Se abona ${m(a.monthly.amount)} por mes, el día ${a.monthly.day}. El primer pago es el ${fLong(firstMonthly(a.monthly))}.${a.monthly.covers ? ` Cubre: ${a.monthly.covers}.` : ''} Cualquiera de las partes puede darlo de baja avisando ${a.monthly.cancel_days} días antes. Si el valor cambia, se avisa con 30 días de anticipación.` });
  }

  blocks.push({ t: 'h', x: 'A qué nos comprometemos' });
  blocks.push({ t: 'two', mark: true, a: { h: 'MYB Digitals', x: a.our_duties }, b: { h: client, x: a.client_duties } });

  const us = [
    `Si una fecha está en riesgo avisamos al menos ${plural(T.notice_days, 'día', 'días')} antes, con el motivo y la nueva fecha por escrito.`,
    'Mientras una fase no esté entregada, no se cobra.',
    ...(T.our_discount_pct > 0 ? [`Por cada semana completa de atraso por causa nuestra se descuenta ${T.our_discount_pct} % del pago de esa fase.`] : []),
    'Si no podemos continuar, devolvemos lo cobrado por trabajo no realizado y entregamos todo lo hecho.',
  ];
  const them = [
    `Pasados ${plural(T.pause_days, 'día', 'días')} del vencimiento, el trabajo se pausa hasta regularizar el pago.`,
    'La pausa corre las fechas siguientes la misma cantidad de días.',
    ...(T.late_fee_pct > 0 ? [`Por cada semana completa de atraso se suma ${T.late_fee_pct} % sobre el monto vencido.`] : []),
    'Si el material o las respuestas llegan tarde, las fechas se corren los mismos días.',
  ];
  blocks.push({ t: 'h', x: 'Si alguno se atrasa' }, { t: 'two', a: { h: 'Si nos atrasamos nosotros', x: us }, b: { h: 'Si se atrasa el cliente', x: them } });

  blocks.push({ t: 'h', x: 'Reglas del trabajo' });
  blocks.push({ t: 'ul', x: [
    `Revisión: cada entrega se revisa en ${plural(T.feedback_days, 'día hábil', 'días hábiles')}. Si no hay respuesta en ese plazo, se da por aprobada.`,
    `Cambios: cada fase incluye ${plural(T.revisions, 'ronda', 'rondas')} de ajustes. Un pedido nuevo se presupuesta aparte y empieza con aprobación escrita.`,
    ...(T.support_days > 0 ? [`Garantía: durante ${T.support_days} días desde la entrega final corregimos sin cargo los errores de lo entregado.`] : []),
    'Propiedad: lo entregado pasa a ser del cliente cuando está pagado por completo. Los contenidos del cliente son siempre suyos.',
    'Portfolio: MYB puede mostrar el trabajo terminado, salvo que el cliente pida lo contrario por escrito.',
    'Confidencialidad: ninguna de las partes comparte información privada de la otra, durante el trabajo y por dos años más.',
    T.stop_refund || 'Cancelación: si el cliente cancela, paga las fases ya entregadas y la parte hecha de la fase en curso, y recibe todo lo desarrollado hasta ese día.',
    `Diferencias: se hablan primero entre las partes. Si en 10 días no hay acuerdo, se busca un mediador elegido por ambas.`,
    'Cualquier cambio de este acuerdo vale cuando las dos partes lo aprueban por escrito.',
  ] });
  if (a.notes.trim()) blocks.push({ t: 'h', x: 'Aclaraciones' }, ...a.notes.trim().split(/\n+/).map(x => ({ t: 'p' as const, x })));
  blocks.push({ t: 'h', x: 'Firmas' }, { t: 'p', x: 'Leímos y aceptamos todo lo escrito en este acuerdo.' }, { t: 'sign' });

  return { title: 'Acuerdo de compromiso mutuo', sub: work, number: a.number, date: `${T.city}, ${fLong(a.signed_at ?? a.start_at)}`, client, blocks, a };
}

// ─── HTML para ver, imprimir y hacer PDF ───
const e = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
/** "Revisión: texto" → la primera palabra en negrita. */
const lead = (s: string) => { const m = /^([A-ZÁÉÍÓÚÑ][^:.]{2,22}): (.+)$/s.exec(s); return m ? `<b>${e(m[1])}.</b> ${e(m[2][0].toUpperCase() + m[2].slice(1))}` : e(s); };
const CSS = `
@page{size:A4;margin:20mm 18mm 20mm;@bottom-left{content:var(--pie);font:8.5pt "Hanken Grotesk",Arial,sans-serif;color:#666}@bottom-right{content:counter(page) " de " counter(pages);font:8.5pt "Hanken Grotesk",Arial,sans-serif;color:#666}}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font:10.2pt/1.5 "Hanken Grotesk","Segoe UI",Arial,sans-serif;color:#0b0b0b;background:#fff}
.top{display:flex;justify-content:space-between;align-items:center;font-size:9.5pt;padding-bottom:9mm}
.logo{font-weight:700;font-size:13pt;letter-spacing:-.02em}.logo b{background:#c3d809;padding:1.2mm 2.4mm;border-radius:1.6mm;margin-right:1.4mm;font-weight:800}
.top div+div{text-align:right;color:#444;line-height:1.4}
h1{font-size:29pt;line-height:1.04;letter-spacing:-.04em;font-weight:700;max-width:150mm}
.sub{font-size:13.5pt;color:#333;margin-top:3mm;letter-spacing:-.01em}
.facts{display:flex;margin:8mm 0 6mm;border:.35mm solid #0b0b0b;border-radius:3mm;overflow:hidden}
.facts div{flex:1;padding:4mm 4.5mm}.facts div+div{border-left:.35mm solid #0b0b0b}.facts div:first-child{background:#c3d809}
.facts span{display:block;font-size:8.8pt}.facts b{font-size:14.5pt;letter-spacing:-.03em;white-space:nowrap;font-variant-numeric:tabular-nums}
h2{font-size:14pt;letter-spacing:-.025em;margin:8mm 0 3mm;break-after:avoid}
h3{font-size:10.6pt;margin-bottom:1.6mm}
p{margin-bottom:2.5mm;max-width:160mm}
ul{list-style:none}li{position:relative;padding-left:5mm;margin-bottom:1.5mm;break-inside:avoid}li:before{content:"";position:absolute;left:0;top:2.1mm;width:1.9mm;height:1.9mm;border-radius:50%;background:#0b0b0b}
ul.cols{columns:2;column-gap:9mm}
.two{display:grid;grid-template-columns:1fr 1fr;gap:9mm;margin:2mm 0}.two>div{break-inside:avoid}.two.plain{margin:5mm 0 0;font-size:9.8pt}.two.plain p{margin:0}
.two.mark{gap:0;border:.35mm solid #0b0b0b;border-radius:3mm;overflow:hidden;break-inside:avoid}.two.mark>div{padding:5mm}.two.mark>div+div{border-left:.35mm solid #0b0b0b}
table{width:100%;border-collapse:collapse;font-size:9.4pt;margin:1mm 0 3mm;font-variant-numeric:tabular-nums}
thead{display:table-header-group}tfoot{display:table-row-group}table.short{break-inside:avoid}tr{break-inside:avoid}
th{text-align:left;font-weight:600;background:#0b0b0b;color:#fff;padding:2.2mm 2.6mm}td{padding:2.6mm;border-bottom:.25mm solid #c9c9c9;vertical-align:top}
td:first-child{font-weight:600}.r{text-align:right;white-space:nowrap}td.d{white-space:nowrap}
tfoot td{font-weight:700;border-bottom:0;border-top:.5mm solid #0b0b0b;font-size:10.4pt}
.sign{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin-top:20mm;break-inside:avoid}.sign div{border-top:.4mm solid #0b0b0b;padding-top:2.5mm;font-size:9.6pt;line-height:1.6}
.sign b{display:block}
@media screen{body{padding:16mm 17mm}}`;
function htmlBlock(b: Block, d: Doc): string {
  switch (b.t) {
    case 'h': return `<h2>${e(b.x)}</h2>`;
    case 'p': return `<p>${e(b.x)}</p>`;
    case 'ul': return `<ul${b.cols ? ' class="cols"' : ''}>${b.x.map(x => `<li>${lead(x)}</li>`).join('')}</ul>`;
    case 'facts': return `<div class="facts">${b.x.map(([k, v]) => `<div><span>${e(k)}</span><b>${e(v)}</b></div>`).join('')}</div>`;
    case 'two': {
      const info = b.a.h === 'Cliente';
      const side = (s: { h: string; x: string[] }) => `<div><h3>${e(s.h)}</h3>${info ? s.x.map(x => `<p>${e(x)}</p>`).join('') : `<ul>${s.x.map(x => `<li>${e(x)}</li>`).join('')}</ul>`}</div>`;
      return `<div class="two${b.mark ? ' mark' : info ? ' plain' : ''}">${side(b.a)}${side(b.b)}</div>`;
    }
    case 'table': {
      const cls = (i: number) => b.right.includes(i) ? ' class="r"' : i === 2 ? ' class="d"' : '';
      return `<table${b.rows.length < 9 ? ' class="short"' : ''}><thead><tr>${b.head.map((x, i) => `<th${cls(i)}>${e(x)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map((x, i) => `<td${cls(i)}>${e(x)}</td>`).join('')}</tr>`).join('')}</tbody>${b.foot ? `<tfoot><tr>${b.foot.map((x, i) => `<td${cls(i)}>${e(x)}</td>`).join('')}</tr></tfoot>` : ''}</table>`;
    }
    case 'sign': return `<div class="sign">${[d.client, 'MYB Digitals'].map(n => `<div><b>${e(n)}</b>Aclaración:<br>DNI:<br>Fecha:</div>`).join('')}</div>`;
  }
}
export function toHtml(d: Doc): string {
  const pie = `${d.title} ${d.number}`.replace(/["\\\n]/g, ' ');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${e(fileName(d))}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400..800&display=block"><style>:root{--pie:"${e(pie)}"}${CSS}</style></head><body><div class="top"><div class="logo"><b>MYB</b>Digitals</div><div>${e(d.number)}<br>${e(d.date)}</div></div><h1>${e(d.title)}</h1><div class="sub">${e(d.sub)}, para ${e(d.client)}</div>${d.blocks.map(b => htmlBlock(b, d)).join('')}</body></html>`;
}
export const fileName = (d: Doc) => `Acuerdo ${d.number} ${d.client}`.replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim();

// ─── Formato simple para pegar en Google Docs ───
export function toPaste(d: Doc): { html: string; text: string } {
  const td = 'style="border:1px solid #999;padding:6px;vertical-align:top"';
  const H = (b: Block): string => {
    switch (b.t) {
      case 'h': return `<h2>${e(b.x)}</h2>`;
      case 'p': return `<p>${e(b.x)}</p>`;
      case 'ul': return `<ul>${b.x.map(x => `<li>${lead(x)}</li>`).join('')}</ul>`;
      case 'facts': return `<table style="border-collapse:collapse"><tr>${b.x.map(([k, v]) => `<td ${td}>${e(k)}<br><b>${e(v)}</b></td>`).join('')}</tr></table>`;
      case 'two': return `<table style="border-collapse:collapse;width:100%"><tr>${[b.a, b.b].map(s => `<td ${td}><p><b>${e(s.h)}</b></p>${s.x.map(x => `<p>${e(x)}</p>`).join('')}</td>`).join('')}</tr></table>`;
      case 'table': return `<table style="border-collapse:collapse;width:100%"><tr>${b.head.map(x => `<td ${td}><b>${e(x)}</b></td>`).join('')}</tr>${[...b.rows, ...(b.foot ? [b.foot] : [])].map(r => `<tr>${r.map(x => `<td ${td}>${e(x)}</td>`).join('')}</tr>`).join('')}</table>`;
      case 'sign': return `<p><br></p><table style="width:100%"><tr>${[d.client, 'MYB Digitals'].map(n => `<td><p>______________________</p><p><b>${e(n)}</b></p><p>Aclaración:</p><p>DNI:</p><p>Fecha:</p></td>`).join('')}</tr></table>`;
    }
  };
  const X = (b: Block): string => b.t === 'h' ? '\n' + b.x : b.t === 'p' ? b.x : b.t === 'ul' ? b.x.map(x => '- ' + x).join('\n') : b.t === 'facts' ? b.x.map(x => x.join(': ')).join('\n') : b.t === 'two' ? [b.a, b.b].map(s => `${s.h}\n${s.x.map(x => '- ' + x).join('\n')}`).join('\n') : b.t === 'table' ? [b.head, ...b.rows, ...(b.foot ? [b.foot] : [])].map(r => r.filter(Boolean).join(' | ')).join('\n') : `\n${d.client}: ____________\nMYB Digitals: ____________`;
  return { html: `<h1>${e(d.title)}</h1><p>${e(d.sub)}, para ${e(d.client)}</p><p>${e(d.number)}. ${e(d.date)}</p>${d.blocks.map(H).join('')}`, text: [d.title, `${d.sub}, para ${d.client}`, `${d.number}. ${d.date}`, ...d.blocks.map(X)].join('\n') };
}

// ─── Word (.docx), sin librerías ───
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Uint8Array) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files: [string, string][]): Blob {
  const enc = new TextEncoder(), parts: Uint8Array[] = [], dir: Uint8Array[] = []; let at = 0;
  for (const [name, text] of files) {
    const n = enc.encode(name), data = enc.encode(text), h = new DataView(new ArrayBuffer(30)), c = new DataView(new ArrayBuffer(46)), sum = crc(data);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint16(12, 0x21, true); h.setUint32(14, sum, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, n.length, true);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint16(14, 0x21, true); c.setUint32(16, sum, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, n.length, true); c.setUint32(42, at, true);
    parts.push(new Uint8Array(h.buffer), n, data); dir.push(new Uint8Array(c.buffer), n); at += 30 + n.length + data.length;
  }
  const size = dir.reduce((s, x) => s + x.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, size, true); end.setUint32(16, at, true);
  return new Blob([...parts, ...dir, new Uint8Array(end.buffer)] as BlobPart[], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
export function toDocx(d: Doc): Blob {
  const x = (s: string) => s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const run = (s: string, o: { b?: boolean; sz?: number; fill?: string; color?: string } = {}) => `<w:r><w:rPr><w:rFonts w:ascii="Hanken Grotesk" w:hAnsi="Hanken Grotesk" w:cs="Arial"/>${o.b ? '<w:b/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}<w:sz w:val="${o.sz || 21}"/>${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''}</w:rPr><w:t xml:space="preserve">${x(s)}</w:t></w:r>`;
  const para = (r: string, o: { after?: number; before?: number; bullet?: boolean; style?: string; keep?: boolean; right?: boolean } = {}) => `<w:p><w:pPr>${o.style ? `<w:pStyle w:val="${o.style}"/>` : ''}${o.keep ? '<w:keepNext/>' : ''}${o.bullet ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : ''}<w:spacing w:before="${o.before || 0}" w:after="${o.after ?? 100}"/>${o.right ? '<w:jc w:val="right"/>' : ''}</w:pPr>${r}</w:p>`;
  const line = (s: string) => { const m = /^([A-ZÁÉÍÓÚÑ][^:.]{2,22}): (.+)$/s.exec(s); return m ? run(m[1] + '. ', { b: true }) + run(m[2][0].toUpperCase() + m[2].slice(1)) : run(s); };
  const cell = (inner: string, w: number, fill = '') => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}<w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr>${inner}</w:tc>`;
  const W = 9600;
  const table = (rows: string[], widths: number[], border = true) => { const s = border ? 'single' : 'nil'; return `<w:tbl><w:tblPr><w:tblW w:w="${W}" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(k => `<w:${k} w:val="${s}" w:sz="4" w:color="0B0B0B"/>`).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.map(r => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${r}</w:tr>`).join('')}</w:tbl>${para('', { after: 60 })}`; };
  const B = (b: Block): string => {
    switch (b.t) {
      case 'h': return para(run(b.x, { b: true, sz: 28 }), { before: 260, after: 110, style: 'Heading2', keep: true });
      case 'p': return para(run(b.x));
      case 'ul': return b.x.map(t => para(line(t), { bullet: true, after: 60 })).join('');
      case 'facts': { const w = Math.floor(W / b.x.length); return table([b.x.map(([k, v], i) => cell(para(run(k, { sz: 18 }), { after: 20 }) + para(run(v, { b: true, sz: 28 }), { after: 0 }), w, i ? '' : 'C3D809')).join('')], b.x.map(() => w)); }
      case 'two': return table([[b.a, b.b].map(s => cell(para(run(s.h, { b: true }), { after: 80 }) + s.x.map(t => para(run(t), { after: 60, bullet: b.a.h !== 'Cliente' })).join(''), W / 2)).join('')], [W / 2, W / 2], b.a.h !== 'Cliente');
      case 'table': { const w = [1900, 3000, 1350, 1550, 1800]; const R = (r: string[], o: { fill?: string; b?: boolean; color?: string } = {}) => r.map((t, i) => cell(para(run(t, { sz: 19, b: o.b || i === 0, color: o.color }), { after: 0, right: b.right.includes(i) }), w[i], o.fill)).join(''); return table([R(b.head, { fill: '0B0B0B', b: true, color: 'FFFFFF' }), ...b.rows.map(r => R(r)), ...(b.foot ? [R(b.foot, { b: true })] : [])], w); }
      case 'sign': return para('', { after: 500 }) + table([[d.client, 'MYB Digitals'].map(n => cell(para(run('______________________')) + para(run(n, { b: true })) + ['Aclaración:', 'DNI:', 'Fecha:'].map(t => para(run(t))).join(''), W / 2)).join('')], [W / 2, W / 2], false);
    }
  };
  const body = para(run('MYB', { b: true, fill: 'C3D809', sz: 26 }) + run(' Digitals', { b: true, sz: 26 }), { after: 60 }) + para(run(`${d.number}. ${d.date}`, { sz: 19, color: '444444' }), { after: 300 }) + para(run(d.title, { b: true, sz: 56 }), { after: 60, style: 'Heading1' }) + para(run(`${d.sub}, para ${d.client}`, { sz: 26 }), { after: 240 }) + d.blocks.map(B).join('');
  const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"', head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  return zip([
    ['[Content_Types].xml', `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`],
    ['_rels/.rels', `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`],
    ['word/_rels/document.xml.rels', `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="r2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['word/styles.xml', `${head}<w:styles ${ns}><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style></w:styles>`],
    ['word/numbering.xml', `${head}<w:numbering ${ns}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:pPr><w:ind w:left="360" w:hanging="260"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`],
    ['word/document.xml', `${head}<w:document ${ns}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="600" w:footer="600" w:gutter="0"/></w:sectPr></w:body></w:document>`],
  ]);
}
