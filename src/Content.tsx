import { useState, useMemo } from 'react';
import { Sparkles, Plug, Plus, Trash2, ChevronLeft, ChevronRight, CheckCircle2, Send } from 'lucide-react';
import { useContent } from './hooks';
import {
  CONTENT_STATUSES, CONTENT_FORMATS, CONTENT_FORMAT_LABELS, CONTENT_OBJECTIVES,
  type ContentPost, type ContentStatus, type ContentFormat,
} from './utils';
import './Content.css';

type Tab = 'resumen' | 'pipeline' | 'calendario' | 'generador' | 'fuentes' | 'conexion';
const TABS: { k: Tab; label: string }[] = [
  { k: 'resumen', label: 'Resumen' },
  { k: 'pipeline', label: 'Pipeline' },
  { k: 'calendario', label: 'Calendario' },
  { k: 'generador', label: 'Generador' },
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
        {tab === 'pipeline' && <Pipeline c={c} />}
        {tab === 'calendario' && <Calendario posts={c.posts} />}
        {tab === 'generador' && <Generador c={c} onDone={() => setTab('pipeline')} />}
        {tab === 'fuentes' && <Fuentes c={c} />}
        {tab === 'conexion' && <Conexion />}
      </div>
    </div>
  );
}

const fmtBadge = (f: ContentFormat) => <span className={`ig-badge ${f}`}>{CONTENT_FORMAT_LABELS[f]}</span>;

function Resumen({ posts, onGo }: { posts: ContentPost[]; onGo: (t: Tab) => void }) {
  const by = (s: ContentStatus) => posts.filter(p => p.status === s).length;
  const metrics = [
    { label: 'En borrador', value: by('borrador') },
    { label: 'Aprobadas', value: by('aprobado') },
    { label: 'Listas para publicar', value: by('listo') },
    { label: 'Total de piezas', value: posts.length },
  ];
  const listas = posts.filter(p => p.status === 'listo');
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
        <strong>📊 Métricas en vivo de Instagram</strong>
        <p>Seguidores, alcance y engagement aparecen acá cuando conectes la cuenta (pestaña "Conexión IG"). Por ahora el módulo gestiona la producción de contenido.</p>
      </div>
    </div>
  );
}

function PostForm({ initial, onSave, onClose }: { initial?: Partial<ContentPost>; onSave: (p: Partial<ContentPost>) => void; onClose: () => void }) {
  const [f, setF] = useState<Partial<ContentPost>>({ format: 'reel', objective: CONTENT_OBJECTIVES[0], title: '', content: '', edgeLevel: 3, status: 'borrador', ...initial });
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h2>{initial?.id ? 'Editar pieza' : 'Nueva pieza'}</h2>
        <div className="ig-form">
          <label>Título<input className="input" value={f.title || ''} autoFocus placeholder="Ej: 3 errores al vender por IG" onChange={e => setF({ ...f, title: e.target.value })} /></label>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1 }}>Formato<select className="select" value={f.format} onChange={e => setF({ ...f, format: e.target.value as ContentFormat })}>{CONTENT_FORMATS.map(x => <option key={x} value={x}>{CONTENT_FORMAT_LABELS[x]}</option>)}</select></label>
            <label style={{ flex: 1 }}>Objetivo<select className="select" value={f.objective} onChange={e => setF({ ...f, objective: e.target.value })}>{CONTENT_OBJECTIVES.map(x => <option key={x} value={x}>{x}</option>)}</select></label>
          </div>
          <label>Guion / idea<textarea className="input" rows={4} value={f.content || ''} placeholder="Hook, desarrollo, CTA…" onChange={e => setF({ ...f, content: e.target.value })} /></label>
          <label>Fecha de publicación (opcional)<input className="input" type="date" value={f.scheduledFor ? new Date(f.scheduledFor).toISOString().split('T')[0] : ''} onChange={e => setF({ ...f, scheduledFor: e.target.value ? new Date(e.target.value + 'T12:00').getTime() : null })} /></label>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => { if ((f.title || '').trim()) { onSave(f); onClose(); } }}>{initial?.id ? 'Guardar' : 'Crear'}</button>
        </div>
      </div>
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
                  {p.content && <p>{p.content}</p>}
                  <div className="ig-post-meta">{fmtBadge(p.format)}{p.objective && <span className="ig-badge soft">{p.objective}</span>}</div>
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

function Generador({ c, onDone }: { c: ReturnType<typeof useContent>; onDone: () => void }) {
  const [form, setForm] = useState<Partial<ContentPost>>({ format: 'reel', objective: CONTENT_OBJECTIVES[0], title: '', content: '', edgeLevel: 4 });
  const crear = () => {
    if (!(form.title || '').trim()) return;
    c.addPost({ ...form, status: 'borrador' });
    onDone();
  };
  return (
    <div className="ig-grid-2">
      <div className="ig-card">
        <div className="ig-card-head"><div><p className="ig-eyebrow">Asistente</p><h3>Crear pieza</h3></div></div>
        <div className="ig-form">
          <label>Tema / título<input className="input" value={form.title || ''} placeholder="Ej: 3 errores al vender por IG" onChange={e => setForm({ ...form, title: e.target.value })} /></label>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1 }}>Formato<select className="select" value={form.format} onChange={e => setForm({ ...form, format: e.target.value as ContentFormat })}>{CONTENT_FORMATS.map(x => <option key={x} value={x}>{CONTENT_FORMAT_LABELS[x]}</option>)}</select></label>
            <label style={{ flex: 1 }}>Objetivo<select className="select" value={form.objective} onChange={e => setForm({ ...form, objective: e.target.value })}>{CONTENT_OBJECTIVES.map(x => <option key={x} value={x}>{x}</option>)}</select></label>
          </div>
          <label>Notas / guion<textarea className="input" rows={4} value={form.content || ''} placeholder="Idea, hook, CTA…" onChange={e => setForm({ ...form, content: e.target.value })} /></label>
          <button className="btn btn-primary" onClick={crear}><Sparkles size={15} /> Crear pieza (queda en Borrador)</button>
        </div>
      </div>
      <div className="ig-card ig-note">
        <strong>✨ Generación con IA</strong>
        <p>Por ahora el "generador" guarda la pieza como borrador en el pipeline con lo que cargues. La redacción automática del guion con IA se conecta en la próxima fase (igual que las propuestas).</p>
      </div>
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
