// Métricas de rendimiento y diagnóstico.
//
// Se cargan los números crudos que da Instagram Insights y el motor de metrics.ts
// devuelve un score ponderado, qué funcionó, qué falló y qué hacer al respecto —
// ordenado por impacto, no por orden de aparición.
import { useState, useMemo } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { useContent } from './hooks';
import { type ContentMetric, type ContentPost } from './utils';
import {
  METRIC_DEFS, diagnose, aggregate, fmtMetric, fmtNum, VERDICT_COLOR, VERDICT_LABEL,
  type Diagnosis, type MetricScore,
} from './content-metrics';

const NUM_FIELDS: { key: keyof ContentMetric; label: string; group: string; hint?: string }[] = [
  { key: 'views', label: 'Reproducciones', group: 'Alcance' },
  { key: 'reach', label: 'Alcance (cuentas)', group: 'Alcance', hint: 'Personas únicas. Es la base de casi todos los cálculos.' },
  { key: 'impressions', label: 'Impresiones', group: 'Alcance' },
  { key: 'nonFollowersPct', label: '% no seguidores', group: 'Alcance' },
  { key: 'likes', label: 'Likes', group: 'Interacción' },
  { key: 'saves', label: 'Guardados', group: 'Interacción' },
  { key: 'shares', label: 'Compartidos', group: 'Interacción', hint: 'La señal más importante del algoritmo.' },
  { key: 'comments', label: 'Comentarios', group: 'Interacción' },
  { key: 'newFollowers', label: 'Nuevos seguidores', group: 'Interacción' },
  { key: 'retentionPct', label: 'Retención %', group: 'Retención' },
  { key: 'avgWatchSec', label: 'Tiempo visto (seg)', group: 'Retención' },
  { key: 'durationSec', label: 'Duración total (seg)', group: 'Retención', hint: 'Si cargás esto y el tiempo visto, la retención se calcula sola.' },
];

function MetricForm({ initial, posts, onSave, onClose }: {
  initial?: Partial<ContentMetric>; posts: ContentPost[];
  onSave: (m: Partial<ContentMetric>) => void; onClose: () => void;
}) {
  const [f, setF] = useState<Partial<ContentMetric>>({
    title: '', postId: null, publishedAt: Date.now(),
    views: 0, reach: 0, impressions: 0, nonFollowersPct: 0,
    likes: 0, saves: 0, shares: 0, comments: 0, newFollowers: 0,
    retentionPct: 0, avgWatchSec: 0, durationSec: 0, notes: '', ...initial,
  });
  const num = (k: keyof ContentMetric) => (f[k] as number) ?? 0;
  const setNum = (k: keyof ContentMetric, v: string) => setF({ ...f, [k]: Math.max(0, +v || 0) });
  const live = useMemo(() => diagnose(f as ContentMetric), [f]);
  const groups = [...new Set(NUM_FIELDS.map(x => x.group))];

  const save = () => {
    if (!(f.title || '').trim() && !f.postId) return;
    const title = (f.title || '').trim() || posts.find(p => p.id === f.postId)?.title || 'Sin título';
    onSave({ ...f, title });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal met-modal" onClick={e => e.stopPropagation()}>
        <h2>{initial?.id ? 'Editar métricas' : 'Cargar métricas'}</h2>
        <div className="met-form-cols">
          <div className="met-form-fields">
            <div className="ig-form">
              <label>Pieza publicada
                <select className="select" value={f.postId || ''} onChange={e => {
                  const id = e.target.value || null;
                  const p = posts.find(x => x.id === id);
                  setF({ ...f, postId: id, title: p?.title || f.title });
                }}>
                  <option value="">— Cargar a mano —</option>
                  {posts.map(p => <option key={p.id} value={p.id}>{p.title || 'Sin título'}</option>)}
                </select>
              </label>
              <label>Título / tema<input className="input" value={f.title || ''} onChange={e => setF({ ...f, title: e.target.value })} /></label>
              <label>Fecha de publicación
                <input className="input" type="date" value={f.publishedAt ? new Date(f.publishedAt).toISOString().split('T')[0] : ''}
                  onChange={e => setF({ ...f, publishedAt: e.target.value ? new Date(e.target.value + 'T12:00').getTime() : null })} />
              </label>
            </div>
            {groups.map(g => (
              <div key={g} className="met-group">
                <p className="met-group-title">{g}</p>
                <div className="met-grid">
                  {NUM_FIELDS.filter(x => x.group === g).map(x => (
                    <label key={String(x.key)} title={x.hint}>
                      {x.label}
                      <input className="input" type="number" min={0} value={num(x.key)} onChange={e => setNum(x.key, e.target.value)} />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="ig-form">
              <label>Notas / aprendizajes
                <textarea className="input" rows={3} placeholder="Qué probaste y qué notaste…" value={f.notes || ''} onChange={e => setF({ ...f, notes: e.target.value })} />
              </label>
            </div>
          </div>

          <div className="met-live">
            <div className="met-score-big" style={{ borderColor: live.score >= 75 ? '#10b981' : live.score >= 50 ? '#f59e0b' : '#ef4444' }}>
              <strong>{live.score}</strong><span>/ 100</span>
            </div>
            <p className="met-live-summary">{live.summary}</p>
            <div className="met-live-list">
              {live.scored.map(s => (
                <div key={s.def.key} className="met-live-row">
                  <span className="met-live-dot" style={{ background: VERDICT_COLOR[s.verdict] }} />
                  <span className="met-live-label">{s.def.short}</span>
                  <span className="met-live-val" style={{ color: VERDICT_COLOR[s.verdict] }}>{fmtMetric(s.value, s.def.unit)}</span>
                </div>
              ))}
            </div>
            {live.engagementRate !== null && (
              <p className="met-live-eng">Engagement total: <b>{fmtMetric(live.engagementRate, '%')}</b></p>
            )}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>{initial?.id ? 'Guardar' : 'Cargar'}</button>
        </div>
      </div>
    </div>
  );
}

function DiagnosisPanel({ m, d, onClose }: { m: ContentMetric; d: Diagnosis; onClose: () => void }) {
  const Row = ({ s, kind }: { s: MetricScore; kind: 'win' | 'issue' }) => (
    <div className={`met-diag-row ${kind}`}>
      <div className="met-diag-row-head">
        <span className="met-diag-name">{s.def.label}</span>
        <span className="met-diag-badge" style={{ background: VERDICT_COLOR[s.verdict] }}>
          {fmtMetric(s.value, s.def.unit)} · {VERDICT_LABEL[s.verdict]}
        </span>
      </div>
      <p className="met-diag-why">{s.def.why}</p>
      {kind === 'issue' && <p className="met-diag-fix"><b>Qué hacer:</b> {s.def.fix}</p>}
      {kind === 'issue' && (
        <p className="met-diag-target">
          Objetivo: {fmtMetric(s.def.good, s.def.unit)} para estar bien · {fmtMetric(s.def.great, s.def.unit)} para destacar.
        </p>
      )}
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal met-diag" onClick={e => e.stopPropagation()}>
        <div className="met-diag-head">
          <div>
            <p className="ig-eyebrow">Diagnóstico</p>
            <h2>{m.title}</h2>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="met-diag-top">
          <div className="met-score-big" style={{ borderColor: d.score >= 75 ? '#10b981' : d.score >= 50 ? '#f59e0b' : '#ef4444' }}>
            <strong>{d.score}</strong><span>/ 100</span>
          </div>
          <div className="met-diag-raw">
            <p>{d.summary}</p>
            <div className="met-diag-raw-nums">
              <span>{fmtNum(m.reach)} alcance</span>
              <span>{fmtNum(m.shares)} compartidos</span>
              <span>{fmtNum(m.saves)} guardados</span>
              <span>{fmtNum(m.comments)} comentarios</span>
              {d.engagementRate !== null && <span>{fmtMetric(d.engagementRate, '%')} engagement</span>}
            </div>
          </div>
        </div>

        {d.issues.length > 0 && (
          <div className="met-diag-section">
            <h4><AlertCircle size={15} /> A mejorar <em>(ordenado por impacto)</em></h4>
            {d.issues.map(s => <Row key={s.def.key} s={s} kind="issue" />)}
          </div>
        )}
        {d.wins.length > 0 && (
          <div className="met-diag-section">
            <h4><CheckCircle2 size={15} /> Lo que funcionó</h4>
            {d.wins.map(s => <Row key={s.def.key} s={s} kind="win" />)}
          </div>
        )}
        {d.missing.length > 0 && (
          <div className="ig-notice">Sin datos: {d.missing.join(', ')}. Cargalos para que el score sea más preciso.</div>
        )}
        {m.notes && <div className="met-diag-notes"><b>Tus notas:</b> {m.notes}</div>}
      </div>
    </div>
  );
}

export default function Metricas({ c }: { c: ReturnType<typeof useContent> }) {
  const [form, setForm] = useState<Partial<ContentMetric> | null>(null);
  const [detail, setDetail] = useState<ContentMetric | null>(null);

  const rows = useMemo(() => c.metrics.map(m => ({ m, d: diagnose(m) })), [c.metrics]);
  const agg = useMemo(() => aggregate(c.metrics), [c.metrics]);
  const chart = useMemo(() =>
    [...rows].reverse().slice(-12).map(({ m, d }) => ({
      name: (m.title || '').slice(0, 18), score: d.score,
    })), [rows]);

  return (
    <div className="ig-card">
      <div className="ig-card-head">
        <div><p className="ig-eyebrow">Rendimiento</p><h3>Métricas y diagnóstico</h3></div>
        <button className="btn btn-primary btn-sm" onClick={() => setForm({})}><Plus size={14} /> Cargar métricas</button>
      </div>

      {agg.count === 0 ? (
        <div className="ig-empty">
          <p>Todavía no cargaste métricas.</p>
          <p className="ig-empty-sub">Cargá los números de Insights de cada pieza y te digo qué funcionó, qué no, y qué cambiar.</p>
        </div>
      ) : (
        <>
          <div className="met-summary">
            <div className="met-kpi">
              <span>Score promedio</span>
              <strong style={{ color: agg.avgScore >= 75 ? '#10b981' : agg.avgScore >= 50 ? '#f59e0b' : '#ef4444' }}>{agg.avgScore}</strong>
              <em>{agg.count} piezas medidas</em>
            </div>
            {agg.top && (
              <div className="met-kpi">
                <span><TrendingUp size={13} /> Mejor pieza</span>
                <strong className="met-kpi-title">{agg.top.m.title}</strong>
                <em>Score {agg.top.d.score}</em>
              </div>
            )}
            {agg.worst && agg.count > 1 && (
              <div className="met-kpi">
                <span><TrendingDown size={13} /> Más floja</span>
                <strong className="met-kpi-title">{agg.worst.m.title}</strong>
                <em>Score {agg.worst.d.score}</em>
              </div>
            )}
          </div>

          <div className="met-trends">
            {agg.trends.map(t => {
              const verdict = t.avg === null ? 'sin_datos'
                : t.avg >= t.def.great ? 'excelente' : t.avg >= t.def.good ? 'bien' : t.avg >= t.def.bad ? 'flojo' : 'critico';
              return (
                <div key={t.key} className="met-trend" title={t.def.why}>
                  <span className="met-trend-label">{t.label}</span>
                  <strong style={{ color: VERDICT_COLOR[verdict] }}>{fmtMetric(t.avg, t.unit)}</strong>
                  <em>mejor: {fmtMetric(t.best, t.unit)}</em>
                  <div className="met-trend-bar">
                    <div style={{
                      width: `${Math.min(100, ((t.avg ?? 0) / t.def.great) * 100)}%`,
                      background: VERDICT_COLOR[verdict],
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {agg.advice.length > 0 && (
            <div className="met-advice">
              <h4>Qué corregir en el conjunto</h4>
              {agg.advice.map((a, i) => <p key={i}>{a}</p>)}
            </div>
          )}

          {chart.length > 1 && (
            <div className="met-chart">
              <p className="ig-eyebrow">Score por pieza</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chart}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} width={28} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {chart.map((d, i) => (
                      <Cell key={i} fill={d.score >= 75 ? '#10b981' : d.score >= 50 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="met-table-wrap">
            <table className="met-table">
              <thead>
                <tr>
                  <th>Pieza</th><th>Fecha</th><th>Alcance</th>
                  {METRIC_DEFS.map(d => <th key={d.key} title={d.why}>{d.short}</th>)}
                  <th>Score</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ m, d }) => (
                  <tr key={m.id} onClick={() => setDetail(m)}>
                    <td className="met-td-title">{m.title || 'Sin título'}</td>
                    <td>{m.publishedAt ? new Date(m.publishedAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—'}</td>
                    <td>{fmtNum(m.reach)}</td>
                    {d.scored.map(s => (
                      <td key={s.def.key} style={{ color: VERDICT_COLOR[s.verdict] }}>{fmtMetric(s.value, s.def.unit)}</td>
                    ))}
                    <td><span className="met-score-pill" style={{ background: d.score >= 75 ? '#10b981' : d.score >= 50 ? '#f59e0b' : '#ef4444' }}>{d.score}</span></td>
                    <td onClick={e => e.stopPropagation()} className="met-td-actions">
                      <button title="Editar" onClick={() => setForm(m)}>✎</button>
                      <button title="Borrar" onClick={() => c.removeMetric(m.id)}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="met-foot">Tocá una fila para ver el diagnóstico completo.</p>
        </>
      )}

      {form && <MetricForm initial={form} posts={c.posts} onClose={() => setForm(null)}
        onSave={m => form.id ? c.updateMetric(form.id, m) : c.addMetric(m)} />}
      {detail && <DiagnosisPanel m={detail} d={diagnose(detail)} onClose={() => setDetail(null)} />}
    </div>
  );
}
