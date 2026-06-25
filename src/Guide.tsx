import { useState, useMemo, useEffect } from 'react';
import {
  BookOpen, Search, Plus, X, Trash2, Map as MapIcon, ListChecks, Check, Pencil,
  Video, Link as LinkIcon, AppWindow, ExternalLink,
} from 'lucide-react';
import { useGuide } from './hooks';
import {
  GUIDE_CATEGORIES, GUIDE_CAT_MAP, smoothPath,
  type GuideTopic, type GuideResource, type GuideCategory,
} from './utils';
import { toEmbed, videoPlatform } from './embed';
import Markdown from './Markdown';

const SEEN_KEY = 'myb_guide_seen';
const loadSeen = (): string[] => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; } };

type Form = Omit<GuideTopic, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
const emptyForm = (cat: GuideCategory): Form => ({ category: cat, title: '', emoji: '📌', summary: '', content: '', resources: [], order: 99 });

export default function Guide() {
  const { topics, add, update, remove } = useGuide();
  const [view, setView] = useState<'temas' | 'mapa'>('temas');
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<GuideCategory | 'all'>('all');
  const [detail, setDetail] = useState<GuideTopic | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [seen, setSeen] = useState<string[]>(loadSeen);
  const [mapScope, setMapScope] = useState<GuideCategory | 'all'>('all');

  // Mantener el detalle sincronizado con datos frescos
  useEffect(() => {
    if (detail) { const fresh = topics.find(t => t.id === detail.id); if (fresh) setDetail(fresh); else setDetail(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics]);

  const toggleSeen = (id: string) => setSeen(prev => {
    const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    return next;
  });
  const isSeen = (id: string) => seen.includes(id);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return topics.filter(t =>
      (cat === 'all' || t.category === cat) &&
      (!q || `${t.title} ${t.summary} ${t.content}`.toLowerCase().includes(q))
    );
  }, [topics, cat, search]);

  const byCat = (c: GuideCategory) => filtered.filter(t => t.category === c);
  const mapTopics = useMemo(() => topics.filter(t => mapScope === 'all' || t.category === mapScope).sort((a, b) => (a.category < b.category ? -1 : a.category > b.category ? 1 : a.order - b.order)), [topics, mapScope]);
  const mapProgress = mapTopics.length ? Math.round(mapTopics.filter(t => isSeen(t.id)).length / mapTopics.length * 100) : 0;

  const openNew = () => setForm(emptyForm(cat === 'all' ? 'marca' : cat));
  const openEdit = (t: GuideTopic) => setForm({ ...t });
  const save = async () => {
    if (!form || !form.title.trim()) return;
    const payload = { category: form.category, title: form.title.trim(), emoji: form.emoji || '📌', summary: form.summary, content: form.content, resources: form.resources, order: form.order };
    if (form.id) await update(form.id, payload); else await add(payload);
    setForm(null);
  };
  const videosOf = (t: GuideTopic) => (t.resources || []).filter(r => r.type === 'video');

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 120px)' }}>
      <div style={{ flex: 1, overflow: 'auto', paddingRight: detail ? 20 : 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={22} />
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Guía</h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="guide-toggle">
              <button className={view === 'temas' ? 'active' : ''} onClick={() => setView('temas')}><ListChecks size={14} /> Temas</button>
              <button className={view === 'mapa' ? 'active' : ''} onClick={() => setView('mapa')}><MapIcon size={14} /> Mapa</button>
            </div>
            <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={15} /> Agregar tema</button>
          </div>
        </div>

        {view === 'temas' ? (
          <>
            <div className="hist-filters">
              <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
                <Search size={16} />
                <input placeholder="Buscar en la guía…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="guide-cats">
              <button className={`hist-folder ${cat === 'all' ? 'active' : ''}`} onClick={() => setCat('all')}>Todas <span>{topics.length}</span></button>
              {GUIDE_CATEGORIES.map(c => (
                <button key={c.key} className={`hist-folder ${cat === c.key ? 'active' : ''}`} onClick={() => setCat(c.key)}>{c.emoji} {c.label.split(' ')[0]} <span>{topics.filter(t => t.category === c.key).length}</span></button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="notif-empty"><BookOpen size={32} /><p>No hay temas en este filtro. Tocá "Agregar tema".</p></div>
            ) : (
              GUIDE_CATEGORIES.filter(c => (cat === 'all' || cat === c.key) && byCat(c.key).length > 0).map(c => (
                <div key={c.key} style={{ marginBottom: 22 }}>
                  <div className="guide-cat-title" style={{ color: c.color }}>{c.emoji} {c.label}</div>
                  <div className="guide-grid">
                    {byCat(c.key).map(t => (
                      <div key={t.id} className={`guide-card ${isSeen(t.id) ? 'seen' : ''}`} onClick={() => setDetail(t)}>
                        <div className="guide-card-emoji">{t.emoji}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="guide-card-title">{t.title}{isSeen(t.id) && <Check size={13} className="guide-seen-tick" />}</div>
                          <div className="guide-card-sum">{t.summary}</div>
                          {videosOf(t).length > 0 && <div className="guide-card-vids"><Video size={12} /> {videosOf(t).length} video{videosOf(t).length > 1 ? 's' : ''}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        ) : (
          <>
            <div className="guide-cats">
              <button className={`hist-folder ${mapScope === 'all' ? 'active' : ''}`} onClick={() => setMapScope('all')}>Todo el recorrido</button>
              {GUIDE_CATEGORIES.map(c => (
                <button key={c.key} className={`hist-folder ${mapScope === c.key ? 'active' : ''}`} onClick={() => setMapScope(c.key)}>{c.emoji} {c.label.split(' ')[0]}</button>
              ))}
            </div>
            <GuideMap topics={mapTopics} isSeen={isSeen} progress={mapProgress} onPick={t => setDetail(t)} />
          </>
        )}
      </div>

      {/* Panel de detalle */}
      {detail && (
        <div className="guide-detail">
          <div className="guide-detail-head">
            <div style={{ minWidth: 0 }}>
              <div className="guide-detail-cat" style={{ color: GUIDE_CAT_MAP[detail.category].color }}>{GUIDE_CAT_MAP[detail.category].emoji} {GUIDE_CAT_MAP[detail.category].label}</div>
              <h2 style={{ fontSize: 19, fontWeight: 700, margin: '4px 0 0' }}>{detail.emoji} {detail.title}</h2>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost btn-icon" onClick={() => openEdit(detail)} title="Editar"><Pencil size={16} /></button>
              <button className="btn btn-ghost btn-icon" onClick={() => setConfirm(detail.id)} title="Borrar"><Trash2 size={16} /></button>
              <button className="btn btn-ghost btn-icon" onClick={() => setDetail(null)}><X size={16} /></button>
            </div>
          </div>
          <div className="guide-detail-body">
            <button className={`btn btn-sm ${isSeen(detail.id) ? 'btn-secondary' : 'btn-primary'}`} style={{ marginBottom: 14 }} onClick={() => toggleSeen(detail.id)}>
              <Check size={14} /> {isSeen(detail.id) ? 'Visto' : 'Marcar como visto'}
            </button>

            <Markdown text={detail.content} />

            {videosOf(detail).map((r, k) => (
              <div key={k} style={{ marginTop: 16 }}>
                <div className="guide-res-title"><Video size={13} /> {r.title || 'Video'}</div>
                <div className="guide-video"><iframe src={toEmbed(r.url)} allow="fullscreen; encrypted-media; picture-in-picture" title={r.title || 'video'} /></div>
              </div>
            ))}

            {(detail.resources || []).filter(r => r.type !== 'video').length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div className="guide-res-title">Recursos</div>
                {(detail.resources || []).filter(r => r.type !== 'video').map((r, k) => (
                  <a key={k} className="guide-res" href={r.url} target="_blank" rel="noreferrer">
                    {r.type === 'app' ? <AppWindow size={14} /> : <LinkIcon size={14} />}
                    <span style={{ flex: 1 }}>{r.title || r.url}</span>
                    <ExternalLink size={13} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor */}
      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '88vh', overflow: 'auto' }}>
            <h2>{form.id ? 'Editar tema' : 'Nuevo tema'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="input-group" style={{ width: 70 }}><label>Emoji</label>
                  <input className="input" value={form.emoji} onChange={e => setForm({ ...form, emoji: e.target.value })} /></div>
                <div className="input-group" style={{ flex: 1 }}><label>Categoría</label>
                  <select className="select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value as GuideCategory })}>
                    {GUIDE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select></div>
              </div>
              <div className="input-group"><label>Título *</label>
                <input className="input" value={form.title} autoFocus onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div className="input-group"><label>Resumen (una línea)</label>
                <input className="input" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} /></div>
              <div className="input-group"><label>Contenido (podés usar markdown: ## título, **negrita**, - listas)</label>
                <textarea className="input" rows={8} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} style={{ fontFamily: 'inherit', lineHeight: 1.5 }} /></div>

              <div>
                <label className="be-label">Recursos y videos</label>
                {(form.resources || []).map((r, k) => (
                  <div key={k} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <select className="select" style={{ width: 90 }} value={r.type} onChange={e => setForm({ ...form, resources: form.resources.map((x, j) => j === k ? { ...x, type: e.target.value as GuideResource['type'] } : x) })}>
                      <option value="video">Video</option><option value="link">Link</option><option value="app">App</option>
                    </select>
                    <input className="input" style={{ width: 110 }} placeholder="Título" value={r.title} onChange={e => setForm({ ...form, resources: form.resources.map((x, j) => j === k ? { ...x, title: e.target.value } : x) })} />
                    <input className="input" style={{ flex: 1 }} placeholder="https://… (YouTube / Instagram / link)" value={r.url} onChange={e => setForm({ ...form, resources: form.resources.map((x, j) => j === k ? { ...x, url: e.target.value, platform: videoPlatform(e.target.value) } : x) })} />
                    <button className="btn btn-ghost btn-icon" onClick={() => setForm({ ...form, resources: form.resources.filter((_, j) => j !== k) })}><Trash2 size={14} /></button>
                  </div>
                ))}
                <button className="btn btn-secondary btn-sm" onClick={() => setForm({ ...form, resources: [...(form.resources || []), { type: 'video', title: '', url: '' }] })}><Plus size={13} /> Agregar recurso</button>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>{form.id ? 'Guardar' : 'Crear tema'}</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h2>¿Borrar tema?</h2>
            <p className="confirm-text">No se puede deshacer.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => { remove(confirm); setConfirm(null); setDetail(null); }}>Borrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Mapa de aprendizaje (recorrido SVG estilo onboarding)
function GuideMap({ topics, isSeen, progress, onPick }: {
  topics: GuideTopic[]; isSeen: (id: string) => boolean; progress: number; onPick: (t: GuideTopic) => void;
}) {
  const VB_W = 1000, VB_H = 440;
  const N = topics.length;
  const stars = useMemo(() => Array.from({ length: 50 }, () => ({
    cx: +(Math.random() * VB_W).toFixed(0), cy: +(Math.random() * VB_H).toFixed(0),
    r: +(Math.random() * 1.5 + 0.4).toFixed(2), o: +(Math.random() * 0.5 + 0.15).toFixed(2),
  })), []);

  if (N === 0) return <div className="notif-empty"><MapIcon size={32} /><p>No hay temas para el mapa todavía.</p></div>;

  const perRow = Math.max(1, Math.ceil(N / 2));
  const xAt = (col: number) => 110 + (780 / Math.max(1, perRow - 1)) * col;
  const pts = topics.map((_, i) => {
    const wave = i % 2 === 0 ? -18 : 18;
    if (i < perRow) return { x: xAt(i), y: 160 + wave };
    return { x: xAt(perRow - 1 - (i - perRow)), y: 320 - wave };
  });
  const d = smoothPath(pts);
  const currentIdx = topics.findIndex(t => !isSeen(t.id));
  const C = 2 * Math.PI * 16;

  return (
    <div className="onb-map">
      <div className="onb-map-canvas">
        <div className="onb-map-head">
          <div>
            <div className="onb-map-eyebrow">Recorrido de aprendizaje</div>
            <h3 className="onb-map-title">Mapa de la guía</h3>
          </div>
          <div className="onb-map-ring">
            <svg width="46" height="46" viewBox="0 0 46 46">
              <circle cx="23" cy="23" r="16" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
              <circle cx="23" cy="23" r="16" fill="none" stroke="#818cf8" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - progress / 100)} transform="rotate(-90 23 23)" style={{ transition: 'stroke-dashoffset .5s' }} />
            </svg>
            <span>{progress}%</span>
          </div>
        </div>
        <svg className="onb-map-svg" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet">
          {stars.map((s, i) => <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#fff" opacity={s.o} />)}
          <path d={d} fill="none" stroke="rgba(129,140,248,0.18)" strokeWidth="10" strokeLinecap="round" />
          <path d={d} fill="none" stroke="url(#guideGrad)" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 10" />
          <defs>
            <linearGradient id="guideGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#6366f1" /><stop offset="1" stopColor="#10b981" />
            </linearGradient>
          </defs>
          {topics.map((t, i) => {
            const p = pts[i];
            const done = isSeen(t.id);
            const current = i === currentIdx;
            return (
              <g key={t.id} className="onb-node" onClick={() => onPick(t)} style={{ cursor: 'pointer' }}>
                {current && <circle cx={p.x} cy={p.y} r="30" fill="none" stroke="#818cf8" strokeWidth="2" opacity="0.5" />}
                <circle cx={p.x} cy={p.y} r="22" fill={done ? '#10b981' : current ? '#6366f1' : '#1e293b'} stroke={done ? '#10b981' : current ? '#818cf8' : 'rgba(255,255,255,0.15)'} strokeWidth="2" />
                <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize="18">{t.emoji}</text>
                <text x={p.x} y={p.y + 40} textAnchor="middle" fontSize="13" fill="#cbd5e1" fontWeight="600">{t.title.length > 18 ? t.title.slice(0, 17) + '…' : t.title}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
