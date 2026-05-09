import { useState, useMemo } from 'react';
import {
  Plus, Search, X, Pencil, Trash2, Users, Mail, Phone, AtSign,
  FolderPlus, MessageSquarePlus, ChevronRight
} from 'lucide-react';
import { useClients, toast } from './hooks';
import {
  uuid, fmt, fmtMoney, fmtUSD,
  CLIENT_STATUSES, CLIENT_STATUS_LABELS, CLIENT_STATUS_COLORS,
  PROJECT_STATUSES, PROJECT_STATUS_LABELS,
  type Client, type ClientProject, type ClientNote
} from './utils';

const emptyClient: Omit<Client, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '', contact: { email: '', whatsapp: '', instagram: '' },
  status: 'prospect', projects: [], notes: [], totalRevenue: 0, totalRevenueUSD: 0,
};

const emptyProject: ClientProject = {
  id: '', name: '', description: '', status: 'pending', value: 0, currency: 'ARS',
  startDate: Date.now(), endDate: null, links: '',
};

export default function Clients() {
  const { clients, create, update, remove } = useClients();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyClient);
  const [detail, setDetail] = useState<Client | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  // Project sub-modal
  const [projModal, setProjModal] = useState(false);
  const [projForm, setProjForm] = useState(emptyProject);
  const [editingProj, setEditingProj] = useState<string | null>(null);
  // Note input
  const [noteInput, setNoteInput] = useState('');

  const filtered = useMemo(() => {
    let list = clients;
    if (search) list = list.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    if (filterStatus) list = list.filter(c => c.status === filterStatus);
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [clients, search, filterStatus]);

  const [formProj, setFormProj] = useState(emptyProject);
  const [addProj, setAddProj] = useState(false);

  const openNew = () => { 
    setForm(emptyClient); 
    setFormProj({ ...emptyProject, id: uuid() });
    setAddProj(true);
    setEditing(null); 
    setModal(true); 
  };
  const openEdit = (c: Client) => { setForm(c); setEditing(c); setModal(true); };
  const close = () => { setModal(false); setEditing(null); };

  const save = () => {
    if (!form.name.trim()) { toast('El nombre es obligatorio', 'error'); return; }
    
    // Si estamos creando un cliente nuevo y el usuario habilitó "Agregar Servicio Inicial" y le puso un nombre
    const isAddingProj = !editing && addProj && formProj.name.trim();
    const finalProjects = isAddingProj ? [formProj] : form.projects;
    
    const revenue = finalProjects.length > 0 
      ? finalProjects.filter(p => p.status !== 'cancelled' && p.currency === 'ARS').reduce((s, p) => s + p.value, 0) 
      : form.totalRevenue;
    const revenueUSD = finalProjects.length > 0 
      ? finalProjects.filter(p => p.status !== 'cancelled' && p.currency === 'USD').reduce((s, p) => s + p.value, 0) 
      : form.totalRevenueUSD;
      
    if (editing) {
      update(editing.id, { ...form, totalRevenue: revenue, totalRevenueUSD: revenueUSD });
    } else {
      create({ ...form, totalRevenue: revenue, totalRevenueUSD: revenueUSD, projects: isAddingProj ? [formProj] : [] });
    }
    
    close();
    if (detail && editing) {
      const refreshed = { ...detail, ...form, totalRevenue: revenue, totalRevenueUSD: revenueUSD, updatedAt: Date.now() };
      setDetail(refreshed);
    }
  };

  const openDetail = (c: Client) => setDetail(c);
  const closeDetail = () => setDetail(null);

  // Add note
  const addNote = () => {
    if (!noteInput.trim() || !detail) return;
    const note: ClientNote = { id: uuid(), content: noteInput.trim(), createdAt: Date.now() };
    const updated = { ...detail, notes: [note, ...detail.notes] };
    update(detail.id, { notes: updated.notes });
    setDetail(updated);
    setNoteInput('');
  };

  // Project CRUD
  const openProjNew = () => { setProjForm({ ...emptyProject, id: uuid() }); setEditingProj(null); setProjModal(true); };
  const openProjEdit = (p: ClientProject) => { setProjForm(p); setEditingProj(p.id); setProjModal(true); };
  const saveProj = () => {
    if (!projForm.name.trim() || !detail) { toast('Nombre del proyecto obligatorio', 'error'); return; }
    let projs: ClientProject[];
    if (editingProj) {
      projs = detail.projects.map(p => p.id === editingProj ? projForm : p);
    } else {
      projs = [...detail.projects, projForm];
    }
    const revenue = projs.filter(p => p.status !== 'cancelled' && p.currency === 'ARS').reduce((s, p) => s + p.value, 0);
    const revenueUSD = projs.filter(p => p.status !== 'cancelled' && p.currency === 'USD').reduce((s, p) => s + p.value, 0);
    update(detail.id, { projects: projs, totalRevenue: revenue, totalRevenueUSD: revenueUSD });
    setDetail({ ...detail, projects: projs, totalRevenue: revenue, totalRevenueUSD: revenueUSD });
    setProjModal(false);
  };
  const deleteProj = (pid: string) => {
    if (!detail) return;
    const projs = detail.projects.filter(p => p.id !== pid);
    const revenue = projs.filter(p => p.status !== 'cancelled' && p.currency === 'ARS').reduce((s, p) => s + p.value, 0);
    const revenueUSD = projs.filter(p => p.status !== 'cancelled' && p.currency === 'USD').reduce((s, p) => s + p.value, 0);
    update(detail.id, { projects: projs, totalRevenue: revenue, totalRevenueUSD: revenueUSD });
    setDetail({ ...detail, projects: projs, totalRevenue: revenue, totalRevenueUSD: revenueUSD });
  };

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 120px)' }}>
      {/* Main List */}
      <div style={{ flex: 1, overflow: 'auto', paddingRight: detail ? 20 : 0 }}>
        <div className="toolbar">
          <div className="toolbar-left">
            <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
              <Search size={16} />
              <input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="toolbar-right">
            <div className="filters">
              <button className={`filter-chip ${!filterStatus ? 'active' : ''}`} onClick={() => setFilterStatus('')}>Todos</button>
              {CLIENT_STATUSES.map(s => (
                <button key={s} className={`filter-chip ${filterStatus === s ? 'active' : ''}`}
                  style={filterStatus === s ? { background: CLIENT_STATUS_COLORS[s], borderColor: CLIENT_STATUS_COLORS[s] } : {}}
                  onClick={() => setFilterStatus(s)}>
                  {CLIENT_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Nuevo Cliente</button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <Users size={48} />
            <h3>No hay clientes</h3>
            <p>Agregá tu primer cliente para empezar a gestionar proyectos.</p>
            <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Agregar Cliente</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(c => (
              <div key={c.id} className="card" onClick={() => openDetail(c)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', border: detail?.id === c.id ? '1px solid var(--primary)' : undefined }}>
                {/* Avatar */}
                <div className="avatar" style={{ width: 40, height: 40, fontSize: 16, background: CLIENT_STATUS_COLORS[c.status] }}>
                  {c.name.charAt(0).toUpperCase()}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{c.name}</h3>
                    <span className="badge" style={{ background: `${CLIENT_STATUS_COLORS[c.status]}22`, color: CLIENT_STATUS_COLORS[c.status] }}>
                      {CLIENT_STATUS_LABELS[c.status]}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {(c.totalRevenue > 0 || c.totalRevenueUSD === 0) && (
                      <span style={{ fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: 12 }}>
                        {fmtMoney(c.totalRevenue)}
                      </span>
                    )}
                    {c.totalRevenueUSD > 0 && (
                      <span style={{ fontWeight: 700, color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 8px', borderRadius: 12 }}>
                        {fmtUSD(c.totalRevenueUSD)}
                      </span>
                    )}
                    {c.projects.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {c.projects.map(p => (
                          <span key={p.id} className="tag" style={{ fontSize: 10, padding: '2px 6px', background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                            {p.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Contact icons */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {c.contact.whatsapp && <Phone size={14} style={{ color: '#25D366' }} />}
                  {c.contact.email && <Mail size={14} style={{ color: 'var(--text-muted)' }} />}
                  {c.contact.instagram && <AtSign size={14} style={{ color: '#E1306C' }} />}
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {detail && (
        <div style={{
          width: 420, flexShrink: 0, background: 'var(--bg-card)',
          border: '1px solid var(--border)', borderRadius: 16,
          overflow: 'auto', display: 'flex', flexDirection: 'column',
          animation: 'slideIn 0.2s ease',
        }}>
          {/* Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="avatar" style={{ width: 44, height: 44, fontSize: 18, background: CLIENT_STATUS_COLORS[detail.status] }}>
                {detail.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{detail.name}</h2>
                <span className="badge" style={{ background: `${CLIENT_STATUS_COLORS[detail.status]}22`, color: CLIENT_STATUS_COLORS[detail.status], marginTop: 4 }}>
                  {CLIENT_STATUS_LABELS[detail.status]}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost btn-icon" onClick={() => openEdit(detail)}><Pencil size={16} /></button>
              <button className="btn btn-ghost btn-icon" onClick={() => setConfirm(detail.id)}><Trash2 size={16} /></button>
              <button className="btn btn-ghost btn-icon" onClick={closeDetail}><X size={16} /></button>
            </div>
          </div>

          <div style={{ padding: '20px 24px', flex: 1, overflow: 'auto' }}>
            {/* Contact */}
            <Section title="Contacto">
              {detail.contact.whatsapp && <ContactRow icon={<Phone size={14} color="#25D366" />} value={detail.contact.whatsapp} />}
              {detail.contact.email && <ContactRow icon={<Mail size={14} color="var(--info)" />} value={detail.contact.email} />}
              {detail.contact.instagram && <ContactRow icon={<AtSign size={14} color="#E1306C" />} value={detail.contact.instagram} />}
              {!detail.contact.whatsapp && !detail.contact.email && !detail.contact.instagram && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin datos de contacto</p>
              )}
            </Section>

            {/* Revenue */}
            <Section title="Facturación">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}>{fmtMoney(detail.totalRevenue)}</div>
                {detail.totalRevenueUSD > 0 && (
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6' }}>{fmtUSD(detail.totalRevenueUSD)}</div>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>desde {fmt(detail.createdAt)}</div>
            </Section>

            {/* Projects / Services */}
            <Section title="Servicios Vendidos" action={<button className="btn btn-ghost btn-sm" onClick={openProjNew}><FolderPlus size={14} /> Agregar</button>}>
              {detail.projects.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin servicios o proyectos</p>
              ) : detail.projects.map(p => (
                <div key={p.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                    {p.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.description}</div>}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="badge" style={{ fontSize: 10 }}>{PROJECT_STATUS_LABELS[p.status]}</span>
                      <span style={{ fontWeight: 600, color: p.currency === 'USD' ? '#3b82f6' : '#10b981' }}>{p.currency === 'USD' ? fmtUSD(p.value) : fmtMoney(p.value)}</span>
                      {p.endDate && <span style={{ background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: 4 }}>Entrega: {fmt(p.endDate)}</span>}
                    </div>
                    {p.links && (
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--primary)', wordBreak: 'break-all' }}>
                        <a href={p.links.startsWith('http') ? p.links : `https://${p.links}`} target="_blank" rel="noopener noreferrer">{p.links}</a>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openProjEdit(p)}><Pencil size={14} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => deleteProj(p.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </Section>

            {/* Notes */}
            <Section title="Notas" action={<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{detail.notes.length}</span>}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input className="input" value={noteInput} onChange={e => setNoteInput(e.target.value)}
                  placeholder="Agregar nota..." onKeyDown={e => e.key === 'Enter' && addNote()} style={{ flex: 1 }} />
                <button className="btn btn-primary btn-sm" onClick={addNote}><MessageSquarePlus size={14} /></button>
              </div>
              {detail.notes.map(n => (
                <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, margin: '0 0 4px 0' }}>{n.content}</p>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(n.createdAt)}</span>
                </div>
              ))}
            </Section>
          </div>
        </div>
      )}

      {/* FAB */}
      <button className="btn-fab" onClick={openNew}><Plus size={24} /></button>

      {/* Client Modal */}
      {modal && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="input-group">
                <label>Nombre / Empresa *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Imperio de la Moda" />
              </div>
              <div className="input-group">
                <label>Estado</label>
                <select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Client['status'] }))}>
                  {CLIENT_STATUSES.map(s => <option key={s} value={s}>{CLIENT_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>WhatsApp</label>
                  <input className="input" value={form.contact.whatsapp} onChange={e => setForm(f => ({ ...f, contact: { ...f.contact, whatsapp: e.target.value } }))} placeholder="+54 11..." />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Email</label>
                  <input className="input" value={form.contact.email} onChange={e => setForm(f => ({ ...f, contact: { ...f.contact, email: e.target.value } }))} placeholder="email@..." />
                </div>
              </div>
              <div className="input-group">
                <label>Instagram</label>
                <input className="input" value={form.contact.instagram} onChange={e => setForm(f => ({ ...f, contact: { ...f.contact, instagram: e.target.value } }))} placeholder="@usuario" />
              </div>
            </div>
            
            {/* Project section inside Client Modal (only when creating) */}
            {!editing && (
              <>
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="addProj" checked={addProj} onChange={e => setAddProj(e.target.checked)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
                  <label htmlFor="addProj" style={{ fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>Añadir Servicio / Proyecto ahora</label>
                </div>
                {addProj && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16, padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <div className="input-group">
                      <label>Servicio Adquirido</label>
                      <select className="select" value={formProj.name} onChange={e => setFormProj(f => ({ ...f, name: e.target.value }))}>
                        <option value="" disabled>Seleccionar servicio...</option>
                        <option value="Landing Page">Landing Page</option>
                        <option value="Página Web">Página Web</option>
                        <option value="Automatización">Automatización</option>
                        <option value="Invitación Digital">Invitación Digital</option>
                        <option value="E-commerce">E-commerce</option>
                        <option value="Diseño UI/UX">Diseño UI/UX</option>
                        <option value="Otro">Otro servicio...</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label>Descripción</label>
                      <input className="input" value={formProj.description} onChange={e => setFormProj(f => ({ ...f, description: e.target.value }))} placeholder="Detalles breves..." />
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div className="input-group" style={{ flex: 1 }}>
                        <label>Estado</label>
                        <select className="select" value={formProj.status} onChange={e => setFormProj(f => ({ ...f, status: e.target.value as ClientProject['status'] }))}>
                          {PROJECT_STATUSES.map(s => <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>)}
                        </select>
                      </div>
                      <div className="input-group" style={{ width: 100 }}>
                        <label>Moneda</label>
                        <select className="select" value={formProj.currency} onChange={e => setFormProj(f => ({ ...f, currency: e.target.value as 'ARS' | 'USD' }))}>
                          <option value="ARS">ARS</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                      <div className="input-group" style={{ flex: 1 }}>
                        <label>Valor</label>
                        <input className="input" type="number" value={formProj.value} onChange={e => setFormProj(f => ({ ...f, value: Number(e.target.value) }))} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div className="input-group" style={{ flex: 1 }}>
                        <label>Fecha de Entrega</label>
                        <input className="input" type="date" value={formProj.endDate ? new Date(formProj.endDate).toISOString().split('T')[0] : ''} onChange={e => setFormProj(f => ({ ...f, endDate: e.target.value ? new Date(e.target.value).getTime() : null }))} />
                      </div>
                    </div>
                    <div className="input-group">
                      <label>Documentos / Links (Opcional)</label>
                      <input className="input" value={formProj.links} onChange={e => setFormProj(f => ({ ...f, links: e.target.value }))} placeholder="https://..." />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="modal-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>{editing ? 'Guardar' : 'Crear Cliente'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Project sub-modal */}
      {projModal && (
        <div className="modal-overlay" onClick={() => setProjModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h2>{editingProj ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="input-group">
                <label>Servicio Vendido *</label>
                <select className="select" value={projForm.name} onChange={e => setProjForm(f => ({ ...f, name: e.target.value }))}>
                  <option value="" disabled>Seleccionar servicio...</option>
                  <option value="Landing Page">Landing Page</option>
                  <option value="Página Web">Página Web</option>
                  <option value="Automatización">Automatización</option>
                  <option value="Invitación Digital">Invitación Digital</option>
                  <option value="E-commerce">E-commerce</option>
                  <option value="Diseño UI/UX">Diseño UI/UX</option>
                  <option value="Otro">Otro servicio...</option>
                </select>
              </div>
              <div className="input-group">
                <label>Descripción</label>
                <textarea className="textarea" value={projForm.description} onChange={e => setProjForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalles..." />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Estado</label>
                  <select className="select" value={projForm.status} onChange={e => setProjForm(f => ({ ...f, status: e.target.value as ClientProject['status'] }))}>
                    {PROJECT_STATUSES.map(s => <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div className="input-group" style={{ width: 100 }}>
                  <label>Moneda</label>
                  <select className="select" value={projForm.currency} onChange={e => setProjForm(f => ({ ...f, currency: e.target.value as 'ARS' | 'USD' }))}>
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Valor</label>
                  <input className="input" type="number" value={projForm.value} onChange={e => setProjForm(f => ({ ...f, value: Number(e.target.value) }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Fecha inicio</label>
                  <input className="input" type="date" value={new Date(projForm.startDate).toISOString().split('T')[0]} onChange={e => setProjForm(f => ({ ...f, startDate: new Date(e.target.value).getTime() }))} />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Fecha de Entrega</label>
                  <input className="input" type="date" value={projForm.endDate ? new Date(projForm.endDate).toISOString().split('T')[0] : ''} onChange={e => setProjForm(f => ({ ...f, endDate: e.target.value ? new Date(e.target.value).getTime() : null }))} />
                </div>
              </div>
              <div className="input-group">
                <label>Documentos / Links (Google Drive, Figma, etc)</label>
                <textarea className="textarea" value={projForm.links} onChange={e => setProjForm(f => ({ ...f, links: e.target.value }))} placeholder="https://..." style={{ minHeight: 60 }} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setProjModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveProj}>{editingProj ? 'Guardar' : 'Agregar Servicio'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2>¿Eliminar cliente?</h2>
            <p className="confirm-text">Se eliminarán todos los proyectos y notas asociados.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => { remove(confirm); setConfirm(null); closeDetail(); }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ───
function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

function ContactRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      {icon}
      <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
