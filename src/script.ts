// Guion estructurado por fases (Hook / Desarrollo / CTA / Otro), con nota de
// visual/edición y duración en segundos por bloque. Se guarda serializado en
// `content_posts.content` (mismo campo de texto que ya usaban Generador/Tabla/Guiones,
// sin migrar la tabla) — así Pipeline/Tabla/Calendario siguen leyendo el mismo campo,
// y las piezas viejas en texto plano se siguen abriendo (se envuelven en un bloque "Otro").
import { uuid } from './utils';

export type ScriptPhase = 'hook' | 'desarrollo' | 'cta' | 'otro';
export interface ScriptBlock { id: string; phase: ScriptPhase; text: string; seconds: number; visual: string }

export const SCRIPT_PHASES: ScriptPhase[] = ['hook', 'desarrollo', 'cta', 'otro'];
export const SCRIPT_PHASE_LABELS: Record<ScriptPhase, string> = { hook: 'Hook', desarrollo: 'Desarrollo', cta: 'CTA', otro: 'Otro' };
export const SCRIPT_PHASE_COLORS: Record<ScriptPhase, string> = { hook: '#f9587a', desarrollo: '#6366f1', cta: '#10b981', otro: '#64748b' };

const MARK = 'MYB_SCRIPT_V1';

export const emptyScript = (): ScriptBlock[] => [
  { id: uuid(), phase: 'hook', text: '', seconds: 3, visual: '' },
  { id: uuid(), phase: 'desarrollo', text: '', seconds: 20, visual: '' },
  { id: uuid(), phase: 'cta', text: '', seconds: 5, visual: '' },
];

export const encodeScript = (blocks: ScriptBlock[]): string => JSON.stringify({ mark: MARK, blocks });

export const isStructuredScript = (content: string): boolean => {
  if (!content || content[0] !== '{') return false;
  try { return JSON.parse(content)?.mark === MARK; } catch { return false; }
};

// Piezas viejas (texto plano de Generador/Tabla/Guiones) se envuelven en un único
// bloque "Otro" para no perder nada al abrirlas en el nuevo editor.
export const decodeScript = (content: string): ScriptBlock[] => {
  if (isStructuredScript(content)) {
    try { return JSON.parse(content).blocks || []; } catch { /* noop */ }
  }
  return content ? [{ id: uuid(), phase: 'otro', text: content, seconds: 0, visual: '' }] : emptyScript();
};

// Preview corta para tarjetas de Pipeline y la columna "Hook" de Tabla.
export const scriptPreview = (content: string): string => {
  const blocks = decodeScript(content);
  const hook = blocks.find(b => b.phase === 'hook')?.text || blocks.find(b => b.text)?.text || '';
  return hook.trim();
};

export const totalSeconds = (blocks: ScriptBlock[]): number => blocks.reduce((s, b) => s + (b.seconds || 0), 0);
