import { useState, useRef, useCallback, useEffect } from 'react';
import {
  StickyNote, Square, Circle, Diamond, Pencil, MousePointer2, ArrowRight, Trash2,
  Palette, Undo2, Link2, Video, ExternalLink, Copy, Type, GripVertical,
} from 'lucide-react';
import { toEmbed, videoPlatform } from './embed';
import {
  BOARD_STICKY_COLORS, BOARD_FONT_SIZES, uuid,
  type BoardData, type BoardNode, type BoardStroke, type BoardShape,
} from './utils';

type Tool = 'select' | 'sticky' | 'box' | 'ellipse' | 'diamond' | 'pen' | 'connect';

const DEFAULT_SIZE: Record<BoardShape, { w: number; h: number }> = {
  sticky: { w: 180, h: 140 }, box: { w: 190, h: 90 }, ellipse: { w: 160, h: 160 },
  diamond: { w: 170, h: 130 }, link: { w: 220, h: 64 }, video: { w: 300, h: 190 },
};

// Pizarra estilo Miro: notas/cajas/formas arrastrables y redimensionables, links y
// videos embebidos, dibujo a mano alzada y flechas de conexión. Todo se guarda como
// JSON (nodes/edges/strokes) via onSave (debounce). Optimizada para arrastre fluido
// con pointer capture y actualización local durante el gesto (guarda al soltar).
export default function Whiteboard({ data, onSave }: { data: BoardData; onSave: (d: BoardData) => void }) {
  const [board, setBoard] = useState<BoardData>(data);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState(BOARD_STICKY_COLORS[0]);
  const [drawing, setDrawing] = useState<[number, number][] | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Gesto activo (drag/resize) — el ref evita depender del estado en los handlers
  const gesture = useRef<{ mode: 'drag' | 'resize'; id: string; offX: number; offY: number } | null>(null);
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

  // ─── canvas pointer (crear forma / dibujar / deseleccionar) ───
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.target !== canvasRef.current) return;
    const { x, y } = toCanvas(e.clientX, e.clientY);
    if (tool === 'sticky' || tool === 'box' || tool === 'ellipse' || tool === 'diamond') {
      addNode(tool, x, y); setTool('select');
    } else if (tool === 'pen') {
      canvasRef.current!.setPointerCapture(e.pointerId);
      setDrawing([[x, y]]);
    } else {
      setSelected(null);
    }
  };
  const onCanvasPointerMove = (e: React.PointerEvent) => {
    if (drawing) { const { x, y } = toCanvas(e.clientX, e.clientY); setDrawing(d => d ? [...d, [x, y]] : d); return; }
    const g = gesture.current;
    if (g) {
      const { x, y } = toCanvas(e.clientX, e.clientY);
      setBoard(b => ({
        ...b, nodes: b.nodes.map(n => {
          if (n.id !== g.id) return n;
          if (g.mode === 'drag') return { ...n, x: Math.max(0, x - g.offX), y: Math.max(0, y - g.offY) };
          return { ...n, w: Math.max(80, x - n.x), h: Math.max(48, y - n.y) }; // resize
        }),
      }));
    }
  };
  const endGesture = () => {
    if (drawing) {
      if (drawing.length > 1) commit({ ...boardRef.current, strokes: [...boardRef.current.strokes, { id: uuid(), points: drawing, color, width: 2.5 } as BoardStroke] });
      setDrawing(null);
    }
    if (gesture.current) { commit(boardRef.current); gesture.current = null; }
  };

  // ─── nodo: drag / resize / connect ───
  const startDrag = (e: React.PointerEvent, n: BoardNode) => {
    e.stopPropagation();
    setSelected(n.id);
    if (tool === 'connect') {
      if (!connectFrom) setConnectFrom(n.id);
      else if (connectFrom !== n.id) { commit({ ...board, edges: [...board.edges, { id: uuid(), from: connectFrom, to: n.id }] }); setConnectFrom(null); setTool('select'); }
      return;
    }
    const { x, y } = toCanvas(e.clientX, e.clientY);
    gesture.current = { mode: 'drag', id: n.id, offX: x - n.x, offY: y - n.y };
    // capturar en el CANVAS (donde vive onPointerMove/Up), no en el grip
    canvasRef.current!.setPointerCapture(e.pointerId);
  };
  const startResize = (e: React.PointerEvent, n: BoardNode) => {
    e.stopPropagation();
    gesture.current = { mode: 'resize', id: n.id, offX: 0, offY: 0 };
    canvasRef.current!.setPointerCapture(e.pointerId);
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

  return (
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
        {tool === 'connect' && <span className="wb-hint">{connectFrom ? 'Tocá el segundo elemento…' : 'Tocá el primer elemento a conectar'}</span>}
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

              {sel && <div className="wb-resize" onPointerDown={e => startResize(e, n)} title="Redimensionar" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
