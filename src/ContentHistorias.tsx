// Historias: registro de secuencias publicadas y cómo les fue.
//
// Sigue la forma de la planilla que ya se usaba (una fila por secuencia, edición
// en la celda) porque es el flujo que la persona ya tiene incorporado. Lo que
// agrega es el cálculo: visitas de la primera vs la última historia es la
// retención de la secuencia, y esa es la única columna que dice si funcionó.
import { useState, useMemo } from 'react';
import { Plus, Trash2, ExternalLink, TrendingDown, Lightbulb } from 'lucide-react';
import type { useContent } from './hooks';
import {
  STORY_KINDS, storyRetention, storyDropPerUnit, storyVerdict,
  type ContentStory,
} from './utils';
import { VERDICT_COLOR, VERDICT_LABEL, fmtNum } from './content-metrics';

const toDateInput = (ts: number | null) => ts ? new Date(ts).toISOString().split('T')[0] : '';
const fromDateInput = (v: string) => v ? new Date(v + 'T12:00').getTime() : null;

// Siguiente código de secuencia mirando los que ya existen (SE_0007 → SE_0008).
const nextCode = (stories: ContentStory[]): string => {
  const nums = stories
    .map(s => /^SE_(\d+)$/.exec(s.code.trim())?.[1])
    .filter((x): x is string => !!x)
    .map(Number);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return 'SE_' + String(next).padStart(4, '0');
};

export default function Historias({ c }: { c: ReturnType<typeof useContent> }) {
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? c.stories.filter(s => (s.code + ' ' + s.kind + ' ' + s.notes).toLowerCase().includes(needle))
      : c.stories;
    return list.map(s => ({ s, ret: storyRetention(s), drop: storyDropPerUnit(s) }));
  }, [c.stories, q]);

  // Promedios y el patrón que importa: qué TIPO de secuencia retiene mejor.
  const summary = useMemo(() => {
    const withData = c.stories.filter(s => storyRetention(s) !== null);
    if (!withData.length) return null;

    const avgRet = withData.reduce((a, s) => a + (storyRetention(s) || 0), 0) / withData.length;
    const totalReach = withData.reduce((a, s) => a + s.viewsFirst, 0);
    const totalReplies = withData.reduce((a, s) => a + s.replies + s.votes, 0);

    // Por tipo, con mínimo 2 secuencias para no leer ruido como señal.
    const byKind = new Map<string, number[]>();
    for (const s of withData) {
      const k = s.kind.trim() || '(sin tipo)';
      if (!byKind.has(k)) byKind.set(k, []);
      byKind.get(k)!.push(storyRetention(s)!);
    }
    const kinds = [...byKind.entries()]
      .filter(([, v]) => v.length >= 2)
      .map(([k, v]) => ({ kind: k, n: v.length, avg: v.reduce((a, b) => a + b, 0) / v.length }))
      .sort((a, b) => b.avg - a.avg);

    // ¿El lead magnet cuesta retención? Es la pregunta que la planilla no respondía.
    const withLm = withData.filter(s => s.hasLeadMagnet);
    const noLm = withData.filter(s => !s.hasLeadMagnet);
    const lmDelta = withLm.length >= 2 && noLm.length >= 2
      ? (withLm.reduce((a, s) => a + storyRetention(s)!, 0) / withLm.length)
        - (noLm.reduce((a, s) => a + storyRetention(s)!, 0) / noLm.length)
      : null;

    return { count: withData.length, avgRet, totalReach, totalReplies, kinds, lmDelta, withLm: withLm.length };
  }, [c.stories]);

  const upd = (s: ContentStory, u: Partial<ContentStory>) => c.updateStory(s.id, u);
  const num = (v: string) => Math.max(0, parseInt(v.replace(/\D/g, '') || '0', 10));

  return (
    <div className="ig-card">
      <div className="ig-card-head">
        <div><p className="ig-eyebrow">Secuencias publicadas</p><h3>Historias</h3></div>
        <div className="ig-head-tools">
          <div className="ig-search">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar tipo o código…" />
          </div>
          <button className="btn btn-primary btn-sm"
            onClick={() => c.addStory({ code: nextCode(c.stories), publishedAt: Date.now() })}>
            <Plus size={14} /> Nueva secuencia
          </button>
        </div>
      </div>

      {summary && (
        <>
          <div className="met-summary">
            <div className="met-kpi">
              <span>Retención promedio</span>
              <strong style={{ color: VERDICT_COLOR[storyVerdict(summary.avgRet)] }}>
                {summary.avgRet.toFixed(1)}%
              </strong>
              <em>{summary.count} secuencias · {VERDICT_LABEL[storyVerdict(summary.avgRet)]}</em>
            </div>
            <div className="met-kpi">
              <span>Visitas acumuladas</span>
              <strong className="met-kpi-title">{fmtNum(summary.totalReach)}</strong>
              <em>en la primera historia</em>
            </div>
            <div className="met-kpi">
              <span>Respuestas + votos</span>
              <strong className="met-kpi-title">{fmtNum(summary.totalReplies)}</strong>
              <em>{summary.totalReach > 0 ? ((summary.totalReplies / summary.totalReach) * 100).toFixed(2) : '0'}% de las visitas</em>
            </div>
          </div>

          {(summary.kinds.length > 1 || summary.lmDelta !== null) && (
            <div className="met-patterns">
              <h4><Lightbulb size={15} /> Qué retiene mejor</h4>
              {summary.kinds.length > 1 && (
                <p>
                  <b>{summary.kinds[0].kind}</b> retiene {summary.kinds[0].avg.toFixed(0)}%
                  {' '}({summary.kinds[0].n} secuencias) y <b>{summary.kinds[summary.kinds.length - 1].kind}</b>
                  {' '}{summary.kinds[summary.kinds.length - 1].avg.toFixed(0)}%
                  {' '}({summary.kinds[summary.kinds.length - 1].n}).
                  {summary.kinds[0].avg - summary.kinds[summary.kinds.length - 1].avg >= 10
                    ? ' Hacé más del primero.'
                    : ' La diferencia todavía es chica para sacar conclusiones.'}
                </p>
              )}
              {summary.lmDelta !== null && (
                <p>
                  Las secuencias con lead magnet retienen{' '}
                  <b>{summary.lmDelta >= 0 ? '+' : ''}{summary.lmDelta.toFixed(1)} puntos</b>{' '}
                  {summary.lmDelta >= 0 ? 'más' : 'menos'} que las que no lo tienen
                  {' '}({summary.withLm} con LM).
                  {summary.lmDelta < -8 && ' El LM está cortando la secuencia: probá ponerlo más cerca del final.'}
                </p>
              )}
              {summary.kinds.length > 1 && (
                <div className="met-pats">
                  <div className="met-pat">
                    <span className="met-pat-title">Retención por tipo</span>
                    {summary.kinds.map(k => (
                      <div key={k.kind} className="met-pat-row">
                        <span>{k.kind}</span>
                        <em>{k.n}</em>
                        <strong style={{ color: VERDICT_COLOR[storyVerdict(k.avg)] }}>{k.avg.toFixed(0)}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {c.stories.length === 0 ? (
        <div className="ig-empty">
          <p>Todavía no cargaste ninguna secuencia.</p>
          <p className="ig-empty-sub">
            Una fila por tanda de historias. Con las visitas de la primera y la última
            calculo cuánta gente llegó hasta el final.
          </p>
        </div>
      ) : (
        <div className="sto-wrap">
          <table className="sto-table">
            <thead>
              <tr>
                <th>Fecha</th><th>Código</th><th>Tipo</th>
                <th title="¿Tuvo llamada a la acción?">CTA</th>
                <th title="Cuántas historias tuvo la secuencia">N°</th>
                <th>1ª historia</th><th>Última</th>
                <th title="Qué % del que abrió la primera llegó a la última">Retención</th>
                <th title="Cuánto cae en promedio de una historia a la siguiente">Caída/u</th>
                <th title="¿Tuvo lead magnet?">LM</th>
                <th>Link</th><th>Respuestas</th><th>Votos</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, ret, drop }) => (
                <tr key={s.id} className={ret !== null && ret < 55 ? 'sto-bad' : ''}>
                  <td>
                    <input className="sto-cell" type="date" value={toDateInput(s.publishedAt)}
                      onChange={e => upd(s, { publishedAt: fromDateInput(e.target.value) })} />
                  </td>
                  <td>
                    <input className="sto-cell sto-code" value={s.code} placeholder="SE_0001"
                      onChange={e => upd(s, { code: e.target.value })} />
                  </td>
                  <td>
                    <input className="sto-cell sto-kind" value={s.kind} list="sto-kinds" placeholder="Tipo…"
                      onChange={e => upd(s, { kind: e.target.value })} />
                  </td>
                  <td className="sto-mid">
                    <button className={`sto-flag ${s.hasCta ? 'yes' : 'no'}`}
                      onClick={() => upd(s, { hasCta: !s.hasCta })}>{s.hasCta ? 'Sí' : 'No'}</button>
                  </td>
                  <td>
                    <input className="sto-cell sto-n" type="number" min={0} value={s.storyCount || ''}
                      onChange={e => upd(s, { storyCount: num(e.target.value) })} />
                  </td>
                  <td>
                    <input className="sto-cell sto-num" type="number" min={0} value={s.viewsFirst || ''}
                      onChange={e => upd(s, { viewsFirst: num(e.target.value) })} />
                  </td>
                  <td>
                    <input className="sto-cell sto-num" type="number" min={0} value={s.viewsLast || ''}
                      onChange={e => upd(s, { viewsLast: num(e.target.value) })} />
                  </td>
                  <td className="sto-mid">
                    {ret === null ? <span className="sto-dash">—</span> : (
                      <span className="sto-ret" style={{ color: VERDICT_COLOR[storyVerdict(ret)] }}>
                        {ret.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className="sto-mid">
                    {drop === null ? <span className="sto-dash">—</span> : (
                      <span className="sto-drop"><TrendingDown size={11} /> {drop}%</span>
                    )}
                  </td>
                  <td className="sto-mid">
                    <button className={`sto-flag ${s.hasLeadMagnet ? 'yes' : 'no'}`}
                      onClick={() => upd(s, { hasLeadMagnet: !s.hasLeadMagnet })}>{s.hasLeadMagnet ? 'Sí' : 'No'}</button>
                  </td>
                  <td className="sto-mid">
                    {s.link
                      ? <a href={s.link} target="_blank" rel="noreferrer" className="sto-link"><ExternalLink size={13} /></a>
                      : <input className="sto-cell sto-linkin" value={s.link} placeholder="—"
                          onChange={e => upd(s, { link: e.target.value })} />}
                  </td>
                  <td>
                    <input className="sto-cell sto-num" type="number" min={0} value={s.replies || ''}
                      onChange={e => upd(s, { replies: num(e.target.value) })} />
                  </td>
                  <td>
                    <input className="sto-cell sto-num" type="number" min={0} value={s.votes || ''}
                      onChange={e => upd(s, { votes: num(e.target.value) })} />
                  </td>
                  <td className="sto-mid">
                    <button className="sto-del" title="Borrar" onClick={() => c.removeStory(s.id)}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="sto-kinds">
            {[...new Set([...STORY_KINDS, ...c.stories.map(s => s.kind).filter(Boolean)])]
              .map(k => <option key={k} value={k} />)}
          </datalist>
        </div>
      )}

      {c.stories.length > 0 && (
        <p className="met-foot">
          La retención es cuánta gente que abrió la primera historia llegó a la última.
          Arriba del 85% es excelente; abajo del 55% algo está cortando la secuencia.
        </p>
      )}
    </div>
  );
}
