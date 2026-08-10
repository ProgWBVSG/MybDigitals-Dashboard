// Producción: las dos colas de trabajo manual (grabar y editar).
//
// Antes había que abrir cada pieza para marcarla grabada o editada, y no había
// forma de decidir cuáles entran a la sesión de hoy. Acá se seleccionan varias
// y se marcan de una, y la "sesión" queda anotada en la pieza para que el
// calendario muestre exactamente eso el día de grabar.
import { useState, useMemo } from 'react';
import { Video, Scissors, Check, Star, Maximize2, CheckCheck, Undo2 } from 'lucide-react';
import type { useContent } from './hooks';
import {
  CONTENT_FORMAT_LABELS, CONTENT_ANGLE_LABELS, CONTENT_STATUSES,
  type ContentPost,
} from './utils';
import { decodeScript, encodeScript, takeProgress, totalSeconds, isStructuredScript } from './script';
import { Teleprompter } from './ContentGuion';

type Queue = 'grabar' | 'editar';

const STATUS_LABEL = Object.fromEntries(CONTENT_STATUSES.map(s => [s.key, s.label]));

export default function Produccion({ c }: { c: ReturnType<typeof useContent> }) {
  const [queue, setQueue] = useState<Queue>('grabar');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [tele, setTele] = useState<ContentPost | null>(null);
  const [onlySession, setOnlySession] = useState(false);

  // Grabar: aprobadas o listas que todavía no se grabaron.
  // Editar: ya grabadas pero sin editar. Publicar no entra: eso ya salió.
  const toRecord = useMemo(
    () => c.posts.filter(p => !p.recorded && p.status !== 'publicado' && p.status !== 'borrador'),
    [c.posts]);
  const toEdit = useMemo(
    () => c.posts.filter(p => p.recorded && !p.edited && p.status !== 'publicado'),
    [c.posts]);

  const base = queue === 'grabar' ? toRecord : toEdit;
  // Las de la sesión primero: son las que se eligieron para hoy.
  const items = useMemo(() => {
    const list = onlySession ? base.filter(p => p.inSession) : base;
    return [...list].sort((a, b) => Number(b.inSession) - Number(a.inSession));
  }, [base, onlySession]);

  const sessionCount = base.filter(p => p.inSession).length;
  const selected = items.filter(p => sel.has(p.id));

  const toggle = (id: string) => setSel(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const allSelected = items.length > 0 && items.every(p => sel.has(p.id));
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(items.map(p => p.id)));

  // Marcar hecho: grabar setea recorded, editar setea edited. En los dos casos
  // se saca de la sesión, que ya se cumplió para esa pieza.
  const markDone = () => {
    const patch = queue === 'grabar'
      ? { recorded: true, inSession: false }
      : { edited: true, inSession: false };
    selected.forEach(p => c.updatePost(p.id, patch));
    setSel(new Set());
  };

  // Deshacer: por si se marcó de más.
  const markUndone = () => {
    const patch = queue === 'grabar' ? { recorded: false } : { edited: false };
    selected.forEach(p => c.updatePost(p.id, patch));
    setSel(new Set());
  };

  const toggleSession = (p: ContentPost) => c.updatePost(p.id, { inSession: !p.inSession });
  const addSelectedToSession = () => {
    selected.forEach(p => c.updatePost(p.id, { inSession: true }));
    setSel(new Set());
  };
  const clearSession = () => base.filter(p => p.inSession).forEach(p => c.updatePost(p.id, { inSession: false }));

  const Icon = queue === 'grabar' ? Video : Scissors;

  return (
    <div className="ig-card">
      <div className="ig-card-head">
        <div><p className="ig-eyebrow">Trabajo pendiente</p><h3>Producción</h3></div>
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
          <div className="prod-bar">
            <label className="prod-check">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              <span>{selected.length > 0 ? `${selected.length} seleccionada${selected.length === 1 ? '' : 's'}` : 'Seleccionar todas'}</span>
            </label>

            {sessionCount > 0 && (
              <button className={`prod-filter ${onlySession ? 'active' : ''}`} onClick={() => setOnlySession(v => !v)}>
                <Star size={12} /> Sesión de hoy ({sessionCount})
              </button>
            )}

            <div className="prod-actions">
              {selected.length > 0 ? (
                <>
                  <button className="btn btn-secondary btn-sm" onClick={addSelectedToSession}>
                    <Star size={13} /> A la sesión
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={markUndone} title="Desmarcar">
                    <Undo2 size={13} />
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={markDone}>
                    <CheckCheck size={14} /> {queue === 'grabar' ? 'Marcar grabadas' : 'Marcar editadas'}
                  </button>
                </>
              ) : sessionCount > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={clearSession}>Vaciar sesión</button>
              )}
            </div>
          </div>

          <div className="prod-list">
            {items.map(p => {
              const blocks = decodeScript(p.content);
              const prog = isStructuredScript(p.content) ? takeProgress(blocks) : { done: 0, total: 0 };
              const isSel = sel.has(p.id);
              return (
                <div key={p.id} className={`prod-row ${isSel ? 'sel' : ''} ${p.inSession ? 'session' : ''}`}>
                  <label className="prod-row-check">
                    <input type="checkbox" checked={isSel} onChange={() => toggle(p.id)} />
                  </label>

                  <button className={`prod-star ${p.inSession ? 'on' : ''}`}
                    title={p.inSession ? 'Sacar de la sesión de hoy' : 'Sumar a la sesión de hoy'}
                    onClick={() => toggleSession(p)}>
                    <Star size={14} />
                  </button>

                  <div className="prod-row-txt" onClick={() => toggle(p.id)}>
                    <strong>{p.title || 'Sin título'}</strong>
                    <em>
                      {STATUS_LABEL[p.status]} · {CONTENT_FORMAT_LABELS[p.format]} · {CONTENT_ANGLE_LABELS[p.angle || 'valor']}
                      {totalSeconds(blocks) > 0 && ` · ${totalSeconds(blocks)}s`}
                      {queue === 'grabar' && prog.total > 0 && ` · ${prog.done}/${prog.total} tomas`}
                    </em>
                  </div>

                  {queue === 'grabar' && prog.total > 0 && (
                    <div className="prod-prog" title={`${prog.done} de ${prog.total} tomas grabadas`}>
                      <div style={{ width: `${(prog.done / prog.total) * 100}%` }} />
                    </div>
                  )}

                  {queue === 'grabar' && (
                    <button className="prod-tele" title="Abrir modo grabación" onClick={() => setTele(p)}>
                      <Maximize2 size={14} />
                    </button>
                  )}

                  <button className="prod-done" title={queue === 'grabar' ? 'Marcar grabada' : 'Marcar editada'}
                    onClick={() => c.updatePost(p.id, queue === 'grabar'
                      ? { recorded: true, inSession: false }
                      : { edited: true, inSession: false })}>
                    <Check size={15} />
                  </button>
                </div>
              );
            })}
            {items.length === 0 && (
              <div className="ig-empty-inline">
                Nada en la sesión de hoy. Marcá con <Star size={11} style={{ verticalAlign: -1 }} /> las que quieras hacer.
              </div>
            )}
          </div>

          <p className="prod-foot">
            <Icon size={12} />
            {queue === 'grabar'
              ? 'Marcá con la estrella las que vas a grabar hoy: el calendario las muestra el día de grabar.'
              : 'Al marcar una pieza como editada queda lista para pasar a Publicado en el Pipeline.'}
          </p>
        </>
      )}

      {/* El teleprompter escribe de vuelta en la pieza: marcar una toma como
          grabada acá tiene que persistir, si no la barra de progreso de la lista
          nunca avanzaría. */}
      {tele && (
        <Teleprompter title={tele.title} blocks={decodeScript(tele.content)}
          onBlocks={blocks => c.updatePost(tele.id, { content: encodeScript(blocks) })}
          onClose={() => setTele(null)} />
      )}
    </div>
  );
}
