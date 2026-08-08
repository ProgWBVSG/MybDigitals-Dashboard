// Motor de métricas y diagnóstico de contenido.
//
// Todo acá es derivado: se calcula a partir de los números crudos de Instagram
// Insights (`ContentMetric`) y nunca se guarda en la base, así los umbrales se
// pueden ajustar sin migrar datos.
//
// El orden de importancia de las señales sigue la lógica del algoritmo actual:
// compartidos > guardados > comentarios > likes. Un video con muchos likes y
// pocos compartidos no escala; uno con pocos likes y muchos compartidos sí.
import type { ContentMetric } from './utils';

export type Verdict = 'excelente' | 'bien' | 'flojo' | 'critico' | 'sin_datos';

export const VERDICT_COLOR: Record<Verdict, string> = {
  excelente: '#10b981', bien: '#84cc16', flojo: '#f59e0b', critico: '#ef4444', sin_datos: '#64748b',
};
export const VERDICT_LABEL: Record<Verdict, string> = {
  excelente: 'Excelente', bien: 'Bien', flojo: 'Flojo', critico: 'Crítico', sin_datos: 'Sin datos',
};

export interface MetricDef {
  key: string;
  label: string;
  short: string;
  unit: '%' | 's' | '';
  weight: number;          // peso en el score final (suma 100)
  good: number;            // umbral "bien"
  great: number;           // umbral "excelente"
  bad: number;             // por debajo = crítico
  why: string;             // por qué importa
  fix: string;             // qué hacer si está flojo
  compute: (m: ContentMetric) => number | null;
}

const pct = (num: number, den: number): number | null => (den > 0 ? (num / den) * 100 : null);

// Las 6 señales que definen si una pieza funcionó. Los pesos priorizan
// compartidos y retención porque son las que el algoritmo usa para escalar.
export const METRIC_DEFS: MetricDef[] = [
  {
    key: 'shareRate', label: 'Tasa de compartidos', short: 'Compartidos', unit: '%',
    weight: 30, good: 1, great: 2, bad: 0.3,
    why: 'Es la señal #1 del algoritmo. Compartir es el acto de mayor costo social: el que comparte pone su reputación. Un share vale más que 50 likes.',
    fix: 'El contenido tiene que ser "compartible": o valida algo que el otro ya piensa, o le da munición para una conversación. Preguntate: ¿por qué alguien le mandaría esto a un amigo?',
    compute: m => pct(m.shares, m.reach),
  },
  {
    key: 'retention', label: 'Retención promedio', short: 'Retención', unit: '%',
    weight: 25, good: 50, great: 70, bad: 30,
    why: 'Mide si el guion aguanta. La caída casi siempre pasa entre el segundo 3 y el 7, donde falta el re-hook.',
    fix: 'Meté un re-hook en el segundo 3-7 que suba la expectativa. Y acortá: si el valor llega después del segundo 12, llegás tarde.',
    compute: m => (m.retentionPct > 0 ? m.retentionPct : (m.durationSec > 0 && m.avgWatchSec > 0 ? pct(m.avgWatchSec, m.durationSec) : null)),
  },
  {
    key: 'nonFollowers', label: 'Alcance en no seguidores', short: 'No seguidores', unit: '%',
    weight: 15, good: 50, great: 70, bad: 25,
    why: 'Si es bajo, el algoritmo lo mostró casi solo a tu audiencia y no lo empujó afuera. Es el termómetro de si la pieza tiene potencial de crecer.',
    fix: 'Bajo alcance externo suele ser audience matching: si mezclás temas, el algoritmo no sabe a quién mostrarte. Mantené el nicho consistente varias piezas seguidas.',
    compute: m => (m.nonFollowersPct > 0 ? m.nonFollowersPct : null),
  },
  {
    key: 'saveRate', label: 'Tasa de guardados', short: 'Guardados', unit: '%',
    weight: 15, good: 1, great: 2, bad: 0.2,
    why: 'Guardar = "esto me va a servir después". Es la prueba de que hubo walkaway value real, no solo entretenimiento.',
    fix: 'Falta valor tangible. Dale algo que se pueda implementar hoy: un número, un paso concreto, una plantilla. Lo obvio no se guarda.',
    compute: m => pct(m.saves, m.reach),
  },
  {
    key: 'commentRate', label: 'Tasa de comentarios', short: 'Comentarios', unit: '%',
    weight: 10, good: 0.5, great: 1.5, bad: 0.1,
    why: 'Los comentarios extienden la vida del video y son la puerta al DM cuando el CTA pide una palabra clave.',
    fix: 'Tomá una posición clara en vez de neutral. El comentario nace de la fricción: acuerdo fuerte o desacuerdo fuerte. Un CTA de una sola palabra ayuda.',
    compute: m => pct(m.comments, m.reach),
  },
  {
    key: 'followerConv', label: 'Conversión a seguidor', short: 'Nuevos seguidores', unit: '%',
    weight: 5, good: 0.5, great: 1.5, bad: 0.05,
    why: 'Mide si la pieza hizo que el que la vio quiera más. Alcance sin seguidores nuevos es alcance que no capitalizás.',
    fix: 'El video se consumió solo. Dejá claro quién sos y qué más vas a enseñar — un loop al final o un CTA de seguir explícito.',
    compute: m => pct(m.newFollowers, m.reach),
  },
];

export const judge = (def: MetricDef, value: number | null): Verdict => {
  if (value === null) return 'sin_datos';
  if (value >= def.great) return 'excelente';
  if (value >= def.good) return 'bien';
  if (value >= def.bad) return 'flojo';
  return 'critico';
};

// Puntos 0-100 por métrica, escalados linealmente hasta el umbral "excelente".
const points = (def: MetricDef, value: number | null): number => {
  if (value === null) return 0;
  return Math.min(100, (value / def.great) * 100);
};

export interface MetricScore {
  def: MetricDef;
  value: number | null;
  verdict: Verdict;
  points: number;
}

export interface Diagnosis {
  score: number;                 // 0-100 ponderado, solo sobre métricas con datos
  scored: MetricScore[];
  engagementRate: number | null; // total de interacciones / alcance
  wins: MetricScore[];
  issues: MetricScore[];         // ordenados por impacto (peso × cuánto falta)
  missing: string[];             // métricas sin cargar
  summary: string;
}

export const diagnose = (m: ContentMetric): Diagnosis => {
  const scored: MetricScore[] = METRIC_DEFS.map(def => {
    const value = def.compute(m);
    return { def, value, verdict: judge(def, value), points: points(def, value) };
  });

  const withData = scored.filter(s => s.value !== null);
  const totalWeight = withData.reduce((sum, s) => sum + s.def.weight, 0);
  const score = totalWeight > 0
    ? Math.round(withData.reduce((sum, s) => sum + s.points * s.def.weight, 0) / totalWeight)
    : 0;

  const interactions = m.likes + m.comments + m.saves + m.shares;
  const engagementRate = pct(interactions, m.reach);

  const wins = withData.filter(s => s.verdict === 'excelente' || s.verdict === 'bien')
    .sort((a, b) => b.points - a.points);
  // Impacto = cuánto peso está desperdiciando esta métrica. Arreglar primero lo que más pesa.
  const issues = withData.filter(s => s.verdict === 'flojo' || s.verdict === 'critico')
    .sort((a, b) => (b.def.weight * (100 - b.points)) - (a.def.weight * (100 - a.points)));
  const missing = scored.filter(s => s.value === null).map(s => s.def.short);

  let summary: string;
  if (withData.length === 0) summary = 'Cargá al menos alcance y compartidos para poder analizar la pieza.';
  else if (score >= 75) summary = issues.length
    ? `Pieza fuerte (${score}/100). Lo único que le falta afinar es ${issues[0].def.short.toLowerCase()}.`
    : `Pieza fuerte (${score}/100). Replicá este formato y este ángulo.`;
  else if (score >= 50) summary = `Rendimiento medio (${score}/100). El cuello de botella está en ${issues[0]?.def.short.toLowerCase() || 'los datos que faltan'}.`;
  else if (issues.length) summary = `Rendimiento bajo (${score}/100). Arreglá primero ${issues[0].def.short.toLowerCase()}: es lo que más impacto tiene.`;
  else summary = `Rendimiento bajo (${score}/100).`;

  return { score, scored, engagementRate, wins, issues, missing, summary };
};

export const fmtMetric = (value: number | null, unit: string): string => {
  if (value === null) return '—';
  const dec = Math.abs(value) < 10 ? 2 : Math.abs(value) < 100 ? 1 : 0;
  return value.toFixed(dec) + unit;
};

export const fmtNum = (n: number): string =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  : n >= 1_000 ? (n / 1_000).toFixed(1).replace('.0', '') + 'k'
  : String(n);

// ─── ANÁLISIS AGREGADO (varias piezas) ───

export interface Trend { key: string; label: string; avg: number | null; best: number | null; unit: string; def: MetricDef }

export const aggregate = (metrics: ContentMetric[]): {
  count: number; avgScore: number; trends: Trend[];
  top: { m: ContentMetric; d: Diagnosis } | null;
  worst: { m: ContentMetric; d: Diagnosis } | null;
  advice: string[];
} => {
  const pairs = metrics.map(m => ({ m, d: diagnose(m) })).filter(p => p.d.scored.some(s => s.value !== null));
  if (!pairs.length) return { count: 0, avgScore: 0, trends: [], top: null, worst: null, advice: [] };

  const sorted = [...pairs].sort((a, b) => b.d.score - a.d.score);
  const avgScore = Math.round(pairs.reduce((s, p) => s + p.d.score, 0) / pairs.length);

  const trends: Trend[] = METRIC_DEFS.map(def => {
    const vals = pairs.map(p => def.compute(p.m)).filter((v): v is number => v !== null);
    return {
      key: def.key, label: def.short, unit: def.unit, def,
      avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
      best: vals.length ? Math.max(...vals) : null,
    };
  });

  // Consejos sobre el conjunto: qué métrica falla de forma sistemática, no en una sola pieza.
  const advice: string[] = [];
  for (const t of trends) {
    if (t.avg === null) continue;
    const v = judge(t.def, t.avg);
    if (v === 'critico' || v === 'flojo') {
      advice.push(`${t.def.label} viene bajo en promedio (${fmtMetric(t.avg, t.unit)}). ${t.def.fix}`);
    }
  }
  if (!advice.length) advice.push('Ninguna métrica viene fallando de forma sistemática. Subí el volumen de publicación manteniendo el nicho.');

  return { count: pairs.length, avgScore, trends, top: sorted[0], worst: sorted[sorted.length - 1], advice: advice.slice(0, 4) };
};
