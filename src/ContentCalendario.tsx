// Calendario de contenido con ritmo de producción.
//
// No es solo "qué sale tal día": cada día de la semana tiene roles (publicar,
// grabar, buscar contenido) y el calendario cruza ese ritmo con el estado real
// del Pipeline. Así un día de publicar sin pieza asignada se ve como un hueco,
// y un día de grabar muestra la cola de lo que está esperando cámara.
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Settings2, Plus, Video, Search, Upload, AlertCircle } from 'lucide-react';
import type { useContent } from './hooks';
import {
  DAY_ROLES, DAY_ROLE_MAP, WEEKDAYS_ES, DEFAULT_RHYTHM, mondayIndex,
  CONTENT_FORMAT_LABELS, CONTENT_ANGLE_LABELS,
  type DayRole, type Rhythm, type ContentAccount,
} from './utils';

const ROLE_ICON: Record<DayRole, typeof Upload> = {
  publicar: Upload, grabar: Video, buscar: Search,
};

const startOfWeek = (offset: number): Date => {
  const now = new Date();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(now.getDate() - mondayIndex(now) + offset * 7);
  return d;
};

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export default function Calendario({ c }: { c: ReturnType<typeof useContent> }) {
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState(false);

  const account = c.accounts.find(a => a.id === c.accountId);
  // Sin cuenta elegida (o cuenta sin ritmo guardado) se usa el ritmo por defecto,
  // así el calendario ya sirve antes de configurar nada.
  const rhythm: Rhythm = account?.rhythm && Object.keys(account.rhythm).length
    ? account.rhythm : DEFAULT_RHYTHM;

  const week = useMemo(() => {
    const monday = startOfWeek(offset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [offset]);

  // Cola de grabación: aprobadas o listas que todavía no se grabaron. Si hay
  // piezas elegidas para la sesión (estrella en Producción) se muestran esas y
  // solo esas — es la decisión que ya se tomó, no la lista completa.
  const toRecord = useMemo(() => {
    const pending = c.posts.filter(p => !p.recorded && (p.status === 'aprobado' || p.status === 'listo'));
    const session = pending.filter(p => p.inSession);
    return session.length ? session : pending;
  }, [c.posts]);
  const hasSession = useMemo(() => c.posts.some(p => p.inSession && !p.recorded), [c.posts]);

  // Listas para publicar y sin fecha: son las candidatas para tapar un hueco.
  const unscheduled = useMemo(
    () => c.posts.filter(p => p.status === 'listo' && !p.scheduledFor),
    [c.posts]);

  const today = new Date();
  const monthLabel = week[0].toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  // Resumen de la semana para saber de un vistazo si el ritmo se está cumpliendo.
  const summary = useMemo(() => {
    let publishDays = 0, covered = 0;
    for (let i = 0; i < 7; i++) {
      if (!(rhythm[i] || []).includes('publicar')) continue;
      publishDays++;
      if (c.posts.some(p => p.scheduledFor && sameDay(new Date(p.scheduledFor), week[i]))) covered++;
    }
    return { publishDays, covered, gaps: publishDays - covered };
  }, [rhythm, c.posts, week]);

  return (
    <div className="ig-card">
      <div className="ig-card-head">
        <div>
          <p className="ig-eyebrow">Ritmo de producción</p>
          <h3>Calendario de contenido</h3>
        </div>
        <div className="cal-head-actions">
          <div className="cal-nav">
            <button title="Semana anterior" onClick={() => setOffset(o => o - 1)}><ChevronLeft size={16} /></button>
            <button className="cal-nav-label" onClick={() => setOffset(0)}>
              {offset === 0 ? 'Esta semana' : offset === 1 ? 'Próxima' : offset === -1 ? 'Anterior' : monthLabel}
            </button>
            <button title="Semana siguiente" onClick={() => setOffset(o => o + 1)}><ChevronRight size={16} /></button>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
            <Settings2 size={14} /> Ritmo
          </button>
        </div>
      </div>

      {summary.publishDays > 0 && (
        <div className={`cal-summary ${summary.gaps > 0 ? 'warn' : 'ok'}`}>
          {summary.gaps > 0 ? (
            <>
              <AlertCircle size={15} />
              <span>
                <b>{summary.covered} de {summary.publishDays}</b> días de publicar tienen pieza asignada.
                Faltan {summary.gaps}.
                {unscheduled.length > 0 && ` Tenés ${unscheduled.length} lista${unscheduled.length === 1 ? '' : 's'} sin fecha para tapar los huecos.`}
              </span>
            </>
          ) : (
            <span>✓ La semana está cubierta: {summary.publishDays} días de publicar con pieza asignada.</span>
          )}
        </div>
      )}

      <div className="cal-week">
        {week.map((d, i) => {
          const roles = rhythm[i] || [];
          const items = c.posts.filter(p => p.scheduledFor && sameDay(new Date(p.scheduledFor), d));
          const isToday = sameDay(d, today);
          const isPast = d < today && !isToday;
          const needsPiece = roles.includes('publicar') && items.length === 0 && !isPast;

          return (
            <div key={i} className={`cal-day ${isToday ? 'today' : ''} ${isPast ? 'past' : ''} ${roles.length === 0 ? 'off' : ''}`}>
              <div className="cal-day-head">
                <span className="cal-day-name">{WEEKDAYS_ES[i].slice(0, 3)}</span>
                <span className="cal-day-num">{d.getDate()}</span>
              </div>

              {roles.length > 0 ? (
                <div className="cal-roles">
                  {roles.map(r => {
                    const def = DAY_ROLE_MAP[r];
                    const Icon = ROLE_ICON[r];
                    return (
                      <span key={r} className="cal-role" title={def.hint}
                        style={{ color: def.color, background: `${def.color}1f` }}>
                        <Icon size={11} /> {def.short}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="cal-day-off">Libre</div>
              )}

              {/* Piezas agendadas para ese día */}
              {items.map(p => (
                <div key={p.id} className="cal-piece" title={p.title}>
                  <span className="cal-piece-fmt">{CONTENT_FORMAT_LABELS[p.format]}</span>
                  <p>{p.title || 'Sin título'}</p>
                  <em>{CONTENT_ANGLE_LABELS[p.angle || 'valor']}</em>
                </div>
              ))}

              {needsPiece && (
                <div className="cal-gap">
                  <Plus size={12} /> Sin pieza asignada
                </div>
              )}

              {/* En día de grabar: la cola de lo que espera cámara */}
              {roles.includes('grabar') && !isPast && (
                <div className="cal-queue">
                  {toRecord.length > 0 ? (
                    <>
                      <strong>{hasSession ? `Sesión: ${toRecord.length}` : `${toRecord.length} para grabar`}</strong>
                      {toRecord.slice(0, 3).map(p => <span key={p.id}>{p.title || 'Sin título'}</span>)}
                      {toRecord.length > 3 && <span className="cal-queue-more">+{toRecord.length - 3} más</span>}
                    </>
                  ) : <span className="cal-queue-empty">Nada pendiente de grabar</span>}
                </div>
              )}

              {/* En día de buscar: qué hacer concretamente */}
              {roles.includes('buscar') && !isPast && (
                <div className="cal-hint">
                  Guardar referentes y anotar ideas
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing && account && (
        <RhythmEditor account={account} rhythm={rhythm}
          onSave={r => c.updateAccount(account.id, { rhythm: r })}
          onClose={() => setEditing(false)} />
      )}
      {editing && !account && (
        <div className="modal-overlay" onClick={() => setEditing(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2 style={{ marginTop: 0 }}>Elegí una cuenta</h2>
            <p className="scr-tip">El ritmo de producción se guarda por cuenta. Seleccioná una arriba a la derecha y volvé a entrar.</p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setEditing(false)}>Entendido</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RhythmEditor({ account, rhythm, onSave, onClose }: {
  account: ContentAccount; rhythm: Rhythm;
  onSave: (r: Rhythm) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<Rhythm>(() => {
    const copy: Rhythm = {};
    for (let i = 0; i < 7; i++) copy[i] = [...(rhythm[i] || [])];
    return copy;
  });

  const toggle = (day: number, role: DayRole) => setDraft(d => {
    const cur = d[day] || [];
    return { ...d, [day]: cur.includes(role) ? cur.filter(r => r !== role) : [...cur, role] };
  });

  const publishCount = Object.values(draft).filter(r => r.includes('publicar')).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="ig-card-head" style={{ marginBottom: 8 }}>
          <div>
            <p className="ig-eyebrow">{account.name}</p>
            <h3>Ritmo de la semana</h3>
          </div>
        </div>
        <p className="scr-tip" style={{ marginBottom: 14 }}>
          Marcá qué se hace cada día. Un día puede tener más de una cosa — por ejemplo
          grabar en tanda y buscar referencias el mismo domingo.
        </p>

        <div className="rhy-grid">
          <div className="rhy-row rhy-head">
            <span />
            {DAY_ROLES.map(r => (
              <span key={r.key} style={{ color: r.color }} title={r.hint}>{r.label}</span>
            ))}
          </div>
          {WEEKDAYS_ES.map((name, i) => (
            <div key={i} className="rhy-row">
              <span className="rhy-day">{name}</span>
              {DAY_ROLES.map(r => {
                const on = (draft[i] || []).includes(r.key);
                return (
                  <button key={r.key} type="button"
                    className={`rhy-cell ${on ? 'on' : ''}`}
                    style={on ? { background: r.color, borderColor: r.color } : undefined}
                    title={`${name} · ${r.label}`}
                    onClick={() => toggle(i, r.key)}>
                    {on ? r.icon : ''}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <p className="rhy-note">
          {publishCount === 0
            ? 'Sin días de publicar el calendario no puede avisarte de huecos.'
            : `${publishCount} ${publishCount === 1 ? 'salida' : 'salidas'} por semana.`}
        </p>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => { onSave(draft); onClose(); }}>Guardar ritmo</button>
        </div>
      </div>
    </div>
  );
}
