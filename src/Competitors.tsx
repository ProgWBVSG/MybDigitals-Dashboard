import { useState } from 'react';
import { Swords, Plus, Trash2, Pencil, Sparkles, AtSign, Globe, Loader, TrendingUp, TrendingDown, Target, Lightbulb } from 'lucide-react';
import { useCompetitors, useClients } from './hooks';
import type { Competitor } from './utils';

type Form = { id?: string; clientId: string | null; name: string; instagram: string; website: string; rubro: string; notes: string };
const empty = (clientId: string | null): Form => ({ clientId, name: '', instagram: '', website: '', rubro: '', notes: '' });

export default function Competitors() {
  const { competitors, add, update, remove, analyze } = useCompetitors();
  const { clients } = useClients();
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [modal, setModal] = useState<Form | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  const clientName = (id: string | null) => id ? (clients.find(c => c.id === id)?.name || 'Cliente') : 'General';
  const shown = competitors.filter(c => clientFilter === 'all' || (clientFilter === 'general' ? !c.clientId : c.clientId === clientFilter));

  const save = async () => {
    if (!modal || !modal.name.trim()) return;
    if (modal.id) await update(modal.id, modal); else await add(modal);
    setModal(null);
  };
  const runAnalyze = async (c: Competitor) => { setAnalyzing(c.id); await analyze(c); setAnalyzing(null); };
  const igUrl = (h: string) => `https://instagram.com/${h.replace(/^@/, '').trim()}`;
  const webUrl = (w: string) => w.startsWith('http') ? w : `https://${w}`;

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Swords size={22} />
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Análisis de competencia</h2>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(empty(clientFilter !== 'all' && clientFilter !== 'general' ? clientFilter : null))}><Plus size={15} /> Nuevo competidor</button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>
        Cargá un competidor con lo que observás (qué postea, cada cuánto, su propuesta) y la IA te da posicionamiento, fortalezas, debilidades y huecos para aprovechar.
      </p>

      <div className="cmp-filter">
        <select className="select" value={clientFilter} onChange={e => setClientFilter(e.target.value)} style={{ maxWidth: 240 }}>
          <option value="all">Todos los competidores</option>
          <option value="general">General (sin cliente)</option>
          {clients.map(c => <option key={c.id} value={c.id}>Competencia de {c.name}</option>)}
        </select>
      </div>

      {shown.length === 0 ? (
        <div className="notif-empty"><Swords size={32} /><p>Todavía no cargaste competidores. Tocá "Nuevo competidor" para empezar.</p></div>
      ) : (
        <div className="cmp-list">
          {shown.map(c => (
            <div key={c.id} className="cmp-card">
              <div className="cmp-head">
                <div style={{ minWidth: 0 }}>
                  <div className="cmp-name">{c.name} {c.rubro && <span className="cmp-rubro">{c.rubro}</span>}</div>
                  <div className="cmp-links">
                    {c.instagram && <a href={igUrl(c.instagram)} target="_blank" rel="noreferrer"><AtSign size={13} /> {c.instagram.startsWith('@') ? c.instagram : '@' + c.instagram}</a>}
                    {c.website && <a href={webUrl(c.website)} target="_blank" rel="noreferrer"><Globe size={13} /> {c.website.replace(/^https?:\/\//, '').slice(0, 28)}</a>}
                    <span style={{ color: 'var(--text-muted)' }}>· {clientName(c.clientId)}</span>
                  </div>
                </div>
                <div className="cmp-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => runAnalyze(c)} disabled={analyzing === c.id}>
                    {analyzing === c.id ? <Loader size={14} className="lead-spin" /> : <Sparkles size={14} />} {c.analysis ? 'Re-analizar' : 'Analizar con IA'}
                  </button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModal({ ...c })}><Pencil size={14} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setConfirm(c.id)}><Trash2 size={14} /></button>
                </div>
              </div>

              {c.notes && <p className="cmp-notes">{c.notes}</p>}

              {c.analysis && (
                <div className="cmp-analysis">
                  <div className="cmp-pos"><strong>Posicionamiento</strong><p>{c.analysis.posicionamiento}</p></div>
                  <div className="cmp-grid">
                    <AnalysisBlock icon={<TrendingUp size={14} />} title="Fortalezas" items={c.analysis.fortalezas} kind="for" />
                    <AnalysisBlock icon={<TrendingDown size={14} />} title="Debilidades" items={c.analysis.debilidades} kind="deb" />
                    <AnalysisBlock icon={<Target size={14} />} title="Oportunidades / huecos" items={c.analysis.oportunidades} kind="opo" />
                    <AnalysisBlock icon={<Lightbulb size={14} />} title="Cómo diferenciarse" items={c.analysis.recomendaciones} kind="rec" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h2>{modal.id ? 'Editar competidor' : 'Nuevo competidor'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="input-group"><label>Nombre *</label><input className="input" autoFocus value={modal.name} placeholder="Ej: Estudio Rival" onChange={e => setModal({ ...modal, name: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="input-group" style={{ flex: 1 }}><label>Instagram</label><input className="input" value={modal.instagram} placeholder="@cuenta" onChange={e => setModal({ ...modal, instagram: e.target.value })} /></div>
                <div className="input-group" style={{ flex: 1 }}><label>Rubro</label><input className="input" value={modal.rubro} placeholder="Estética, gym…" onChange={e => setModal({ ...modal, rubro: e.target.value })} /></div>
              </div>
              <div className="input-group"><label>Web</label><input className="input" value={modal.website} placeholder="sitio.com" onChange={e => setModal({ ...modal, website: e.target.value })} /></div>
              <div className="input-group"><label>Cliente (opcional)</label>
                <select className="select" value={modal.clientId || ''} onChange={e => setModal({ ...modal, clientId: e.target.value || null })}>
                  <option value="">General (sin cliente)</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="input-group"><label>Observaciones (qué postea, frecuencia, propuesta…)</label>
                <textarea className="input" rows={4} value={modal.notes} placeholder="Ej: postea 3 reels/semana, todo promo, no muestra resultados, atención lenta por DM…" onChange={e => setModal({ ...modal, notes: e.target.value })} /></div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>{modal.id ? 'Guardar' : 'Agregar'}</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h2>¿Borrar competidor?</h2>
            <p className="confirm-text">No se puede deshacer.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => { remove(confirm); setConfirm(null); }}>Borrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisBlock({ icon, title, items, kind }: { icon: React.ReactNode; title: string; items: string[]; kind: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div className={`cmp-block ${kind}`}>
      <div className="cmp-block-title">{icon} {title}</div>
      <ul>{items.map((it, k) => <li key={k}>{it}</li>)}</ul>
    </div>
  );
}
