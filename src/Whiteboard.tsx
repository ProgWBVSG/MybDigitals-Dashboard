import { useState, useRef, useCallback, useEffect } from 'react';
import { StickyNote, Square, Pencil, MousePointer2, ArrowRight, Trash2, Palette, Undo2 } from 'lucide-react';
import { BOARD_STICKY_COLORS, uuid, type BoardData, type BoardNode, type BoardStroke } from './utils';

type Tool = 'select' | 'sticky' | 'box' | 'pen' | 'connect';

// Pizarra estilo Miro: notas/cajas arrastrables, dibujo a mano alzada y flechas de
// conexión entre elementos. Todo se guarda como JSON (nodes/edges/strokes) via onSave.
export default function Whiteboard({ data, onSave }: { data: BoardData; onSave: (d: BoardData) => void }) {
  const [board, setBoard] = useState<BoardData>(data);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState(BOARD_STICKY_COLORS[0]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 });
  const [drawing, setDrawing] = useState<[number, number][] | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setBoard(data), [data]);

  const scheduleSave = useCallback((next: BoardData) => {
    setBoard(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onSave(next), 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSave]);

  const toCanvas = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: clientX - r.left + canvasRef.current!.scrollLeft, y: clientY - r.top + canvasRef.current!.scrollTop };
  };

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.target !== canvasRef.current) return;
    const { x, y } = toCanvas(e.clientX, e.clientY);
    if (tool === 'sticky' || tool === 'box') {
      const node: BoardNode = { id: uuid(), x, y, w: 180, h: tool === 'sticky' ? 140 : 90, text: '', color, shape: tool };
      scheduleSave({ ...board, nodes: [...board.nodes, node] });
      setTool('select'); setSelected(node.id);
    } else if (tool === 'pen') {
      setDrawing([[x, y]]);
    } else {
      setSelected(null);
    }
  };
  const onCanvasPointerMove = (e: React.PointerEvent) => {
    if (drawing) { const { x, y } = toCanvas(e.clientX, e.clientY); setDrawing(d => d ? [...d, [x, y]] : d); return; }
    if (dragId) {
      const { x, y } = toCanvas(e.clientX, e.clientY);
      setBoard(b => ({ ...b, nodes: b.nodes.map(n => n.id === dragId ? { ...n, x: x - dragOff.x, y: y - dragOff.y } : n) }));
    }
  };
  const onCanvasPointerUp = () => {
    if (drawing && drawing.length > 1) {
      const stroke: BoardStroke = { id: uuid(), points: drawing, color, width: 2.5 };
      scheduleSave({ ...board, strokes: [...board.strokes, stroke] });
    }
    setDrawing(null);
    if (dragId) scheduleSave(board);
    setDragId(null);
  };

  const startDragNode = (e: React.PointerEvent, n: BoardNode) => {
    e.stopPropagation();
    if (tool === 'connect') {
      if (!connectFrom) setConnectFrom(n.id);
      else if (connectFrom !== n.id) {
        scheduleSave({ ...board, edges: [...board.edges, { id: uuid(), from: connectFrom, to: n.id }] });
        setConnectFrom(null); setTool('select');
      }
      return;
    }
    setSelected(n.id);
    if (tool !== 'select') return;
    const { x, y } = toCanvas(e.clientX, e.clientY);
    setDragId(n.id);
    setDragOff({ x: x - n.x, y: y - n.y });
  };

  const updateText = (id: string, text: string) => scheduleSave({ ...board, nodes: board.nodes.map(n => n.id === id ? { ...n, text } : n) });
  const deleteSelected = () => {
    if (!selected) return;
    scheduleSave({ ...board, nodes: board.nodes.filter(n => n.id !== selected), edges: board.edges.filter(e => e.from !== selected && e.to !== selected) });
    setSelected(null);
  };
  const undoStroke = () => scheduleSave({ ...board, strokes: board.strokes.slice(0, -1) });
  const clearAll = () => { if (window.confirm('¿Vaciar toda la pizarra?')) scheduleSave({ nodes: [], edges: [], strokes: [] }); };

  const pathOf = (pts: [number, number][]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const nodeById = (id: string) => board.nodes.find(n => n.id === id);

  return (
    <div className="wb-wrap">
      <div className="wb-toolbar">
        <button className={`wb-tool ${tool === 'select' ? 'on' : ''}`} title="Seleccionar / mover" onClick={() => { setTool('select'); setConnectFrom(null); }}><MousePointer2 size={16} /></button>
        <button className={`wb-tool ${tool === 'sticky' ? 'on' : ''}`} title="Nota adhesiva" onClick={() => setTool('sticky')}><StickyNote size={16} /></button>
        <button className={`wb-tool ${tool === 'box' ? 'on' : ''}`} title="Caja / paso" onClick={() => setTool('box')}><Square size={16} /></button>
        <button className={`wb-tool ${tool === 'connect' ? 'on' : ''}`} title="Conectar con flecha" onClick={() => { setTool('connect'); setConnectFrom(null); }}><ArrowRight size={16} /></button>
        <button className={`wb-tool ${tool === 'pen' ? 'on' : ''}`} title="Dibujar a mano alzada" onClick={() => setTool('pen')}><Pencil size={16} /></button>
        <span className="wb-sep" />
        <div className="wb-colors"><Palette size={14} style={{ color: 'var(--text-muted)' }} />
          {BOARD_STICKY_COLORS.map(c => <button key={c} className={`wb-color ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />)}
        </div>
        <span className="wb-sep" />
        <button className="wb-tool" title="Deshacer último trazo" onClick={undoStroke} disabled={!board.strokes.length}><Undo2 size={16} /></button>
        <button className="wb-tool" title="Borrar seleccionado" onClick={deleteSelected} disabled={!selected}><Trash2 size={16} /></button>
        <button className="wb-clear" onClick={clearAll}>Vaciar pizarra</button>
        {tool === 'connect' && <span className="wb-hint">{connectFrom ? 'Tocá el segundo elemento…' : 'Tocá el primer elemento a conectar'}</span>}
      </div>

      <div ref={canvasRef} className={`wb-canvas tool-${tool}`}
        onPointerDown={onCanvasPointerDown} onPointerMove={onCanvasPointerMove} onPointerUp={onCanvasPointerUp} onPointerLeave={onCanvasPointerUp}>
        <svg className="wb-svg" width="3000" height="1800">
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
        {board.nodes.map(n => (
          <div key={n.id} className={`wb-node ${n.shape} ${selected === n.id ? 'sel' : ''} ${connectFrom === n.id ? 'connecting' : ''}`}
            style={{ left: n.x, top: n.y, width: n.w, height: n.h, background: n.shape === 'sticky' ? n.color : 'var(--bg-card)', borderColor: n.shape === 'box' ? n.color : 'transparent' }}
            onPointerDown={e => startDragNode(e, n)}>
            <textarea value={n.text} placeholder="Escribí acá…" onPointerDown={e => e.stopPropagation()} onChange={e => updateText(n.id, e.target.value)} />
          </div>
        ))}
      </div>
    </div>
  );
}
