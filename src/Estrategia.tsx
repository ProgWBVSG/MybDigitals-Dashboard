import { useState } from 'react';
import { Target, Plus, X, Trash2, Pencil, BookOpen, LayoutDashboard, ArrowRight, FileText } from 'lucide-react';
import { useWhiteboards, useGuide, useClients, toast } from './hooks';
import Whiteboard from './Whiteboard';
import Markdown from './Markdown';
import StrategyDocs from './StrategyDocs';
import { GUIDE_CAT_MAP, type GuideCategory } from './utils';

const STRATEGY_CATS: GuideCategory[] = ['comercial', 'crecimiento'];

export default function Estrategia({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [tab, setTab] = useState<'docs' | 'pizarras' | 'guia'>('docs');
  const wb = useWhiteboards('embudo');
  const { topics } = useGuide();
  const { clients } = useClients();
  const [openBoard, setOpenBoard] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const board = wb.boards.find(b => b.id === openBoard);
  const crear = async () => {
    const title = window.prompt('Nombre del embudo (ej: "Embudo Instagram → Reunión")', 'Nuevo embudo');
    if (!title) return;
    const id = await wb.create(title, 'embudo');
    if (id) setOpenBoard(id);
  };
  const guiaTopics = topics.filter(t => STRATEGY_CATS.includes(t.category)).sort((a, b) => a.order - b.order);

  if (board) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setOpenBoard(null)}><X size={16} /></button>
          {renaming === board.id ? (
            <input className="input" style={{ maxWidth: 320 }} autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onBlur={() => { if (newTitle.trim()) wb.rename(board.id, newTitle.trim()); setRenaming(null); }}
              onKeyDown={e => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
          ) : (
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, cursor: 'pointer' }} onClick={() => { setRenaming(board.id); setNewTitle(board.title); }}>
              {board.title} <Pencil size={12} style={{ opacity: 0.5 }} />
            </h2>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Whiteboard data={board.data} onSave={d => wb.saveData(board.id, d)} automation boardId={board.id} clients={clients.map(c => ({ id: c.id, name: c.name }))} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Target size={22} />
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Estrategia</h2>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>
        Documentos estratégicos, embudos visuales (estilo Miro) y la guía para conseguir clientes por internet y hacerles seguimiento.
      </p>

      <div className="ig-tabs" style={{ marginBottom: 18 }}>
        <button className={tab === 'docs' ? 'active' : ''} onClick={() => setTab('docs')}><FileText size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />Documentos</button>
        <button className={tab === 'pizarras' ? 'active' : ''} onClick={() => setTab('pizarras')}><LayoutDashboard size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />Pizarras de embudos</button>
        <button className={tab === 'guia' ? 'active' : ''} onClick={() => setTab('guia')}><BookOpen size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />Guía de captación</button>
      </div>

      {tab === 'docs' && <StrategyDocs onNavigate={onNavigate} />}

      {tab === 'pizarras' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={crear}><Plus size={14} /> Nuevo embudo</button>
          </div>
          {wb.boards.length === 0 ? (
            <div className="notif-empty"><Target size={32} /><p>Armá tu primer embudo: cajas por etapa (Atracción → Contacto → Reunión → Propuesta → Cierre) conectadas con flechas.</p></div>
          ) : (
            <div className="strat-grid">
              {wb.boards.map(b => (
                <div key={b.id} className="strat-card" onClick={() => setOpenBoard(b.id)}>
                  <div className="strat-card-top">
                    <strong>{b.title}</strong>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={e => { e.stopPropagation(); setConfirm(b.id); }}><Trash2 size={13} /></button>
                  </div>
                  <div className="strat-card-meta">{b.data.nodes.length} elementos · {b.data.edges.length} conexiones</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'guia' && (
        <div className="strat-guide">
          {guiaTopics.map(t => {
            const cat = GUIDE_CAT_MAP[t.category];
            const open = expanded === t.id;
            return (
              <div key={t.id} className="strat-guide-item">
                <button className="strat-guide-head" onClick={() => setExpanded(open ? null : t.id)}>
                  <span className="strat-guide-emoji">{t.emoji}</span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div className="strat-guide-title">{t.title}</div>
                    <div className="strat-guide-sum">{t.summary}</div>
                  </div>
                  <span className="ig-badge soft" style={{ background: `${cat.color}22`, color: cat.color }}>{cat.label}</span>
                </button>
                {open && <div className="strat-guide-body"><Markdown text={t.content} /></div>}
              </div>
            );
          })}
          {onNavigate && (
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => onNavigate('guide')}>
              Ver toda la Guía (editar / más temas) <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}

      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h2>¿Borrar este embudo?</h2>
            <p className="confirm-text">No se puede deshacer.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => { wb.remove(confirm); setConfirm(null); toast('Embudo borrado'); }}>Borrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
