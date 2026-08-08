// Guion estructurado por fases (Hook / Desarrollo / CTA / Otro), con nota de
// visual/edición y duración en segundos por bloque. Se guarda serializado en
// `content_posts.content` (mismo campo de texto que ya usaban Generador/Tabla/Guiones,
// sin migrar la tabla) — así Pipeline/Tabla/Calendario siguen leyendo el mismo campo,
// y las piezas viejas en texto plano se siguen abriendo (se envuelven en un bloque "Otro").
import { uuid } from './utils';

export type ScriptPhase = 'hook' | 'rehook' | 'desarrollo' | 'cta' | 'otro';

// Una toma = un fragmento que se graba de corrido. Un bloque largo se parte en
// varias tomas para no tener que decirlo todo seguido; después se unen en edición.
export interface ScriptTake { id: string; text: string; done: boolean }
export interface ScriptBlock {
  id: string; phase: ScriptPhase; text: string; seconds: number; visual: string;
  takes: ScriptTake[]; // vacío = se graba de una sola toma usando `text`
}

export const SCRIPT_PHASES: ScriptPhase[] = ['hook', 'rehook', 'desarrollo', 'cta', 'otro'];
export const SCRIPT_PHASE_LABELS: Record<ScriptPhase, string> = {
  hook: 'Hook', rehook: 'Re-hook', desarrollo: 'Desarrollo', cta: 'CTA', otro: 'Otro',
};
export const SCRIPT_PHASE_COLORS: Record<ScriptPhase, string> = {
  hook: '#f9587a', rehook: '#f59e0b', desarrollo: '#6366f1', cta: '#10b981', otro: '#64748b',
};
// Segundos sugeridos por fase (Kallaway: hook 0-3s, re-hook 3-7s, valor <12s).
export const SCRIPT_PHASE_HINT: Record<ScriptPhase, string> = {
  hook: 'Primeros 3s. Verbal + visual + texto en pantalla deben decir lo MISMO.',
  rehook: 'Segundos 3-7. El puente que evita la caída de retención. Casi nadie lo hace.',
  desarrollo: 'El valor concreto. Explicá el punto central dos veces (regla + ejemplo).',
  cta: 'Un solo pedido claro. Comentario / DM / seguir. Nunca tres a la vez.',
  otro: 'Bloque libre.',
};

const MARK = 'MYB_SCRIPT_V2';
const MARK_V1 = 'MYB_SCRIPT_V1';

export const emptyScript = (): ScriptBlock[] => [
  { id: uuid(), phase: 'hook', text: '', seconds: 3, visual: '', takes: [] },
  { id: uuid(), phase: 'rehook', text: '', seconds: 4, visual: '', takes: [] },
  { id: uuid(), phase: 'desarrollo', text: '', seconds: 20, visual: '', takes: [] },
  { id: uuid(), phase: 'cta', text: '', seconds: 5, visual: '', takes: [] },
];

export const encodeScript = (blocks: ScriptBlock[]): string => JSON.stringify({ mark: MARK, blocks });

export const isStructuredScript = (content: string): boolean => {
  if (!content || content[0] !== '{') return false;
  try { const m = JSON.parse(content)?.mark; return m === MARK || m === MARK_V1; } catch { return false; }
};

// Piezas viejas (texto plano de Generador/Tabla/Guiones) se envuelven en un único
// bloque "Otro". Los guiones V1 (sin `takes`) se completan con takes vacío.
export const decodeScript = (content: string): ScriptBlock[] => {
  if (isStructuredScript(content)) {
    try {
      const blocks = JSON.parse(content).blocks || [];
      return blocks.map((b: Partial<ScriptBlock>) => ({
        id: b.id || uuid(), phase: b.phase || 'otro', text: b.text || '',
        seconds: b.seconds ?? 0, visual: b.visual || '', takes: b.takes || [],
      }));
    } catch { /* noop */ }
  }
  return content ? [{ id: uuid(), phase: 'otro', text: content, seconds: 0, visual: '', takes: [] }] : emptyScript();
};

// Preview corta para tarjetas de Pipeline y la columna "Hook" de Tabla.
export const scriptPreview = (content: string): string => {
  const blocks = decodeScript(content);
  const hook = blocks.find(b => b.phase === 'hook')?.text || blocks.find(b => b.text)?.text || '';
  return hook.trim();
};

export const totalSeconds = (blocks: ScriptBlock[]): number => blocks.reduce((s, b) => s + (b.seconds || 0), 0);

// ─── PARTIR EN TOMAS ───
// Corta el texto en fragmentos hablables: primero por oración, y si una oración
// pasa MAX_WORDS la sigue partiendo en las pausas naturales (; : , — y luego
// conectores). Así cada toma se puede decir de corrido sin trabarse.
const MAX_WORDS = 14;
const CONNECTORS = /\s+(?=(?:pero|porque|entonces|además|aunque|mientras|cuando|si|y|o|para|que|donde)\s)/i;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const splitLong = (s: string): string[] => {
  if (words(s) <= MAX_WORDS) return [s.trim()];
  // Cortar en la pausa más cercana al medio para que las tomas queden parejas.
  const marks = [...s.matchAll(/[;:,—–]\s+/g)].map(m => (m.index ?? 0) + m[0].length);
  const mid = s.length / 2;
  const cut = marks.length
    ? marks.reduce((best, i) => Math.abs(i - mid) < Math.abs(best - mid) ? i : best, marks[0])
    : (s.search(CONNECTORS) > 0 ? s.search(CONNECTORS) : -1);
  if (cut <= 0 || cut >= s.length) {
    // Sin pausas: cortar por cantidad de palabras.
    const w = s.trim().split(/\s+/);
    const out: string[] = [];
    for (let i = 0; i < w.length; i += MAX_WORDS) out.push(w.slice(i, i + MAX_WORDS).join(' '));
    return out;
  }
  return [...splitLong(s.slice(0, cut)), ...splitLong(s.slice(cut))];
};

export const splitIntoTakes = (text: string): ScriptTake[] => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?…]+[.!?…]*/g) || [clean];
  return sentences
    .flatMap(s => splitLong(s))
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => ({ id: uuid(), text: t, done: false }));
};

// Tomas efectivas de un bloque: las explícitas, o el texto completo como toma única.
export const blockTakes = (b: ScriptBlock): ScriptTake[] =>
  b.takes.length ? b.takes : (b.text.trim() ? [{ id: b.id + '_solo', text: b.text.trim(), done: false }] : []);

// Progreso de grabación sobre todo el guion (solo cuenta tomas explícitas).
export const takeProgress = (blocks: ScriptBlock[]): { done: number; total: number } => {
  const all = blocks.flatMap(b => b.takes);
  return { done: all.filter(t => t.done).length, total: all.length };
};

// ─── TEXTO PARA COMPARTIR ───
// Arma la pieza completa como texto plano para mandar por WhatsApp a quien graba
// o al cliente. Sin markdown (WhatsApp no lo renderiza en todos lados): emoji
// como separadores, tomas numeradas, y el link de referencia al final para que
// quede como preview del mensaje.
const PHASE_ICON: Record<ScriptPhase, string> = {
  hook: '🎣', rehook: '🌉', desarrollo: '▶️', cta: '📢', otro: '·',
};

export interface SharePiece {
  title?: string; angleLabel?: string; formatLabel?: string;
  howToRecord?: string; cta?: string; caption?: string;
  hashtags?: string; refLink?: string;
}

export const scriptForShare = (blocks: ScriptBlock[], p: SharePiece = {}): string => {
  const out: string[] = [];
  const sep = '━━━━━━━━━━━━━━━';

  const head = [p.angleLabel, p.formatLabel, `${totalSeconds(blocks)}s`].filter(Boolean).join(' · ');
  if (p.title) out.push(`🎬 ${p.title.toUpperCase()}`);
  if (head) out.push(head);

  const written = blocks.filter(b => b.text.trim() || b.visual.trim());
  if (written.length) {
    out.push('', sep, 'GUION', sep);
    for (const b of written) {
      const label = `${PHASE_ICON[b.phase]} ${SCRIPT_PHASE_LABELS[b.phase].toUpperCase()}${b.seconds ? ` (${b.seconds}s)` : ''}`;
      out.push('', label);
      // Con tomas explícitas se numeran, para que se sepa que va cortado por partes.
      if (b.takes.length > 1) {
        b.takes.forEach((t, i) => t.text.trim() && out.push(`  ${i + 1}. ${t.text.trim()}`));
      } else if (b.text.trim()) {
        out.push(b.text.trim());
      }
      if (b.visual.trim()) out.push(`🎥 ${b.visual.trim()}`);
    }
  }

  if (p.howToRecord?.trim()) out.push('', sep, 'CÓMO GRABARLO', sep, p.howToRecord.trim());
  if (p.cta?.trim()) out.push('', sep, 'CTA', sep, p.cta.trim());
  if (p.caption?.trim()) out.push('', sep, 'COPY', sep, p.caption.trim());
  if (p.hashtags?.trim()) out.push('', p.hashtags.trim());
  // El link va último: WhatsApp usa el último link del mensaje para la preview.
  if (p.refLink?.trim()) out.push('', sep, 'REEL DE REFERENCIA', sep, p.refLink.trim());

  return out.join('\n');
};
