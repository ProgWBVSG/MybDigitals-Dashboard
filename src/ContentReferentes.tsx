// Referentes (swipe file).
//
// Guardás el link de un video que funcionó y la IA lo clasifica: si es de venta,
// tendencia, viral o educativo, qué fórmula de hook usa, qué formato narrativo
// sigue, por qué funciona y cómo adaptarlo al rubro propio.
import { useState, useMemo } from 'react';
import { Plus, Trash2, Sparkles, ExternalLink, Star, Loader2, Filter } from 'lucide-react';
import type { useContent } from './hooks';
import { REF_CATEGORIES, REF_CATEGORY_LABELS, REF_PLATFORMS, type ContentRef, type RefCategory } from './utils';
import { HOOK_FORMULAS, NARRATIVES } from './hooks-data';

const CAT_COLOR: Record<string, string> = Object.fromEntries(REF_CATEGORIES.map(c => [c.key, c.color]));

// Detecta la plataforma del link para no hacerlo elegir a mano.
const guessPlatform = (url: string): string => {
  const u = url.toLowerCase();
  if (u.includes('tiktok')) return 'TikTok';
  if (u.includes('youtube') || u.includes('youtu.be')) return 'YouTube Shorts';
  return 'Instagram';
};

// Extrae el @usuario del link cuando está en la ruta (TikTok e IG lo ponen ahí).
const guessCreator = (url: string): string => {
  const m = url.match(/@([\w.]+)/) || url.match(/instagram\.com\/([\w.]+)\//);
  return m ? '@' + m[1].replace(/^@/, '') : '';
};

function RefForm({ initial, onSave, onClose, onAnalyze }: {
  initial?: Partial<ContentRef>;
  onSave: (r: Partial<ContentRef>) => void; onClose: () => void;
  onAnalyze: (input: { url: string; hook?: string; notas?: string }) => Promise<any | null>;
}) {
  const [f, setF] = useState<Partial<ContentRef>>({
    url: '', creator: '', platform: 'Instagram', category: '', hook: '', hookFormula: '',
    narrative: '', whyWorks: '', howToAdapt: '', notes: '', saved: false, ...initial,
  });
  const [busy, setBusy] = useState(false);

  const setUrl = (url: string) => setF(prev => ({
    ...prev, url,
    platform: url.startsWith('http') ? guessPlatform(url) : prev.platform,
    creator: prev.creator || guessCreator(url),
  }));

  const analyze = async () => {
    if (!(f.url || '').trim()) return;
    setBusy(true);
    const a = await onAnalyze({ url: f.url!, hook: f.hook, notas: f.notes });
    setBusy(false);
    if (!a) return;
    setF(prev => ({
      ...prev,
      category: a.categoria || prev.category,
      hook: a.gancho || prev.hook,
      hookFormula: a.formulaHook || prev.hookFormula,
      narrative: a.formatoNarrativo || prev.narrative,
      whyWorks: a.porQueFunciona || prev.whyWorks,
      howToAdapt: a.comoAdaptarlo || prev.howToAdapt,
      analyzedAt: Date.now(),
    }));
  };

  const save = () => {
    if (!(f.url || '').trim()) return;
    onSave(f); onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ref-modal" onClick={e => e.stopPropagation()}>
        <h2>{initial?.id ? 'Editar referente' : 'Nuevo referente'}</h2>
        <div className="ig-form">
          <label>Link del video
            <div className="ref-url-row">
              <input className="input" autoFocus placeholder="https://instagram.com/reel/… o TikTok" value={f.url || ''} onChange={e => setUrl(e.target.value)} />
              <button className="btn btn-primary btn-sm" disabled={busy || !(f.url || '').trim()} onClick={analyze}>
                {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} {busy ? 'Analizando…' : 'Analizar'}
              </button>
            </div>
          </label>
          <p className="ref-tip">
            La IA no puede ver el video. Pegá el <b>gancho</b> (lo que dice en los primeros 3s) o describilo en las notas
            para que el análisis sea preciso.
          </p>

          <label>Gancho (primeros 3 segundos)
            <textarea className="input" rows={2} placeholder="Lo que dice al arrancar…" value={f.hook || ''} onChange={e => setF({ ...f, hook: e.target.value })} />
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1 }}>Creador<input className="input" placeholder="@usuario" value={f.creator || ''} onChange={e => setF({ ...f, creator: e.target.value })} /></label>
            <label style={{ flex: 1 }}>Plataforma
              <select className="select" value={f.platform} onChange={e => setF({ ...f, platform: e.target.value })}>
                {REF_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          </div>

          <div>
            <label className="scr-col-label">Categoría</label>
            <div className="ref-cats">
              {REF_CATEGORIES.map(cat => (
                <button key={cat.key} type="button" className={f.category === cat.key ? 'active' : ''}
                  style={f.category === cat.key ? { borderColor: cat.color, color: cat.color } : undefined}
                  onClick={() => setF({ ...f, category: cat.key as RefCategory })}>{cat.label}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1 }}>Fórmula de hook
              <select className="select" value={f.hookFormula || ''} onChange={e => setF({ ...f, hookFormula: e.target.value })}>
                <option value="">Sin definir</option>
                {HOOK_FORMULAS.map(h => <option key={h.key} value={h.label}>{h.label}</option>)}
              </select>
            </label>
            <label style={{ flex: 1 }}>Formato narrativo
              <select className="select" value={f.narrative || ''} onChange={e => setF({ ...f, narrative: e.target.value })}>
                <option value="">Sin definir</option>
                {NARRATIVES.map(n => <option key={n.key} value={n.label}>{n.label}</option>)}
              </select>
            </label>
          </div>

          <label>Por qué funciona
            <textarea className="input" rows={3} value={f.whyWorks || ''} onChange={e => setF({ ...f, whyWorks: e.target.value })} />
          </label>
          <label>Cómo adaptarlo a lo mío
            <textarea className="input" rows={3} value={f.howToAdapt || ''} onChange={e => setF({ ...f, howToAdapt: e.target.value })} />
          </label>
          <label>Notas
            <textarea className="input" rows={2} value={f.notes || ''} onChange={e => setF({ ...f, notes: e.target.value })} />
          </label>
          <label className="scr-check">
            <input type="checkbox" checked={!!f.saved} onChange={e => setF({ ...f, saved: e.target.checked })} /> Marcar como favorito
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>{initial?.id ? 'Guardar' : 'Agregar'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Referentes({ c }: { c: ReturnType<typeof useContent> }) {
  const [form, setForm] = useState<Partial<ContentRef> | null>(null);
  const [filter, setFilter] = useState<RefCategory | 'todos' | 'favoritos'>('todos');

  const list = useMemo(() => c.refs.filter(r =>
    filter === 'todos' ? true : filter === 'favoritos' ? r.saved : r.category === filter
  ), [c.refs, filter]);

  const counts = useMemo(() => {
    const byCat = Object.fromEntries(REF_CATEGORIES.map(x => [x.key, 0])) as Record<string, number>;
    for (const r of c.refs) if (r.category) byCat[r.category] = (byCat[r.category] || 0) + 1;
    return byCat;
  }, [c.refs]);

  return (
    <div className="ig-card">
      <div className="ig-card-head">
        <div><p className="ig-eyebrow">Swipe file</p><h3>Referentes</h3></div>
        <button className="btn btn-primary btn-sm" onClick={() => setForm({})}><Plus size={14} /> Nuevo referente</button>
      </div>

      {c.refs.length > 0 && (
        <div className="ref-filters">
          <Filter size={14} />
          <button className={filter === 'todos' ? 'active' : ''} onClick={() => setFilter('todos')}>Todos <em>{c.refs.length}</em></button>
          {REF_CATEGORIES.map(cat => (
            <button key={cat.key} className={filter === cat.key ? 'active' : ''} onClick={() => setFilter(cat.key)}
              style={filter === cat.key ? { borderColor: cat.color, color: cat.color } : undefined}>
              {cat.label} <em>{counts[cat.key] || 0}</em>
            </button>
          ))}
          <button className={filter === 'favoritos' ? 'active' : ''} onClick={() => setFilter('favoritos')}>
            <Star size={12} /> Favoritos <em>{c.refs.filter(r => r.saved).length}</em>
          </button>
        </div>
      )}

      {c.refs.length === 0 ? (
        <div className="ig-empty">
          <p>Todavía no guardaste referentes.</p>
          <p className="ig-empty-sub">Pegá el link de un video que te funcionó y la IA te dice qué fórmula usa y cómo adaptarlo.</p>
        </div>
      ) : list.length === 0 ? (
        <div className="ig-empty-inline">No hay referentes en esta categoría.</div>
      ) : (
        <div className="ref-grid">
          {list.map(r => (
            <div key={r.id} className="ref-card" onClick={() => setForm(r)}>
              <div className="ref-card-head">
                <div className="ref-card-tags">
                  {r.category && <span className="ref-badge" style={{ background: CAT_COLOR[r.category] }}>{REF_CATEGORY_LABELS[r.category as RefCategory]}</span>}
                  <span className="ref-badge soft">{r.platform}</span>
                  {r.saved && <Star size={13} className="ref-star" />}
                </div>
                <div className="ref-card-actions" onClick={e => e.stopPropagation()}>
                  {r.url.startsWith('http') && (
                    <a href={r.url} target="_blank" rel="noreferrer" title="Abrir video"><ExternalLink size={13} /></a>
                  )}
                  <button title="Borrar" onClick={() => c.removeRef(r.id)}><Trash2 size={13} /></button>
                </div>
              </div>

              {r.creator && <p className="ref-creator">{r.creator}</p>}
              {r.hook && <p className="ref-hook">"{r.hook}"</p>}

              <div className="ref-card-meta">
                {r.hookFormula && <span className="ref-chip">🎣 {r.hookFormula}</span>}
                {r.narrative && <span className="ref-chip">📐 {r.narrative}</span>}
              </div>

              {r.whyWorks && <div className="ref-block"><span>Por qué funciona</span><p>{r.whyWorks}</p></div>}
              {r.howToAdapt && <div className="ref-block adapt"><span>Cómo adaptarlo</span><p>{r.howToAdapt}</p></div>}
            </div>
          ))}
        </div>
      )}

      {form && <RefForm initial={form} onClose={() => setForm(null)}
        onAnalyze={c.analyzeRef}
        onSave={r => form.id ? c.updateRef(form.id, r) : c.addRef(r)} />}
    </div>
  );
}
