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
  type DayRole, type Rhythm, type ContentAccount, type ContentPost,
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
  const [picker, setPicker] = useState<{ day: Date; kind: 'grabar' | 'editar' } | null>(null);

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

  // Sin grabar ni editar todavía, para el resumen de "queda por agendar".
  const toRecord = useMemo(
    () => c.posts.filter(p => !p.recorded && (p.status === 'aprobado' || p.status === 'listo')),
    [c.posts]);
  const toEdit = useMemo(
    () => c.posts.filter(p => p.recorded && !p.edited && p.status !== 'publicado'),
    [c.posts]);

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
          // Tres agendas distintas sobre el mismo día: publicar, grabar, editar.
          const items = c.posts.filter(p => p.scheduledFor && sameDay(new Date(p.scheduledFor), d));
          const recording = c.posts.filter(p => p.recordAt && !p.recorded && sameDay(new Date(p.recordAt), d));
          const editing_ = c.posts.filter(p => p.editAt && !p.edited && sameDay(new Date(p.editAt), d));
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

              {/* Agendadas para grabar ESE día (recordAt), no la cola entera */}
              {recording.length > 0 && (
                <div className="cal-task grabar">
                  <strong>🎥 Grabar {recording.length}</strong>
                  {recording.slice(0, 3).map(p => <span key={p.id}>{p.title || 'Sin título'}</span>)}
                  {recording.length > 3 && <span className="cal-task-more">+{recording.length - 3} más</span>}
                </div>
              )}

              {/* Agendadas para editar ese día (editAt) */}
              {editing_.length > 0 && (
                <div className="cal-task editar">
                  <strong>✂ Editar {editing_.length}</strong>
                  {editing_.slice(0, 3).map(p => <span key={p.id}>{p.title || 'Sin título'}</span>)}
                  {editing_.length > 3 && <span className="cal-task-more">+{editing_.length - 3} más</span>}
                </div>
              )}

              {/* Día marcado para grabar pero sin nada agendado */}
              {roles.includes('grabar') && recording.length === 0 && !isPast && (
                <div className="cal-gap soft">
                  {toRecord.length > 0
                    ? `${toRecord.length} sin agendar`
                    : 'Nada pendiente de grabar'}
                </div>
              )}

              {roles.includes('buscar') && !isPast && (
                <div className="cal-hint">Guardar referentes y anotar ideas</div>
              )}

              {/* Agendar desde el propio día: se elige la pieza y queda con la
                  fecha de ese día. Es el flujo natural — estás mirando el
                  calendario y decidís qué entra acá. */}
              {!isPast && (
                <div className="cal-add">
                  <button onClick={() => setPicker({ day: d, kind: 'grabar' })}>
                    <Plus size={11} /> Guion para grabar
                  </button>
                  <button onClick={() => setPicker({ day: d, kind: 'editar' })}>
                    <Plus size={11} /> Video para editar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {picker && (
        <PiecePicker day={picker.day} kind={picker.kind}
          candidates={picker.kind === 'grabar' ? toRecord : toEdit}
          onPick={id => c.updatePost(id, picker.kind === 'grabar'
            ? { recordAt: picker.day.getTime() }
            : { editAt: picker.day.getTime() })}
          onClose={() => setPicker(null)} />
      )}

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

// Selector de pieza para agendar a un día. Muestra las candidatas de la cola
// correspondiente y avisa si alguna ya estaba agendada a otro día.
function PiecePicker({ day, kind, candidates, onPick, onClose }: {
  day: Date; kind: 'grabar' | 'editar'; candidates: ContentPost[];
  onPick: (id: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const dateField = kind === 'grabar' ? 'recordAt' : 'editAt';
  const needle = q.trim().toLowerCase();
  const list = needle
    ? candidates.filter(p => (p.title || '').toLowerCase().includes(needle))
    : candidates;

  const dayTxt = day.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="ig-card-head" style={{ marginBottom: 8 }}>
          <div>
            <p className="ig-eyebrow">{dayTxt}</p>
            <h3>{kind === 'grabar' ? 'Guion para grabar' : 'Video para editar'}</h3>
          </div>
        </div>

        {candidates.length === 0 ? (
          <div className="ig-empty-inline">
            {kind === 'grabar'
              ? 'No hay guiones esperando cámara. Pasá una pieza a Aprobado o Listo en el Pipeline.'
              : 'No hay videos esperando edición. Marcá una pieza como grabada primero.'}
          </div>
        ) : (
          <>
            {candidates.length > 6 && (
              <div className="ig-search" style={{ marginBottom: 10 }}>
                <Search size={14} />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar…" autoFocus />
              </div>
            )}
            <div className="pick-list">
              {list.map(p => {
                const already = p[dateField];
                const otherDay = already && !sameDay(new Date(already), day);
                return (
                  <button key={p.id} className="pick-row"
                    onClick={() => { onPick(p.id); onClose(); }}>
                    <div className="pick-txt">
                      <strong>{p.title || 'Sin título'}</strong>
                      <em>
                        {CONTENT_FORMAT_LABELS[p.format]} · {CONTENT_ANGLE_LABELS[p.angle || 'valor']}
                        {otherDay && ` · ya agendada el ${new Date(already).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}`}
                      </em>
                    </div>
                    <Plus size={15} />
                  </button>
                );
              })}
              {list.length === 0 && <div className="ig-empty-inline">Nada coincide.</div>}
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
