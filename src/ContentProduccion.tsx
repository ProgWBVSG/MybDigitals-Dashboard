// Producción: las dos colas de trabajo manual (grabar y editar).
//
// Cada pieza se agenda a un DÍA concreto de grabación y otro de edición, que son
// distintos de la fecha de publicación. Así el trabajo se reparte en la semana en
// vez de quedar en un montón de "pendiente", y el calendario puede mostrar qué
// toca cada día.
import { useState, useMemo } from 'react';
import { Video, Scissors, Check, Maximize2, CheckCheck, Undo2, CalendarPlus, CalendarX } from 'lucide-react';
import type { useContent } from './hooks';
import {
  CONTENT_FORMAT_LABELS, CONTENT_ANGLE_LABELS, CONTENT_STATUSES, WEEKDAYS_ES, mondayIndex,
  type ContentPost,
} from './utils';
import { decodeScript, encodeScript, takeProgress, totalSeconds, isStructuredScript } from './script';
import { Teleprompter } from './ContentGuion';

type Queue = 'grabar' | 'editar';

const STATUS_LABEL = Object.fromEntries(CONTENT_STATUSES.map(s => [s.key, s.label]));

const toDateInput = (ts: number | null) => ts ? new Date(ts).toISOString().split('T')[0] : '';
const fromDateInput = (v: string) => v ? new Date(v + 'T12:00').getTime() : null;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

// "Hoy", "Mañana", "Lunes 11" — más rápido de leer que una fecha suelta.
const dayLabel = (ts: number): string => {
  const d = new Date(ts); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - startOfToday().getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  if (diff < 0) return `Atrasada · ${d.getDate()}/${d.getMonth() + 1}`;
  if (diff < 7) return `${WEEKDAYS_ES[mondayIndex(d)]} ${d.getDate()}`;
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

const isOverdue = (ts: number | null) => ts !== null && ts < startOfToday().getTime();

export default function Produccion({ c }: { c: ReturnType<typeof useContent> }) {
  const [queue, setQueue] = useState<Queue>('grabar');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [tele, setTele] = useState<ContentPost | null>(null);
  const [filter, setFilter] = useState<'todas' | 'agendadas' | 'sin_fecha'>('todas');
  const [batchDate, setBatchDate] = useState('');

  const dateKey = queue === 'grabar' ? 'recordAt' : 'editAt';

  // Grabar: aprobadas o listas sin grabar. Editar: grabadas sin editar.
  const toRecord = useMemo(
    () => c.posts.filter(p => !p.recorded && p.status !== 'publicado' && p.status !== 'borrador'),
    [c.posts]);
  const toEdit = useMemo(
    () => c.posts.filter(p => p.recorded && !p.edited && p.status !== 'publicado'),
    [c.posts]);

  const base = queue === 'grabar' ? toRecord : toEdit;

  const items = useMemo(() => {
    const withDate = (p: ContentPost) => p[dateKey];
    const list = filter === 'agendadas' ? base.filter(withDate)
      : filter === 'sin_fecha' ? base.filter(p => !withDate(p))
      : base;
    // Agendadas primero y por fecha; las sin fecha al final.
    return [...list].sort((a, b) => {
      const da = withDate(a), db = withDate(b);
      if (da && db) return da - db;
      if (da) return -1;
      if (db) return 1;
      return 0;
    });
  }, [base, filter, dateKey]);

  const scheduled = base.filter(p => p[dateKey]).length;
  const overdue = base.filter(p => isOverdue(p[dateKey])).length;
  const selected = items.filter(p => sel.has(p.id));

  const toggle = (id: string) => setSel(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const allSelected = items.length > 0 && items.every(p => sel.has(p.id));
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(items.map(p => p.id)));

  const setDate = (p: ContentPost, v: string) => c.updatePost(p.id, { [dateKey]: fromDateInput(v) });

  // Agendar en tanda: el uso real es "estas cinco las grabo el domingo".
  const applyBatchDate = () => {
    const ts = fromDateInput(batchDate);
    selected.forEach(p => c.updatePost(p.id, { [dateKey]: ts }));
    setSel(new Set()); setBatchDate('');
  };
  const clearDates = () => {
    selected.forEach(p => c.updatePost(p.id, { [dateKey]: null }));
    setSel(new Set());
  };

  // Marcar hecho también limpia la fecha: ya se cumplió, no tiene que seguir
  // apareciendo agendada en el calendario.
  const markDone = () => {
    const patch = queue === 'grabar'
      ? { recorded: true, recordAt: null }
      : { edited: true, editAt: null };
    selected.forEach(p => c.updatePost(p.id, patch));
    setSel(new Set());
  };
  const markUndone = () => {
    selected.forEach(p => c.updatePost(p.id, queue === 'grabar' ? { recorded: false } : { edited: false }));
    setSel(new Set());
  };

  const Icon = queue === 'grabar' ? Video : Scissors;

  return (
    <div className="ig-card">
      <div className="ig-card-head">
        <div><p className="ig-eyebrow">Agenda de trabajo</p><h3>Producción</h3></div>
        <div className="prod-queues">
          <button className={queue === 'grabar' ? 'active' : ''} onClick={() => { setQueue('grabar'); setSel(new Set()); }}>
            <Video size={14} /> Grabar <em>{toRecord.length}</em>
          </button>
          <button className={queue === 'editar' ? 'active' : ''} onClick={() => { setQueue('editar'); setSel(new Set()); }}>
            <Scissors size={14} /> Editar <em>{toEdit.length}</em>
          </button>
        </div>
      </div>

      {base.length === 0 ? (
        <div className="ig-empty">
          <p>{queue === 'grabar' ? 'No hay nada esperando cámara.' : 'No hay nada esperando edición.'}</p>
          <p className="ig-empty-sub">
            {queue === 'grabar'
              ? 'Las piezas aparecen acá cuando pasan a Aprobado o Listo y todavía no están grabadas.'
              : 'Una pieza entra a esta cola cuando la marcás como grabada.'}
          </p>
        </div>
      ) : (
        <>
          {overdue > 0 && (
            <div className="prod-overdue">
              {overdue} pieza{overdue === 1 ? '' : 's'} con fecha de {queue === 'grabar' ? 'grabación' : 'edición'} pasada.
              Reagendala{overdue === 1 ? '' : 's'} o marcala{overdue === 1 ? '' : 's'} como hecha{overdue === 1 ? '' : 's'}.
            </div>
          )}

          <div className="prod-bar">
            <label className="prod-check">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              <span>{selected.length > 0 ? `${selected.length} seleccionada${selected.length === 1 ? '' : 's'}` : 'Seleccionar todas'}</span>
            </label>

            <div className="prod-filters">
              {([['todas', `Todas (${base.length})`], ['agendadas', `Agendadas (${scheduled})`], ['sin_fecha', `Sin fecha (${base.length - scheduled})`]] as const).map(([k, label]) => (
                <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{label}</button>
              ))}
            </div>

            {selected.length > 0 && (
              <div className="prod-actions">
                <div className="prod-batch-date">
                  <CalendarPlus size={13} />
                  <input type="date" value={batchDate} onChange={e => setBatchDate(e.target.value)}
                    title={`Agendar las ${selected.length} seleccionadas`} />
                  <button className="btn btn-secondary btn-sm" disabled={!batchDate} onClick={applyBatchDate}>
                    Agendar
                  </button>
                </div>
                <button className="prod-icon-btn" title="Quitar la fecha" onClick={clearDates}><CalendarX size={14} /></button>
                <button className="prod-icon-btn" title="Desmarcar" onClick={markUndone}><Undo2 size={14} /></button>
                <button className="btn btn-primary btn-sm" onClick={markDone}>
                  <CheckCheck size={14} /> {queue === 'grabar' ? 'Grabadas' : 'Editadas'}
                </button>
              </div>
            )}
          </div>

          <div className="prod-list">
            {items.map(p => {
              const blocks = decodeScript(p.content);
              const prog = isStructuredScript(p.content) ? takeProgress(blocks) : { done: 0, total: 0 };
              const isSel = sel.has(p.id);
              const when = p[dateKey];
              const late = isOverdue(when);
              return (
                <div key={p.id} className={`prod-row ${isSel ? 'sel' : ''} ${when ? 'agendada' : ''} ${late ? 'late' : ''}`}>
                  <label className="prod-row-check">
                    <input type="checkbox" checked={isSel} onChange={() => toggle(p.id)} />
                  </label>

                  <div className="prod-row-txt" onClick={() => toggle(p.id)}>
                    <strong>{p.title || 'Sin título'}</strong>
                    <em>
                      {STATUS_LABEL[p.status]} · {CONTENT_FORMAT_LABELS[p.format]} · {CONTENT_ANGLE_LABELS[p.angle || 'valor']}
                      {totalSeconds(blocks) > 0 && ` · ${totalSeconds(blocks)}s`}
                      {queue === 'grabar' && prog.total > 0 && ` · ${prog.done}/${prog.total} tomas`}
                    </em>
                  </div>

                  {/* La fecha se edita en la fila: es la acción principal de esta vista */}
                  <div className="prod-date">
                    {when && <span className={`prod-date-lbl ${late ? 'late' : ''}`}>{dayLabel(when)}</span>}
                    <input type="date" value={toDateInput(when)} onChange={e => setDate(p, e.target.value)}
                      title={queue === 'grabar' ? 'Día de grabación' : 'Día de edición'} />
                  </div>

                  {queue === 'grabar' && prog.total > 0 && (
                    <div className="prod-prog" title={`${prog.done} de ${prog.total} tomas grabadas`}>
                      <div style={{ width: `${(prog.done / prog.total) * 100}%` }} />
                    </div>
                  )}

                  {queue === 'grabar' && (
                    <button className="prod-icon-btn" title="Abrir modo grabación" onClick={() => setTele(p)}>
                      <Maximize2 size={14} />
                    </button>
                  )}

                  <button className="prod-done" title={queue === 'grabar' ? 'Marcar grabada' : 'Marcar editada'}
                    onClick={() => c.updatePost(p.id, queue === 'grabar'
                      ? { recorded: true, recordAt: null }
                      : { edited: true, editAt: null })}>
                    <Check size={15} />
                  </button>
                </div>
              );
            })}
            {items.length === 0 && <div className="ig-empty-inline">Nada con este filtro.</div>}
          </div>

          <p className="prod-foot">
            <Icon size={12} />
            {queue === 'grabar'
              ? 'Poné el día de grabación de cada pieza (o seleccioná varias y agendalas juntas): el calendario las muestra ese día.'
              : 'Al marcar una pieza como editada queda lista para pasar a Publicado en el Pipeline.'}
          </p>
        </>
      )}

      {/* El teleprompter escribe de vuelta en la pieza: marcar una toma como
          grabada tiene que persistir, si no la barra de progreso no avanza. */}
      {tele && (
        <Teleprompter title={tele.title} blocks={decodeScript(tele.content)}
          onBlocks={blocks => c.updatePost(tele.id, { content: encodeScript(blocks) })}
          onClose={() => setTele(null)} />
      )}
    </div>
  );
}
