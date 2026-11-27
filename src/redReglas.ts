// Red de contactos: prospectos, clientes y empresas como un mapa, con MYB en el centro.
// Reglas puras (sin React) para poder probarlas: quién es cada nodo, qué tan fuerte es la relación y dónde se dibuja.
import type { Row } from './base';
import { HEALTH, isLive, type ClientRow, type ClientView } from './negocio';

/** Lo que se anota en la red, guardado dentro de la misma fila del prospecto o del cliente. */
export type Red = { rol?: string; empresa?: string; via?: string; por?: string; perfil?: string };
export interface Empresa extends Row { name: string; rubro?: string; notes?: string }
export interface ProspectoR extends Row { name: string; business: string; source: string; stage: string; contact?: { whatsapp?: string }; client_id?: string | null; meeting_at?: number | null; red?: Red }
export type ClienteR = ClientRow & { red?: Red };

export type Nivel = 'activo' | 'compro' | 'seguimiento' | 'hablado' | 'nuevo' | 'perdido';
// r: distancia al centro. Más cerca y más grueso = relación más fuerte.
export const NIVEL: Record<Nivel, { label: string; r: number; w: number; dash: string; op: number; size: number }> = {
  activo: { label: 'Sigue con nosotros', r: 130, w: 3.2, dash: '', op: 1, size: 16 },
  compro: { label: 'Ya compró', r: 200, w: 2.2, dash: '', op: .7, size: 14 },
  seguimiento: { label: 'En seguimiento', r: 270, w: 1.8, dash: '7 5', op: .75, size: 12.5 },
  hablado: { label: 'Le hablamos', r: 330, w: 1.3, dash: '3 5', op: .6, size: 11 },
  nuevo: { label: 'Sin hablar', r: 390, w: 1, dash: '1 6', op: .45, size: 10 },
  perdido: { label: 'No avanzó', r: 450, w: .9, dash: '1 7', op: .22, size: 9 },
};
export const NIVELES = Object.keys(NIVEL) as Nivel[];
/** Qué etapa de Pre-venta pone cada botón de relación (sólo prospectos). */
export const ETAPA_DE: Partial<Record<Nivel, string>> = { nuevo: 'prospeccion', hablado: 'contacto', seguimiento: 'calificacion', compro: 'ganado', perdido: 'perdido' };
export const nivelDeEtapa = (s: string): Nivel => s === 'ganado' ? 'compro' : s === 'perdido' ? 'perdido' : s === 'contacto' ? 'hablado' : s === 'prospeccion' || !s ? 'nuevo' : 'seguimiento';

export const VIAS: [string, string][] = [['referido', 'Lo recomendó alguien'], ['instagram', 'Instagram'], ['whatsapp', 'WhatsApp'], ['web', 'Web'], ['frio', 'Salimos a buscarlo'], ['evento', 'Evento'], ['otro', 'Otro']];
export const viaLabel = (v?: string) => VIAS.find(x => x[0] === v)?.[1] || '';
/** Lo que se escribió a mano en "¿De dónde salió?" → un origen de la lista. */
export function adivinarVia(src = ''): string {
  const s = src.toLowerCase();
  return /refer|recomend|amig|conocid/.test(s) ? 'referido' : /insta|\big\b|reel/.test(s) ? 'instagram' : /whats|wsp|wpp/.test(s) ? 'whatsapp' : /web|google|pagina|página|landing/.test(s) ? 'web'
    : /fr[ií]o|calle|puerta|visita|buscar|mapa/.test(s) ? 'frio' : /evento|feria|charla/.test(s) ? 'evento' : s.trim() ? 'otro' : '';
}

export type Nodo = {
  id: string; kind: 'yo' | 'persona' | 'empresa'; name: string; sub: string; nivel: Nivel; hot: string;
  red: Red; via: string; por: string; tel: string; empresaId: string;
  cliente?: ClienteR; prospecto?: ProspectoR; vista?: ClientView; empresa?: Empresa;
};
export type Linea = { a: string; b: string; kind: 'rel' | 'ref' | 'emp'; nivel: Nivel };
export type Grafo = { nodos: Nodo[]; lineas: Linea[]; byId: Map<string, Nodo> };

const DAY = 86400000;
const norm = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const mismaEmpresa = (a: string, b: string) => norm(a) === norm(b);

export function armarGrafo(prospectos: ProspectoR[], clientes: ClienteR[], vistas: Map<string, ClientView>, empresas: Empresa[], now = Date.now()): Grafo {
  const nodos: Nodo[] = [{ id: 'yo', kind: 'yo', name: 'MYB', sub: 'Nosotros', nivel: 'activo', hot: '', red: {}, via: '', por: '', tel: '', empresaId: '' }];
  const cid = new Set(clientes.map(c => c.id));
  const alias = new Map<string, string>(); // p:<id> de un prospecto que ya es cliente → c:<id>
  for (const c of clientes) {
    const p = prospectos.find(x => x.client_id === c.id);
    if (p) alias.set('p:' + p.id, 'c:' + c.id);
    const v = vistas.get(c.id), red = { ...p?.red, ...c.red };
    const live = !!v?.agreements.some(isLive) && v.health !== 'terminado';
    nodos.push({
      id: 'c:' + c.id, kind: 'persona', name: c.name || 'Sin nombre', sub: red.rol || p?.business || '', nivel: live ? 'activo' : 'compro',
      hot: v && HEALTH[v.health].hot ? v.why : '', red, via: red.via || adivinarVia(p?.source), por: red.por || '', tel: c.contact?.whatsapp || p?.contact?.whatsapp || '', empresaId: red.empresa || '', cliente: c, prospecto: p, vista: v,
    });
  }
  for (const p of prospectos) {
    if (p.client_id && cid.has(p.client_id)) continue;
    const red = p.red || {}, nivel = nivelDeEtapa(p.stage);
    const quiet = Math.floor((now - Number(p.updated_at || p.created_at || now)) / DAY);
    const meet = p.meeting_at && p.meeting_at > now - 12 * 3600000 && p.meeting_at < now + 36 * 3600000;
    const hot = meet ? 'Tiene reunión ' + (new Date(p.meeting_at!).toDateString() === new Date(now).toDateString() ? 'hoy' : 'mañana')
      : (nivel === 'hablado' || nivel === 'seguimiento') && quiet >= 7 ? `Hace ${quiet} días sin novedades: escribile` : '';
    nodos.push({ id: 'p:' + p.id, kind: 'persona', name: p.name || 'Sin nombre', sub: red.rol || p.business || '', nivel, hot, red, via: red.via || adivinarVia(p.source), por: red.por || '', tel: p.contact?.whatsapp || '', empresaId: red.empresa || '', prospecto: p });
  }
  const eid = new Set(empresas.map(e => e.id));
  for (const e of empresas) nodos.push({ id: 'e:' + e.id, kind: 'empresa', name: e.name || 'Empresa', sub: e.rubro || '', nivel: 'nuevo', hot: '', red: {}, via: '', por: '', tel: '', empresaId: '', empresa: e });
  const byId = new Map(nodos.map(n => [n.id, n]));
  const ref = (n: Nodo) => { const r = alias.get(n.por) || n.por; return n.via === 'referido' && r !== n.id && byId.get(r)?.kind === 'persona' ? r : ''; };
  for (const n of nodos) if (n.kind === 'persona') { n.por = ref(n); if (!eid.has(n.empresaId)) n.empresaId = ''; }
  // Una cadena de recomendaciones que vuelve sobre sí misma se corta: esa persona cuelga del centro.
  for (const n of nodos) {
    const seen = new Set([n.id]);
    for (let x = n.por; x; x = byId.get(x)!.por) { if (seen.has(x)) { n.por = ''; break; } seen.add(x); }
  }
  const lineas: Linea[] = [];
  const conGente = new Map<string, Nivel>();
  for (const n of nodos) {
    if (n.kind !== 'persona') continue;
    lineas.push({ a: n.por || 'yo', b: n.id, kind: n.por ? 'ref' : 'rel', nivel: n.nivel });
    if (n.empresaId) {
      lineas.push({ a: 'e:' + n.empresaId, b: n.id, kind: 'emp', nivel: n.nivel });
      const k = 'e:' + n.empresaId, prev = conGente.get(k);
      if (!prev || NIVEL[n.nivel].r < NIVEL[prev].r) conGente.set(k, n.nivel);
    }
  }
  for (const n of nodos) if (n.kind === 'empresa') { n.nivel = conGente.get(n.id) || 'nuevo'; if (!conGente.has(n.id)) lineas.push({ a: 'yo', b: n.id, kind: 'emp', nivel: 'nuevo' }); }
  return { nodos, lineas, byId };
}

/** Recomendados por una persona. */
export const trajo = (g: Grafo, id: string) => g.nodos.filter(n => n.por === id);

// ─── Dónde va cada uno: fuerzas simples, MYB fijo en el centro ───
export type Pos = Map<string, { x: number; y: number }>;
const seed = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return ((h >>> 0) % 3600) / 3600 * Math.PI * 2; };

export function ubicar(g: Grafo, prev?: Pos, ticks = prev?.size ? 90 : 320): Pos {
  const N = g.nodos, idx = new Map(N.map((n, i) => [n.id, i]));
  const X = new Float64Array(N.length), Y = new Float64Array(N.length);
  N.forEach((n, i) => {
    const p = prev?.get(n.id);
    if (p) { X[i] = p.x; Y[i] = p.y; return; }
    const par = n.por ? prev?.get(n.por) : undefined, a = seed(n.id), r = n.kind === 'yo' ? 0 : NIVEL[n.nivel].r;
    X[i] = par ? par.x + Math.cos(a) * 60 : Math.cos(a) * r; Y[i] = par ? par.y + Math.sin(a) * 60 : Math.sin(a) * r;
  });
  const L = g.lineas.map(l => ({ a: idx.get(l.a)!, b: idx.get(l.b)!, len: l.kind === 'rel' ? NIVEL[l.nivel].r : l.kind === 'ref' ? 85 : 62, k: l.kind === 'rel' ? .02 : .08 }));
  for (let t = 0; t < ticks; t++) {
    const alpha = 1 - t / ticks, VX = new Float64Array(N.length), VY = new Float64Array(N.length);
    for (let i = 1; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
      let dx = X[i] - X[j], dy = Y[i] - Y[j], d2 = dx * dx + dy * dy;
      if (d2 < 1) { dx = Math.random() - .5; dy = Math.random() - .5; d2 = 1; }
      if (d2 > 90000) continue;
      const f = Math.min(2200 / d2, 8), d = Math.sqrt(d2);
      VX[i] += dx / d * f; VY[i] += dy / d * f; VX[j] -= dx / d * f; VY[j] -= dy / d * f;
    }
    for (const l of L) {
      const dx = X[l.b] - X[l.a], dy = Y[l.b] - Y[l.a], d = Math.hypot(dx, dy) || 1, f = (d - l.len) * l.k;
      VX[l.a] += dx / d * f; VY[l.a] += dy / d * f; VX[l.b] -= dx / d * f; VY[l.b] -= dy / d * f;
    }
    for (let i = 1; i < N.length; i++) {
      const n = N[i], d = Math.hypot(X[i], Y[i]) || 1, want = NIVEL[n.nivel].r * (n.kind === 'empresa' ? .9 : 1), f = (d - want) * (n.por ? .006 : .03);
      VX[i] -= X[i] / d * f; VY[i] -= Y[i] / d * f;
      X[i] += Math.max(-30, Math.min(30, VX[i] * alpha)); Y[i] += Math.max(-30, Math.min(30, VY[i] * alpha));
    }
    X[0] = 0; Y[0] = 0;
  }
  return new Map(N.map((n, i) => [n.id, { x: Math.round(X[i] * 10) / 10, y: Math.round(Y[i] * 10) / 10 }]));
}

export const iniciales = (s: string) => s.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '·';
export const buscar = (n: Nodo, q: string) => norm([n.name, n.sub, n.red.perfil, n.prospecto?.business].join(' ')).includes(norm(q));
