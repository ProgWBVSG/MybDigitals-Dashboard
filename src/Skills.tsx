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

  const allCategories = useMemo(() => {
    const cats = new Set(CATEGORIES);
    skills.forEach(s => cats.add(s.category));
    return Array.from(cats);
  }, [skills]);

  const groupedSkills = useMemo(() => {
    let list = skills.filter(s => s.name !== '__folder__');
    if (search) list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    if (filterCat) list = list.filter(s => s.category === filterCat);
    
    return allCategories.reduce((acc, cat) => {
      const catSkills = list.filter(s => s.category === cat);
      const hasDummy = skills.some(s => s.name === '__folder__' && s.category === cat);
      if (catSkills.length > 0 || hasDummy) acc[cat] = catSkills;
      return acc;
    }, {} as Record<string, Skill[]>);
  }, [skills, search, filterCat, allCategories]);
  
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

  const createFolder = () => {
    const name = window.prompt('Nombre de la nueva carpeta:');
    if (name && name.trim()) {
      create({
        name: '__folder__',
        category: name.trim(),
        level: 1,
        description: '',
        assignedTo: [],
        color: '#6366f1',
        links: ''
      });
      toast('Carpeta creada');
    }
  };

  const deleteFolder = (cat: string) => {
    const dummy = skills.find(s => s.name === '__folder__' && s.category === cat);
    if (dummy) {
      remove(dummy.id);
      toast('Carpeta eliminada');
    }
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
            {allCategories.map(c => (
              <button key={c} className={`filter-chip ${filterCat === c ? 'active' : ''}`} onClick={() => setFilterCat(c)}>{c}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={createFolder}><FolderPlus size={16} /> Nueva Carpeta</button>
            <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Nueva Skill</button>
          </div>
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
            <div 
              key={cat}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const skillId = e.dataTransfer.getData('skillId');
                if (skillId) {
                  const skillToMove = skills.find(sk => sk.id === skillId);
                  if (skillToMove && skillToMove.category !== cat) {
                    update(skillToMove.id, { category: cat });
                  }
                }
              }}
              style={{ padding: '8px', borderRadius: '12px', background: 'transparent', transition: 'background 0.2s' }}
              onDragEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'; }}
              onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <FolderPlus size={20} style={{ color: 'var(--primary)' }} />
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{cat}</h2>
                <span className="badge" style={{ marginLeft: 'auto' }}>{sks.length} items</span>
                {sks.length === 0 && (
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => deleteFolder(cat)} title="Eliminar carpeta vacía">
                    <Trash2 size={14} style={{ color: 'var(--text-muted)' }} />
                  </button>
                )}
              </div>
              {sks.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 16, padding: '20px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                  Carpeta vacía. Arrastrá skills acá para moverlas.
                </div>
              )}
              <div className="skills-grid">
                {sks.map(s => (
                  <div 
                    key={s.id} 
                    className="card skill-card"
                    draggable
                    onDragStart={e => e.dataTransfer.setData('skillId', s.id)}
                    style={{ cursor: 'grab' }}
                  >
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
                <label>Carpeta / Categoría</label>
                <input className="input" list="cat-list" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Escribí o seleccioná una carpeta..." />
                <datalist id="cat-list">
                  {allCategories.map(c => <option key={c} value={c} />)}
                </datalist>
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
