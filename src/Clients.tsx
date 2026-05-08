import { useState, useMemo } from 'react';
import {
  Plus, Search, X, Pencil, Trash2, Users, Mail, Phone, AtSign,
  FolderPlus, MessageSquarePlus, ChevronRight
} from 'lucide-react';
import { useClients, toast } from './hooks';
import {
  uuid, fmt, fmtMoney,
  CLIENT_STATUSES, CLIENT_STATUS_LABELS, CLIENT_STATUS_COLORS,
  PROJECT_STATUSES, PROJECT_STATUS_LABELS,
  type Client, type ClientProject, type ClientNote
} from './utils';

const emptyClient: Omit<Client, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '', contact: { email: '', whatsapp: '', instagram: '' },
  status: 'prospect', projects: [], notes: [], totalRevenue: 0,
};

const emptyProject: ClientProject = {
  id: '', name: '', description: '', status: 'pending', value: 0,
  startDate: Date.now(), endDate: null,
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

  const openNew = () => { setForm(emptyClient); setEditing(null); setModal(true); };
  const openEdit = (c: Client) => { setForm(c); setEditing(c); setModal(true); };
  const close = () => { setModal(false); setEditing(null); };

  const save = () => {
    if (!form.name.trim()) { toast('El nombre es obligatorio', 'error'); return; }
    const revenue = form.projects.filter(p => p.status !== 'cancelled').reduce((s, p) => s + p.value, 0);
    if (editing) update(editing.id, { ...form, totalRevenue: revenue });
    else create({ ...form, totalRevenue: revenue });
    close();
    // Refresh detail if open
    if (detail && editing) {
      const refreshed = { ...detail, ...form, totalRevenue: revenue, updatedAt: Date.now() };
      setDetail(refreshed);
    }
  };

  // Detail panel
  const openDetail = (c: Client) => setDetail(c);
  const closeDetail = () => setDetail(null);
  const refreshDetail = (id: string) => {
    const fresh = clients.find(c => c.id === id);
    if (fresh) setDetail(fresh);
  };

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
    const revenue = projs.filter(p => p.status !== 'cancelled').reduce((s, p) => s + p.value, 0);
    update(detail.id, { projects: projs, totalRevenue: revenue });
    setDetail({ ...detail, projects: projs, totalRevenue: revenue });
    setProjModal(false);
  };
  const deleteProj = (pid: string) => {
    if (!detail) return;
    const projs = detail.projects.filter(p => p.id !== pid);
    const revenue = projs.filter(p => p.status !== 'cancelled').reduce((s, p) => s + p.value, 0);
    update(detail.id, { projects: projs, totalRevenue: revenue });
    setDetail({ ...detail, projects: projs, totalRevenue: revenue });
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
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    {c.projects.length} proyecto{c.projects.length !== 1 ? 's' : ''} · {fmtMoney(c.totalRevenue)}
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
              <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}>{fmtMoney(detail.totalRevenue)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>desde {fmt(detail.createdAt)}</div>
            </Section>

            {/* Projects */}
            <Section title="Proyectos" action={<button className="btn btn-ghost btn-sm" onClick={openProjNew}><FolderPlus size={14} /> Agregar</button>}>
              {detail.projects.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin proyectos</p>
              ) : detail.projects.map(p => (
                <div key={p.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 4 }}>
                      <span className="badge" style={{ fontSize: 10 }}>{PROJECT_STATUS_LABELS[p.status]}</span>
                      <span>{fmtMoney(p.value)}</span>
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openProjEdit(p)}><Pencil size={12} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => deleteProj(p.id)}><Trash2 size={12} /></button>
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
            <div className="modal-actions">
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
                <label>Nombre *</label>
                <input className="input" value={projForm.name} onChange={e => setProjForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: E-commerce, Landing Page..." />
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
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Valor ($)</label>
                  <input className="input" type="number" value={projForm.value} onChange={e => setProjForm(f => ({ ...f, value: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="input-group">
                <label>Fecha inicio</label>
                <input className="input" type="date" value={new Date(projForm.startDate).toISOString().split('T')[0]} onChange={e => setProjForm(f => ({ ...f, startDate: new Date(e.target.value).getTime() }))} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setProjModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveProj}>{editingProj ? 'Guardar' : 'Agregar Proyecto'}</button>
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
