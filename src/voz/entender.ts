// Entiende una frase hablada sin conexión y al instante. Lo que no cierra, lo completa el LLM.
import type { Person } from '../base';
import { CATEGORIES, daysTo, type Cur, type MoveKind } from '../negocio';
import { ACCOUNTS } from '../plataTxt';
import { billDe, clienteDe, cobrables, dueDe, nueva, type Accion, type Datos, type Falta, type Tipo } from './accion';
import { cantidades, fecha, plano, plata, tramosDe, type Tramo } from './numeros';

// ─── Parecidos: el dictado escribe los nombres como los oye ───
const fono = (s: string) => plano(s).replace(/[^a-z0-9ñ ]/g, '').replace(/h/g, '').replace(/v/g, 'b').replace(/z/g, 's').replace(/c(?=[ei])/g, 's').replace(/qu|q|c/g, 'k').replace(/ll/g, 'y').replace(/gu(?=[ei])/g, 'g').replace(/x/g, 'ks').replace(/w/g, 'u').replace(/y\b/g, 'i').replace(/(.)\1+/g, '$1');
function lev(a: string, b: string): number {
  let v = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { const w = [i]; for (let j = 1; j <= b.length; j++) w[j] = Math.min(v[j] + 1, w[j - 1] + 1, v[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); v = w; }
  return v[b.length];
}
const parecido = (a: string, b: string) => { const m = Math.max(a.length, b.length); return m ? 1 - lev(a, b) / m : 0; };
const COMUN = new Set('barberia peluqueria bar gym gimnasio restaurante restaurant resto web estudio local salon tienda kiosco boliche digital digitals shop club cafe casa grupo doctor doctora centro de del la el los las y app uno dos tres sistema pagina taller barber barbershop hair'.split(' '));
interface Hallado { id: string; puntos: number; ini: number; fin: number; parcial: boolean }
const palabras = (t: string) => [...plano(t).matchAll(/[a-z0-9ñ]+/g)].map(m => ({ t: m[0], ini: m.index!, fin: m.index! + m[0].length }));
/** Busca en la frase los nombres de una lista, aunque estén mal escritos. */
export function buscar(texto: string, lista: { id: string; nombres: string[] }[], minimo = 0.8): Hallado[] {
  const w = palabras(texto), out: Hallado[] = [];
  for (const it of lista) {
    const cand: Hallado[] = [];
    for (const nombre of it.nombres) {
      const nt = palabras(nombre), nf = fono(nombre).replace(/ /g, ''); if (nf.length < 2) continue;
      for (let n = Math.max(1, nt.length - 1); n <= nt.length + 1; n++) for (let i = 0; i + n <= w.length; i++) {
        const gf = fono(texto.slice(w[i].ini, w[i + n - 1].fin)).replace(/ /g, '');
        const r = parecido(gf, nf); if (r >= (nf.length <= 4 ? 1 : minimo)) cand.push({ id: it.id, puntos: r, ini: w[i].ini, fin: w[i + n - 1].fin, parcial: false });
      }
      // Una sola palabra propia alcanza: "Off" por "Off Basic"
      if (nt.length > 1) for (const t of nt) if (!COMUN.has(t.t) && t.t.length >= 3) for (const x of w) if (fono(x.t) === fono(t.t)) cand.push({ id: it.id, puntos: 0.78 + Math.min(0.1, t.t.length / 100), ini: x.ini, fin: x.fin, parcial: true });
    }
    cand.sort((x, y) => y.puntos - x.puntos || (y.fin - y.ini) - (x.fin - x.ini));
    if (cand[0]) out.push(cand[0]);
  }
  return out.sort((a, b) => b.puntos - a.puntos);
}
export const listaClientes = (d: Datos) => d.clients.map(c => ({
  id: c.id, nombres: [c.name, ...d.memoria.filter(m => m.cliente_id === c.id).map(m => m.oido), ...d.agreements.filter(a => a.client_id === c.id).flatMap(a => [a.client_data?.name || '', a.client_data?.business || ''])].filter(Boolean),
}));
function clienteEn(texto: string, d: Datos): { id: string | null; tramo: Tramo | null; opciones: string[] } {
  // "Juan Pérez" no es "Juan Martínez": si sigue otro apellido, es otra persona
  const h = buscar(texto, listaClientes(d)).filter(x => { const m = x.parcial && /^\s+(\p{Lu}\p{L}+)/u.exec(texto.slice(x.fin)); return !m || listaClientes(d).find(c => c.id === x.id)!.nombres.some(n => fono(n).includes(fono(m[1]))); });
  if (!h.length) return { id: null, tramo: null, opciones: [] };
  const top = h.filter(x => x.puntos >= h[0].puntos - 0.02 && !(h[0].fin - h[0].ini > x.fin - x.ini && x.ini >= h[0].ini && x.fin <= h[0].fin));
  if (top.length > 1 && top[0].ini === top[1].ini) return { id: null, tramo: top[0], opciones: top.slice(0, 4).map(x => x.id) };
  return { id: h[0].id, tramo: h[0], opciones: [] };
}

// ─── Verbos ───
type Regla = [Tipo, MoveKind | '', RegExp];
const b = (s: string) => new RegExp(`\\b(?:${s})\\b`);
const REGLAS: Regla[] = [
  ['deshacer', '', b('deshace(?:lo|r)?|borra(?:r)? lo ultimo|borra el ultimo|saca lo ultimo|volve(?:r)? atras')],
  ['ir', '', b('abri(?:me)?|anda a|llevame a|entra a|quiero ver la seccion')],
  ['consulta', '', /^\W*(?:che |a ver |decime |contame |mostrame |y )?(?:cuanto|cuanta|cuantos|cuantas|quien|quienes|que tengo|que tenemos|que hay que|que hago|que me falta|como venimos|como vamos|como viene|como esta|cual|cuales|por donde|me alcanza|nos alcanza|podemos|conviene|resumen|resumime)\b/],
  ['precio', '', b('(?:cambia(?:r|le)?|subi(?:r|le)?|baja(?:r|le)?|actualiza(?:r)?|pone(?:r|le)?) (?:el|al) precio|ahora (?:sale|vale|cuesta)|pasa a (?:salir|valer|costar)|va a (?:salir|valer|costar)')],
  ['acuerdo', '', b('cerre(?:mos)? (?:con|un trato|el trato|trato)|cerramos (?:con|trato)|(?:arma(?:me)?|crea(?:me)?|hace(?:me)?|nuevo|carga(?:me)?) (?:un |el )?(?:acuerdo|contrato|presupuesto)')],
  ['mensaje', '', b('(?:mandale|manda|enviale|escribile|decile|avisale|mandarle|escribirle|avisarle|recordale)(?: un)?(?: (?:mensaje|whatsapp|wasap|wasa))?(?= (?:a|al)\\b)')],
  ['cliente', '', b('(?:nuevo cliente|cliente nuevo|agrega(?:r|me)? (?:a |al |un )?cliente|carga(?:r|me)? (?:a |al |un )?cliente|suma(?:r|me)? (?:a |al |un )?cliente|el (?:whatsapp|wasap|telefono|celular|numero) de)')],
  ['prospecto', '', b('(?:me|nos) (?:escribio|hablo|consulto|contacto|pregunto|llamo)|nuevo (?:prospecto|contacto|interesado|posible cliente)|posible cliente|esta interesad[oa]')],
  ['nota', '', b('(?:me|nos) deben?|anota(?:me)? que|nota(?= |:)|apunta(?:me)?|toma nota')],
  ['entrega', '', b('entregue|entregamos|ya (?:esta|quedo) (?:lista|entregada) la fase|terminamos la fase|termine la fase|fase (?:lista|terminada|entregada)')],
  ['hecha', '', b('ya (?:hice|termine|complete|llame|mande|escribi|lo hice)|termine (?:de|con|lo de)|marca(?:r|me)? como (?:hecha|lista|terminada)|complete|tacha(?:me)?|listo lo de')],
  ['evento', '', b('(?:tengo|tenemos|agenda(?:me)?|anota(?:me)?|hay|pone(?:me)?) (?:una |un )?(?:reunion|junta|juntada|videollamada|turno|cita|llamada)|reunion con|videollamada con')],
  ['vencimiento', '', b('vence|todos los meses (?:hay que pagar|pago|pagamos)|pago fijo|gasto fijo|hay que pagar|tenemos que pagar|tengo que pagar')],
  ['tarea', '', b('tengo que|tenemos que|tiene que|hay que|acordate(?: de)?|recordame|acordame|agenda(?:me)?|agrega(?:me)? (?:una |la )?tarea|nueva tarea|tarea(?= |:)|anota(?:me)?|que no me olvide|quiero|voy a|necesito|falta')],
  ['plata', 'traspaso', b('pas[ae](?:mos|r)?(?= .*\\bsobre\\b)|movi(?:mos)?|pase|pasamos|traspaso|traspase')],
  ['plata', 'retiro', b('retire|retiramos|retiro|saque|sacamos|me lleve|nos llevamos|se llevo')],
  ['plata', 'aporte', b('aporte|aportamos|aporto|puse (?:plata|de mi|yo)|pusimos|puse(?= .*\\b(?:bolsillo|empresa|caja|negocio)\\b)')],
  ['plata', 'inversion', b('inverti|invertimos|invirtio|inversion|puse en|pusimos en|metimos en|puse(?= .*\\b(?:publicidad|anuncios|meta|pauta)\\b)')],
  ['plata', 'ingreso', b('entro|entraron|entra|entran|ingreso|ingresaron|cobre|cobramos|cobro|(?:me|nos) (?:pago|pagaron|deposito|depositaron|transfirio|transfirieron|dio|dieron|mando|mandaron|abono|seno)|transfirio|deposito|abono(?= \\d)|recibi|recibimos|cayo|cayeron|vendi|vendimos|llego|llegaron')],
  ['plata', 'gasto', b('gaste|gastamos|gasto|gastos|pague|pagamos|compre|compramos|salio|salieron|se fue|se fueron|(?:me|nos) (?:cobro|cobraron|salio|costo)|puse|costo|le pague|le pagamos')],
  ['plata', '', b('pago|pagaron')],
];
const DIAQ = '(?:a las? \\S+(?: y (?:media|cuarto|\\d+))?(?: de la (?:manana|tarde|noche))?|(?:el )?(?:dia )?\\d{1,2}(?: de [a-z]+)?|la semana (?:que viene|pasada)|el (?:mes|ano) (?:que viene|pasado)|(?:el )?proximo [a-z]+|hoy|ayer|anteayer|manana|pasado manana|el (?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)|a la (?:manana|tarde|noche)|recien|despues|tambien|yo|matias|mati|benja|benjamin|_{2,})';

/** Dónde empieza cada pedido dentro de la frase. */
export function separar(texto: string, d?: Datos): string[] {
  let p = plano(texto);
  // "y Barbería Uno me pagó": el nombre va pegado al verbo
  if (d) for (const h of buscar(texto, listaClientes(d))) p = p.slice(0, h.ini) + '_'.repeat(h.fin - h.ini) + p.slice(h.fin);
  const cortes = new Set<number>([0]);
  for (const m of p.matchAll(/[.;!?]\s+(?=\S)/g)) cortes.add(m.index!);
  for (const [tipo, , re] of REGLAS) {
    if (tipo === 'consulta' || tipo === 'ir') continue;
    for (const m of p.matchAll(new RegExp(re.source, 'g'))) {
      if (!m.index) continue;
      // Sólo si antes hay una coma, un punto o una "y" (con un día en el medio, como mucho)
      const antes = p.slice(0, m.index), c = new RegExp(`(?:[,.;]\\s*(?:(?:y|e|tambien|ademas|despues|luego)\\s+)*|\\b(?:y|tambien|ademas|despues|luego)\\s+)+(?:${DIAQ}\\s+)*(?:(?:me|nos|le|les|te|se|ya|que|yo|matias|mati|benja|benjamin)\\s+)*$`).exec(antes);
      if (c && antes.slice(0, c.index).trim()) cortes.add(c.index);
    }
  }
  // "gasté 5 lucas en nafta y 3 mil en comida"
  for (const c of cantidades(texto)) {
    if (c.clase !== 'plata' && !(c.clase === 'quizas' && c.valor >= 100 && !c.enLetras)) continue;
    const par = /(?:\s*,\s*(?:y\s+)?|\s+y\s+)_{2,}\s+$/.exec(p.slice(0, c.ini)); // "Roy me pagó 30 y Barbería Uno 45"
    if (par && cantidades(texto.slice(0, par.index)).length) { cortes.add(par.index); continue; }
    const m = /(?:\s*,\s*(?:y\s+)?|\s+y\s+(?:otros?\s+|otras?\s+)?)$/.exec(p.slice(0, c.ini));
    if (m && /^\s*(?:pesos|dolares)?\s*(?:en|de|por|para)\s/.test(p.slice(c.fin)) && cantidades(texto.slice(0, m.index)).some(x => x.clase === 'plata' || x.clase === 'quizas') && !/\b(sena|entrega|cuota|fase|anticipo|mes)\b/.test(p.slice(c.fin, c.fin + 24))) cortes.add(m.index);
  }
  const l = [...cortes].sort((x, y) => x - y), out: string[] = [];
  for (let i = 0; i < l.length; i++) {
    const s = texto.slice(l[i], l[i + 1] ?? texto.length).replace(/^[\s,.;]+|[\s,;.]+$/g, '').replace(/^(?:(?:y|e|también|tambien|además|ademas|después|despues|luego|aparte)\s+)+/i, '');
    if (s) out.push(s);
  }
  return out;
}

// ─── Cuentas, sobres, categorías ───
const CUENTAS: [RegExp, string][] = [
  [/\b(?:a|en|por|con|al)?\s*(?:mi |la |nuestro |nuestra )?(?:cuenta de )?(?:mercado\s*pago|mercadopago|emepe|mp)\b/, 'Mercado Pago'],
  [/\b(?:en|con)\s+(?:efectivo|cash|billetes)\b|\befectivo\b|\ben mano\b/, 'Efectivo'],
  [/\b(?:a|en|por|con|al)\s+(?:el |la |mi |una )?(?:banco|cuenta del banco|transferencia(?: bancaria)?|transfer)\b/, 'Banco'],
  [/\b(?:con|en|a)\s+(?:la |mi )?tarjeta(?: de (?:credito|debito))?\b/, 'Tarjeta'],
];
function cuentaEn(t: string, d: Datos, moneda: Cur): { v: string; tramo: Tramo } | null {
  const p = plano(t);
  for (const [re, v] of CUENTAS) { const m = re.exec(p); if (m) return { v: v === 'Efectivo' && moneda === 'USD' ? ACCOUNTS[3] : v, tramo: { ini: m.index, fin: m.index + m[0].length } }; }
  const otras = [...new Set(d.movements.map(m => m.account).filter(a => a && a.length > 3))].map(a => ({ id: a, nombres: [a] }));
  const h = buscar(t, otras, 0.9)[0];
  return h ? { v: h.id, tramo: h } : null;
}
const CATS: [MoveKind, string, RegExp][] = [
  ['gasto', 'Traslados', b('nafta|combustible|uber|didi|cabify|taxi|remis|colectivo|bondi|peaje|viaje|viatico|viaticos|estacionamiento|pasaje|pasajes')],
  ['gasto', 'Servidores y dominios', b('dominios?|hosting|servidor|servidores|vercel|supabase|neon|nube|cloud|railway|hostinger')],
  ['gasto', 'Herramientas', b('chat ?gpt|claude|canva|cap ?cut|eleven ?labs|suscripcion|suscripciones|figma|higgsfield|gemini|openai|notion|adobe|programas?|licencias?|heygen')],
  ['gasto', 'Impuestos', b('monotributo|afip|arca|iva|impuestos?|ingresos brutos|contador|contadora|comisiones?')],
  ['inversion', 'Publicidad', b('publicidad|publicidades|anuncios?|pauta|ads|meta ads|promocion|promocionar|influencer')],
  ['inversion', 'Formación', b('cursos?|mentoria|libros?|capacitacion|clases?')],
  ['inversion', 'Equipos', b('notebook|compu|computadora|camara|microfono|celulares|celular|microfonos|camaras|notebooks|monitor|disco|auriculares|tripode|luces|placa|equipos?')],
  ['inversion', 'Marca y contenido', b('logos?|tarjetas personales|folletos|marca|contenido')],
  ['inversion', 'Desarrollo de producto', b('desarrollo|prototipo|producto nuevo')],
];
function sobres(t: string, d: Datos): { de: string | null; a: string | null; tramos: Tramo[] } {
  const p = plano(t), tramos: Tramo[] = [];
  let de: string | null = null, a: string | null = null;
  if (!/\bsobres?\b/.test(p)) return { de, a, tramos };
  const h = buscar(t, d.funds.filter(f => !f.archived).map(f => ({ id: f.id, nombres: [f.name, f.name.split(' ')[0]] })), 0.85).sort((x, y) => x.ini - y.ini);
  for (const x of h) {
    const pre = /(?:\b(del|de|desde|al|a|para|en)\s+)?(?:el\s+|la\s+)?(?:sobre\s+(?:de\s+|del\s+)?)?$/.exec(p.slice(0, x.ini))!;
    if (/^(al|a|para|en)$/.test(pre[1] || '')) a ??= x.id; else de ??= x.id;
    tramos.push({ ini: pre.index, fin: x.fin });
  }
  return { de, a, tramos };
}

// ─── Aprender de lo ya cargado ───
/** Cómo se cargó la última vez algo parecido: en qué rubro, sobre y cuenta. */
export function costumbre(titulo: string, clase: MoveKind, d: Datos) {
  const f = fono(titulo); if (f.length < 3) return null;
  const l = d.movements.filter(m => m.kind === clase && m.concept && !m.agreement_id).sort((x, y) => y.date - x.date).slice(0, 400);
  return l.find(m => fono(m.concept) === f) || l.find(m => parecido(fono(m.concept), f) >= 0.84) || null;
}
const cap = (s: string) => s ? s[0].toUpperCase() + s.slice(1) : '';
const BORDE = /^(?:\s|[,.;:]|(?:por|en|para|de|del|la|el|los|las|un|una|unos|unas|lo|que|y|e|fue|fueron|eran|son|a|al|con|concepto de|mas|ya|se|me|nos|le|les|te|como|pesos|che|eh|bueno|hoy|m[ií]|aprox|más o menos)(?![\p{L}\d]))+/iu;
function resto(t: string, tramos: Tramo[]): string[] {
  const s = t.split('');
  for (const x of tramos) for (let i = x.ini; i < x.fin; i++) s[i] = '\u0000';
  return s.join('').split(/\u0000+/).map(x => x.trim()).filter(x => /[\p{L}\d]{2}/u.test(x));
}
const limpio = (s: string) => { let x = s, y = ''; while (x !== y) { y = x; x = x.replace(BORDE, '').replace(/[\s,.;:]+$/, '').replace(/\s(?:por|en|para|de|del|y|a|al|con|el|la|que|un|una)$/i, ''); } return /^(?:y|e|a|de|por|en)$/i.test(x) ? '' : x; };

/** ¿Parece dicho para el dashboard? Lo que suena de fondo se ignora y no se manda a ningún lado. */
export function tieneSenal(t: string, d: Datos): boolean {
  const p = plano(t);
  return cantidades(t).some(x => x.valor > 0 && (x.clase === 'plata' || x.valor >= 20)) || buscar(t, listaClientes(d)).length > 0 || REGLAS.some(([ti, , re]) => ti !== 'tarea' && ti !== 'plata' && re.test(p)) || /\b(?:plata|pago|pague|cobr\w+|gast\w+|entr(?:o|aron)|cliente|acuerdo|factura|tarea|recorda\w*|acorda\w*|anota\w*|agenda\w*|tengo que|tenemos que|reunion|mensaje|sobre|sena|abono)\b/.test(p);
}
export interface Entendido { acciones: Accion[]; seguro: boolean; pistas: string[] }

/** Una frase suelta, ya separada. */
function una(t: string, d: Datos, hereda: MoveKind | null): { a: Accion | null; seguro: boolean; pistas: string[] } {
  const p = plano(t);
  let tipo: Tipo | '' = '', clase: MoveKind | '' = '', verbo: Tramo | null = null;
  const din = plata(t);
  const cl = clienteEn(t, d);
  let mejor = Infinity;
  for (const [ti, k, re] of REGLAS) {
    const m = re.exec(p); if (!m) continue;
    if (ti === 'vencimiento' && !din) continue;                       // "tengo que pagar el monotributo" sin monto es una tarea
    if (ti === 'tarea' && /^(quiero|voy a|necesito|falta|anota|anotame|tarea|hay que)$/.test(m[0]) && m.index > 12) continue;
    if (ti === 'nota' && m[0] === 'nota' && m.index > 3) continue;
    if (ti === 'consulta' && din && !/\?/.test(t) && /^\W*(que hay que|cual)/.test(p)) continue;
    if (ti === 'evento' && !fecha(t, d.now, 'despues') && !/agenda|reunion con|videollamada con/.test(m[0])) continue;
    if (ti === 'hecha' && din && !/^(?:ya|marca|tacha)/.test(m[0])) continue;
    if (ti === 'plata') {
      // Entre verbos de plata gana el que se dijo primero
      if ((tipo && tipo !== 'plata') || m.index >= mejor) continue;
      mejor = m.index;
    } else if (tipo) continue;
    tipo = ti; clase = k; verbo = { ini: m.index, fin: m.index + m[0].length };
    if (ti !== 'plata') break;
  }
  if (tipo === 'plata' && !clase) { // "pago": según quién
    const acento = /pag(?:ó|aron)/i.test(t.normalize('NFC'));
    clase = cl.id || cl.opciones.length || acento ? 'ingreso' : 'gasto';
  }
  if (!tipo && hereda && din) { tipo = 'plata'; clase = hereda; }
  if (!tipo && din && (cl.id || cl.opciones.length || /\bde\b.*\bpor\b/.test(p))) { tipo = 'plata'; clase = 'ingreso'; }
  if (!tipo) return { a: null, seguro: false, pistas: [] };

  const pistas: string[] = [];
  const marca = (x: Tramo | null | undefined) => { if (x) pistas.push(t.slice(x.ini, x.fin)); };
  const usados: Tramo[] = verbo ? [verbo] : [];
  const a = nueva(tipo, d, { texto: t });
  const f = tipo === 'consulta' || tipo === 'ir' || tipo === 'deshacer' ? null : fecha(t, d.now, tipo === 'plata' || tipo === 'entrega' ? 'antes' : 'despues');
  if (f) { a.fecha = f.at; a.hora = f.hora; tramosDe(f).forEach(x => { usados.push(x); marca(x); }); }
  if (din && ['plata', 'vencimiento', 'acuerdo', 'precio'].includes(tipo)) { a.monto = din.valor; a.moneda = din.moneda || 'ARS'; usados.push(din); marca(din); }
  if (tipo !== 'ir' && tipo !== 'deshacer') { a.cliente_id = cl.id; a.opciones = cl.opciones; marca(cl.tramo); }
  const conPrep = (x: Tramo): Tramo => { const m = /\b(?:de|a|al|para|con|del|por)\s+(?:el\s+|la\s+)?$/.exec(p.slice(0, x.ini)); return { ini: m ? m.index : x.ini, fin: x.fin }; };
  const quien = (): Person | '' => /\b(?:matias|mati)\b/.test(p) ? 'mati' : /\b(?:benja|benjamin)\b/.test(p) ? 'benja' : '';
  let seguro = true;

  switch (tipo) {
    case 'plata': {
      a.clase = clase as MoveKind;
      if (a.clase === 'aporte' && !/bolsillo|empresa|caja/.test(p) && CATS.some(([k, , re]) => k === 'inversion' && re.test(p))) a.clase = 'inversion';
      if (a.clase === 'retiro' && /\bpara (?:comprar|pagar)\b/.test(p)) a.clase = CATS.some(([k, , re]) => k === 'inversion' && re.test(p)) ? 'inversion' : 'gasto';
      const cu = cuentaEn(t, d, a.moneda); if (cu) { a.cuenta = cu.v; usados.push(cu.tramo); marca(cu.tramo); }
      const so = sobres(t, d); so.tramos.forEach(x => { usados.push(x); marca(x); });
      a.fondo = so.de; a.fondo2 = so.a;
      if (a.clase !== 'traspaso') { a.fondo = so.de || so.a; a.fondo2 = null; }
      if (a.clase === 'retiro' || a.clase === 'aporte') {
        a.persona = quien() || d.yo;
        for (const m of p.matchAll(/\b(?:matias|mati|benja|benjamin)\b/g)) usados.push(conPrep({ ini: m.index!, fin: m.index! + m[0].length }));
        const b2 = /\bde mi bolsillo\b|\b(?:a|en) la (?:empresa|caja)\b/.exec(p); if (b2) usados.push({ ini: b2.index, fin: b2.index + b2[0].length });
      }
      if (cl.tramo) usados.push(conPrep(cl.tramo));
      const trozos = resto(t, usados);
      // "de Juan Pérez por la web": alguien que todavía no es cliente
      if (!a.cliente_id && !a.opciones.length && a.clase === 'ingreso') {
        for (let i = 0; i < trozos.length; i++) {
          const m = /^(?:de|desde|a)\s+(?:parte de\s+)?(.+?)(?:\s+(?:por|en concepto de|para|de)\s+(.+))?$/i.exec(trozos[i]) || /^((?:\p{Lu}[\p{L}]+\s?)+)(?:\s*(?:por|para)\s+(.+))?$/u.exec(trozos[i]);
          const z = /^(.+?)(,)?\s+de\s+((?:\p{Lu}\p{L}+\s?){1,3})$/u.exec(trozos[i]);
          if (z && (z[2] || z[3].trim().includes(' '))) { a.cliente_nuevo = z[3].trim(); trozos[i] = z[1]; break; }
          if (m && limpio(m[1]) && limpio(m[1]).split(/\s+/).length <= 4 && !/^(?:se[nñ]a|anticipo|abono|cuota|entrega|ventas?)/i.test(limpio(m[1]))) { a.cliente_nuevo = cap(limpio(m[1])); trozos[i] = m[2] || ''; break; }
        }
      }
      a.titulo = cap(trozos.map(limpio).filter(Boolean).join(' ').slice(0, 90));
      if (a.clase === 'gasto' || a.clase === 'inversion') {
        const c = CATS.find(([k, , re]) => re.test(p) && (a.clase === 'gasto' || k === 'inversion'));
        if (c) { a.clase = c[0]; a.categoria = c[1]; }
      }
      if (a.clase === 'ingreso') a.categoria = /\b(abono|mensual|mensualidad|mes)\b/.test(p) ? 'Abono mensual' : 'Proyecto';
      if (a.clase === 'retiro') a.categoria = 'Sueldo';
      if (a.clase === 'aporte') a.categoria = 'Aporte';
      if (a.clase === 'traspaso') { a.categoria = 'Traspaso'; a.titulo = 'Entre sobres'; }
      enganchar(a, d);
      // Con todo en su lugar y poco texto sin explicar no hace falta preguntarle a nadie
      seguro = a.monto > 0 && cantidades(t).filter(x => x.clase === 'plata' || x.clase === 'quizas').length < 2 && a.titulo.split(' ').length <= 6 && !a.cliente_nuevo && (a.clase !== 'ingreso' || !!a.cliente_id || !d.clients.length);
      break;
    }
    case 'vencimiento': {
      const r = /\b(?:todos los meses|por mes|cada mes|mensual(?:mente)?|al mes)\b/.exec(p), y = /\b(?:por ano|al ano|todos los anos|cada ano|anual(?:mente)?)\b/.exec(p);
      const dia = /\b(?:el|dia|el dia)\s+(\d{1,2})\s+de\s+(?:cada mes|todos los meses)\b/.exec(p);
      a.repite = r || dia ? 'mes' : y ? 'anio' : 'no';
      for (const m of [r, y, dia]) if (m) usados.push({ ini: m.index, fin: m.index + m[0].length });
      if (dia) { const t0 = new Date(d.now); let x = new Date(t0.getFullYear(), t0.getMonth(), Number(dia[1]), 12).getTime(); if (daysTo(x, d.now) < 0) x = new Date(t0.getFullYear(), t0.getMonth() + 1, Number(dia[1]), 12).getTime(); a.fecha = x; }
      a.cliente_id = null; a.opciones = [];
      a.titulo = cap(resto(t, usados).map(limpio).filter(Boolean).join(' '));
      break;
    }
    case 'tarea': {
      const otro = /\b(?:(?:que |a |para )?(?:matias|mati|benja|benjamin))\b(?=[^,]*\b(?:tiene que|haga|se encargue|se encarga)\b)|\b(?:para|que) (?:matias|mati|benja|benjamin)\b/.exec(p);
      a.persona = otro ? quien() : d.yo;
      if (otro) usados.push({ ini: otro.index, fin: otro.index + otro[0].length });
      const im = /\b(?:es )?(?:lo mas importante|urgente|prioridad|muy importante)(?: del dia| de hoy)?\b/.exec(p); if (im) { a.top = true; usados.push({ ini: im.index, fin: im.index + im[0].length }); }
      const du = cantidades(t).find(x => x.clase === 'tiempo' && (x.unidad === 'hora' || x.unidad === 'minuto') && !/\b(?:hace|en|dentro de)\s*$/.test(p.slice(0, x.ini)));
      if (du) { a.minutos = Math.round(du.valor * (du.unidad === 'hora' ? 60 : 1)); const pr = /(?:durante|unos|unas|de|por|son|me lleva|lleva)\s*$/.exec(p.slice(0, du.ini)); usados.push({ ini: pr ? pr.index : du.ini, fin: du.fin }); }
      const ap = resto(t, usados).map(x => x.replace(/^(?:[\s,.:;]|(?:que|tarea|de|y)(?![\p{L}\d])|(?:yo|ya)(?![\p{L}\d]))+/iu, '').replace(/[\s,.;]+$/, '').replace(/\s(?:y|a|de|para|el)$/i, '')).filter(Boolean);
      a.titulo = cap(ap.join(' ')); seguro = a.titulo.split(' ').length <= 14;
      break;
    }
    case 'nota': a.titulo = cap((/deben?/.test(p.slice(verbo!.ini, verbo!.fin)) ? t : t.slice(verbo!.fin)).replace(/^[\s,:.]+/, '').replace(/^que\s+/i, '')); a.fecha = d.now; break;
    case 'evento': {
      const ti = resto(t, usados.filter(x => x !== verbo)).join(' ').replace(/^(?:tengo|tenemos|agend[aá](?:me)?|anot[aá](?:me)?|hay|pon[eé](?:me)?)\s+(?:una?\s+)?/i, '').replace(/[\s,.;]+$/, '').replace(/\s(?:y|a|de|para|el)$/i, '');
      a.titulo = cap(ti); break;
    }
    case 'hecha': {
      const h = mejorTexto(t, d.items.filter(x => !x.done_at).map(x => ({ id: x.id, n: x.title })));
      if (h) a.ref = 'item:' + h; else a.titulo = cap(limpio(t.slice(verbo!.fin))); seguro = !!h; break;
    }
    case 'entrega': {
      const fases = d.agreements.filter(x => x.status === 'firmado' && (!a.cliente_id || x.client_id === a.cliente_id)).flatMap(x => x.phases.filter(y => y.kind === 'fase' && !y.done_at).map(y => ({ id: `fase:${x.id}:${y.id}`, n: y.name, at: y.due_at ?? 9e15 })));
      const h = mejorTexto(t, fases);
      a.ref = h || (a.cliente_id && fases.length ? [...fases].sort((x, y) => x.at - y.at)[0].id : ''); seguro = !!h; break;
    }
    case 'cliente': case 'prospecto': {
      const te = /\+?\d[\d\s.-]{6,}\d/.exec(t); if (te) { a.telefono = te[0].trim(); const x = { ini: te.index, fin: te.index + te[0].length }; usados.push(x); marca(x); }
      for (const m of p.matchAll(/[,.]?\s*\b(?:(?:y )?(?:el |su )?)(?:whatsapp|wasap|telefono|celular|numero)(?: de)?(?: es)?(?: el)?\b/g)) if (m.index! >= (verbo?.fin ?? 0)) usados.push({ ini: m.index!, fin: m.index! + m[0].length });
      const trozos = resto(t, usados).map(x => x.replace(/^[\s,:.]+|[\s,.]+$/g, ''));
      if (tipo === 'cliente') {
        if (/(?:whatsapp|wasap|telefono|celular|numero) de/.test(p.slice(verbo!.ini, verbo!.fin))) { if (!a.cliente_id) a.titulo = cap(limpio((trozos[0] || '').replace(/\s+es$/i, ''))); }
        else { a.cliente_id = null; a.opciones = []; const m = /^(?:se llama\s+|a\s+|es\s+)?(.+?)(?:\s*[,.]\s*(.+))?$/i.exec(trozos[0] || ''); a.titulo = cap((m?.[1] || '').trim()); a.detalle = cap([m?.[2], ...trozos.slice(1)].filter(Boolean).join(' ')); }
      } else {
        const m = /^(?:una?\s+(?:tal\s+)?|a\s+)?(.+?)(?:\s+(?:de|del|que tiene|dueñ[oa] de)\s+(?:una?\s+|la\s+|el\s+)?(.+?))?(?:\s*(?:,|\bque\b|\bquiere\b|\bpreguntando\b|\bpara\b|\bpor\b)\s*(.*))?$/i.exec(trozos.join(' '));
        a.titulo = cap((m?.[1] || '').trim()); a.categoria = cap((m?.[2] || '').trim()); a.detalle = t; a.cliente_id = null; a.opciones = []; seguro = false;
      }
      break;
    }
    case 'mensaje': {
      // La fecha es parte de lo que se le dice, no del pedido
      const v = [verbo!]; if (cl.tramo) v.push(conPrep(cl.tramo));
      let cuerpo = resto(t, v).join(' ').replace(/^(?:[\s,:]|(?:a|al|que diga|para decirle|dici[eé]ndole)(?![\p{L}\d]))+/iu, '').replace(/^que\s+/i, '').trim();
      if (!cl.id && !cl.opciones.length) { const m = /^(.+?)(?:\s+(?:que|dici[eé]ndole)\s+|\s*[:,]\s*)(.+)$/i.exec(cuerpo); if (m) { a.cliente_nuevo = cap(m[1]); cuerpo = m[2]; } }
      a.detalle = cap(cuerpo); seguro = false; break;
    }
    case 'acuerdo': {
      const c = cantidades(t).filter(x => x.clase === 'plata' || x.clase === 'quizas');
      const mes = c.find(x => /^\s*(?:pesos|dolares)?\s*(?:por mes|al mes|mensual|de abono|cada mes)/.test(p.slice(x.fin)) || /\b(?:abono|mensual|mensualidad)\s+(?:de\s+)?$/.test(p.slice(0, x.ini)));
      const total = c.find(x => x !== mes && x.valor >= 20); a.monto = total?.valor || 0; a.abono = mes?.valor || 0; a.moneda = (total?.moneda || mes?.moneda || 'ARS') as Cur;
      const pct = cantidades(t).find(x => x.clase === 'pct'), s = mejorTexto(t, d.services.map(x => ({ id: x.id, n: x.name })));
      if (s) { a.ref = 'serv:' + s; a.titulo = d.services.find(x => x.id === s)!.name; }
      if (pct && a.monto && /se[nñ]a|anticipo|adelant/i.test(t)) { const se = Math.round(a.monto * pct.valor) / 100; a.fases = [{ nombre: 'Seña', monto: se, fecha: null }, { nombre: 'Entrega final', monto: Math.round((a.monto - se) * 100) / 100, fecha: f ? a.fecha : null }]; }
      if (!a.cliente_id && !a.opciones.length) { const m = /\bcon\s+(.+?)(?=\s+(?:por|en|una?|la|el|para|a|de)(?![\p{L}\d])|[,.]|$)/iu.exec(t); if (m) a.cliente_nuevo = cap(m[1].trim()); }
      seguro = false; break;
    }
    case 'precio': {
      const s = mejorTexto(t, d.services.map(x => ({ id: x.id, n: x.name }))); if (s) a.ref = 'serv:' + s;
      a.repite = /\b(?:por mes|al mes|mensual)\b/.test(p) ? 'mes' : /\b(?:por ano|al ano|anual)\b/.test(p) ? 'anio' : 'no';
      a.cliente_id = null; a.opciones = []; seguro = !!s; break;
    }
    case 'consulta': a.titulo = t; seguro = false; break;
    case 'ir': a.titulo = t.slice(verbo!.fin).trim(); break;
    default: break;
  }
  if (a.cliente_id) a.opciones = [];
  return { a, seguro, pistas };
}

/** El texto de la lista que más se parece a lo dicho, por palabras en común. */
export function mejorTexto(t: string, lista: { id: string; n: string }[]): string {
  const raiz = (x: string) => { const f = fono(x), r = f.replace(/(?:arle|erle|irle|aron|ando|iendo|amos|aste|ar|er|ir|e|o|a|s)$/, ''); return r.length > 2 ? r : f; };
  const w = new Set(palabras(t).filter(x => x.t.length > 2 && !/^(?:que|con|los|las|del|una|por|para|fase|ahora|sale|ya|hice|termine|lista|entregue|entregamos|precio|cerre|cerramos)$/.test(x.t)).map(x => raiz(x.t)));
  let best = '', pt = 0, empate = false;
  for (const it of lista) {
    const n = palabras(it.n).filter(x => x.t.length > 2 && !/^(?:que|con|los|las|del|una|por|para)$/.test(x.t)).map(x => raiz(x.t)); if (!n.length) continue;
    const k = n.filter(x => w.has(x)).length, s = k / n.length + k * 0.05;
    if (s > pt + 0.001) { best = it.id; pt = s; empate = false; } else if (s && Math.abs(s - pt) <= 0.001) empate = true;
  }
  return pt >= 0.38 && !empate ? best : '';
}

/** Une lo dicho con lo que ya está cargado: cobros pendientes, pagos fijos y costumbres. */
export function enganchar(a: Accion, d: Datos) {
  if (a.tipo !== 'plata') return;
  const libre = (c: string) => !a.fijo.includes(c);
  if (libre('ref')) {
    a.ref = '';
    if (a.clase === 'ingreso' && a.cliente_id) {
      const l = cobrables(d, a.cliente_id), p = plano(a.titulo + ' ' + a.texto);
      const porNombre = l.filter(x => palabras(x.label).some(w => w.t.length > 3 && w.t !== 'fase' && p.includes(w.t)) || (x.kind === 'mes' && /\b(abono|mes|mensual)\b/.test(p))).sort((x, y) => (x.due_at ?? 9e15) - (y.due_at ?? 9e15));
      const igual = a.monto ? l.filter(x => x.left === a.monto && x.agreement.currency === a.moneda) : [];
      const ya = l.filter(x => x.state !== 'futuro');
      const el = igual.find(x => porNombre.includes(x)) || (igual.length === 1 ? igual[0] : null) || igual.find(x => x.state !== 'futuro') || porNombre[0] || (ya.length === 1 ? ya[0] : null);
      if (el) a.ref = 'due:' + el.key;
    } else if (a.clase === 'gasto' || a.clase === 'inversion') {
      const h = buscar(a.titulo || a.texto, d.bills.filter(x => x.active).map(x => ({ id: x.id, nombres: [x.name] })), 0.82)[0];
      if (h) a.ref = 'bill:' + h.id;
    }
  }
  const due = dueDe(d, a.ref), bill = billDe(d, a.ref);
  if (due) {
    if (!a.monto && libre('monto')) { a.monto = due.left; a.moneda = due.agreement.currency; }
    a.categoria = due.kind === 'mes' ? 'Abono mensual' : 'Proyecto';
  }
  if (bill) { if (!a.monto && libre('monto')) { a.monto = bill.amount; a.moneda = bill.currency; } a.titulo ||= bill.name; a.fondo ??= bill.fund_id; }
  const c = due ? null : costumbre(a.titulo, a.clase, d);
  if (c) { if (!a.categoria && libre('categoria')) a.categoria = c.category; if (!a.fondo && libre('fondo') && a.clase !== 'ingreso') a.fondo = c.fund_id; if (!a.cuenta && libre('cuenta')) a.cuenta = c.account; }
  if (a.clase !== 'ingreso' && a.clase !== 'traspaso' && !a.fondo && libre('fondo')) {
    const live = d.funds.filter(x => !x.archived);
    if (a.clase === 'inversion') a.fondo = live.find(x => x.kind === 'inversion')?.id ?? null;
    if (a.clase === 'retiro') a.fondo = live.find(x => plano(x.name) === (a.persona === 'mati' ? 'matias' : 'benjamin'))?.id ?? null;
  }
  if (!a.cuenta && libre('cuenta')) a.cuenta = d.cuenta;
  if (!a.categoria) a.categoria = CATEGORIES[a.clase].includes('Otro') ? 'Otro' : CATEGORIES[a.clase][0];
}

/** Toda la frase. */
export function entender(texto: string, d: Datos): Entendido {
  // El dictado a veces escribe una palabra entera en mayúsculas
  const t = texto.normalize('NFC').replace(/\s+/g, ' ').trim().replace(/(?<!\p{L})\p{Lu}{4,}(?!\p{L})/gu, x => /[a-zñáéíóú]/.test(texto) ? x.toLowerCase() : x);
  const out: Entendido = { acciones: [], seguro: true, pistas: [] };
  let hereda: MoveKind | null = null;
  const solo = una(t, d, null);
  const l = solo.a && ['consulta', 'ir', 'deshacer', 'mensaje', 'nota', 'acuerdo', 'prospecto', 'cliente'].includes(solo.a.tipo) && !/[.;]\s+\S/.test(t) ? [t] : separar(t, d);
  for (const s of l) {
    const r = una(s, d, hereda);
    if (!r.a) { out.seguro = false; const u = out.acciones[out.acciones.length - 1]; if (u) u.detalle = [u.detalle, s].filter(Boolean).join('. '); continue; }
    if (r.a.tipo === 'plata') hereda = r.a.clase;
    out.acciones.push(r.a); out.pistas.push(...r.pistas); if (!r.seguro) out.seguro = false;
  }
  if (!out.acciones.length) out.seguro = false;
  return out;
}

// ─── Charla: confirmar, cancelar, corregir, responder ───
export type Orden = 'guardar' | 'cancelar' | 'parar' | null;
export function orden(texto: string): Orden {
  const p = plano(texto).replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(?:(?:si|dale|bueno|ok|okey|listo|perfecto|joya|genial|buenisimo|de una|esta bien|eso es todo|nada mas|correcto|exacto|confirmo|confirmar|confirma|guarda|guardalo|guardala|guardalos|guardar|guardame|cargalo|carga|cargala|anotalo|mandale|todo|todos|bien|por favor|gracias|asi)(?:\s+|$))+$/.test(p)) return 'guardar';
  if (/^(?:no )?(?:cancela(?:r|lo)?|olvidate|descarta(?:lo|r)?|borra(?:r)? todo|dejalo|nada|no nada|no guardes|no lo guardes|mejor no)(?: nada| todo)?$/.test(p)) return 'cancelar';
  if (/^(?:para|callate|deja de escuchar|apagate|chau|cerra|cerrate|cerrar)$/.test(p)) return 'parar';
  return null;
}
const ORD: [RegExp, number][] = [[/\b(?:la|el|lo) primer[oa]?\b/, 0], [/\b(?:la|el) segund[oa]\b/, 1], [/\b(?:la|el) tercer[oa]?\b/, 2], [/\b(?:la|el) cuart[oa]\b/, 3], [/\b(?:la|el) ultim[oa]\b/, -1]];
/** Cambia lo que ya está en pantalla. Devuelve null si la frase no es una corrección. */
export function corregir(texto: string, lista: Accion[], d: Datos, pide: Falta | null, sobre = 0): Accion[] | null {
  if (!lista.length) return null;
  const t = texto.normalize('NFC').trim(), p = plano(t);
  const aviso = /^\W*(?:no\b|perdon|corrijo|corregi|mejor|cambia|cambialo|cambiale|pone|ponelo|ponele|en realidad|era|eran|es\b|son\b|fue|fueron|sacale|saca|borra|quita|agregale|que sea|quise decir|digo\b)/.test(p);
  const idx = ORD.find(([re]) => re.test(p))?.[1];
  // Sin decir cuál: la que nombra, o la que tiene un monto más parecido ("no, eran 15 mil" corrige los 14, no los 5)
  const cual = (): number => {
    if (pide) return sobre;
    if (lista.length === 1) return 0;
    const n = mejorTexto(t, lista.map((x, k) => ({ id: String(k), n: `${x.titulo} ${clienteDe(d, x.cliente_id)?.name || ''}` })).filter(x => x.n.trim())); if (n) return Number(n);
    const v = plata(t), m = lista.map((x, k) => ({ k, x })).filter(o => o.x.monto > 0);
    if (v && m.length) { const w = v.clase !== 'plata' && v.valor < 1000 ? v.valor * 1000 : v.valor; return m.sort((p1, p2) => Math.abs(Math.log(w / p1.x.monto)) - Math.abs(Math.log(w / p2.x.monto)))[0].k; }
    return lista.length - 1;
  };
  const i = idx == null ? cual() : idx < 0 ? lista.length - 1 : idx;
  const a0 = lista[i]; if (!a0) return null;
  if (aviso && /\b(?:borra|saca|quita|elimina)(?:la|lo)?\b/.test(p) && (idx != null || /^\W*(?:no )?(?:borra|saca|quita|elimina)(?:la|lo)?(?: es[eao])?\W*$/.test(p))) return lista.filter((_, k) => k !== i);
  if (!aviso) {
    const e = entender(t, d).acciones;
    // Respuesta corta a una pregunta, o un pedido nuevo
    if (e.length && (!pide || e.some(x => x.texto !== t || x.tipo !== 'plata' || /\b(?:gaste|pague|compre|entro|entraron|cobre|me pago|nos pago)\b/.test(p)))) return null;
    if (!pide && idx == null && !/\b(?:era|eran|es|son|fue|fueron|va|ponela|ponelo)\b/.test(p)) return null;
  }
  const a: Accion = { ...a0, fijo: [...a0.fijo] };
  let hizo = false;
  const hit = (c: string) => { if (!a.fijo.includes(c)) a.fijo.push(c); hizo = true; };
  if (pide?.campo === 'titulo' && !aviso) { const v = cap(a.tipo === 'mensaje' ? t : limpio(t) || t); if (a.tipo === 'mensaje') { a.detalle = v; hit('detalle'); } else { a.titulo = v; hit('titulo'); } return lista.map((x, k) => k === i ? a : x); }
  const tl = /\+?\d[\d\s.-]{6,}\d/.exec(t);
  if (tl && (pide?.campo === 'telefono' || ((a.tipo === 'cliente' || a.tipo === 'prospecto' || a.tipo === 'mensaje') && !plata(t)))) { a.telefono = tl[0]; hit('telefono'); }
  const n = plata(t) || (pide?.campo === 'monto' ? cantidades(t).filter(x => x.valor > 0).pop() || null : null);
  if (n && a.telefono !== tl?.[0] && ['plata', 'vencimiento', 'precio', 'acuerdo'].includes(a.tipo)) {
    // "eran 15" sobre 14.000 quiere decir 15 mil
    let v = n.valor; if (n.clase !== 'plata' && v < 1000 && a0.monto >= 1000 && a0.moneda === 'ARS') v *= 1000;
    a.monto = v; hit('monto'); if (n.moneda) { a.moneda = n.moneda; hit('moneda'); }
  } else if (/\b(?:dolares|verdes)\b/.test(p)) { a.moneda = 'USD'; hit('moneda'); } else if (/\bpesos\b/.test(p)) { a.moneda = 'ARS'; hit('moneda'); }
  const f = fecha(t, d.now, a.tipo === 'plata' || a.tipo === 'entrega' ? 'antes' : 'despues');
  if (f) { a.fecha = f.at; if (f.hora) a.hora = f.hora; hit('fecha'); }
  if (a.tipo === 'plata') {
    const K: [MoveKind, RegExp][] = [['inversion', /\binversion\b/], ['retiro', /\bretiro\b/], ['aporte', /\baporte\b/], ['ingreso', /\b(?:ingreso|entro|entrada)\b/], ['gasto', /\bgasto\b/]];
    const k = K.find(([, re]) => re.test(p)); if (k && k[0] !== a.clase) { a.clase = k[0]; a.categoria = ''; a.ref = ''; a.fondo = null; hit('clase'); }
    const cu = cuentaEn(t, d, a.moneda); if (cu) { a.cuenta = cu.v; hit('cuenta'); }
    const so = sobres(pide?.campo === 'fondo2' ? 'al sobre ' + t : t, d);
    if (pide?.campo === 'fondo2' && (so.a || so.de)) { a.fondo2 = so.a || so.de; hit('fondo2'); } else if (so.de || so.a) { a.fondo = so.de || so.a; hit('fondo'); }
    const ca = buscar(t, CATEGORIES[a.clase].filter(x => x !== 'Otro').map(x => ({ id: x, nombres: [x, x.split(' ')[0]] })), 0.88)[0];
    if (ca) { a.categoria = ca.id; hit('categoria'); }
  }
  if (a.tipo === 'tarea' && /\b(?:matias|mati|benja|benjamin)\b/.test(p)) { a.persona = /\bmati/.test(p) ? 'mati' : 'benja'; hit('persona'); }
  const en = pide?.campo === 'cliente' && a0.opciones.length ? { ...d, clients: d.clients.filter(c => a0.opciones.includes(c.id)) } : d;
  const c = clienteEn(t, en);
  if (c.id && c.id !== a0.cliente_id && a.tipo !== 'vencimiento' && a.tipo !== 'precio') { a.cliente_id = c.id; a.cliente_nuevo = ''; a.opciones = []; hit('cliente'); }
  else if (pide?.campo === 'cliente' && !c.id && !c.opciones.length && !hizo) { const v = limpio(t); if (v) { a.cliente_nuevo = cap(v); a.opciones = []; hit('cliente'); } }
  if (pide?.campo === 'ref') {
    const l = a.tipo === 'hecha' ? d.items.filter(x => !x.done_at).map(x => ({ id: 'item:' + x.id, n: x.title })) : a.tipo === 'precio' ? d.services.map(x => ({ id: 'serv:' + x.id, n: x.name }))
      : d.agreements.filter(x => x.status === 'firmado').flatMap(x => x.phases.filter(y => y.kind === 'fase' && !y.done_at).map(y => ({ id: `fase:${x.id}:${y.id}`, n: `${y.name} ${clienteDe(d, x.client_id)?.name || ''}` })));
    const m = mejorTexto(t, l); if (m) { a.ref = m; hit('ref'); }
  }
  const con = /\b(?:concepto|es por|fue por|era por|era para|fue en|titulo|se llama)\s+(.+)$/i.exec(t);
  if (con && !hizo) { a.titulo = cap(limpio(con[1])); hit('titulo'); }
  if (!hizo) return null;
  enganchar(a, d);
  return lista.map((x, k) => k === i ? a : x);
}
