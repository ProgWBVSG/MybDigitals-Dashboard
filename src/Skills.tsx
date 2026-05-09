import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, Layers, FolderPlus, Video, Link as LinkIcon } from 'lucide-react';
import { useSkills, toast } from './hooks';
import { CATEGORIES, LEVELS, COLORS, type Skill } from './utils';

const empty: Omit<Skill, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '', category: 'Frontend', level: 3, description: '',
  assignedTo: [], color: '#6366f1', links: ''
};

export default function Skills() {
  const { skills, create, update, remove } = useSkills();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [form, setForm] = useState(empty);
  const [personInput, setPersonInput] = useState('');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);

  const groupedSkills = useMemo(() => {
    let list = skills;
    if (search) list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    if (filterCat) list = list.filter(s => s.category === filterCat);
    
    return CATEGORIES.reduce((acc, cat) => {
      const catSkills = list.filter(s => s.category === cat);
      if (catSkills.length > 0) acc[cat] = catSkills;
      return acc;
    }, {} as Record<string, Skill[]>);
  }, [skills, search, filterCat]);
  
  const hasResults = Object.keys(groupedSkills).length > 0;

  const openNew = () => { setForm(empty); setEditing(null); setPersonInput(''); setModal(true); };
  const openEdit = (s: Skill) => { setForm(s); setEditing(s); setPersonInput(''); setModal(true); };
  const close = () => { setModal(false); setEditing(null); };

  const save = () => {
    if (!form.name.trim()) { toast('El nombre es obligatorio', 'error'); return; }
    if (editing) update(editing.id, form);
    else create(form);
    close();
  };

  const addPerson = () => {
    if (!personInput.trim()) return;
    setForm(f => ({ ...f, assignedTo: [...f.assignedTo, personInput.trim()] }));
    setPersonInput('');
  };

  const removePerson = (idx: number) => {
    setForm(f => ({ ...f, assignedTo: f.assignedTo.filter((_, i) => i !== idx) }));
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
            <Search size={16} />
            <input placeholder="Buscar skill..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="toolbar-right">
          <div className="filters">
            <button className={`filter-chip ${!filterCat ? 'active' : ''}`} onClick={() => setFilterCat('')}>Todas</button>
            {CATEGORIES.map(c => (
              <button key={c} className={`filter-chip ${filterCat === c ? 'active' : ''}`} onClick={() => setFilterCat(c)}>{c}</button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Nueva Skill</button>
        </div>
      </div>

      {/* Grid */}
      {!hasResults ? (
        <div className="empty-state">
          <Layers size={48} />
          <h3>No hay skills</h3>
          <p>Creá tu primera skill o cargá datos de ejemplo.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {Object.entries(groupedSkills).map(([cat, sks]) => (
            <div key={cat}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <FolderPlus size={20} style={{ color: 'var(--primary)' }} />
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{cat}</h2>
                <span className="badge" style={{ marginLeft: 'auto' }}>{sks.length} items</span>
              </div>
              <div className="skills-grid">
                {sks.map(s => (
                  <div key={s.id} className="card skill-card">
                    <div className="card-header">
                      <h3 style={{ color: s.color }}>{s.name}</h3>
                      <span className="badge" style={{ background: `${s.color}22`, color: s.color }}>{s.category}</span>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nivel: {LEVELS[s.level - 1]}</span>
                      <div className="level-bar" style={{ marginTop: 6 }}>
                        {[1, 2, 3, 4, 5].map(n => (
                          <div key={n} className={`dot ${n <= s.level ? 'active' : ''}`} style={n <= s.level ? { background: s.color } : {}} />
                        ))}
                      </div>
                    </div>
                    {s.description && <p className="description">{s.description}</p>}
                    
                    {s.links && (
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {s.links.split(',').map((link, i) => {
                          const url = link.trim();
                          if (!url) return null;
                          const isVideo = url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com');
                          return (
                            <a key={i} href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--primary)', textDecoration: 'none', background: 'rgba(59, 130, 246, 0.1)', padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                              {isVideo ? <Video size={12} /> : <LinkIcon size={12} />}
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {isVideo ? 'Ver Video Tutorial' : 'Abrir Recurso / Archivo'}
                              </span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                    
                    <div className="assigned" style={{ marginTop: 12 }}>
                      {s.assignedTo.map((p, i) => <span key={i} className="tag">{p}</span>)}
                    </div>
                    <div className="card-footer">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}><Pencil size={14} /> Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setConfirm(s.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button className="btn-fab" onClick={openNew}><Plus size={24} /></button>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Editar Skill' : 'Nueva Skill'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="input-group">
                <label>Nombre *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: React, Python, SEO..." />
              </div>
              <div className="input-group">
                <label>Categoría</label>
                <select className="select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Nivel: {LEVELS[form.level - 1]}</label>
                <div className="slider-container">
                  <input type="range" className="slider-input" min={1} max={5} value={form.level} onChange={e => setForm(f => ({ ...f, level: Number(e.target.value) }))} />
                  <div className="slider-labels">
                    {LEVELS.map(l => <span key={l}>{l}</span>)}
                  </div>
                </div>
              </div>
              <div className="input-group">
                <label>Descripción</label>
                <textarea className="textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describí la habilidad..." />
              </div>
              <div className="input-group">
                <label>Recursos (Links a Videos, Archivos, Drive, separados por coma)</label>
                <textarea className="textarea" value={form.links || ''} onChange={e => setForm(f => ({ ...f, links: e.target.value }))} placeholder="https://youtube.com/..., https://drive.google.com/..." />
              </div>
              <div className="input-group">
                <label>Asignar a</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" value={personInput} onChange={e => setPersonInput(e.target.value)} placeholder="Nombre..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPerson())} />
                  <button className="btn btn-secondary" onClick={addPerson}>Agregar</button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {form.assignedTo.map((p, i) => (
                    <span key={i} className="tag">{p} <button className="tag-remove" onClick={() => removePerson(i)}>×</button></span>
                  ))}
                </div>
              </div>
              <div className="input-group">
                <label>Color</label>
                <div className="color-picker">
                  {COLORS.map(c => (
                    <div key={c} className={`color-dot ${form.color === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => setForm(f => ({ ...f, color: c }))} />
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>{editing ? 'Guardar cambios' : 'Crear Skill'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2>¿Eliminar skill?</h2>
            <p className="confirm-text">Esta acción no se puede deshacer.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => { remove(confirm); setConfirm(null); }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
