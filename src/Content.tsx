import { useState, useMemo } from 'react';
import { Sparkles, Plug, Plus, Trash2, ChevronLeft, ChevronRight, CheckCircle2, Send, Maximize2, X, ArrowUp, ArrowDown } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useContent } from './hooks';
import {
  CONTENT_STATUSES, CONTENT_FORMATS, CONTENT_FORMAT_LABELS, CONTENT_OBJECTIVES, CONTENT_KINDS, uuid,
  AD_FORMATS, AD_FORMAT_LABELS, AD_OBJECTIVES, AD_OBJECTIVE_RESULT_LABEL, AD_STATUSES,
  type ContentPost, type ContentStatus, type ContentFormat, type ContentAd, type AdFormat, type AdStatus,
} from './utils';
import {
  SCRIPT_PHASES, SCRIPT_PHASE_LABELS, SCRIPT_PHASE_COLORS, emptyScript, decodeScript, encodeScript, scriptPreview, totalSeconds, isStructuredScript,
  type ScriptBlock, type ScriptPhase,
} from './script';
import './Content.css';

type Tab = 'resumen' | 'ideas' | 'guiones' | 'tabla' | 'pipeline' | 'calendario' | 'generador' | 'anuncios' | 'fuentes' | 'conexion';
const TABS: { k: Tab; label: string }[] = [
  { k: 'resumen', label: 'Resumen' },
  { k: 'ideas', label: 'Ideas ✨' },
  { k: 'guiones', label: 'Guiones 🎬' },
  { k: 'tabla', label: 'Tabla ⚡' },
  { k: 'pipeline', label: 'Pipeline' },
  { k: 'calendario', label: 'Calendario' },
  { k: 'generador', label: 'Generador' },
  { k: 'anuncios', label: 'Anuncios 📊' },
  { k: 'fuentes', label: 'Fuentes' },
  { k: 'conexion', label: 'Conexión IG' },
];
const STATUS_ORDER: ContentStatus[] = ['borrador', 'aprobado', 'listo'];

export default function Content() {
  const [tab, setTab] = useState<Tab>('resumen');
  const c = useContent();
  return (
    <div className="ig">
      <div className="ig-head">
        <div className="ig-title">
          <span className="ig-logo">IG</span>
          <div><h2>IG Content</h2><p>Centro de contenido para Instagram</p></div>
        </div>
        <span className="ig-pill">{c.posts.length} piezas · {c.sources.length} fuentes</span>
      </div>

      <div className="ig-tabs">
        {TABS.map(t => <button key={t.k} className={tab === t.k ? 'active' : ''} onClick={() => setTab(t.k)}>{t.label}</button>)}
      </div>

      <div className="ig-body">
        {tab === 'resumen' && <Resumen posts={c.posts} onGo={setTab} />}
        {tab === 'ideas' && <Ideas c={c} />}
        {tab === 'guiones' && <Guiones c={c} />}
        {tab === 'tabla' && <Tabla c={c} />}
        {tab === 'pipeline' && <Pipeline c={c} />}
        {tab === 'calendario' && <Calendario posts={c.posts} />}
        {tab === 'generador' && <Generador c={c} onDone={() => setTab('pipeline')} />}
        {tab === 'anuncios' && <Anuncios c={c} />}
        {tab === 'fuentes' && <Fuentes c={c} />}
        {tab === 'conexion' && <Conexion />}
      </div>
    </div>
  );
}

const fmtBadge = (f: ContentFormat) => <span className={`ig-badge ${f}`}>{CONTENT_FORMAT_LABELS[f]}</span>;
const FORMAT_COLOR: Record<ContentFormat, string> = { reel: '#f9587a', carrusel: '#a64bf4', story: '#ffaa3a', ad: '#6366f1' };

function Resumen({ posts, onGo }: { posts: ContentPost[]; onGo: (t: Tab) => void }) {
  const by = (s: ContentStatus) => posts.filter(p => p.status === s).length;
  const metrics = [
    { label: 'En borrador', value: by('borrador') },
    { label: 'Aprobadas', value: by('aprobado') },
    { label: 'Listas para publicar', value: by('listo') },
    { label: 'Total de piezas', value: posts.length },
  ];
  const listas = posts.filter(p => p.status === 'listo');

  // Distribución por formato (gráfico de torta)
  const formatData = useMemo(() => CONTENT_FORMATS
    .map(f => ({ name: CONTENT_FORMAT_LABELS[f], value: posts.filter(p => p.format === f).length, color: FORMAT_COLOR[f] }))
    .filter(d => d.value > 0), [posts]);

  // Producción por semana (últimas 6, gráfico de barras)
  const weekData = useMemo(() => {
    const now = new Date(); const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return Array.from({ length: 6 }, (_, i) => {
      const start = new Date(monday); start.setDate(monday.getDate() - (5 - i) * 7);
      const end = new Date(start); end.setDate(start.getDate() + 7);
      const count = posts.filter(p => { const t = new Date(p.createdAt).getTime(); return t >= start.getTime() && t < end.getTime(); }).length;
      return { label: start.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }), piezas: count };
    });
  }, [posts]);

  const funnel = [
    { label: 'Borrador', value: by('borrador'), color: '#64748b' },
    { label: 'Aprobado', value: by('aprobado'), color: '#6366f1' },
    { label: 'Listo', value: by('listo'), color: '#10b981' },
  ];
  const maxF = Math.max(1, ...funnel.map(f => f.value));

  return (
    <div className="ig-stack">
      <div className="ig-metrics">
        {metrics.map(m => (
          <div key={m.label} className="ig-metric">
            <div className="ig-metric-top"><span>{m.label}</span></div>
            <strong>{m.value}</strong>
          </div>
        ))}
      </div>

      <div className="ig-charts">
        <div className="ig-card">
          <div className="ig-card-head"><div><p className="ig-eyebrow">Producción</p><h3>Piezas por semana</h3></div></div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={weekData} barCategoryGap="28%">
              <XAxis dataKey="label" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} width={24} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 13 }} />
              <Bar dataKey="piezas" fill="#a64bf4" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="ig-card">
          <div className="ig-card-head"><div><p className="ig-eyebrow">Mix</p><h3>Por formato</h3></div></div>
          {formatData.length === 0 ? (
            <div className="ig-empty-inline" style={{ height: 200 }}>Cargá piezas para ver el mix.</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={formatData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                  {formatData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="ig-legend">
            {formatData.map(d => <span key={d.name}><i style={{ background: d.color }} />{d.name} ({d.value})</span>)}
          </div>
        </div>
      </div>

      <div className="ig-card">
        <div className="ig-card-head"><div><p className="ig-eyebrow">Pipeline</p><h3>Embudo de producción</h3></div></div>
        <div className="ig-funnel">
          {funnel.map(f => (
            <div key={f.label} className="ig-funnel-row">
              <span className="ig-funnel-label">{f.label}</span>
              <div className="ig-funnel-bar"><div style={{ width: `${(f.value / maxF) * 100}%`, background: f.color }} /></div>
              <span className="ig-funnel-val">{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ig-card">
        <div className="ig-card-head">
          <div><p className="ig-eyebrow">Para hoy</p><h3>Listas para publicar</h3></div>
          <button className="btn btn-secondary btn-sm" onClick={() => onGo('pipeline')}>Ver pipeline</button>
        </div>
        {listas.length === 0
          ? <div className="ig-empty-inline">Todavía no hay piezas marcadas como "Listo para publicar". Movélas en el Pipeline cuando estén aprobadas.</div>
          : <div className="ig-ready-list">{listas.map(p => <div key={p.id} className="ig-ready"><CheckCircle2 size={15} />{fmtBadge(p.format)}<span>{p.title || 'Sin título'}</span></div>)}</div>}
      </div>

      <div className="ig-card ig-note">
        <strong>📈 Métricas de la cuenta (seguidores, alcance, engagement)</strong>
        <p>Se cargan al conectar Instagram (pestaña "Conexión IG", Fase 4). Por ahora el módulo mide y grafica tu producción de contenido, que es lo que controlás vos.</p>
      </div>
    </div>
  );
}

// Editor de un bloque del guion: fase + segundos arriba, guion/idea a la izquierda,
// visual-edición a la derecha (lo que hay que mostrar en pantalla o cortar en ese momento).
function ScriptBlockEditor({ block, index, total, onChange, onRemove, onMove }: {
  block: ScriptBlock; index: number; total: number;
  onChange: (b: ScriptBlock) => void; onRemove: () => void; onMove: (dir: 1 | -1) => void;
}) {
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
        <div className="scr-block-actions">
          <button type="button" title="Subir" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={13} /></button>
          <button type="button" title="Bajar" disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown size={13} /></button>
          <button type="button" title="Quitar bloque" onClick={onRemove}><Trash2 size={13} /></button>
        </div>
      </div>
      <div className="scr-block-cols">
        <label>Guion<textarea className="input" rows={3} placeholder="Qué decís en este momento…" value={block.text} onChange={e => onChange({ ...block, text: e.target.value })} /></label>
        <label>Visual / edición<textarea className="input" rows={3} placeholder="Qué se ve o qué corte hacer acá…" value={block.visual} onChange={e => onChange({ ...block, visual: e.target.value })} /></label>
      </div>
    </div>
  );
}

// Modo grabación: guion completo a pantalla grande, ordenado por bloque, para
// tenerlo a mano mientras grabás (estilo teleprompter simple).
function Teleprompter({ title, blocks, onClose }: { title: string; blocks: ScriptBlock[]; onClose: () => void }) {
  const [big, setBig] = useState(false);
  return (
    <div className="tp-overlay" onClick={onClose}>
      <div className="tp-sheet" onClick={e => e.stopPropagation()}>
        <div className="tp-bar">
          <div><strong>{title || 'Sin título'}</strong><span>{totalSeconds(blocks)}s en total</span></div>
          <div className="tp-bar-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setBig(v => !v)}>{big ? 'Texto normal' : 'Texto más grande'}</button>
            <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={15} /> Cerrar</button>
          </div>
        </div>
        <div className={`tp-content ${big ? 'big' : ''}`}>
          {blocks.filter(b => b.text.trim() || b.visual.trim()).map(b => (
            <div key={b.id} className="tp-block">
              <div className="tp-block-tag" style={{ color: SCRIPT_PHASE_COLORS[b.phase] }}>{SCRIPT_PHASE_LABELS[b.phase]}{b.seconds ? ` · ${b.seconds}s` : ''}</div>
              {b.text.trim() && <p className="tp-text">{b.text}</p>}
              {b.visual.trim() && <p className="tp-visual">🎬 {b.visual}</p>}
            </div>
          ))}
          {blocks.every(b => !b.text.trim() && !b.visual.trim()) && <div className="ig-empty-inline">Todavía no escribiste el guion.</div>}
        </div>
      </div>
    </div>
  );
}

function PostForm({ initial, onSave, onClose }: { initial?: Partial<ContentPost>; onSave: (p: Partial<ContentPost>) => void; onClose: () => void }) {
  const [f, setF] = useState<Partial<ContentPost>>({ format: 'reel', objective: CONTENT_OBJECTIVES[0], title: '', edgeLevel: 3, status: 'borrador', kind: 'organico', ...initial });
  const [blocks, setBlocks] = useState<ScriptBlock[]>(() => initial?.content ? decodeScript(initial.content) : emptyScript());
  const [tele, setTele] = useState(false);

  const setBlock = (i: number, b: ScriptBlock) => setBlocks(bs => bs.map((x, idx) => idx === i ? b : x));
  const removeBlock = (i: number) => setBlocks(bs => bs.filter((_, idx) => idx !== i));
  const moveBlock = (i: number, dir: 1 | -1) => setBlocks(bs => {
    const j = i + dir; if (j < 0 || j >= bs.length) return bs;
    const copy = [...bs]; [copy[i], copy[j]] = [copy[j], copy[i]]; return copy;
  });
  const addBlock = () => setBlocks(bs => [...bs, { id: uuid(), phase: 'desarrollo', text: '', seconds: 10, visual: '' }]);

  const save = () => {
    if (!(f.title || '').trim()) return;
    onSave({ ...f, content: encodeScript(blocks) });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="scr-form-head">
          <h2>{initial?.id ? 'Editar pieza' : 'Nueva pieza'}</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTele(true)}><Maximize2 size={14} /> Modo grabación</button>
        </div>
        <div className="ig-form">
          <div className="scr-kind">
            {CONTENT_KINDS.map(k => (
              <button key={k.key} type="button" className={f.kind === k.key ? 'active' : ''} onClick={() => setF({ ...f, kind: k.key })}>{k.label}</button>
            ))}
          </div>
          <label>Título<input className="input" value={f.title || ''} autoFocus placeholder="Ej: 3 errores al vender por IG" onChange={e => setF({ ...f, title: e.target.value })} /></label>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1 }}>Formato<select className="select" value={f.format} onChange={e => setF({ ...f, format: e.target.value as ContentFormat })}>{CONTENT_FORMATS.map(x => <option key={x} value={x}>{CONTENT_FORMAT_LABELS[x]}</option>)}</select></label>
            <label style={{ flex: 1 }}>Objetivo<select className="select" value={f.objective} onChange={e => setF({ ...f, objective: e.target.value })}>{CONTENT_OBJECTIVES.map(x => <option key={x} value={x}>{x}</option>)}</select></label>
          </div>
          {f.kind === 'anuncio' && (
            <div className="ig-notice">Esta pieza es la base creativa. Cargá el presupuesto, audiencia y resultados en la pestaña <b>Anuncios</b> una vez que la corras.</div>
          )}
          <label>Fecha de publicación (opcional)<input className="input" type="date" value={f.scheduledFor ? new Date(f.scheduledFor).toISOString().split('T')[0] : ''} onChange={e => setF({ ...f, scheduledFor: e.target.value ? new Date(e.target.value + 'T12:00').getTime() : null })} /></label>
        </div>

        <div className="scr-blocks-head">
          <span>Guion por fases <em>({totalSeconds(blocks)}s en total)</em></span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addBlock}><Plus size={13} /> Agregar bloque</button>
        </div>
        <div className="scr-blocks">
          {blocks.map((b, i) => (
            <ScriptBlockEditor key={b.id} block={b} index={i} total={blocks.length}
              onChange={nb => setBlock(i, nb)} onRemove={() => removeBlock(i)} onMove={dir => moveBlock(i, dir)} />
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>{initial?.id ? 'Guardar' : 'Crear'}</button>
        </div>
      </div>
      {tele && <Teleprompter title={f.title || ''} blocks={blocks} onClose={() => setTele(false)} />}
    </div>
  );
}

function Pipeline({ c }: { c: ReturnType<typeof useContent> }) {
  const [form, setForm] = useState<Partial<ContentPost> | null>(null);
  const move = (p: ContentPost, dir: number) => {
    const i = STATUS_ORDER.indexOf(p.status);
    const next = STATUS_ORDER[Math.max(0, Math.min(STATUS_ORDER.length - 1, i + dir))];
    if (next !== p.status) c.updatePost(p.id, { status: next });
  };
  return (
    <div className="ig-card">
      <div className="ig-card-head">
        <div><p className="ig-eyebrow">Workflow editorial</p><h3>Pipeline de producción</h3></div>
        <button className="btn btn-primary btn-sm" onClick={() => setForm({})}><Plus size={14} /> Nueva pieza</button>
      </div>
      <div className="ig-board">
        {CONTENT_STATUSES.map(st => {
          const items = c.posts.filter(p => p.status === st.key);
          return (
            <div key={st.key} className="ig-lane">
              <div className="ig-lane-head">{st.label}<span>{items.length}</span></div>
              {items.map(p => (
                <div key={p.id} className="ig-post" onClick={() => setForm(p)}>
                  <h4>{p.title || 'Sin título'}</h4>
                  {scriptPreview(p.content) && <p>{scriptPreview(p.content)}</p>}
                  <div className="ig-post-meta">{p.kind === 'anuncio' && <span className="ig-badge kind-ad">📊 Anuncio</span>}{fmtBadge(p.format)}{p.objective && <span className="ig-badge soft">{p.objective}</span>}</div>
                  <div className="ig-post-actions" onClick={e => e.stopPropagation()}>
                    <button title="Mover atrás" disabled={p.status === 'borrador'} onClick={() => move(p, -1)}><ChevronLeft size={14} /></button>
                    <button title="Mover adelante" disabled={p.status === 'listo'} onClick={() => move(p, 1)}><ChevronRight size={14} /></button>
                    <button title="Borrar" onClick={() => c.removePost(p.id)}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
              {items.length === 0 && <div className="ig-lane-empty">Vacío</div>}
            </div>
          );
        })}
      </div>
      {form && <PostForm initial={form} onClose={() => setForm(null)} onSave={p => form.id ? c.updatePost(form.id, p) : c.addPost(p)} />}
    </div>
  );
}

function Calendario({ posts }: { posts: ContentPost[] }) {
  const week = useMemo(() => {
    const now = new Date(); const day = (now.getDay() + 6) % 7; // lunes=0
    const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(now.getDate() - day);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  }, []);
  const dayName = (d: Date) => d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' });
  return (
    <div className="ig-card">
      <div className="ig-card-head"><div><p className="ig-eyebrow">Esta semana</p><h3>Calendario editorial</h3></div></div>
      <div className="ig-cal">
        {week.map((d, i) => {
          const items = posts.filter(p => p.scheduledFor && new Date(p.scheduledFor).toDateString() === d.toDateString());
          return (
            <div key={i} className="ig-cal-day">
              <strong>{dayName(d)}</strong>
              {items.map(p => <div key={p.id} className="ig-cal-item"><span>{CONTENT_FORMAT_LABELS[p.format]}</span><p>{p.title || 'Sin título'}</p></div>)}
              {items.length === 0 && <div className="ig-cal-empty">—</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type GenOut = { titulo: string; hook: string; guion: string[]; caption: string; hashtags: string[]; cta: string };

// Mismo formato de texto plano en los dos lugares que guardan una pieza generada por IA
// (Generador y la Tabla), así el Pipeline/Calendario ven siempre la misma estructura.
const buildContentText = (out: GenOut) => [
  `HOOK: ${out.hook}`, '',
  'GUION:', ...(out.guion || []).map((g, i) => `${i + 1}. ${g}`), '',
  `CAPTION: ${out.caption}`, '',
  `CTA: ${out.cta}`, '',
  (out.hashtags || []).join(' '),
].join('\n');

// Para la vista de tabla: extrae solo el hook como preview corta de la pieza
// (soporta el guion estructurado por bloques y el texto plano viejo de la IA).
const parseHook = (content: string) => {
  if (!content) return '';
  if (isStructuredScript(content)) return scriptPreview(content);
  const m = content.match(/^HOOK:\s*(.+)$/m);
  return m ? m[1].trim() : content.split('\n')[0]?.trim() || '';
};

// Vista tipo spreadsheet (estilo Sandcastle): muchas piezas en filas, edición inline de
// título/formato/objetivo/estado/fecha, y un botón "Generar" por fila que escribe el hook
// con IA sin salir de la tabla — pensada para cargar/revisar varias ideas de un saque, en
// vez de una pieza a la vez como el Generador.
function Tabla({ c }: { c: ReturnType<typeof useContent> }) {
  const [genRow, setGenRow] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [editing, setEditing] = useState<ContentPost | null>(null);

  const addRow = () => c.addPost({ title: '', format: 'reel', objective: CONTENT_OBJECTIVES[0], status: 'borrador', content: '' });

  const addBulk = () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach(title => c.addPost({ title, format: 'reel', objective: CONTENT_OBJECTIVES[0], status: 'borrador', content: '' }));
    setBulkText(''); setBulkOpen(false);
  };

  const generarFila = async (p: ContentPost) => {
    if (!p.title.trim()) { return; }
    setGenRow(p.id);
    const res = await c.generateScript({ format: CONTENT_FORMAT_LABELS[p.format], objective: p.objective, tema: p.title });
    setGenRow(null);
    if (res) c.updatePost(p.id, { content: buildContentText(res as GenOut) });
  };

  return (
    <div className="ig-card">
      <div className="ig-card-head">
        <div><p className="ig-eyebrow">Batch — estilo Sandcastle</p><h3>Tabla de contenido</h3></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setBulkOpen(true)}>+ Varias ideas</button>
          <button className="btn btn-primary btn-sm" onClick={addRow}><Plus size={14} /> Nueva fila</button>
        </div>
      </div>

      {c.posts.length === 0 ? (
        <div className="ig-empty-inline">Todavía no hay piezas. Agregá una fila o pegá varias ideas de un saque.</div>
      ) : (
        <div className="ig-table-wrap">
          <table className="ig-table">
            <thead>
              <tr><th>Título / tema</th><th>Formato</th><th>Objetivo</th><th>Estado</th><th>Hook</th><th>Fecha</th><th /></tr>
            </thead>
            <tbody>
              {c.posts.map(p => (
                <tr key={p.id}>
                  <td>
                    <input className="ig-cell-input" value={p.title} placeholder="Tema de la pieza…"
                      onChange={e => c.updatePost(p.id, { title: e.target.value })} />
                  </td>
                  <td>
                    <select className="ig-cell-select" value={p.format} onChange={e => c.updatePost(p.id, { format: e.target.value as ContentFormat })}>
                      {CONTENT_FORMATS.map(f => <option key={f} value={f}>{CONTENT_FORMAT_LABELS[f]}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="ig-cell-select" value={p.objective} onChange={e => c.updatePost(p.id, { objective: e.target.value })}>
                      {CONTENT_OBJECTIVES.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="ig-cell-select" value={p.status} onChange={e => c.updatePost(p.id, { status: e.target.value as ContentStatus })}>
                      {CONTENT_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="ig-cell-hook">
                    {p.content ? (
                      <span title={parseHook(p.content)} onClick={() => setEditing(p)}>{parseHook(p.content) || '(sin hook)'}</span>
                    ) : (
                      <button className="btn btn-ghost btn-sm" disabled={genRow === p.id || !p.title.trim()} onClick={() => generarFila(p)}>
                        <Sparkles size={13} /> {genRow === p.id ? 'Generando…' : 'Generar'}
                      </button>
                    )}
                  </td>
                  <td>
                    <input className="ig-cell-input" type="date" style={{ minWidth: 128 }}
                      value={p.scheduledFor ? new Date(p.scheduledFor).toISOString().split('T')[0] : ''}
                      onChange={e => c.updatePost(p.id, { scheduledFor: e.target.value ? new Date(e.target.value + 'T12:00').getTime() : null })} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Editar/ver completo" onClick={() => setEditing(p)}><ChevronRight size={14} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" title="Borrar" onClick={() => c.removePost(p.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bulkOpen && (
        <div className="modal-overlay" onClick={() => setBulkOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h2>Agregar varias ideas</h2>
            <p className="confirm-text" style={{ marginBottom: 10 }}>Una idea por línea — se crea una fila por cada una, lista para generar.</p>
            <textarea className="input" rows={8} autoFocus value={bulkText} placeholder={'3 errores al vender por IG\nCómo armar un reel sin mostrar la cara\nMitos del algoritmo de Instagram'} onChange={e => setBulkText(e.target.value)} />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setBulkOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={addBulk} disabled={!bulkText.trim()}>Agregar filas</button>
            </div>
          </div>
        </div>
      )}

      {editing && <PostForm initial={editing} onClose={() => setEditing(null)} onSave={p => c.updatePost(editing.id, p)} />}
    </div>
  );
}

function Generador({ c, onDone }: { c: ReturnType<typeof useContent>; onDone: () => void }) {
  const [format, setFormat] = useState<ContentFormat>('reel');
  const [objective, setObjective] = useState(CONTENT_OBJECTIVES[0]);
  const [tema, setTema] = useState('');
  const [notas, setNotas] = useState('');
  const [gen, setGen] = useState(false);
  const [out, setOut] = useState<GenOut | null>(null);

  const generar = async () => {
    if (!tema.trim()) return;
    setGen(true); setOut(null);
    const res = await c.generateScript({ format: CONTENT_FORMAT_LABELS[format], objective, tema, notas });
    setGen(false);
    if (res) setOut(res as GenOut);
  };

  const guardar = () => {
    if (!out) return;
    c.addPost({ format, objective, title: out.titulo || tema, content: buildContentText(out), status: 'borrador' });
    onDone();
  };

  return (
    <div className="ig-grid-2">
      <div className="ig-card">
        <div className="ig-card-head"><div><p className="ig-eyebrow">Asistente IA</p><h3>Generar pieza</h3></div></div>
        <div className="ig-form">
          <label>Tema<input className="input" value={tema} placeholder="Ej: 3 errores al vender por IG" onChange={e => setTema(e.target.value)} /></label>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1 }}>Formato<select className="select" value={format} onChange={e => setFormat(e.target.value as ContentFormat)}>{CONTENT_FORMATS.map(x => <option key={x} value={x}>{CONTENT_FORMAT_LABELS[x]}</option>)}</select></label>
            <label style={{ flex: 1 }}>Objetivo<select className="select" value={objective} onChange={e => setObjective(e.target.value)}>{CONTENT_OBJECTIVES.map(x => <option key={x} value={x}>{x}</option>)}</select></label>
          </div>
          <label>Notas (opcional)<textarea className="input" rows={3} value={notas} placeholder="Ángulo, dato, lo que quieras que incluya…" onChange={e => setNotas(e.target.value)} /></label>
          <button className="btn btn-primary" onClick={generar} disabled={gen || !tema.trim()}>
            <Sparkles size={15} /> {gen ? 'Escribiendo el guion…' : 'Generar con IA'}
          </button>
        </div>
      </div>

      <div className="ig-card">
        <div className="ig-card-head">
          <div><p className="ig-eyebrow">Salida</p><h3>Guion generado</h3></div>
          {out && <button className="btn btn-primary btn-sm" onClick={guardar}><Plus size={14} /> Guardar en Pipeline</button>}
        </div>
        {!out ? (
          <div className="ig-empty-inline" style={{ minHeight: 220 }}>{gen ? 'La IA está escribiendo tu pieza…' : 'Completá el tema y tocá "Generar con IA". El guion aparece acá para revisar y guardar.'}</div>
        ) : (
          <div className="ig-gen-out">
            <div className="ig-gen-block"><span>Hook</span><p>{out.hook}</p></div>
            <div className="ig-gen-block"><span>Guion</span><ol>{(out.guion || []).map((g, i) => <li key={i}>{g}</li>)}</ol></div>
            <div className="ig-gen-block"><span>Caption</span><p>{out.caption}</p></div>
            <div className="ig-gen-block"><span>CTA</span><p>{out.cta}</p></div>
            {(out.hashtags || []).length > 0 && <div className="ig-gen-tags">{out.hashtags.map((h, i) => <span key={i}>{h.startsWith('#') ? h : '#' + h}</span>)}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

type GenIdeas = {
  nota?: string; resumen: string;
  ideasInstagram: { titulo: string; formato: string; gancho: string; idea: string; cta: string }[];
  anuncios: { nicho: string; formato: string; gancho: string; oferta: string; porQue: string; adaptar: string }[];
  tendencias: { titulo: string; detalle: string; uso: string }[];
  cruzadas: { nicho: string; ideas: string[] }[];
  acciones: { producir: string[]; testear: string[]; conversion: string[] };
};
const IDEA_FMT: Record<string, ContentFormat> = { reel: 'reel', carrusel: 'carrusel', story: 'story', stories: 'story', ad: 'ad', anuncio: 'ad' };
const toFmt = (s: string): ContentFormat => IDEA_FMT[(s || '').toLowerCase().trim()] || 'reel';
const adLibUrl = (q: string) => `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=AR&media_type=all&q=${encodeURIComponent(q)}`;

const OBJ_IDEAS = ['Alcance / viral', 'Conseguir consultas (DM)', 'Ventas', 'Autoridad / confianza', 'Sumar seguidores'];
const PLAT_IDEAS = ['Cualquiera', 'Reels', 'Carruseles', 'Stories', 'Anuncios'];

function Ideas({ c }: { c: ReturnType<typeof useContent> }) {
  const [nichos, setNichos] = useState('');
  const [publico, setPublico] = useState('');
  const [objetivo, setObjetivo] = useState(OBJ_IDEAS[1]);
  const [plataforma, setPlataforma] = useState(PLAT_IDEAS[0]);
  const [tono, setTono] = useState('');
  const [foco, setFoco] = useState('');
  const [evitar, setEvitar] = useState('');
  const [iaFocus, setIaFocus] = useState(false);
  const [gen, setGen] = useState(false);
  const [out, setOut] = useState<GenIdeas | null>(null);

  const generar = async () => {
    if (!nichos.trim()) return;
    setGen(true);
    const r = await c.generateIdeas({ nichos, publico, objetivo, plataforma, tono, foco, evitar, iaFocus });
    setGen(false);
    if (r) setOut(r as GenIdeas);
  };
  const guardar = (i: GenIdeas['ideasInstagram'][0]) => c.addPost({
    format: toFmt(i.formato), objective: objetivo, title: i.titulo, status: 'borrador',
    content: `HOOK: ${i.gancho}\n\n${i.idea}\n\nCTA: ${i.cta}`,
  });

  return (
    <div className="ig-stack">
      <div className="ig-card">
        <div className="ig-card-head"><div><p className="ig-eyebrow">Agente de ideas</p><h3>Investigá y generá ideas de contenido</h3></div></div>
        <div className="ig-form">
          <label>Nichos (separados por coma) *<input className="input" value={nichos} placeholder="Ej: estética, inmobiliarias, gastronomía" onChange={e => setNichos(e.target.value)} /></label>
          <label>¿Para quién? (público objetivo)<input className="input" value={publico} placeholder="Ej: mujeres 25-45, dueñas de PyME, zona Córdoba" onChange={e => setPublico(e.target.value)} /></label>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1 }}>Objetivo<select className="select" value={objetivo} onChange={e => setObjetivo(e.target.value)}>{OBJ_IDEAS.map(x => <option key={x}>{x}</option>)}</select></label>
            <label style={{ flex: 1 }}>Formato<select className="select" value={plataforma} onChange={e => setPlataforma(e.target.value)}>{PLAT_IDEAS.map(x => <option key={x}>{x}</option>)}</select></label>
          </div>
          <label>Tono / estilo (opcional)<input className="input" value={tono} placeholder="Ej: cercano y divertido / experto y directo" onChange={e => setTono(e.target.value)} /></label>
          <label>Foco extra (opcional)<input className="input" value={foco} placeholder="Ej: aprovechar temporada / lanzamiento nuevo" onChange={e => setFoco(e.target.value)} /></label>
          <label>Qué evitar (opcional)<input className="input" value={evitar} placeholder="Ej: nada de bailecitos, sin tecnicismos" onChange={e => setEvitar(e.target.value)} /></label>
          <label className="notif-toggle"><input type="checkbox" checked={iaFocus} onChange={e => setIaFocus(e.target.checked)} /> Enfocar en novedades de IA / Claude Code / tecnología</label>
          <button className="btn btn-primary" onClick={generar} disabled={gen || !nichos.trim()}>
            <Sparkles size={15} /> {gen ? 'Investigando y generando…' : 'Generar ideas'}
          </button>
        </div>
        {nichos.trim() && (
          <div className="idea-adslib">
            <span>👀 Ver anuncios reales en Meta Ads Library:</span>
            {nichos.split(',').map(s => s.trim()).filter(Boolean).slice(0, 6).map((nch, k) => (
              <a key={k} className="btn btn-secondary btn-sm" href={adLibUrl(nch)} target="_blank" rel="noreferrer">{nch} ↗</a>
            ))}
          </div>
        )}
      </div>

      {out && (
        <>
          {out.nota && <div className="ig-note" style={{ padding: '10px 14px' }}><p style={{ margin: 0, fontSize: 12.5 }}>ℹ️ {out.nota}</p></div>}
          <div className="ig-card"><div className="ig-card-head"><div><p className="ig-eyebrow">Resumen</p><h3>Oportunidades</h3></div></div><p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{out.resumen}</p></div>

          <div className="ig-card">
            <div className="ig-card-head"><div><p className="ig-eyebrow">Instagram</p><h3>Ideas ({out.ideasInstagram?.length || 0})</h3></div></div>
            <div className="idea-grid">
              {(out.ideasInstagram || []).map((i, k) => (
                <div key={k} className="idea-card">
                  <div className="idea-top">{fmtBadge(toFmt(i.formato))}<button className="btn btn-ghost btn-sm" title="Guardar como borrador" onClick={() => guardar(i)}><Plus size={13} /> Pipeline</button></div>
                  <strong>{i.titulo}</strong>
                  <p className="idea-hook">“{i.gancho}”</p>
                  <p className="idea-idea">{i.idea}</p>
                  <p className="idea-cta">CTA: {i.cta}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="ig-card">
            <div className="ig-card-head"><div><p className="ig-eyebrow">Anuncios</p><h3>Patrones que funcionan</h3></div></div>
            <div className="idea-list">
              {(out.anuncios || []).map((a, k) => (
                <div key={k} className="idea-ad">
                  <div className="idea-ad-head"><strong>{a.nicho}</strong><span className="ig-badge soft">{a.formato}</span></div>
                  <p><b>Gancho:</b> {a.gancho}</p>
                  <p><b>Oferta:</b> {a.oferta}</p>
                  <p><b>Por qué funciona:</b> {a.porQue}</p>
                  <p style={{ color: 'var(--primary-light)' }}><b>Adaptar:</b> {a.adaptar}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="ig-card">
            <div className="ig-card-head"><div><p className="ig-eyebrow">Tecnología</p><h3>Tendencias para aprovechar</h3></div></div>
            <div className="idea-list">
              {(out.tendencias || []).map((t, k) => (
                <div key={k} className="idea-trend"><strong>{t.titulo}</strong><p>{t.detalle}</p><p className="idea-use">💡 {t.uso}</p></div>
              ))}
            </div>
          </div>

          <div className="ig-card">
            <div className="ig-card-head"><div><p className="ig-eyebrow">Cruzadas</p><h3>Ideas por nicho (tendencia + anuncio + novedad)</h3></div></div>
            <div className="idea-grid">
              {(out.cruzadas || []).map((cr, k) => (
                <div key={k} className="idea-card"><strong>{cr.nicho}</strong><ul className="idea-ul">{(cr.ideas || []).map((x, j) => <li key={j}>{x}</li>)}</ul></div>
              ))}
            </div>
          </div>

          {out.acciones && (
            <div className="ig-card">
              <div className="ig-card-head"><div><p className="ig-eyebrow">Acciones</p><h3>Qué hacer primero</h3></div></div>
              <div className="idea-actions">
                <div><span className="idea-act-t">🎬 Producir</span><ul className="idea-ul">{(out.acciones.producir || []).map((x, k) => <li key={k}>{x}</li>)}</ul></div>
                <div><span className="idea-act-t">🧪 Testear en ads</span><ul className="idea-ul">{(out.acciones.testear || []).map((x, k) => <li key={k}>{x}</li>)}</ul></div>
                <div><span className="idea-act-t">💰 Más conversión</span><ul className="idea-ul">{(out.acciones.conversion || []).map((x, k) => <li key={k}>{x}</li>)}</ul></div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

type ViralScript = {
  framework: string;
  cicloViral: { idea: string; lente: string; comparteFactor: string; razon: string };
  hooks: { texto: string; formula: string }[];
  reHook: string;
  guion: { tiempo: string; voz: string; pantalla: string; visual: string; gatillo: string }[];
  cta: { tipo: string; texto: string };
  loop: string; caption: string; hashtags: string[];
};
const PLATAFORMAS = ['Reel de Instagram', 'YouTube Short', 'TikTok'];
const OBJETIVOS_G = ['Viral / alcance', 'Ventas', 'Educativo', 'Autoridad'];
const DURACIONES = ['7-15s', '20-30s', '45-60s'];

function Guiones({ c }: { c: ReturnType<typeof useContent> }) {
  const [plataforma, setPlataforma] = useState(PLATAFORMAS[0]);
  const [objetivo, setObjetivo] = useState(OBJETIVOS_G[0]);
  const [duracion, setDuracion] = useState(DURACIONES[1]);
  const [tema, setTema] = useState('');
  const [publico, setPublico] = useState('');
  const [gen, setGen] = useState(false);
  const [out, setOut] = useState<ViralScript | null>(null);
  const [hookSel, setHookSel] = useState(0);

  const generar = async () => {
    if (!tema.trim()) return;
    setGen(true); setOut(null);
    const r = await c.generateViralScript({ plataforma, objetivo, duracion, tema, publico });
    setGen(false);
    if (r) { setOut(r as ViralScript); setHookSel(0); }
  };
  // Rango tipo "7-12s" → duración en segundos, para precargar el editor de bloques del Pipeline.
  const parseRange = (t: string): number => {
    const nums = (t.match(/\d+/g) || []).map(Number);
    return nums.length >= 2 ? Math.max(1, nums[1] - nums[0]) : 8;
  };
  const guardar = () => {
    if (!out) return;
    const hook = out.hooks?.[hookSel];
    // Guarda directo como guion por bloques (mismo formato que edita el Pipeline):
    // Hook+Re-Hook como bloque "hook", cada beat como "desarrollo", cierre como "cta".
    const blocks: ScriptBlock[] = [
      { id: uuid(), phase: 'hook', text: [hook?.texto, out.reHook].filter(Boolean).join('\n\n'), seconds: 7, visual: hook?.formula ? `Fórmula de hook: ${hook.formula}` : '' },
      ...(out.guion || []).map(g => ({
        id: uuid(), phase: 'desarrollo' as const, text: g.voz, seconds: parseRange(g.tiempo),
        visual: [g.pantalla && `En pantalla: ${g.pantalla}`, g.visual, g.gatillo && `Gatillo: ${g.gatillo}`].filter(Boolean).join(' · '),
      })),
      { id: uuid(), phase: 'cta', text: out.cta?.texto || '', seconds: 5, visual: out.loop ? `Loop: ${out.loop}` : '' },
    ];
    c.addPost({ format: 'reel', objective: objetivo, title: tema, content: encodeScript(blocks), status: 'borrador', kind: 'organico' });
  };

  return (
    <div className="ig-grid-2">
      <div className="ig-card" style={{ alignSelf: 'start' }}>
        <div className="ig-card-head"><div><p className="ig-eyebrow">Estudio de guiones</p><h3>Guion viral</h3></div></div>
        <div className="ig-form">
          <label>Tema<input className="input" value={tema} placeholder="Ej: por qué tu web no vende" onChange={e => setTema(e.target.value)} /></label>
          <label>Plataforma<select className="select" value={plataforma} onChange={e => setPlataforma(e.target.value)}>{PLATAFORMAS.map(x => <option key={x}>{x}</option>)}</select></label>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1 }}>Objetivo<select className="select" value={objetivo} onChange={e => setObjetivo(e.target.value)}>{OBJETIVOS_G.map(x => <option key={x}>{x}</option>)}</select></label>
            <label style={{ flex: 1 }}>Duración<select className="select" value={duracion} onChange={e => setDuracion(e.target.value)}>{DURACIONES.map(x => <option key={x}>{x}</option>)}</select></label>
          </div>
          <label>Público / marca (opcional)<input className="input" value={publico} placeholder="Ej: dueños de estética" onChange={e => setPublico(e.target.value)} /></label>
          <button className="btn btn-primary" onClick={generar} disabled={gen || !tema.trim()}>
            <Sparkles size={15} /> {gen ? 'Escribiendo el guion…' : 'Generar guion viral'}
          </button>
        </div>
      </div>

      <div className="ig-card">
        <div className="ig-card-head">
          <div><p className="ig-eyebrow">Guion listo para grabar</p><h3>{out ? out.framework : 'Salida'}</h3></div>
          {out && <button className="btn btn-primary btn-sm" onClick={guardar}><Plus size={14} /> Guardar en Pipeline</button>}
        </div>
        {!out ? (
          <div className="ig-empty-inline" style={{ minHeight: 240 }}>{gen ? 'La IA está escribiendo tu guion viral…' : 'Completá el tema y generá. Vas a tener 3 hooks, el guion por segundos y el cierre en loop.'}</div>
        ) : (
          <div className="scr-out">
            {out.cicloViral && (
              <div className="scr-ciclo">
                <div className="scr-ciclo-row"><span>Idea</span><b>{out.cicloViral.idea}</b><span>Comparten porque</span><b>{out.cicloViral.comparteFactor === 'siente' ? 'sienten algo 💥' : 'aprenden algo 💡'}</b></div>
                <p><b>Lente:</b> {out.cicloViral.lente}</p>
                <p className="scr-ciclo-razon">{out.cicloViral.razon}</p>
              </div>
            )}
            <div className="scr-hooks">
              <div className="scr-label">🎣 Elegí tu hook (0-3s)</div>
              {(out.hooks || []).map((h, k) => (
                <button key={k} className={`scr-hook ${hookSel === k ? 'on' : ''}`} onClick={() => setHookSel(k)}>
                  <span className="scr-hook-formula">{h.formula}</span>{h.texto}
                </button>
              ))}
            </div>
            {out.reHook && <div className="scr-rehook"><b>🌉 Re-hook (3-7s):</b> {out.reHook}</div>}
            <div className="scr-beats">
              {(out.guion || []).map((g, k) => (
                <div key={k} className="scr-beat">
                  <span className="scr-time">{g.tiempo}</span>
                  <div>
                    <p className="scr-voz">{g.voz}</p>
                    {g.pantalla && <p className="scr-mini"><b>En pantalla:</b> {g.pantalla}</p>}
                    {g.visual && <p className="scr-mini"><b>Visual:</b> {g.visual}</p>}
                    {g.gatillo && <p className="scr-mini scr-gatillo"><b>⚡ Gatillo:</b> {g.gatillo}</p>}
                  </div>
                </div>
              ))}
            </div>
            {out.cta?.texto && <div className="scr-cta"><b>📢 CTA ({out.cta.tipo}):</b> {out.cta.texto}</div>}
            {out.loop && <div className="scr-loop"><b>🔁 Loop:</b> {out.loop}</div>}
            <div className="ig-gen-block"><span>Caption</span><p>{out.caption}</p></div>
            {(out.hashtags || []).length > 0 && <div className="ig-gen-tags">{out.hashtags.map((h, i) => <span key={i}>{h.startsWith('#') ? h : '#' + h}</span>)}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// Formulario de un anuncio corrido: formato+objetivo (campaña), configuración
// (audiencia/ubicaciones/presupuesto/copy, nivel Ad Set + Ad de Meta) y resultados reales.
function AdForm({ initial, posts, onSave, onClose }: {
  initial?: Partial<ContentAd>; posts: ContentPost[]; onSave: (a: Partial<ContentAd>) => void; onClose: () => void;
}) {
  const [a, setA] = useState<Partial<ContentAd>>({
    format: 'reel', objective: AD_OBJECTIVES[0], status: 'activo', budget: 0, currency: 'ARS', durationDays: 7,
    audience: '', placement: 'Advantage+ (automático)', cta: '', copy: '', notes: '',
    spend: 0, impressions: 0, reach: 0, results: 0, ctr: 0, postId: null, ...initial,
  });
  const resultLabel = AD_OBJECTIVE_RESULT_LABEL[a.objective as keyof typeof AD_OBJECTIVE_RESULT_LABEL] || 'Resultados';
  const costPerResult = a.results ? (a.spend || 0) / (a.results || 1) : 0;
  const num = (v: string) => Math.max(0, +v || 0);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <h2>{initial?.id ? 'Editar anuncio' : 'Nuevo anuncio'}</h2>
        <div className="ig-form">
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1 }}>Formato<select className="select" value={a.format} onChange={e => setA({ ...a, format: e.target.value as AdFormat })}>{AD_FORMATS.map(x => <option key={x} value={x}>{AD_FORMAT_LABELS[x]}</option>)}</select></label>
            <label style={{ flex: 1 }}>Objetivo de campaña<select className="select" value={a.objective} onChange={e => setA({ ...a, objective: e.target.value })}>{AD_OBJECTIVES.map(x => <option key={x} value={x}>{x}</option>)}</select></label>
            <label style={{ flex: 1 }}>Estado<select className="select" value={a.status} onChange={e => setA({ ...a, status: e.target.value as AdStatus })}>{AD_STATUSES.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}</select></label>
          </div>
          <label>Pieza creativa usada (opcional)
            <select className="select" value={a.postId || ''} onChange={e => setA({ ...a, postId: e.target.value || null })}>
              <option value="">— sin vincular —</option>
              {posts.map(p => <option key={p.id} value={p.id}>{p.title || 'Sin título'}</option>)}
            </select>
          </label>

          <p className="scr-subhead">Configuración (Ad Set / Ad)</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1 }}>Presupuesto diario<input type="number" min={0} className="input" value={a.budget} onChange={e => setA({ ...a, budget: num(e.target.value) })} /></label>
            <label style={{ width: 90 }}>Moneda<input className="input" value={a.currency} onChange={e => setA({ ...a, currency: e.target.value })} /></label>
            <label style={{ width: 120 }}>Duración (días)<input type="number" min={0} className="input" value={a.durationDays} onChange={e => setA({ ...a, durationDays: num(e.target.value) })} /></label>
          </div>
          <label>Audiencia / segmentación<textarea className="input" rows={2} placeholder="Ej: Amplio 18-45, todo género, Córdoba capital" value={a.audience} onChange={e => setA({ ...a, audience: e.target.value })} /></label>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1 }}>Ubicaciones<input className="input" placeholder="Advantage+ / Feed+Stories+Reels" value={a.placement} onChange={e => setA({ ...a, placement: e.target.value })} /></label>
            <label style={{ flex: 1 }}>CTA<input className="input" placeholder="Enviar mensaje / Comprar ahora" value={a.cta} onChange={e => setA({ ...a, cta: e.target.value })} /></label>
          </div>
          <label>Copy / texto del anuncio<textarea className="input" rows={2} value={a.copy} onChange={e => setA({ ...a, copy: e.target.value })} /></label>

          <p className="scr-subhead">Resultados</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1 }}>Gasto total<input type="number" min={0} className="input" value={a.spend} onChange={e => setA({ ...a, spend: num(e.target.value) })} /></label>
            <label style={{ flex: 1 }}>Impresiones<input type="number" min={0} className="input" value={a.impressions} onChange={e => setA({ ...a, impressions: num(e.target.value) })} /></label>
            <label style={{ flex: 1 }}>Alcance<input type="number" min={0} className="input" value={a.reach} onChange={e => setA({ ...a, reach: num(e.target.value) })} /></label>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <label style={{ flex: 1 }}>{resultLabel}<input type="number" min={0} className="input" value={a.results} onChange={e => setA({ ...a, results: num(e.target.value) })} /></label>
            <label style={{ flex: 1 }}>CTR %<input type="number" min={0} step={0.01} className="input" value={a.ctr} onChange={e => setA({ ...a, ctr: num(e.target.value) })} /></label>
            <div className="scr-cpr">Costo por resultado<strong>{costPerResult ? `${a.currency} ${costPerResult.toFixed(0)}` : '—'}</strong></div>
          </div>
          <label>Notas / aprendizajes<textarea className="input" rows={2} placeholder="Qué funcionó, qué cambiar la próxima" value={a.notes} onChange={e => setA({ ...a, notes: e.target.value })} /></label>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => { onSave(a); onClose(); }}>{initial?.id ? 'Guardar' : 'Registrar'}</button>
        </div>
      </div>
    </div>
  );
}

const AD_STATUS_COLOR: Record<AdStatus, string> = { activo: '#10b981', pausado: '#ffaa3a', finalizado: '#64748b' };

function Anuncios({ c }: { c: ReturnType<typeof useContent> }) {
  const [form, setForm] = useState<Partial<ContentAd> | null>(null);
  const [filter, setFilter] = useState<AdStatus | 'todos'>('todos');
  const ads = c.ads.filter(a => filter === 'todos' || a.status === filter);

  const totalInvertido = c.ads.reduce((s, a) => s + (a.spend || 0), 0);
  const activos = c.ads.filter(a => a.status === 'activo').length;
  const conResultados = c.ads.filter(a => a.results > 0);
  const cprPromedio = conResultados.length
    ? conResultados.reduce((s, a) => s + a.spend / a.results, 0) / conResultados.length : 0;

  return (
    <div className="ig-stack">
      <div className="ig-metrics">
        <div className="ig-metric"><div className="ig-metric-top"><span>Invertido (todo)</span></div><strong>${totalInvertido.toFixed(0)}</strong></div>
        <div className="ig-metric"><div className="ig-metric-top"><span>Anuncios activos</span></div><strong>{activos}</strong></div>
        <div className="ig-metric"><div className="ig-metric-top"><span>Costo por resultado prom.</span></div><strong>{cprPromedio ? `$${cprPromedio.toFixed(0)}` : '—'}</strong></div>
        <div className="ig-metric"><div className="ig-metric-top"><span>Total registrados</span></div><strong>{c.ads.length}</strong></div>
      </div>

      <div className="ig-card">
        <div className="ig-card-head">
          <div><p className="ig-eyebrow">Meta Ads</p><h3>Anuncios corridos</h3></div>
          <button className="btn btn-primary btn-sm" onClick={() => setForm({})}><Plus size={14} /> Nuevo anuncio</button>
        </div>
        <div className="ig-chips" style={{ marginBottom: 14 }}>
          <button className={filter === 'todos' ? 'active' : ''} onClick={() => setFilter('todos')}>Todos</button>
          {AD_STATUSES.map(s => <button key={s.key} className={filter === s.key ? 'active' : ''} onClick={() => setFilter(s.key)}>{s.label}</button>)}
        </div>
        {ads.length === 0 ? (
          <div className="ig-empty-inline">Todavía no cargaste ningún anuncio. Registrá cada campaña que corras: formato, configuración y cómo te fue.</div>
        ) : (
          <div className="ad-grid">
            {ads.map(a => {
              const cpr = a.results ? a.spend / a.results : 0;
              return (
                <div key={a.id} className="ad-card" onClick={() => setForm(a)}>
                  <div className="ad-card-top">
                    <span className="ad-status" style={{ background: AD_STATUS_COLOR[a.status] }}>{AD_STATUSES.find(s => s.key === a.status)?.label}</span>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={e => { e.stopPropagation(); c.removeAd(a.id); }}><Trash2 size={13} /></button>
                  </div>
                  <h4>{AD_FORMAT_LABELS[a.format]} · {a.objective}</h4>
                  {a.audience && <p className="ad-audience">{a.audience}</p>}
                  <div className="ad-stats">
                    <div><span>Gasto</span><strong>{a.currency} {a.spend.toFixed(0)}</strong></div>
                    <div><span>{AD_OBJECTIVE_RESULT_LABEL[a.objective as keyof typeof AD_OBJECTIVE_RESULT_LABEL] || 'Resultados'}</span><strong>{a.results}</strong></div>
                    <div><span>Costo/resultado</span><strong>{cpr ? `${a.currency} ${cpr.toFixed(0)}` : '—'}</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {form && <AdForm initial={form} posts={c.posts} onClose={() => setForm(null)} onSave={p => form.id ? c.updateAd(form.id, p) : c.addAd(p)} />}
    </div>
  );
}

function Fuentes({ c }: { c: ReturnType<typeof useContent> }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', content: '', tags: '' });
  const save = () => { if (!f.title.trim()) return; c.addSource({ type: 'nota', ...f }); setF({ title: '', content: '', tags: '' }); setOpen(false); };
  return (
    <div className="ig-card">
      <div className="ig-card-head">
        <div><p className="ig-eyebrow">Materia prima</p><h3>Fuentes de contenido</h3></div>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Plus size={14} /> Nueva fuente</button>
      </div>
      {c.sources.length === 0
        ? <div className="ig-empty-inline">Guardá acá ideas, frases de clientes, objeciones, llamadas de venta… para sacar contenido después.</div>
        : <div className="ig-sources">
          {c.sources.map(s => (
            <div key={s.id} className="ig-source">
              <div className="ig-source-head"><strong>{s.title}</strong><button className="btn btn-ghost btn-icon btn-sm" onClick={() => c.removeSource(s.id)}><Trash2 size={13} /></button></div>
              {s.content && <p>{s.content}</p>}
              {s.tags && <div className="ig-tags">{s.tags.split(',').map((t, k) => t.trim() && <span key={k}>{t.trim()}</span>)}</div>}
            </div>
          ))}
        </div>}

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h2>Nueva fuente</h2>
            <div className="ig-form">
              <label>Título<input className="input" autoFocus value={f.title} placeholder="Ej: Llamada con Cliente X" onChange={e => setF({ ...f, title: e.target.value })} /></label>
              <label>Contenido<textarea className="input" rows={3} value={f.content} placeholder="Frase, objeción, idea…" onChange={e => setF({ ...f, content: e.target.value })} /></label>
              <label>Tags (separados por coma)<input className="input" value={f.tags} placeholder="Ventas, Objeciones" onChange={e => setF({ ...f, tags: e.target.value })} /></label>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Conexion() {
  return (
    <div className="ig-card" style={{ maxWidth: 560 }}>
      <div className="ig-card-head"><div><p className="ig-eyebrow">Conector de Instagram</p><h3>Preparado, todavía sin conectar</h3></div></div>
      <div className="ig-notice"><Plug size={16} /> Esta versión gestiona la producción de contenido localmente. La conexión con la cuenta de Instagram (métricas reales, publicación) se suma en la próxima fase.</div>
      <div className="ig-form" style={{ marginTop: 14 }}>
        <label>IG Business Account ID<input className="input" disabled value="—" /></label>
        <label>Meta App ID<input className="input" disabled value="—" /></label>
        <button className="btn btn-secondary" disabled><Send size={14} /> Conectar Instagram (próximamente)</button>
      </div>
    </div>
  );
}
