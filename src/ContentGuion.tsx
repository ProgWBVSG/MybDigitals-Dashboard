// Editor de guion y modo grabación.
//
// El editor arma la pieza completa (los campos de la planilla de reels) y el guion
// por bloques. Cada bloque se puede partir en TOMAS: fragmentos cortos que se
// graban por separado y se unen en edición — para no tener que decir todo de corrido.
//
// El modo grabación muestra una toma a la vez, en grande, con avance y marcado de
// "grabada", así se puede seguir desde el celular mientras se filma.
import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, X, ArrowUp, ArrowDown, Maximize2, Scissors, Check, ChevronLeft, ChevronRight, RotateCcw, Link2, Copy } from 'lucide-react';
import {
  CONTENT_FORMATS, CONTENT_FORMAT_LABELS, CONTENT_OBJECTIVES, CONTENT_KINDS,
  CONTENT_ANGLES, CONTENT_ANGLE_LABELS, AWARENESS_LEVELS, uuid,
  type ContentPost, type ContentFormat, type ContentAngle, type Awareness,
} from './utils';
import {
  SCRIPT_PHASES, SCRIPT_PHASE_LABELS, SCRIPT_PHASE_COLORS, SCRIPT_PHASE_HINT,
  emptyScript, decodeScript, encodeScript, totalSeconds, splitIntoTakes, blockTakes, takeProgress, scriptForShare,
  type ScriptBlock, type ScriptPhase, type ScriptTake,
} from './script';

// ─── BLOQUE DEL GUION ───

function BlockEditor({ block, index, total, onChange, onRemove, onMove }: {
  block: ScriptBlock; index: number; total: number;
  onChange: (b: ScriptBlock) => void; onRemove: () => void; onMove: (dir: 1 | -1) => void;
}) {
  const hasTakes = block.takes.length > 0;

  const split = () => {
    const takes = splitIntoTakes(block.text);
    if (takes.length < 2) return; // no vale partir algo que ya es una sola frase
    onChange({ ...block, takes });
  };
  const merge = () => onChange({ ...block, takes: [] });
  const setTake = (i: number, text: string) =>
    onChange({ ...block, takes: block.takes.map((t, idx) => idx === i ? { ...t, text } : t) });
  const removeTake = (i: number) => {
    const takes = block.takes.filter((_, idx) => idx !== i);
    onChange({ ...block, takes, text: takes.map(t => t.text).join(' ') });
  };
  const addTake = () => onChange({ ...block, takes: [...block.takes, { id: uuid(), text: '', done: false }] });

  // Al editar tomas, el texto del bloque queda como la unión — así el guion
  // completo (y el copy) siguen siendo coherentes sin doble fuente de verdad.
  useEffect(() => {
    if (!hasTakes) return;
    const joined = block.takes.map(t => t.text.trim()).filter(Boolean).join(' ');
    if (joined !== block.text) onChange({ ...block, text: joined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.takes]);

  return (
    <div className="scr-block" style={{ borderLeftColor: SCRIPT_PHASE_COLORS[block.phase] }}>
      <div className="scr-block-head">
        <select className="select scr-phase" value={block.phase} onChange={e => onChange({ ...block, phase: e.target.value as ScriptPhase })}>
          {SCRIPT_PHASES.map(p => <option key={p} value={p}>{SCRIPT_PHASE_LABELS[p]}</option>)}
        </select>
        <label className="scr-sec">
          <input type="number" min={0} className="input" value={block.seconds} onChange={e => onChange({ ...block, seconds: Math.max(0, +e.target.value || 0) })} />
          <span>seg</span>
        </label>
        {hasTakes && <span className="scr-take-count">{block.takes.length} tomas</span>}
        <div className="scr-block-actions">
          {!hasTakes
            ? <button type="button" title="Partir en tomas cortas" disabled={!block.text.trim()} onClick={split}><Scissors size={13} /></button>
            : <button type="button" title="Volver a una sola toma" onClick={merge}><RotateCcw size={13} /></button>}
          <button type="button" title="Subir" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={13} /></button>
          <button type="button" title="Bajar" disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown size={13} /></button>
          <button type="button" title="Quitar bloque" onClick={onRemove}><Trash2 size={13} /></button>
        </div>
      </div>

      <p className="scr-block-hint">{SCRIPT_PHASE_HINT[block.phase]}</p>

      <div className="scr-block-cols">
        <div className="scr-col">
          <label className="scr-col-label">Guion</label>
          {!hasTakes ? (
            <textarea className="input" rows={3} placeholder="Qué decís en este momento…"
              value={block.text} onChange={e => onChange({ ...block, text: e.target.value })} />
          ) : (
            <div className="scr-takes">
              {block.takes.map((t, i) => (
                <div key={t.id} className="scr-take">
                  <span className="scr-take-n">{i + 1}</span>
                  <textarea className="input" rows={2} value={t.text} placeholder="Fragmento a grabar…"
                    onChange={e => setTake(i, e.target.value)} />
                  <button type="button" title="Quitar toma" onClick={() => removeTake(i)}><Trash2 size={12} /></button>
                </div>
              ))}
              <button type="button" className="scr-take-add" onClick={addTake}><Plus size={12} /> Agregar toma</button>
            </div>
          )}
        </div>
        <div className="scr-col">
          <label className="scr-col-label">Visual / edición</label>
          <textarea className="input" rows={3} placeholder="Qué se ve o qué corte hacer acá…"
            value={block.visual} onChange={e => onChange({ ...block, visual: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

// ─── MODO GRABACIÓN ───
// Una toma por pantalla. Se avanza con las flechas o marcando la toma como grabada.

interface FlatTake { take: ScriptTake; blockIdx: number; takeIdx: number; phase: ScriptPhase; visual: string; isVirtual: boolean }

export function Teleprompter({ title, blocks, onBlocks, onClose }: {
  title: string; blocks: ScriptBlock[]; onBlocks?: (b: ScriptBlock[]) => void; onClose: () => void;
}) {
  const [big, setBig] = useState(true);
  const [mode, setMode] = useState<'tomas' | 'completo'>('tomas');
  const [i, setI] = useState(0);

  // Aplana todas las tomas del guion. Un bloque sin tomas explícitas aporta una
  // sola toma "virtual" (su texto completo) que no se puede marcar como grabada.
  const flat = useMemo<FlatTake[]>(() =>
    blocks.flatMap((b, blockIdx) =>
      blockTakes(b).map((take, takeIdx) => ({
        take, blockIdx, takeIdx, phase: b.phase, visual: b.visual, isVirtual: b.takes.length === 0,
      }))
    ), [blocks]);

  const progress = takeProgress(blocks);
  const cur = flat[Math.min(i, flat.length - 1)];

  const toggleDone = () => {
    if (!cur || cur.isVirtual || !onBlocks) return;
    onBlocks(blocks.map((b, bi) => bi !== cur.blockIdx ? b : {
      ...b, takes: b.takes.map((t, ti) => ti !== cur.takeIdx ? t : { ...t, done: !t.done }),
    }));
    if (!cur.take.done && i < flat.length - 1) setI(i + 1); // al marcarla, pasar a la siguiente
  };
  const resetAll = () => onBlocks?.(blocks.map(b => ({ ...b, takes: b.takes.map(t => ({ ...t, done: false })) })));

  // Navegación con teclado: flechas para moverse, espacio para marcar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode !== 'tomas') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setI(v => Math.min(flat.length - 1, v + 1)); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setI(v => Math.max(0, v - 1)); }
      if (e.key === ' ') { e.preventDefault(); toggleDone(); }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="tp-overlay" onClick={onClose}>
      <div className="tp-sheet" onClick={e => e.stopPropagation()}>
        <div className="tp-bar">
          <div className="tp-bar-info">
            <strong>{title || 'Sin título'}</strong>
            <span>
              {totalSeconds(blocks)}s en total
              {progress.total > 0 && ` · ${progress.done}/${progress.total} tomas grabadas`}
            </span>
          </div>
          <div className="tp-bar-actions">
            <div className="tp-mode">
              <button className={mode === 'tomas' ? 'active' : ''} onClick={() => setMode('tomas')}>Por tomas</button>
              <button className={mode === 'completo' ? 'active' : ''} onClick={() => setMode('completo')}>Guion completo</button>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setBig(v => !v)}>{big ? 'A−' : 'A+'}</button>
            {progress.done > 0 && <button className="btn btn-secondary btn-sm" title="Desmarcar todas" onClick={resetAll}><RotateCcw size={14} /></button>}
            <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={15} /></button>
          </div>
        </div>

        {progress.total > 0 && (
          <div className="tp-progress"><div style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
        )}

        {mode === 'tomas' ? (
          !cur ? (
            <div className="tp-content"><div className="ig-empty-inline">Todavía no escribiste el guion.</div></div>
          ) : (
            <>
              <div className={`tp-take ${big ? 'big' : ''} ${cur.take.done ? 'done' : ''}`}>
                <div className="tp-take-head">
                  <span className="tp-take-tag" style={{ color: SCRIPT_PHASE_COLORS[cur.phase] }}>{SCRIPT_PHASE_LABELS[cur.phase]}</span>
                  <span className="tp-take-pos">Toma {i + 1} de {flat.length}</span>
                </div>
                <p className="tp-take-text">{cur.take.text}</p>
                {cur.visual.trim() && <p className="tp-take-visual">🎬 {cur.visual}</p>}
              </div>
              <div className="tp-nav">
                <button className="btn btn-secondary" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft size={18} /></button>
                <button className={`btn ${cur.take.done ? 'btn-secondary' : 'btn-primary'} tp-mark`}
                  disabled={cur.isVirtual} onClick={toggleDone}
                  title={cur.isVirtual ? 'Partí el bloque en tomas para poder marcarlas' : ''}>
                  <Check size={18} /> {cur.take.done ? 'Grabada' : 'Marcar grabada'}
                </button>
                <button className="btn btn-secondary" disabled={i >= flat.length - 1} onClick={() => setI(i + 1)}><ChevronRight size={18} /></button>
              </div>
              <p className="tp-hint">Flechas para moverte · Espacio para marcar · Esc para salir</p>
            </>
          )
        ) : (
          <div className={`tp-content ${big ? 'big' : ''}`}>
            {blocks.filter(b => b.text.trim() || b.visual.trim()).map(b => (
              <div key={b.id} className="tp-block">
                <div className="tp-block-tag" style={{ color: SCRIPT_PHASE_COLORS[b.phase] }}>
                  {SCRIPT_PHASE_LABELS[b.phase]}{b.seconds ? ` · ${b.seconds}s` : ''}
                </div>
                {b.text.trim() && <p className="tp-text">{b.text}</p>}
                {b.visual.trim() && <p className="tp-visual">🎬 {b.visual}</p>}
              </div>
            ))}
            {blocks.every(b => !b.text.trim() && !b.visual.trim()) && <div className="ig-empty-inline">Todavía no escribiste el guion.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FORMULARIO DE PIEZA ───

type FormTab = 'guion' | 'produccion' | 'publicacion';

export function PostForm({ initial, onSave, onClose }: {
  initial?: Partial<ContentPost>; onSave: (p: Partial<ContentPost>) => void; onClose: () => void;
}) {
  const [f, setF] = useState<Partial<ContentPost>>({
    format: 'reel', objective: CONTENT_OBJECTIVES[0], title: '', edgeLevel: 3, status: 'borrador', kind: 'organico',
    angle: 'valor', awareness: '', theme: '', howToRecord: '', refLink: '', cta: '', caption: '',
    hashtagsIg: '', hashtagsTt: '', recorded: false, edited: false, ...initial,
  });
  const [blocks, setBlocks] = useState<ScriptBlock[]>(() => initial?.content ? decodeScript(initial.content) : emptyScript());
  const [tele, setTele] = useState(false);
  const [tab, setTab] = useState<FormTab>('guion');
  const [copied, setCopied] = useState(false);

  const setBlock = (i: number, b: ScriptBlock) => setBlocks(bs => bs.map((x, idx) => idx === i ? b : x));
  const removeBlock = (i: number) => setBlocks(bs => bs.filter((_, idx) => idx !== i));
  const moveBlock = (i: number, dir: 1 | -1) => setBlocks(bs => {
    const j = i + dir; if (j < 0 || j >= bs.length) return bs;
    const copy = [...bs]; [copy[i], copy[j]] = [copy[j], copy[i]]; return copy;
  });
  const addBlock = () => setBlocks(bs => [...bs, { id: uuid(), phase: 'desarrollo', text: '', seconds: 10, visual: '', takes: [] }]);

  const progress = takeProgress(blocks);
  const angle = CONTENT_ANGLES.find(a => a.key === f.angle);
  const aw = AWARENESS_LEVELS.find(a => a.key === f.awareness);

  const save = () => {
    if (!(f.title || '').trim()) return;
    onSave({ ...f, content: encodeScript(blocks) });
    onClose();
  };

  // Copia la pieza entera como texto plano para mandarla por WhatsApp,
  // con el reel de referencia al final (así queda como preview del mensaje).
  const copyAll = () => {
    const text = scriptForShare(blocks, {
      title: f.title, angleLabel: f.angle ? CONTENT_ANGLE_LABELS[f.angle] : '',
      formatLabel: f.format ? CONTENT_FORMAT_LABELS[f.format] : '',
      howToRecord: f.howToRecord, cta: f.cta, caption: f.caption,
      hashtags: f.hashtagsIg, refLink: f.refLink,
    });
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal scr-modal" onClick={e => e.stopPropagation()}>
        <div className="scr-form-head">
          <div>
            <h2>{initial?.id ? 'Editar pieza' : 'Nueva pieza'}</h2>
            <span className="scr-form-sub">
              {totalSeconds(blocks)}s
              {progress.total > 0 && ` · ${progress.done}/${progress.total} tomas grabadas`}
            </span>
          </div>
          <div className="scr-form-head-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={copyAll}
              title="Copiar guion + referencia para mandar por WhatsApp">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar todo'}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setTele(true)}>
              <Maximize2 size={14} /> Modo grabación
            </button>
          </div>
        </div>

        <div className="scr-form-tabs">
          <button className={tab === 'guion' ? 'active' : ''} onClick={() => setTab('guion')}>Guion</button>
          <button className={tab === 'produccion' ? 'active' : ''} onClick={() => setTab('produccion')}>Producción</button>
          <button className={tab === 'publicacion' ? 'active' : ''} onClick={() => setTab('publicacion')}>Publicación</button>
        </div>

        <div className="scr-form-body">
          {tab === 'guion' && (
            <>
              <div className="ig-form">
                <div className="scr-kind">
                  {CONTENT_KINDS.map(k => (
                    <button key={k.key} type="button" className={f.kind === k.key ? 'active' : ''} onClick={() => setF({ ...f, kind: k.key })}>{k.label}</button>
                  ))}
                </div>

                <label>Título<input className="input" value={f.title || ''} autoFocus placeholder="Ej: 3 errores al vender por IG" onChange={e => setF({ ...f, title: e.target.value })} /></label>
                <label>Tema<input className="input" value={f.theme || ''} placeholder="De qué habla en una línea" onChange={e => setF({ ...f, theme: e.target.value })} /></label>

                <div className="scr-angle-row">
                  <div>
                    <label className="scr-col-label">Ángulo</label>
                    <div className="scr-angle">
                      {CONTENT_ANGLES.map(a => (
                        <button key={a.key} type="button" className={f.angle === a.key ? 'active' : ''}
                          style={f.angle === a.key ? { borderColor: a.color, color: a.color } : undefined}
                          onClick={() => setF({ ...f, angle: a.key as ContentAngle })}>{a.label}</button>
                      ))}
                    </div>
                  </div>
                  <label style={{ flex: 1 }}>Escalón de consciencia
                    <select className="select" value={f.awareness || ''} onChange={e => setF({ ...f, awareness: e.target.value as Awareness | '' })}>
                      <option value="">Sin definir</option>
                      {AWARENESS_LEVELS.map(a => <option key={a.key} value={a.key}>{a.step}. {a.label}</option>)}
                    </select>
                  </label>
                </div>
                {angle && <p className="scr-tip">{angle.hint}</p>}
                {aw && <p className="scr-tip">
                  <b>{aw.driver === 'dolor' ? '🔴 Movelo con dolor.' : '🟢 Movelo con ganancia.'}</b> {aw.hint}
                </p>}
              </div>

              <div className="scr-blocks-head">
                <span>Guion por fases</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addBlock}><Plus size={13} /> Agregar bloque</button>
              </div>
              <div className="scr-blocks">
                {blocks.map((b, i) => (
                  <BlockEditor key={b.id} block={b} index={i} total={blocks.length}
                    onChange={nb => setBlock(i, nb)} onRemove={() => removeBlock(i)} onMove={dir => moveBlock(i, dir)} />
                ))}
              </div>
            </>
          )}

          {tab === 'produccion' && (
            <div className="ig-form">
              <label>Cómo grabarlo
                <textarea className="input" rows={5} placeholder={'Ej:\n1. De frente mirando a cámara\n2. De lado, sin mirar\n3. Plano detalle del celular'}
                  value={f.howToRecord || ''} onChange={e => setF({ ...f, howToRecord: e.target.value })} />
              </label>
              <label>Link de referencia
                <div className="scr-link-row">
                  <input className="input" placeholder="https://instagram.com/reel/…" value={f.refLink || ''} onChange={e => setF({ ...f, refLink: e.target.value })} />
                  {(f.refLink || '').startsWith('http') && (
                    <a className="btn btn-secondary btn-sm" href={f.refLink} target="_blank" rel="noreferrer"><Link2 size={14} /> Abrir</a>
                  )}
                </div>
              </label>
              <div className="scr-checks">
                <label className="scr-check">
                  <input type="checkbox" checked={!!f.recorded} onChange={e => setF({ ...f, recorded: e.target.checked })} /> Grabado
                </label>
                <label className="scr-check">
                  <input type="checkbox" checked={!!f.edited} onChange={e => setF({ ...f, edited: e.target.checked })} /> Editado
                </label>
              </div>
              {progress.total > 0 && (
                <div className="ig-notice">
                  Progreso de tomas: <b>{progress.done} de {progress.total}</b>. Abrí el modo grabación para ir marcándolas.
                </div>
              )}
            </div>
          )}

          {tab === 'publicacion' && (
            <div className="ig-form">
              <div style={{ display: 'flex', gap: 10 }}>
                <label style={{ flex: 1 }}>Formato
                  <select className="select" value={f.format} onChange={e => setF({ ...f, format: e.target.value as ContentFormat })}>
                    {CONTENT_FORMATS.map(x => <option key={x} value={x}>{CONTENT_FORMAT_LABELS[x]}</option>)}
                  </select>
                </label>
                <label style={{ flex: 1 }}>Objetivo
                  <select className="select" value={f.objective} onChange={e => setF({ ...f, objective: e.target.value })}>
                    {CONTENT_OBJECTIVES.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
              </div>
              <label>CTA<input className="input" placeholder='Ej: Comentá "GUIA" y te lo mando' value={f.cta || ''} onChange={e => setF({ ...f, cta: e.target.value })} /></label>
              <label>Copy / descripción
                <textarea className="input" rows={4} placeholder="El texto que va debajo del video…" value={f.caption || ''} onChange={e => setF({ ...f, caption: e.target.value })} />
              </label>
              <label>Hashtags Instagram
                <textarea className="input" rows={2} placeholder="#nicho #tema…" value={f.hashtagsIg || ''} onChange={e => setF({ ...f, hashtagsIg: e.target.value })} />
              </label>
              <label>Hashtags TikTok
                <textarea className="input" rows={2} placeholder="#fyp #nicho…" value={f.hashtagsTt || ''} onChange={e => setF({ ...f, hashtagsTt: e.target.value })} />
              </label>
              <label>Fecha de publicación
                <input className="input" type="date" value={f.scheduledFor ? new Date(f.scheduledFor).toISOString().split('T')[0] : ''}
                  onChange={e => setF({ ...f, scheduledFor: e.target.value ? new Date(e.target.value + 'T12:00').getTime() : null })} />
              </label>
              {f.kind === 'anuncio' && (
                <div className="ig-notice">Esta pieza es la base creativa. Cargá presupuesto, audiencia y resultados en la pestaña <b>Anuncios</b>.</div>
              )}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>{initial?.id ? 'Guardar' : 'Crear'}</button>
        </div>
      </div>
      {tele && <Teleprompter title={f.title || ''} blocks={blocks} onBlocks={setBlocks} onClose={() => setTele(false)} />}
    </div>
  );
}
