import { useState, useMemo, useEffect } from 'react';
import { Sparkles, Plug, Plus, Trash2, ChevronLeft, ChevronRight, CheckCircle2, Send, Copy, Check, Search, X } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useContent, useClients } from './hooks';
import {
  CONTENT_STATUSES, CONTENT_FORMATS, CONTENT_FORMAT_LABELS, CONTENT_OBJECTIVES, uuid,
  AD_FORMATS, AD_FORMAT_LABELS, AD_OBJECTIVES, AD_OBJECTIVE_RESULT_LABEL, AD_STATUSES, CONTENT_GAMES,
  CONTENT_ANGLES, CONTENT_ANGLE_LABELS,
  type ContentPost, type ContentStatus, type ContentFormat, type ContentAd, type AdFormat, type AdStatus,
} from './utils';
import { encodeScript, scriptPreview, splitIntoTakes, takeProgress, decodeScript, isStructuredScript, scriptForShare, type ScriptBlock } from './script';
import { PostForm } from './ContentGuion';
import Metricas from './ContentMetricas';
import Ganchos from './ContentGanchos';
import Referentes from './ContentReferentes';
import Calendario from './ContentCalendario';
import { AccountSwitcher, AccountsModal, ACCOUNT_STORAGE_KEY, resolveStoredAccount } from './ContentCuentas';
import './Content.css';

type Tab = 'resumen' | 'ideas' | 'guiones' | 'ganchos' | 'referentes' | 'tabla' | 'pipeline' | 'calendario' | 'metricas' | 'generador' | 'anuncios' | 'fuentes' | 'conexion';
const TABS: { k: Tab; label: string }[] = [
  { k: 'resumen', label: 'Resumen' },
  { k: 'ideas', label: 'Ideas ✨' },
  { k: 'guiones', label: 'Guiones 🎬' },
  { k: 'ganchos', label: 'Ganchos 🎣' },
  { k: 'referentes', label: 'Referentes 🔥' },
  { k: 'pipeline', label: 'Pipeline' },
  { k: 'tabla', label: 'Tabla ⚡' },
  { k: 'calendario', label: 'Calendario' },
  { k: 'metricas', label: 'Métricas 📈' },
  { k: 'generador', label: 'Generador' },
  { k: 'anuncios', label: 'Anuncios 📊' },
  { k: 'fuentes', label: 'Fuentes' },
  { k: 'conexion', label: 'Conexión IG' },
];
const ANGLE_COLOR: Record<string, string> = Object.fromEntries(CONTENT_ANGLES.map(a => [a.key, a.color]));
const STATUS_ORDER: ContentStatus[] = ['borrador', 'aprobado', 'listo'];

export default function Content() {
  const [tab, setTab] = useState<Tab>('resumen');
  const [accountId, setAccountId] = useState<string | null>(() => localStorage.getItem(ACCOUNT_STORAGE_KEY));
  const [managing, setManaging] = useState(false);
  const c = useContent(accountId);

  // Al cargar (o si se borró la cuenta guardada) cae en la primera disponible.
  useEffect(() => {
    if (!c.accounts.length) return;
    const resolved = resolveStoredAccount(c.accounts);
    if (resolved !== accountId) setAccountId(resolved);
  }, [c.accounts, accountId]);

  const selectAccount = (id: string) => {
    setAccountId(id);
    localStorage.setItem(ACCOUNT_STORAGE_KEY, id);
  };

  // Conteo de piezas por cuenta para mostrarlo en el selector.
  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const p of c.allPosts) if (p.accountId) acc[p.accountId] = (acc[p.accountId] || 0) + 1;
    return acc;
  }, [c.allPosts]);

  const active = c.accounts.find(a => a.id === accountId);
  const orphans = c.allPosts.filter(p => !p.accountId).length;

  return (
    <div className="ig">
      <div className="ig-head">
        <div className="ig-title">
          <span className="ig-logo" style={active ? { background: active.color } : undefined}>IG</span>
          <div>
            <h2>IG Content</h2>
            <p>{active ? `${active.name}${active.handle ? ` · @${active.handle}` : ''}` : 'Centro de contenido para Instagram'}</p>
          </div>
        </div>
        <div className="ig-head-right">
          <span className="ig-pill">{c.posts.length} piezas · {c.sources.length} fuentes</span>
          <AccountSwitcher accounts={c.accounts} accountId={accountId} counts={counts}
            onSelect={selectAccount} onManage={() => setManaging(true)} />
        </div>
      </div>

      {!c.loading && !c.accounts.length && (
        <div className="ig-notice">
          Creá tu primera cuenta para separar guiones y métricas. Si ya venías cargando contenido, al crear la cuenta te lo asigno.
        </div>
      )}
      {orphans > 0 && c.accounts.length > 0 && (
        <div className="ig-notice warn">
          Hay {orphans} pieza{orphans === 1 ? '' : 's'} sin cuenta asignada (de antes de separar por cuenta).
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: 10 }}
            onClick={() => accountId && c.claimOrphans(accountId)}>
            Asignar a {active?.name || 'esta cuenta'}
          </button>
        </div>
      )}

      <div className="ig-tabs">
        {TABS.map(t => <button key={t.k} className={tab === t.k ? 'active' : ''} onClick={() => setTab(t.k)}>{t.label}</button>)}
      </div>

      <div className="ig-body">
        {tab === 'resumen' && <Resumen posts={c.posts} onGo={setTab} />}
        {tab === 'ideas' && <Ideas c={c} />}
        {tab === 'guiones' && <Guiones c={c} />}
        {tab === 'ganchos' && <Ganchos />}
        {tab === 'referentes' && <Referentes c={c} />}
        {tab === 'tabla' && <Tabla c={c} />}
        {tab === 'pipeline' && <Pipeline c={c} />}
        {tab === 'calendario' && <Calendario c={c} />}
        {tab === 'metricas' && <Metricas c={c} />}
        {tab === 'generador' && <Generador c={c} onDone={() => setTab('pipeline')} />}
        {tab === 'anuncios' && <Anuncios c={c} />}
        {tab === 'fuentes' && <Fuentes c={c} />}
        {tab === 'conexion' && <Conexion />}
      </div>

      {managing && (
        <AccountsModal accounts={c.accounts} counts={counts} onClose={() => setManaging(false)}
          onAdd={async a => {
            const id = await c.addAccount(a);
            // La primera cuenta se selecciona sola y adopta el contenido suelto.
            if (id) { selectAccount(id); if (!c.accounts.length) c.claimOrphans(id); }
            return id;
          }}
          onUpdate={c.updateAccount} onRemove={c.removeAccount} />
      )}
    </div>
  );
}

// Criterio de búsqueda compartido por Pipeline y Tabla: mira todo lo que uno
// puede recordar de una pieza, no solo el título — muchas veces se acuerda una
// frase del guion o del CTA y no cómo la tituló.
const matchPosts = (posts: ContentPost[], q: string): ContentPost[] => {
  const needle = q.trim().toLowerCase();
  if (!needle) return posts;
  return posts.filter(p => {
    const blocks = decodeScript(p.content);
    return [
      p.title, p.theme, p.cta, p.caption, p.hashtagsIg, p.objective,
      ...blocks.map(b => b.text), ...blocks.map(b => b.visual),
    ].join(' ').toLowerCase().includes(needle);
  });
};

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

function Pipeline({ c }: { c: ReturnType<typeof useContent> }) {
  const [form, setForm] = useState<Partial<ContentPost> | null>(null);
  const [angleFilter, setAngleFilter] = useState<string>('todos');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [askUrl, setAskUrl] = useState<ContentPost | null>(null);
  const [q, setQ] = useState('');
  const move = (p: ContentPost, dir: number) => {
    const i = STATUS_ORDER.indexOf(p.status);
    const next = STATUS_ORDER[Math.max(0, Math.min(STATUS_ORDER.length - 1, i + dir))];
    if (next === p.status) return;
    // Publicar sella la fecha de salida (si no venia programada) y marca la pieza
    // como grabada+editada: llegar hasta aca implica que ya pasó por eso.
    const extra: Partial<ContentPost> = next === 'publicado'
      ? { publishedAt: p.publishedAt ?? p.scheduledFor ?? Date.now(), recorded: true, edited: true }
      : (p.status === 'publicado' ? { publishedAt: null } : {});
    c.updatePost(p.id, { status: next, ...extra });
    // Al publicar, pedir el link del reel para poder anclar sus métricas.
    if (next === 'publicado' && !p.postUrl) setAskUrl({ ...p, status: next, ...extra });
  };
  const visible = useMemo(() => {
    const byAngle = angleFilter === 'todos'
      ? c.posts : c.posts.filter(p => (p.angle || 'valor') === angleFilter);
    return matchPosts(byAngle, q);
  }, [c.posts, angleFilter, q]);

  // Copia la pieza lista para mandar por WhatsApp sin tener que abrirla.
  const copyPost = (p: ContentPost) => {
    navigator.clipboard.writeText(scriptForShare(decodeScript(p.content), {
      title: p.title, angleLabel: CONTENT_ANGLE_LABELS[p.angle || 'valor'],
      formatLabel: CONTENT_FORMAT_LABELS[p.format],
      howToRecord: p.howToRecord, cta: p.cta, caption: p.caption,
      hashtags: p.hashtagsIg, refLink: p.refLink,
    }));
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="ig-card">
      <div className="ig-card-head">
        <div><p className="ig-eyebrow">Workflow editorial</p><h3>Pipeline de producción</h3></div>
        <div className="ig-head-tools">
          <div className="ig-search">
            <Search size={14} />
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="Buscar en título, guion, CTA…" />
            {q && <button title="Limpiar" onClick={() => setQ('')}><X size={13} /></button>}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setForm({})}><Plus size={14} /> Nueva pieza</button>
        </div>
      </div>

      {q.trim() && (
        <p className="ig-search-count">
          {visible.length === 0
            ? `Ninguna pieza coincide con "${q.trim()}".`
            : `${visible.length} pieza${visible.length === 1 ? '' : 's'} coincide${visible.length === 1 ? '' : 'n'} con "${q.trim()}".`}
        </p>
      )}

      <div className="ig-angle-filter">
        <button className={angleFilter === 'todos' ? 'active' : ''} onClick={() => setAngleFilter('todos')}>
          Todos <em>{c.posts.length}</em>
        </button>
        {CONTENT_ANGLES.map(a => {
          const n = c.posts.filter(p => (p.angle || 'valor') === a.key).length;
          return (
            <button key={a.key} className={angleFilter === a.key ? 'active' : ''}
              style={angleFilter === a.key ? { borderColor: a.color, color: a.color } : undefined}
              onClick={() => setAngleFilter(a.key)}>{a.label} <em>{n}</em></button>
          );
        })}
      </div>

      <div className="ig-board">
        {CONTENT_STATUSES.map(st => {
          const items = visible.filter(p => p.status === st.key);
          return (
            <div key={st.key} className="ig-lane">
              <div className="ig-lane-head">{st.label}<span>{items.length}</span></div>
              {/* Las tarjetas van en su propio contenedor con scroll: así el
                  encabezado de la columna queda fijo y una columna con muchas
                  piezas no estira la página entera. */}
              <div className="ig-lane-cards">
              {items.map(p => {
                const prog = isStructuredScript(p.content) ? takeProgress(decodeScript(p.content)) : { done: 0, total: 0 };
                const angle = p.angle || 'valor';
                return (
                  <div key={p.id} className="ig-post" onClick={() => setForm(p)}
                    style={{ borderTopColor: ANGLE_COLOR[angle] }}>
                    <h4>{p.title || 'Sin título'}</h4>
                    {scriptPreview(p.content) && <p>{scriptPreview(p.content)}</p>}
                    <div className="ig-post-meta">
                      <span className="ig-badge angle" style={{ background: ANGLE_COLOR[angle] }}>{CONTENT_ANGLE_LABELS[angle]}</span>
                      {p.kind === 'anuncio' && <span className="ig-badge kind-ad">📊 Anuncio</span>}
                      {fmtBadge(p.format)}
                      {p.status === 'publicado'
                        ? <span className="ig-badge pub">▲ Publicado{p.publishedAt ? ` ${new Date(p.publishedAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}` : ''}</span>
                        : p.edited ? <span className="ig-badge soft">✓ Editado</span>
                        : p.recorded ? <span className="ig-badge soft">✓ Grabado</span> : null}
                    </div>
                    {prog.total > 0 && (
                      <div className="ig-post-takes" title={`${prog.done} de ${prog.total} tomas grabadas`}>
                        <div className="ig-post-takes-bar"><div style={{ width: `${(prog.done / prog.total) * 100}%` }} /></div>
                        <span>{prog.done}/{prog.total}</span>
                      </div>
                    )}
                    <div className="ig-post-actions" onClick={e => e.stopPropagation()}>
                      <button title="Mover atrás" disabled={p.status === 'borrador'} onClick={() => move(p, -1)}><ChevronLeft size={14} /></button>
                      <button title="Mover adelante" disabled={p.status === 'publicado'} onClick={() => move(p, 1)}><ChevronRight size={14} /></button>
                      <button title="Copiar para mandar por WhatsApp" onClick={() => copyPost(p)}>
                        {copiedId === p.id ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                      <button title="Borrar" onClick={() => c.removePost(p.id)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && <div className="ig-lane-empty">Vacío</div>}
              </div>
            </div>
          );
        })}
      </div>
      {form && <PostForm initial={form} onClose={() => setForm(null)} onSave={p => form.id ? c.updatePost(form.id, p) : c.addPost(p)} />}
      {askUrl && <PublishedUrlModal post={askUrl} onSave={u => c.updatePost(askUrl.id, u)} onClose={() => setAskUrl(null)} />}
    </div>
  );
}

// El calendario vive en ContentCalendario.tsx: dejó de ser una grilla de "qué
// sale tal día" para cruzar el ritmo de producción con el estado del Pipeline.

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
  const [q, setQ] = useState('');
  const [genRow, setGenRow] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [editing, setEditing] = useState<ContentPost | null>(null);

  const filtered = useMemo(() => matchPosts(c.posts, q), [c.posts, q]);

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
        <div className="ig-head-tools">
          <div className="ig-search">
            <Search size={14} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar…" />
            {q && <button title="Limpiar" onClick={() => setQ('')}><X size={13} /></button>}
          </div>
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
              {filtered.map(p => (
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
  framework: string; formato: string; categoriaContenido: string; valorClave: string;
  cicloViral: { idea: string; lente: string; comparteFactor: string; razon: string };
  hooks: { texto: string; formula: string; hookVisual: string; textoPantalla: string }[];
  reHook: string;
  guion: { tiempo: string; voz: string; pantalla: string; visual: string; gatillo: string }[];
  cta: { categoria: string; mecanica: string; texto: string };
  loop: string; caption: string; hashtags: string[];
};
const PLATAFORMAS = ['Reel de Instagram', 'YouTube Short', 'TikTok'];
const OBJETIVOS_G = ['Viral / alcance', 'Ventas', 'Educativo', 'Autoridad'];
const DURACIONES = ['7-15s', '20-30s', '45-60s'];

function Guiones({ c }: { c: ReturnType<typeof useContent> }) {
  const { clients } = useClients();
  const [plataforma, setPlataforma] = useState(PLATAFORMAS[0]);
  const [objetivo, setObjetivo] = useState(OBJETIVOS_G[0]);
  const [duracion, setDuracion] = useState(DURACIONES[1]);
  const [tema, setTema] = useState('');
  const [publico, setPublico] = useState('');
  const [clientId, setClientId] = useState('');
  const [gen, setGen] = useState(false);
  const [out, setOut] = useState<ViralScript | null>(null);
  const [hookSel, setHookSel] = useState(0);

  const cliente = clients.find(cl => cl.id === clientId);
  const juegoInfo = cliente?.contentGame ? CONTENT_GAMES.find(g => g.key === cliente.contentGame) : undefined;

  const generar = async () => {
    if (!tema.trim()) return;
    setGen(true); setOut(null);
    const r = await c.generateViralScript({ plataforma, objetivo, duracion, tema, publico: publico || cliente?.name || '', juego: cliente?.contentGame || undefined });
    setGen(false);
    if (r) { setOut(r as ViralScript); setHookSel(0); }
  };
  // Rango tipo "7-12s" → duración en segundos, para precargar el editor de bloques del Pipeline.
  const parseRange = (t: string): number => {
    const nums = (t.match(/\d+/g) || []).map(Number);
    return nums.length >= 2 ? Math.max(1, nums[1] - nums[0]) : 8;
  };
  // Ángulo inferido del objetivo elegido, para que la pieza quede clasificada al guardar.
  const angleFor = (obj: string) => obj.toLowerCase().includes('venta') ? 'venta' as const
    : obj.toLowerCase().includes('viral') || obj.toLowerCase().includes('alcance') ? 'tendencia' as const
    : 'valor' as const;

  const guardar = () => {
    if (!out) return;
    const hook = out.hooks?.[hookSel];
    // Guarda directo como guion por bloques (mismo formato que edita el Pipeline):
    // hook / re-hook propios, cada beat como "desarrollo", cierre como "cta". Los
    // beats largos ya vienen partidos en tomas para poder grabarlos por partes.
    const blocks: ScriptBlock[] = [
      {
        id: uuid(), phase: 'hook', text: hook?.texto || '', seconds: 3, takes: [],
        visual: [hook?.hookVisual && `Visual: ${hook.hookVisual}`, hook?.textoPantalla && `En pantalla: ${hook.textoPantalla}`].filter(Boolean).join(' · '),
      },
      ...(out.reHook ? [{ id: uuid(), phase: 'rehook' as const, text: out.reHook, seconds: 4, visual: '', takes: [] }] : []),
      ...(out.guion || []).map(g => {
        const takes = splitIntoTakes(g.voz);
        return {
          id: uuid(), phase: 'desarrollo' as const, text: g.voz, seconds: parseRange(g.tiempo),
          visual: [g.pantalla && `En pantalla: ${g.pantalla}`, g.visual, g.gatillo && `Gatillo: ${g.gatillo}`].filter(Boolean).join(' · '),
          takes: takes.length > 1 ? takes : [],
        };
      }),
      { id: uuid(), phase: 'cta' as const, text: out.cta?.texto || '', seconds: 5, visual: out.loop ? `Loop: ${out.loop}` : '', takes: [] },
    ];
    c.addPost({
      format: 'reel', objective: objetivo, title: tema, content: encodeScript(blocks),
      status: 'borrador', kind: 'organico', angle: angleFor(objetivo), theme: tema,
      cta: out.cta?.texto || '', caption: out.caption || '',
      hashtagsIg: Array.isArray(out.hashtags) ? out.hashtags.join(' ') : (out.hashtags || ''),
    });
  };

  return (
    <div className="ig-grid-2">
      <div className="ig-card" style={{ alignSelf: 'start' }}>
        <div className="ig-card-head"><div><p className="ig-eyebrow">Estudio de guiones</p><h3>Guion viral</h3></div></div>
        <div className="ig-form">
          <label>Tema<input className="input" value={tema} placeholder="Ej: por qué tu web no vende" onChange={e => setTema(e.target.value)} /></label>
          <label>Cliente (opcional, ajusta el ángulo según su juego de contenido)
            <select className="select" value={clientId} onChange={e => setClientId(e.target.value)}>
              <option value="">— sin cliente —</option>
              {clients.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
            </select>
          </label>
          {juegoInfo && <div className="ig-notice">🎯 <b>{juegoInfo.label}</b>: {juegoInfo.hint}</div>}
          <label>Plataforma<select className="select" value={plataforma} onChange={e => setPlataforma(e.target.value)}>{PLATAFORMAS.map(x => <option key={x}>{x}</option>)}</select></label>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1 }}>Objetivo<select className="select" value={objetivo} onChange={e => setObjetivo(e.target.value)}>{OBJETIVOS_G.map(x => <option key={x}>{x}</option>)}</select></label>
            <label style={{ flex: 1 }}>Duración<select className="select" value={duracion} onChange={e => setDuracion(e.target.value)}>{DURACIONES.map(x => <option key={x}>{x}</option>)}</select></label>
          </div>
          <label>Público / marca (opcional)<input className="input" value={publico} placeholder={cliente?.name || 'Ej: dueños de estética'} onChange={e => setPublico(e.target.value)} /></label>
          <button className="btn btn-primary" onClick={generar} disabled={gen || !tema.trim()}>
            <Sparkles size={15} /> {gen ? 'Escribiendo el guion…' : 'Generar guion viral'}
          </button>
        </div>
      </div>

      <div className="ig-card">
        <div className="ig-card-head">
          <div><p className="ig-eyebrow">{out ? [out.categoriaContenido, out.formato].filter(Boolean).join(' · ') : 'Guion listo para grabar'}</p><h3>{out ? out.framework : 'Salida'}</h3></div>
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
            {out.valorClave && <div className="scr-valor"><b>🎯 Valor clave (walkaway value):</b> {out.valorClave}</div>}
            <div className="scr-hooks">
              <div className="scr-label">🎣 Elegí tu hook (0-3s)</div>
              {(out.hooks || []).map((h, k) => (
                <button key={k} className={`scr-hook ${hookSel === k ? 'on' : ''}`} onClick={() => setHookSel(k)}>
                  <span className="scr-hook-formula">{h.formula}</span>{h.texto}
                  {(h.hookVisual || h.textoPantalla) && (
                    <span className="scr-hook-extra">
                      {h.hookVisual && <>🎥 {h.hookVisual}</>}
                      {h.hookVisual && h.textoPantalla && ' · '}
                      {h.textoPantalla && <>🔤 "{h.textoPantalla}"</>}
                    </span>
                  )}
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
            {out.cta?.texto && <div className="scr-cta"><b>📢 CTA ({out.cta.categoria} · {out.cta.mecanica}):</b> {out.cta.texto}</div>}
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

// Al pasar una pieza a "Publicado" se pide el link del reel: es lo que ancla la
// pieza con sus métricas y lo que permite volver al video desde la tabla.
function PublishedUrlModal({ post, onSave, onClose }: {
  post: ContentPost; onSave: (u: Partial<ContentPost>) => void; onClose: () => void;
}) {
  const [url, setUrl] = useState(post.postUrl || '');
  const [when, setWhen] = useState(() =>
    new Date(post.publishedAt || Date.now()).toISOString().split('T')[0]);

  const save = () => {
    onSave({ postUrl: url.trim(), publishedAt: new Date(when + 'T12:00').getTime() });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h2 style={{ marginTop: 0 }}>Pieza publicada</h2>
        <p className="scr-tip" style={{ marginBottom: 14 }}>
          Pegá el link del reel ya subido. Con eso la pieza queda lista para cargarle
          las métricas desde la pestaña <b>Métricas</b>.
        </p>
        <div className="ig-form">
          <label>Link del reel publicado
            <input className="input" autoFocus value={url} placeholder="https://www.instagram.com/reel/…"
              onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} />
          </label>
          <label>Fecha de publicación
            <input className="input" type="date" value={when} onChange={e => setWhen(e.target.value)} />
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Después</button>
          <button className="btn btn-primary" onClick={save}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
