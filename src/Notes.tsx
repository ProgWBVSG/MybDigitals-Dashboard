import { useState, useMemo } from 'react';
import { Lightbulb, Plus, Search, Pin, Trash2, CalendarClock, LayoutDashboard, X, Palette } from 'lucide-react';
import { useNotes, useWhiteboards, toast } from './hooks';
import Whiteboard from './Whiteboard';
import { REPEAT_LABELS, fmt, fmtRel, type Note, type RepeatRule } from './utils';

type Form = { id?: string; title: string; content: string; tags: string; followUpAt: number | null; repeatRule: RepeatRule; pinned: boolean };
const empty = (): Form => ({ title: '', content: '', tags: '', followUpAt: null, repeatRule: 'none', pinned: false });

export default function Notes() {
  const { notes, add, update, remove } = useNotes();
  const wb = useWhiteboards('idea');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<Form | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [openBoard, setOpenBoard] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(n => `${n.title} ${n.content} ${n.tags}`.toLowerCase().includes(q));
  }, [notes, search]);

  const save = async () => {
    if (!modal || !modal.title.trim()) return;
    const payload = { title: modal.title.trim(), content: modal.content, tags: modal.tags, followUpAt: modal.followUpAt, repeatRule: modal.repeatRule, pinned: modal.pinned, boardId: null };
    if (modal.id) await update(modal.id, payload); else await add(payload);
    setModal(null);
  };

  const newBoardFor = async (note: Note) => {
    const id = await wb.create(`Pizarra — ${note.title}`, 'idea', null, note.id);
    if (id) { await update(note.id, { boardId: id }); setOpenBoard(id); }
  };

  const board = wb.boards.find(b => b.id === openBoard);

  if (board) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setOpenBoard(null)}><X size={16} /></button>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{board.title}</h2>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}><Whiteboard data={board.data} onSave={d => wb.saveData(board.id, d)} /></div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Lightbulb size={22} />
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Ideas</h2>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(empty())}><Plus size={15} /> Nueva idea</button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>
        Bloc de notas para ideas sueltas. Ponele fecha de seguimiento y aparece en el Calendario. Cada idea puede tener su propia pizarra para dibujar/organizar visualmente.
      </p>

      <div className="search-bar" style={{ maxWidth: 360, marginBottom: 16 }}>
        <Search size={16} /><input placeholder="Buscar ideas…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="notif-empty"><Lightbulb size={32} /><p>Todavía no anotaste ninguna idea. Tocá "Nueva idea" para empezar.</p></div>
      ) : (
        <div className="note-grid">
          {filtered.map(n => (
            <div key={n.id} className={`note-card ${n.pinned ? 'pinned' : ''}`} onClick={() => setModal({ id: n.id, title: n.title, content: n.content, tags: n.tags, followUpAt: n.followUpAt, repeatRule: n.repeatRule, pinned: n.pinned })}>
              <div className="note-head">
                <strong>{n.title}</strong>
                {n.pinned && <Pin size={13} className="note-pin" />}
              </div>
              {n.content && <p className="note-content">{n.content}</p>}
              {n.tags && <div className="note-tags">{n.tags.split(',').map((t, i) => t.trim() && <span key={i}>{t.trim()}</span>)}</div>}
              <div className="note-foot">
                {n.followUpAt
                  ? <span className="note-followup"><CalendarClock size={12} /> {fmt(n.followUpAt)} · {fmtRel(n.followUpAt)}{n.repeatRule !== 'none' ? ` · ${REPEAT_LABELS[n.repeatRule]}` : ''}</span>
                  : <span />}
                <button className="btn btn-ghost btn-icon btn-sm" title="Pizarra" onClick={e => { e.stopPropagation(); if (n.boardId) setOpenBoard(n.boardId); else newBoardFor(n); }}>
                  <LayoutDashboard size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h2>{modal.id ? 'Editar idea' : 'Nueva idea'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="input-group"><label>Título *</label><input className="input" autoFocus value={modal.title} placeholder="Ej: Automatizar el seguimiento de leads fríos" onChange={e => setModal({ ...modal, title: e.target.value })} /></div>
              <div className="input-group"><label>Notas</label><textarea className="input" rows={4} value={modal.content} placeholder="Desarrollá la idea…" onChange={e => setModal({ ...modal, content: e.target.value })} /></div>
              <div className="input-group"><label>Tags (separados por coma)</label><input className="input" value={modal.tags} placeholder="Automatización, Marketing…" onChange={e => setModal({ ...modal, tags: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Seguimiento (se ve en el Calendario)</label>
                  <input className="input" type="datetime-local" value={modal.followUpAt ? new Date(modal.followUpAt - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                    onChange={e => setModal({ ...modal, followUpAt: e.target.value ? new Date(e.target.value).getTime() : null })} />
                </div>
                {modal.followUpAt && (
                  <div className="input-group" style={{ width: 160 }}>
                    <label>Repetir</label>
                    <select className="select" value={modal.repeatRule} onChange={e => setModal({ ...modal, repeatRule: e.target.value as RepeatRule })}>
                      {(['none', 'daily', 'weekly', 'monthly'] as RepeatRule[]).map(r => <option key={r} value={r}>{REPEAT_LABELS[r]}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <label className="notif-toggle"><input type="checkbox" checked={modal.pinned} onChange={e => setModal({ ...modal, pinned: e.target.checked })} /> Fijar arriba</label>
              {modal.id && (
                <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => { const n = notes.find(x => x.id === modal.id)!; setModal(null); if (n.boardId) setOpenBoard(n.boardId); else newBoardFor(n); }}>
                  <Palette size={14} /> {notes.find(x => x.id === modal.id)?.boardId ? 'Abrir pizarra' : 'Crear pizarra para esta idea'}
                </button>
              )}
            </div>
            <div className="modal-actions">
              {modal.id && <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => setConfirm(modal.id!)}><Trash2 size={14} /></button>}
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>{modal.id ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h2>¿Borrar idea?</h2>
            <p className="confirm-text">También se borra su recordatorio del calendario si tenía.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => { remove(confirm); setConfirm(null); setModal(null); toast('Idea borrada'); }}>Borrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
