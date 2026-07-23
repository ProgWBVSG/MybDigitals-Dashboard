import { useState, useRef, useCallback, useEffect } from 'react';
import {
  StickyNote, Square, Circle, Diamond, Pencil, MousePointer2, ArrowRight, Trash2,
  Palette, Undo2, Link2, Video, ExternalLink, Copy, Type, GripVertical, Zap, Loader2,
  Eraser, LayoutTemplate,
} from 'lucide-react';
import { toEmbed, videoPlatform } from './embed';
import {
  BOARD_STICKY_COLORS, BOARD_FONT_SIZES, NODE_STAGE_STATUSES, uuid,
  type BoardData, type BoardNode, type BoardStroke, type BoardShape, type NodeStageStatus,
} from './utils';
import { fireNodeWebhook } from './hooks';
import { BOARD_TEMPLATES, placeTemplate, type BoardTemplate } from './boardTemplates';

type Tool = 'select' | 'sticky' | 'box' | 'ellipse' | 'diamond' | 'pen' | 'eraser' | 'connect';

const DEFAULT_SIZE: Record<BoardShape, { w: number; h: number }> = {
  sticky: { w: 180, h: 140 }, box: { w: 190, h: 90 }, ellipse: { w: 160, h: 160 },
  diamond: { w: 170, h: 130 }, link: { w: 220, h: 64 }, video: { w: 300, h: 190 },
};

const GRID = 8;           // grilla invisible a la que se ajusta todo al arrastrar/redimensionar
const SNAP = 6;           // distancia (px) para "engancharse" a la guía de otro elemento
const snapGrid = (v: number) => Math.round(v / GRID) * GRID;
const ERASE_RADIUS = 14;

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function strokeHit(s: BoardStroke, x: number, y: number, r: number) {
  const pts = s.points;
  if (pts.length === 1) return Math.hypot(x - pts[0][0], y - pts[0][1]) <= r;
  for (let i = 1; i < pts.length; i++) if (distToSegment(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= r) return true;
  return false;
}

// Guías inteligentes: ajusta la posición del nodo arrastrado a los bordes/centros de los
// demás nodos (estilo Figma/Miro) y devuelve dónde dibujar la línea guía, si enganchó.
function snapToSiblings(n: BoardNode, nx: number, ny: number, others: BoardNode[]) {
  let x = snapGrid(nx), y = snapGrid(ny), guideX: number | null = null, guideY: number | null = null;
  let bestDx = SNAP + 1, bestDy = SNAP + 1;
  const myX = [nx, nx + n.w / 2, nx + n.w];
  const myY = [ny, ny + n.h / 2, ny + n.h];
  for (const o of others) {
    if (o.id === n.id) continue;
    const oX = [o.x, o.x + o.w / 2, o.x + o.w];
    const oY = [o.y, o.y + o.h / 2, o.y + o.h];
    myX.forEach((mx, i) => oX.forEach(ox => {
      const d = Math.abs(mx - ox);
      if (d < bestDx) { bestDx = d; guideX = ox; x = ox - [0, n.w / 2, n.w][i]; }
    }));
    myY.forEach((my, i) => oY.forEach(oy => {
      const d = Math.abs(my - oy);
      if (d < bestDy) { bestDy = d; guideY = oy; y = oy - [0, n.h / 2, n.h][i]; }
    }));
  }
  return { x: bestDx <= SNAP ? x : snapGrid(nx), y: bestDy <= SNAP ? y : snapGrid(ny), guideX: bestDx <= SNAP ? guideX : null, guideY: bestDy <= SNAP ? guideY : null };
}

// Pizarra estilo Miro: notas/cajas/formas arrastrables y redimensionables, links y
// videos embebidos, dibujo a mano alzada y flechas de conexión. Todo se guarda como
// JSON (nodes/edges/strokes) via onSave (debounce). Optimizada para arrastre fluido
// con pointer capture y actualización local durante el gesto (guarda al soltar).
interface WhiteboardProps {
  data: BoardData; onSave: (d: BoardData) => void;
  // Panel de automatización (solo para pizarras de Estrategia, kind='embudo')
  automation?: boolean; boardId?: string; clients?: { id: string; name: string }[];
}
export default function Whiteboard({ data, onSave, automation, boardId, clients }: WhiteboardProps) {
  const [board, setBoard] = useState<BoardData>(data);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState(BOARD_STICKY_COLORS[0]);
  const [drawing, setDrawing] = useState<[number, number][] | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [firing, setFiring] = useState(false);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Gesto activo (drag/resize) — el ref evita depender del estado en los handlers
  const gesture = useRef<{ mode: 'drag' | 'resize'; id: string; offX: number; offY: number } | null>(null);
  const erasing = useRef(false);
  const boardRef = useRef(board);
  boardRef.current = board;

  useEffect(() => setBoard(data), [data]);

  const commit = useCallback((next: BoardData) => {
    setBoard(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onSave(next), 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSave]);

  const toCanvas = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: clientX - r.left + canvasRef.current!.scrollLeft, y: clientY - r.top + canvasRef.current!.scrollTop };
  };
  // setPointerCapture puede fallar en algunos casos borde (el navegador ya soltó el puntero,
  // etc.) — nunca debe cortar el gesto en curso, así que el estado ya se actualiza ANTES de
  // llamar a esto y acá solo se intenta, sin bloquear nada si falla.
  const tryCapture = (id: number) => { try { canvasRef.current?.setPointerCapture(id); } catch { /* noop */ } };

  const selectedNode = board.nodes.find(n => n.id === selected) || null;

  // ─── crear nodos ───
  const addNode = (shape: BoardShape, x: number, y: number, extra?: Partial<BoardNode>) => {
    const size = DEFAULT_SIZE[shape];
    const node: BoardNode = { id: uuid(), x, y, w: size.w, h: size.h, text: '', color, shape, fontSize: 15, ...extra };
    commit({ ...board, nodes: [...board.nodes, node] });
    setSelected(node.id);
    return node;
  };

  const addLink = () => {
    const url = window.prompt('Pegá el link (web, doc, drive, etc.)');
    if (!url) return;
    const label = window.prompt('Texto para mostrar (opcional)', '') || url;
    const c = toCanvas(0, 0);
    addNode('link', c.x + 40, c.y + 40, { url: url.trim(), text: label.trim() });
    setTool('select');
  };
  const addVideo = () => {
    const url = window.prompt('Pegá el link del video (YouTube, Instagram, Loom)');
    if (!url) return;
    const c = toCanvas(0, 0);
    addNode('video', c.x + 40, c.y + 40, { url: url.trim(), text: videoPlatform(url) });
    setTool('select');
  };

  const eraseAt = (x: number, y: number) => {
    setBoard(b => {
      const kept = b.strokes.filter(s => !strokeHit(s, x, y, ERASE_RADIUS));
      return kept.length === b.strokes.length ? b : { ...b, strokes: kept };
    });
  };

  // ─── canvas pointer (crear forma / dibujar / borrar / deseleccionar) ───
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.target !== canvasRef.current) return;
    const { x, y } = toCanvas(e.clientX, e.clientY);
    if (tool === 'sticky' || tool === 'box' || tool === 'ellipse' || tool === 'diamond') {
      addNode(tool, x, y); setTool('select');
    } else if (tool === 'pen') {
      setDrawing([[x, y]]);
      tryCapture(e.pointerId);
    } else if (tool === 'eraser') {
      erasing.current = true;
      eraseAt(x, y);
      tryCapture(e.pointerId);
    } else {
      setSelected(null);
    }
  };
  const onCanvasPointerMove = (e: React.PointerEvent) => {
    if (drawing) { const { x, y } = toCanvas(e.clientX, e.clientY); setDrawing(d => d ? [...d, [x, y]] : d); return; }
    if (erasing.current) { const { x, y } = toCanvas(e.clientX, e.clientY); eraseAt(x, y); return; }
    const g = gesture.current;
    if (g) {
      const { x, y } = toCanvas(e.clientX, e.clientY);
      setBoard(b => {
        const cur = b.nodes.find(n => n.id === g.id);
        if (!cur) return b;
        if (g.mode === 'drag') {
          const snapped = snapToSiblings(cur, x - g.offX, y - g.offY, b.nodes);
          setGuides({ x: snapped.guideX, y: snapped.guideY });
          return { ...b, nodes: b.nodes.map(n => n.id === g.id ? { ...n, x: Math.max(0, snapped.x), y: Math.max(0, snapped.y) } : n) };
        }
        // resize: ajustado a la grilla, prolijo sin decimales sueltos
        const w = Math.max(80, snapGrid(x - cur.x)), h = Math.max(48, snapGrid(y - cur.y));
        return { ...b, nodes: b.nodes.map(n => n.id === g.id ? { ...n, w, h } : n) };
      });
    }
  };
  const endGesture = () => {
    if (drawing) {
      if (drawing.length > 1) commit({ ...boardRef.current, strokes: [...boardRef.current.strokes, { id: uuid(), points: drawing, color, width: 2.5 } as BoardStroke] });
      setDrawing(null);
    }
    if (erasing.current) { commit(boardRef.current); erasing.current = false; }
    if (gesture.current) { commit(boardRef.current); gesture.current = null; setGuides({ x: null, y: null }); }
  };

  // ─── nodo: drag / resize / connect ───
  const startDrag = (e: React.PointerEvent, n: BoardNode) => {
    e.stopPropagation();
    setSelected(n.id);
    if (tool === 'connect') {
      if (!connectFrom) setConnectFrom(n.id);
      else if (connectFrom !== n.id) {
        commit({ ...board, edges: [...board.edges, { id: uuid(), from: connectFrom, to: n.id }] });
        // Sigue en modo "conectar" y encadena desde el nodo recién unido (A→B, tocás C y
        // sigue B→C, etc.) — así se conectan varias partes seguidas sin volver a tocar la
        // herramienta cada vez. Tocar el mismo botón de nuevo, Esc, o "Seleccionar" corta la cadena.
        setConnectFrom(n.id);
      }
      return;
    }
    const { x, y } = toCanvas(e.clientX, e.clientY);
    gesture.current = { mode: 'drag', id: n.id, offX: x - n.x, offY: y - n.y };
    // capturar en el CANVAS (donde vive onPointerMove/Up), no en el grip
    tryCapture(e.pointerId);
  };
  const startResize = (e: React.PointerEvent, n: BoardNode) => {
    e.stopPropagation();
    gesture.current = { mode: 'resize', id: n.id, offX: 0, offY: 0 };
    tryCapture(e.pointerId);
  };

  // ─── ediciones sobre nodo ───
  const patchNode = (id: string, patch: Partial<BoardNode>) => commit({ ...board, nodes: board.nodes.map(n => n.id === id ? { ...n, ...patch } : n) });
  const deleteNode = (id: string) => { commit({ ...board, nodes: board.nodes.filter(n => n.id !== id), edges: board.edges.filter(e => e.from !== id && e.to !== id) }); setSelected(null); };
  const duplicateNode = (n: BoardNode) => { const c = addNode(n.shape, n.x + 24, n.y + 24, { text: n.text, url: n.url, color: n.color, fontSize: n.fontSize }); patchNode(c.id, { w: n.w, h: n.h }); };
  const bumpFont = (n: BoardNode, dir: 1 | -1) => {
    const cur = n.fontSize || 15; let idx = BOARD_FONT_SIZES.findIndex(s => s === cur);
    if (idx < 0) idx = BOARD_FONT_SIZES.findIndex(s => s >= cur);
    if (idx < 0) idx = BOARD_FONT_SIZES.length - 1;
    const next = BOARD_FONT_SIZES[Math.min(BOARD_FONT_SIZES.length - 1, Math.max(0, idx + dir))];
    patchNode(n.id, { fontSize: next });
  };
  const pickColor = (c: string) => { setColor(c); if (selectedNode) patchNode(selectedNode.id, { color: c }); };
  const editUrl = (n: BoardNode) => { const url = window.prompt('Editar link', n.url || ''); if (url !== null) patchNode(n.id, { url: url.trim() }); };

  const insertTemplate = (tpl: BoardTemplate) => {
    const { nodes, edges } = placeTemplate(tpl, board.nodes);
    commit({ ...board, nodes: [...board.nodes, ...nodes], edges: [...board.edges, ...edges] });
    setTemplatesOpen(false);
    setTool('select');
  };

  const fire = async (n: BoardNode) => {
    if (!boardId || firing) return;
    setFiring(true);
    await fireNodeWebhook(boardId, n);
    setFiring(false);
  };

  const undoStroke = () => commit({ ...board, strokes: board.strokes.slice(0, -1) });
  const clearAll = () => { if (window.confirm('¿Vaciar toda la pizarra?')) commit({ nodes: [], edges: [], strokes: [] }); };

  // teclado: Supr borra, Esc deselecciona (ignora si se está escribiendo)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); deleteNode(selected); }
      if (e.key === 'Escape') { setSelected(null); setConnectFrom(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, board]);

  const pathOf = (pts: [number, number][]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const nodeById = (id: string) => board.nodes.find(n => n.id === id);

  const T = (t: Tool, icon: React.ReactNode, label: string) => (
    <button className={`wb-tool ${tool === t ? 'on' : ''}`} title={label} onClick={() => { setTool(t); setConnectFrom(null); }}>{icon}</button>
  );

  const stageAutomation = automation && !!selectedNode && selectedNode.shape !== 'link' && selectedNode.shape !== 'video';

  return (
    <div className="wb-outer">
    <div className="wb-wrap">
      <div className="wb-toolbar">
        {T('select', <MousePointer2 size={16} />, 'Seleccionar / mover')}
        {T('sticky', <StickyNote size={16} />, 'Nota adhesiva')}
        {T('box', <Square size={16} />, 'Caja / paso')}
        {T('ellipse', <Circle size={16} />, 'Óvalo')}
        {T('diamond', <Diamond size={16} />, 'Rombo / decisión')}
        <button className="wb-tool" title="Agregar link" onClick={addLink}><Link2 size={16} /></button>
        <button className="wb-tool" title="Agregar video (YouTube/IG/Loom)" onClick={addVideo}><Video size={16} /></button>
        {T('connect', <ArrowRight size={16} />, 'Conectar con flecha')}
        {T('pen', <Pencil size={16} />, 'Dibujar a mano alzada')}
        {T('eraser', <Eraser size={16} />, 'Goma de borrar (tocá o arrastrá sobre un trazo)')}
        <button className="wb-tool" title="Plantillas inteligentes" onClick={() => setTemplatesOpen(true)}><LayoutTemplate size={16} /></button>
        <span className="wb-sep" />
        <div className="wb-colors"><Palette size={14} style={{ color: 'var(--text-muted)' }} />
          {BOARD_STICKY_COLORS.map(c => <button key={c} className={`wb-color ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => pickColor(c)} />)}
        </div>
        {selectedNode && selectedNode.shape !== 'video' && (
          <>
            <span className="wb-sep" />
            <span className="wb-fontgrp" title="Tamaño de letra">
              <Type size={14} style={{ color: 'var(--text-muted)' }} />
              <button className="wb-tool sm" onClick={() => bumpFont(selectedNode, -1)}>A−</button>
              <button className="wb-tool sm" onClick={() => bumpFont(selectedNode, 1)}>A+</button>
            </span>
          </>
        )}
        <span className="wb-sep" />
        {selectedNode && <button className="wb-tool" title="Duplicar" onClick={() => duplicateNode(selectedNode)}><Copy size={16} /></button>}
        <button className="wb-tool" title="Deshacer último trazo" onClick={undoStroke} disabled={!board.strokes.length}><Undo2 size={16} /></button>
        <button className="wb-tool" title="Borrar seleccionado" onClick={() => selected && deleteNode(selected)} disabled={!selected}><Trash2 size={16} /></button>
        <button className="wb-clear" onClick={clearAll}>Vaciar</button>
        {tool === 'connect' && <span className="wb-hint">{connectFrom ? 'Tocá el siguiente para conectarlo (podés seguir encadenando)' : 'Tocá el primer elemento a conectar'}</span>}
      </div>

      <div ref={canvasRef} className={`wb-canvas tool-${tool}`}
        onPointerDown={onCanvasPointerDown} onPointerMove={onCanvasPointerMove} onPointerUp={endGesture} onPointerCancel={endGesture}>
        <svg className="wb-svg" width="4000" height="2600">
          {board.edges.map(e => {
            const a = nodeById(e.from), b = nodeById(e.to);
            if (!a || !b) return null;
            const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
            return <line key={e.id} x1={ax} y1={ay} x2={bx} y2={by} stroke="#818cf8" strokeWidth={2} markerEnd="url(#wb-arrow)" />;
          })}
          {board.strokes.map(s => <path key={s.id} d={pathOf(s.points)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
          {drawing && <path d={pathOf(drawing)} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
          {guides.x != null && <line x1={guides.x} y1={0} x2={guides.x} y2={2600} stroke="#f472b6" strokeWidth={1.5} strokeDasharray="5 4" />}
          {guides.y != null && <line x1={0} y1={guides.y} x2={4000} y2={guides.y} stroke="#f472b6" strokeWidth={1.5} strokeDasharray="5 4" />}
          <defs><marker id="wb-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#818cf8" /></marker></defs>
        </svg>

        {board.nodes.map(n => {
          const sel = selected === n.id, connecting = connectFrom === n.id;
          const fs = n.fontSize || 15;
          const isText = n.shape === 'sticky' || n.shape === 'box' || n.shape === 'ellipse' || n.shape === 'diamond';
          const bg = n.shape === 'sticky' ? n.color : (n.shape === 'ellipse' || n.shape === 'diamond') ? `${n.color}22` : 'var(--bg-card)';
          const border = (n.shape === 'box' || n.shape === 'ellipse' || n.shape === 'diamond') ? n.color : 'transparent';
          return (
            <div key={n.id} className={`wb-node ${n.shape} ${sel ? 'sel' : ''} ${connecting ? 'connecting' : ''}`}
              style={{ left: n.x, top: n.y, width: n.w, height: n.h, background: bg, borderColor: border, ['--wbc' as string]: n.color } as React.CSSProperties}>
              {/* grip de arrastre */}
              <div className="wb-grip" onPointerDown={e => startDrag(e, n)} title="Arrastrar"><GripVertical size={13} /></div>

              {isText && (
                <textarea value={n.text} placeholder="Escribí…" style={{ fontSize: fs, lineHeight: 1.3 }}
                  onPointerDown={e => e.stopPropagation()} onFocus={() => setSelected(n.id)}
                  onChange={e => patchNode(n.id, { text: e.target.value })} />
              )}

              {n.shape === 'link' && (
                <div className="wb-link">
                  <Link2 size={16} />
                  <a href={n.url} target="_blank" rel="noreferrer" style={{ fontSize: fs }} onPointerDown={e => e.stopPropagation()} title={n.url}>{n.text || n.url}</a>
                  <button className="wb-mini" title="Editar link" onPointerDown={e => e.stopPropagation()} onClick={() => editUrl(n)}><Pencil size={12} /></button>
                </div>
              )}

              {n.shape === 'video' && (
                <div className="wb-video">
                  <div className="wb-videobar" onPointerDown={e => startDrag(e, n)}>
                    <span>{videoPlatform(n.url || '')}</span>
                    <span style={{ display: 'flex', gap: 4 }}>
                      <button className="wb-mini" title="Abrir" onPointerDown={e => e.stopPropagation()} onClick={() => n.url && window.open(n.url, '_blank')}><ExternalLink size={12} /></button>
                      <button className="wb-mini" title="Cambiar link" onPointerDown={e => e.stopPropagation()} onClick={() => editUrl(n)}><Pencil size={12} /></button>
                    </span>
                  </div>
                  <iframe src={toEmbed(n.url || '')} title={n.id} allow="encrypted-media; picture-in-picture" allowFullScreen />
                </div>
              )}

              {automation && n.stageStatus && n.shape !== 'link' && n.shape !== 'video' && (
                <span className="wb-status-dot" style={{ background: NODE_STAGE_STATUSES.find(s => s.key === n.stageStatus)?.color }} title={NODE_STAGE_STATUSES.find(s => s.key === n.stageStatus)?.label} />
              )}

              {sel && <div className="wb-resize" onPointerDown={e => startResize(e, n)} title="Redimensionar" />}
            </div>
          );
        })}
      </div>
    </div>

    {stageAutomation && selectedNode && (
      <div className="wb-panel">
        <h4>Automatización del nodo</h4>
        <div className="input-group">
          <label>Cliente</label>
          <select className="select" value={selectedNode.clientId || ''} onChange={e => patchNode(selectedNode.id, { clientId: e.target.value || null })}>
            <option value="">Sin cliente / general</option>
            {(clients || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label>Estado de la etapa</label>
          <select className="select" value={selectedNode.stageStatus || 'pending'} onChange={e => patchNode(selectedNode.id, { stageStatus: e.target.value as NodeStageStatus })}>
            {NODE_STAGE_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label>Tasa de conversión (%)</label>
          <input className="input" type="number" min={0} max={100} value={selectedNode.conversionRate ?? ''}
            onChange={e => patchNode(selectedNode.id, { conversionRate: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
        <div className="input-group">
          <label>Webhook n8n</label>
          <input className="input" placeholder="https://n8n.tuservidor.com/webhook/..." value={selectedNode.webhookUrl || ''}
            onChange={e => patchNode(selectedNode.id, { webhookUrl: e.target.value })} />
        </div>
        <button className="btn btn-primary btn-sm wb-fire" disabled={!selectedNode.webhookUrl || firing} onClick={() => fire(selectedNode)}>
          {firing ? <><Loader2 size={14} className="wb-spin" /> Disparando…</> : <><Zap size={14} /> Disparar automatización</>}
        </button>
        <p className="wb-panel-hint">Envía el contexto de este nodo a n8n vía POST. Queda logueado.</p>
      </div>
    )}

    {templatesOpen && (
      <div className="modal-overlay" onClick={() => setTemplatesOpen(false)}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
          <h2>Plantillas inteligentes</h2>
          <p className="confirm-text" style={{ marginBottom: 4 }}>Se insertan ya armadas y conectadas, debajo de lo que tengas en la pizarra.</p>
          <div className="wb-tpl-grid">
            {BOARD_TEMPLATES.map(t => (
              <button key={t.key} className="wb-tpl-card" onClick={() => insertTemplate(t)}>
                <span className="wb-tpl-emoji">{t.emoji}</span>
                <strong>{t.label}</strong>
                <span>{t.description}</span>
              </button>
            ))}
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setTemplatesOpen(false)}>Cerrar</button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
