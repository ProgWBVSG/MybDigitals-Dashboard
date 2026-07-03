import { useState, useMemo } from 'react';
import { Sparkles, Plug, Plus, Trash2, ChevronLeft, ChevronRight, CheckCircle2, Send } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useContent } from './hooks';
import {
  CONTENT_STATUSES, CONTENT_FORMATS, CONTENT_FORMAT_LABELS, CONTENT_OBJECTIVES,
  type ContentPost, type ContentStatus, type ContentFormat,
} from './utils';
import './Content.css';

type Tab = 'resumen' | 'ideas' | 'pipeline' | 'calendario' | 'generador' | 'fuentes' | 'conexion';
const TABS: { k: Tab; label: string }[] = [
  { k: 'resumen', label: 'Resumen' },
  { k: 'ideas', label: 'Ideas ✨' },
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
        {tab === 'ideas' && <Ideas c={c} />}
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

type GenOut = { titulo: string; hook: string; guion: string[]; caption: string; hashtags: string[]; cta: string };

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
    const content = [
      `HOOK: ${out.hook}`, '',
      'GUION:', ...(out.guion || []).map((g, i) => `${i + 1}. ${g}`), '',
      `CAPTION: ${out.caption}`, '',
      `CTA: ${out.cta}`, '',
      (out.hashtags || []).join(' '),
    ].join('\n');
    c.addPost({ format, objective, title: out.titulo || tema, content, status: 'borrador' });
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

function Ideas({ c }: { c: ReturnType<typeof useContent> }) {
  const [nichos, setNichos] = useState('');
  const [foco, setFoco] = useState('');
  const [gen, setGen] = useState(false);
  const [out, setOut] = useState<GenIdeas | null>(null);

  const generar = async () => {
    setGen(true); const r = await c.generateIdeas(nichos, foco); setGen(false);
    if (r) setOut(r as GenIdeas);
  };
  const guardar = (i: GenIdeas['ideasInstagram'][0]) => c.addPost({
    format: toFmt(i.formato), objective: '', title: i.titulo, status: 'borrador',
    content: `HOOK: ${i.gancho}\n\n${i.idea}\n\nCTA: ${i.cta}`,
  });

  return (
    <div className="ig-stack">
      <div className="ig-card">
        <div className="ig-card-head"><div><p className="ig-eyebrow">Agente de ideas</p><h3>Investigá y generá ideas de contenido</h3></div></div>
        <div className="ig-form">
          <label>Nichos (separados por coma)<input className="input" value={nichos} placeholder="Ej: estética, inmobiliarias, gastronomía" onChange={e => setNichos(e.target.value)} /></label>
          <label>Foco / objetivo (opcional)<input className="input" value={foco} placeholder="Ej: reels que generen consultas por DM" onChange={e => setFoco(e.target.value)} /></label>
          <button className="btn btn-primary" onClick={generar} disabled={gen}>
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
