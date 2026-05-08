import { useState, type DragEvent } from 'react';
import { Plus, Trash2, Pencil, Calendar, GripVertical, LayoutGrid, AlertCircle } from 'lucide-react';
import { useTasks, toast } from './hooks';
import { PRIORITIES, PRIORITY_LABELS, fmt, isOverdue, type TaskCard as TCard } from './utils';

const emptyCard = (boardId: string, colId: string): Omit<TCard, 'id' | 'createdAt' | 'updatedAt' | 'order'> => ({
  boardId, columnId: colId, title: '', description: '', assignedTo: [],
  priority: 'medium', dueDate: null, tags: [],
});

export default function Tasks() {
  const {
    boards, cards, activeBoardId, setActiveBoardId,
    createBoard, deleteBoard, createCard, updateCard, moveCard, deleteCard,
  } = useTasks();
  const [modal, setModal] = useState(false);
  const [boardModal, setBoardModal] = useState(false);
  const [editing, setEditing] = useState<TCard | null>(null);
  const [form, setForm] = useState<Omit<TCard, 'id' | 'createdAt' | 'updatedAt' | 'order'>>(emptyCard('', ''));
  const [boardName, setBoardName] = useState('');
  const [personInput, setPersonInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const activeBoard = boards.find(b => b.id === activeBoardId);

  const openNew = (colId: string) => {
    if (!activeBoardId) return;
    setForm(emptyCard(activeBoardId, colId));
    setEditing(null); setPersonInput(''); setTagInput('');
    setModal(true);
  };

  const openEdit = (card: TCard) => {
    setForm(card); setEditing(card); setPersonInput(''); setTagInput('');
    setModal(true);
  };

  const close = () => { setModal(false); setEditing(null); };

  const save = () => {
    if (!form.title.trim()) { toast('El título es obligatorio', 'error'); return; }
    if (editing) updateCard(editing.id, form);
    else createCard(form);
    close();
  };

  const addPerson = () => {
    if (!personInput.trim()) return;
    setForm(f => ({ ...f, assignedTo: [...f.assignedTo, personInput.trim()] }));
    setPersonInput('');
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    setForm(f => ({ ...f, tags: [...f.tags, tagInput.trim()] }));
    setTagInput('');
  };

  // Drag & Drop
  const onDragStart = (e: DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e: DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colId);
  };
  const onDragLeave = () => setDragOverCol(null);
  const onDrop = (e: DragEvent, colId: string) => {
    e.preventDefault();
    if (draggedId) moveCard(draggedId, colId);
    setDraggedId(null);
    setDragOverCol(null);
  };

  const saveBoardName = () => {
    if (!boardName.trim()) { toast('Nombre obligatorio', 'error'); return; }
    createBoard(boardName.trim());
    setBoardName('');
    setBoardModal(false);
  };

  return (
    <div>
      {/* Board selector */}
      <div className="board-selector">
        {boards.map(b => (
          <button key={b.id} className={`board-tab ${activeBoardId === b.id ? 'active' : ''}`} onClick={() => setActiveBoardId(b.id)}>
            {b.name}
          </button>
        ))}
        <button className="btn btn-secondary btn-sm" onClick={() => setBoardModal(true)}>
          <Plus size={14} /> Nuevo Tablero
        </button>
        {activeBoard && (
          <button className="btn btn-danger btn-sm" onClick={() => setConfirm(activeBoard.id)}>
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Kanban */}
      {!activeBoard ? (
        <div className="empty-state">
          <LayoutGrid size={48} />
          <h3>No hay tableros</h3>
          <p>Creá tu primer tablero para empezar a gestionar tareas.</p>
          <button className="btn btn-primary" onClick={() => setBoardModal(true)}><Plus size={16} /> Crear Tablero</button>
        </div>
      ) : (
        <div className="kanban">
          {activeBoard.columns.sort((a, b) => a.order - b.order).map(col => {
            const colCards = cards.filter(c => c.columnId === col.id).sort((a, b) => a.order - b.order);
            return (
              <div
                key={col.id}
                className={`kanban-col ${dragOverCol === col.id ? 'drag-over' : ''}`}
                onDragOver={e => onDragOver(e, col.id)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, col.id)}
              >
                <div className="col-header">
                  <h3>{col.name} <span className="col-count">{colCards.length}</span></h3>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openNew(col.id)}>
                    <Plus size={16} />
                  </button>
                </div>
                <div className="col-cards">
                  {colCards.map(card => (
                    <div
                      key={card.id}
                      className={`task-card ${draggedId === card.id ? 'dragging' : ''}`}
                      draggable
                      onDragStart={e => onDragStart(e, card.id)}
                    >
                      <div className="card-title">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <GripVertical size={14} style={{ color: 'var(--text-muted)', cursor: 'grab' }} />
                          {card.title}
                        </span>
                        <span className={`badge badge-${card.priority}`}>{PRIORITY_LABELS[card.priority]}</span>
                      </div>
                      {card.description && (
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 4px 0', lineHeight: 1.4 }}>
                          {card.description.slice(0, 80)}{card.description.length > 80 ? '...' : ''}
                        </p>
                      )}
                      {card.tags.length > 0 && (
                        <div className="tags">
                          {card.tags.map((t, i) => <span key={i} className="tag">{t}</span>)}
                        </div>
                      )}
                      <div className="card-meta">
                        {card.dueDate && (
                          <>
                            <Calendar size={12} />
                            <span>{fmt(card.dueDate)}</span>
                            {isOverdue(card.dueDate) && col.name !== 'Completado' && (
                              <span className="overdue"><AlertCircle size={12} /> Atrasada</span>
                            )}
                          </>
                        )}
                      </div>
                      <div className="card-bottom">
                        <div className="avatar-stack">
                          {card.assignedTo.map((p, i) => (
                            <div key={i} className="avatar" title={p}>{p.charAt(0).toUpperCase()}</div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(card)}><Pencil size={13} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => deleteCard(card.id)}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="col-footer">
                  <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => openNew(col.id)}>
                    <Plus size={14} /> Agregar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Modal */}
      {modal && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Editar Tarea' : 'Nueva Tarea'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="input-group">
                <label>Título *</label>
                <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="¿Qué hay que hacer?" />
              </div>
              <div className="input-group">
                <label>Descripción</label>
                <textarea className="textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalles..." />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Prioridad</label>
                  <select className="select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TCard['priority'] }))}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                  </select>
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Fecha límite</label>
                  <input className="input" type="date" value={form.dueDate ? new Date(form.dueDate).toISOString().split('T')[0] : ''} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value ? new Date(e.target.value).getTime() : null }))} />
                </div>
              </div>
              <div className="input-group">
                <label>Tags</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Tag..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} />
                  <button className="btn btn-secondary" onClick={addTag}>+</button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {form.tags.map((t, i) => (
                    <span key={i} className="tag">{t} <button className="tag-remove" onClick={() => setForm(f => ({ ...f, tags: f.tags.filter((_, j) => j !== i) }))}>×</button></span>
                  ))}
                </div>
              </div>
              <div className="input-group">
                <label>Asignar a</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" value={personInput} onChange={e => setPersonInput(e.target.value)} placeholder="Nombre..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPerson())} />
                  <button className="btn btn-secondary" onClick={addPerson}>+</button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {form.assignedTo.map((p, i) => (
                    <span key={i} className="tag">{p} <button className="tag-remove" onClick={() => setForm(f => ({ ...f, assignedTo: f.assignedTo.filter((_, j) => j !== i) }))}>×</button></span>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>{editing ? 'Guardar' : 'Crear Tarea'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Board Modal */}
      {boardModal && (
        <div className="modal-overlay" onClick={() => setBoardModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2>Nuevo Tablero</h2>
            <div className="input-group">
              <label>Nombre</label>
              <input className="input" value={boardName} onChange={e => setBoardName(e.target.value)} placeholder="Ej: Proyecto X" onKeyDown={e => e.key === 'Enter' && saveBoardName()} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Se crearán 4 columnas: Por Hacer, En Proceso, Revisión, Completado</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setBoardModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveBoardName}>Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Board */}
      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2>¿Eliminar tablero?</h2>
            <p className="confirm-text">Se eliminarán todas las tareas del tablero. Esta acción no se puede deshacer.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => { deleteBoard(confirm); setConfirm(null); }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
