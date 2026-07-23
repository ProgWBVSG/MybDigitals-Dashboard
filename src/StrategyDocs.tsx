import { useState, useRef, useCallback, useEffect } from 'react';
import {
  FileText, Plus, Trash2, ArrowLeft, Heading2, Pilcrow, List as ListIcon,
  Quote as QuoteIcon, Megaphone, Link2 as LinkIcon, Minus, ChevronUp, ChevronDown,
  ExternalLink, X, Users, Layers, LayoutGrid,
} from 'lucide-react';
import { useStrategyDocs, useClients, useSkills } from './hooks';
import { DOC_TEMPLATES, type DocTemplate } from './docTemplates';
import { DOC_CONNECTION_TABS, uuid, fmtRel, type DocBlock, type DocBlockType, type ConnTargetType, type StrategyDoc } from './utils';

const CALLOUT_COLORS = ['#fef3c7', '#dbeafe', '#fce7f3', '#dcfce7', '#ede9fe'];
const BLOCK_LABELS: Record<DocBlockType, { label: string; icon: React.ReactNode }> = {
  heading: { label: 'Título', icon: <Heading2 size={13} /> },
  paragraph: { label: 'Párrafo', icon: <Pilcrow size={13} /> },
  bullets: { label: 'Lista', icon: <ListIcon size={13} /> },
  quote: { label: 'Cita / fuente', icon: <QuoteIcon size={13} /> },
  callout: { label: 'Destacado', icon: <Megaphone size={13} /> },
  connection: { label: 'Conexión', icon: <LinkIcon size={13} /> },
  divider: { label: 'Separador', icon: <Minus size={13} /> },
};

const DOC_TYPE_COLOR: Record<string, string> = { fuente: '#a78bfa', estrategia: '#60a5fa', contenido: '#f472b6', general: '#64748b' };

// Editor de Documentos Estratégicos: a diferencia de la pizarra (canvas libre), esto es
// una secuencia ORDENADA de bloques — para texto largo, citar una fuente externa (ej. una
// estrategia vista en un video) y conectar con partes reales del dashboard.
export default function StrategyDocs({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { docs, create, saveBlocks, update, remove } = useStrategyDocs();
  const { clients } = useClients();
  const { skills } = useSkills();
  const [openId, setOpenId] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const openDoc = docs.find(d => d.id === openId) || null;

  const startFromTemplate = async (t: DocTemplate) => {
    const id = await create(t.label, t.docType, t.build());
    setTemplatesOpen(false);
    if (id) setOpenId(id);
  };

  if (openDoc) {
    return (
      <DocEditor doc={openDoc} clients={clients} skills={skills} onNavigate={onNavigate}
        onBack={() => setOpenId(null)}
        onSaveBlocks={blocks => saveBlocks(openDoc.id, blocks)}
        onRename={title => update(openDoc.id, { title })} />
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={22} />
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Documentos estratégicos</h2>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setTemplatesOpen(true)}><Plus size={15} /> Nuevo documento</button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 18px' }}>
        Texto explicativo, citas de referentes (ej. "esto dijo Kallaway") y conexiones a clientes/skills/secciones del dashboard — como un doc, no un pizarrón.
      </p>

      {docs.length === 0 ? (
        <div className="notif-empty"><FileText size={32} /><p>Todavía no armaste ningún documento. Elegí una plantilla para empezar.</p></div>
      ) : (
        <div className="strat-grid">
          {docs.map(d => (
            <div key={d.id} className="strat-card" onClick={() => setOpenId(d.id)}>
              <div className="strat-card-top">
                <strong>{d.title}</strong>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={e => { e.stopPropagation(); setConfirmDel(d.id); }}><Trash2 size={13} /></button>
              </div>
              <span className="ig-badge soft" style={{ background: `${DOC_TYPE_COLOR[d.docType] || '#64748b'}22`, color: DOC_TYPE_COLOR[d.docType] || '#64748b' }}>{d.docType}</span>
              <div className="strat-card-meta">{d.blocks.length} bloques · actualizado {fmtRel(d.updatedAt)}</div>
            </div>
          ))}
        </div>
      )}

      {templatesOpen && (
        <div className="modal-overlay" onClick={() => setTemplatesOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h2>Nuevo documento</h2>
            <p className="confirm-text" style={{ marginBottom: 4 }}>Arranca con la estructura ya armada, la completás vos.</p>
            <div className="wb-tpl-grid">
              {DOC_TEMPLATES.map(t => (
                <button key={t.key} className="wb-tpl-card" onClick={() => startFromTemplate(t)}>
                  <span className="wb-tpl-emoji">{t.emoji}</span>
                  <strong>{t.label}</strong>
                  <span>{t.description}</span>
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setTemplatesOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {confirmDel && (
        <div className="modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h2>¿Borrar este documento?</h2>
            <p className="confirm-text">No se puede deshacer.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => { remove(confirmDel); setConfirmDel(null); }}>Borrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Editor de un documento ───
function DocEditor({ doc, clients, skills, onNavigate, onBack, onSaveBlocks, onRename }: {
  doc: StrategyDoc; clients: { id: string; name: string }[]; skills: { id: string; name: string }[];
  onNavigate?: (tab: string) => void; onBack: () => void;
  onSaveBlocks: (blocks: DocBlock[]) => void; onRename: (title: string) => void;
}) {
  const [blocks, setBlocks] = useState<DocBlock[]>(doc.blocks);
  const [title, setTitle] = useState(doc.title);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  useEffect(() => { setBlocks(doc.blocks); setTitle(doc.title); }, [doc.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = useCallback((next: DocBlock[]) => {
    setBlocks(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onSaveBlocks(next), 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSaveBlocks]);

  const patchBlock = (id: string, patch: Partial<DocBlock>) => commit(blocks.map(b => b.id === id ? { ...b, ...patch } : b));
  const removeBlock = (id: string) => commit(blocks.filter(b => b.id !== id));
  const moveBlock = (id: string, dir: -1 | 1) => {
    const i = blocks.findIndex(b => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };
  const addBlock = (type: DocBlockType) => {
    const base: DocBlock = { id: uuid(), type };
    if (type === 'heading') { base.level = 2; base.text = ''; }
    if (type === 'paragraph' || type === 'callout') base.text = '';
    if (type === 'bullets') base.items = [''];
    if (type === 'quote') { base.text = ''; base.author = ''; base.sourceUrl = ''; }
    if (type === 'callout') base.color = CALLOUT_COLORS[0];
    if (type === 'connection') { base.connType = 'tab'; base.connTab = 'metrics'; base.connLabel = 'Ir a Métricas'; }
    commit([...blocks, base]);
  };

  const titleBlur = () => { if (title.trim() && title.trim() !== doc.title) onRename(title.trim()); };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="sd-topbar">
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onBack}><ArrowLeft size={16} /></button>
        <input className="sd-title-input" value={title} onChange={e => setTitle(e.target.value)} onBlur={titleBlur}
          onKeyDown={e => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} placeholder="Título del documento" />
        <span className="sd-tag" style={{ background: `${DOC_TYPE_COLOR[doc.docType] || '#64748b'}22`, color: DOC_TYPE_COLOR[doc.docType] || '#64748b' }}>{doc.docType}</span>
      </div>

      <div className="sd-page-wrap">
        <div className="sd-page">
          {blocks.map((b, i) => (
            <BlockView key={b.id} block={b} isFirst={i === 0} isLast={i === blocks.length - 1}
              clients={clients} skills={skills} onNavigate={onNavigate}
              onPatch={patch => patchBlock(b.id, patch)} onRemove={() => removeBlock(b.id)} onMove={dir => moveBlock(b.id, dir)} />
          ))}

          <div className="sd-addbar">
            {(Object.keys(BLOCK_LABELS) as DocBlockType[]).map(t => (
              <button key={t} className="sd-addbtn" onClick={() => addBlock(t)}>{BLOCK_LABELS[t].icon} {BLOCK_LABELS[t].label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BlockView({ block: b, isFirst, isLast, clients, skills, onNavigate, onPatch, onRemove, onMove }: {
  block: DocBlock; isFirst: boolean; isLast: boolean;
  clients: { id: string; name: string }[]; skills: { id: string; name: string }[]; onNavigate?: (tab: string) => void;
  onPatch: (patch: Partial<DocBlock>) => void; onRemove: () => void; onMove: (dir: -1 | 1) => void;
}) {
  const Ctrl = (
    <div className="sd-block-ctrl">
      <button className="sd-block-btn" disabled={isFirst} onClick={() => onMove(-1)} title="Subir"><ChevronUp size={13} /></button>
      <button className="sd-block-btn" disabled={isLast} onClick={() => onMove(1)} title="Bajar"><ChevronDown size={13} /></button>
      <button className="sd-block-btn sd-block-del" onClick={onRemove} title="Borrar"><X size={13} /></button>
    </div>
  );

  if (b.type === 'heading') {
    return <div className="sd-block">{Ctrl}
      <input className={b.level === 3 ? 'sd-h3' : 'sd-h2'} value={b.text || ''} placeholder="Título…" onChange={e => onPatch({ text: e.target.value })} />
    </div>;
  }
  if (b.type === 'paragraph') {
    return <div className="sd-block">{Ctrl}<AutoTextarea className="sd-paragraph" value={b.text || ''} placeholder="Escribí acá…" onChange={v => onPatch({ text: v })} /></div>;
  }
  if (b.type === 'bullets') {
    const items = b.items || [''];
    return (
      <div className="sd-block">{Ctrl}
        <ul className="sd-bullets">
          {items.map((it, i) => (
            <li key={i}>
              <input value={it} placeholder="Punto…" onChange={e => { const n = [...items]; n[i] = e.target.value; onPatch({ items: n }); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onPatch({ items: [...items.slice(0, i + 1), '', ...items.slice(i + 1)] }); } }} />
              <button className="sd-block-btn sd-block-del" style={{ opacity: 0.5 }} onClick={() => onPatch({ items: items.filter((_, j) => j !== i) })}><X size={12} /></button>
            </li>
          ))}
        </ul>
        <button className="sd-bullets-add" onClick={() => onPatch({ items: [...items, ''] })}>+ agregar punto</button>
      </div>
    );
  }
  if (b.type === 'quote') {
    return (
      <div className="sd-block">{Ctrl}
        <div className="sd-quote">
          <AutoTextarea value={b.text || ''} placeholder='"Pegá acá la cita o idea…"' onChange={v => onPatch({ text: v })} />
          <div className="sd-quote-meta">
            <input value={b.author || ''} placeholder="Quién lo dijo (ej. Kallaway)" onChange={e => onPatch({ author: e.target.value })} />
            <input value={b.sourceUrl || ''} placeholder="Link a la fuente (opcional)" onChange={e => onPatch({ sourceUrl: e.target.value })} />
          </div>
          {b.sourceUrl && <a className="sd-quote-link" href={b.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={11} /> Ver fuente</a>}
        </div>
      </div>
    );
  }
  if (b.type === 'callout') {
    return (
      <div className="sd-block">{Ctrl}
        <div className="sd-callout" style={{ background: b.color || CALLOUT_COLORS[0] }}>
          <AutoTextarea value={b.text || ''} placeholder="Idea destacada, próximo paso…" onChange={v => onPatch({ text: v })} />
          <div className="sd-callout-colors">
            {CALLOUT_COLORS.map(c => <button key={c} style={{ background: c }} onClick={() => onPatch({ color: c })} />)}
          </div>
        </div>
      </div>
    );
  }
  if (b.type === 'divider') return <div className="sd-block">{Ctrl}<hr className="sd-divider" /></div>;

  if (b.type === 'connection') {
    const type = b.connType || 'tab';
    const Icon = type === 'client' ? Users : type === 'skill' ? Layers : LayoutGrid;
    const go = () => {
      if (type === 'tab' && b.connTab) onNavigate?.(b.connTab);
      else if (type === 'client') onNavigate?.('clients');
      else if (type === 'skill') onNavigate?.('skills');
    };
    return (
      <div className="sd-block">{Ctrl}
        <div className="sd-conn">
          <span className="sd-conn-ic"><Icon size={15} /></span>
          <select value={type} onChange={e => onPatch({ connType: e.target.value as ConnTargetType, connId: undefined, connTab: e.target.value === 'tab' ? 'metrics' : undefined })}>
            <option value="tab">Sección</option>
            <option value="client">Cliente</option>
            <option value="skill">Skill</option>
          </select>
          {type === 'tab' && (
            <select value={b.connTab || 'metrics'} onChange={e => onPatch({ connTab: e.target.value })}>
              {DOC_CONNECTION_TABS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          )}
          {type === 'client' && (
            <select value={b.connId || ''} onChange={e => onPatch({ connId: e.target.value, connLabel: clients.find(c => c.id === e.target.value)?.name })}>
              <option value="">Elegí un cliente…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {type === 'skill' && (
            <select value={b.connId || ''} onChange={e => onPatch({ connId: e.target.value, connLabel: skills.find(s => s.id === e.target.value)?.name })}>
              <option value="">Elegí una skill…</option>
              {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <input className="sd-conn-label" value={b.connLabel || ''} placeholder="Texto a mostrar" onChange={e => onPatch({ connLabel: e.target.value })} />
          {onNavigate && <button className="sd-conn-go" onClick={go}><ExternalLink size={12} /> Ir</button>}
        </div>
      </div>
    );
  }
  return null;
}

function AutoTextarea({ className, value, placeholder, onChange }: { className?: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (ref.current) { ref.current.style.height = 'auto'; ref.current.style.height = ref.current.scrollHeight + 'px'; } }, [value]);
  return <textarea ref={ref} className={className} value={value} placeholder={placeholder} rows={1} onChange={e => onChange(e.target.value)} />;
}
