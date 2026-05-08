import { useState, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight, CalendarDays, List, Pencil, Trash2 } from 'lucide-react';
import { useCalendar, toast } from './hooks';
import { calendarDays, DAYS_ES, MONTHS_ES, EVENT_TYPES, EVENT_LABELS, COLORS, isSameDay, fmt, fmtTime, fmtDTLocal, type CalEvent } from './utils';

type View = 'month' | 'agenda';

const emptyEv: Omit<CalEvent, 'id' | 'createdAt'> = {
  title: '', description: '', startDate: Date.now(), endDate: Date.now() + 3600000,
  type: 'meeting', assignedTo: [], relatedTaskId: null, color: '#3b82f6', allDay: false,
};

export default function CalendarView() {
  const { events, create, update, remove } = useCalendar();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [view, setView] = useState<View>('month');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<CalEvent | null>(null);
  const [form, setForm] = useState(emptyEv);
  const [personInput, setPersonInput] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<Date | null>(null);

  const days = useMemo(() => calendarDays(year, month), [year, month]);
  const today = new Date();

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  const eventsForDay = (d: Date) => events.filter(e => isSameDay(new Date(e.startDate), d));

  const openNew = (date?: Date) => {
    const d = date || new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10, 0).getTime();
    setForm({ ...emptyEv, startDate: start, endDate: start + 3600000 });
    setEditing(null); setPersonInput(''); setModal(true);
  };

  const openEdit = (ev: CalEvent) => {
    setForm(ev); setEditing(ev); setPersonInput(''); setModal(true);
  };

  const close = () => { setModal(false); setEditing(null); };

  const save = () => {
    if (!form.title.trim()) { toast('El título es obligatorio', 'error'); return; }
    if (form.endDate < form.startDate) { toast('La fecha fin no puede ser anterior al inicio', 'error'); return; }
    if (editing) update(editing.id, form);
    else create(form);
    close();
  };

  const addPerson = () => {
    if (!personInput.trim()) return;
    setForm(f => ({ ...f, assignedTo: [...f.assignedTo, personInput.trim()] }));
    setPersonInput('');
  };

  // Agenda view - group events
  const agendaEvents = useMemo(() => {
    const sorted = [...events]
      .filter(e => new Date(e.startDate).getMonth() === month && new Date(e.startDate).getFullYear() === year)
      .sort((a, b) => a.startDate - b.startDate);
    const grouped: { date: Date; events: CalEvent[] }[] = [];
    sorted.forEach(ev => {
      const d = new Date(ev.startDate);
      const existing = grouped.find(g => isSameDay(g.date, d));
      if (existing) existing.events.push(ev);
      else grouped.push({ date: d, events: [ev] });
    });
    return grouped;
  }, [events, month, year]);

  return (
    <div>
      {/* Header */}
      <div className="cal-header">
        <div className="cal-nav">
          <button className="btn btn-ghost btn-icon" onClick={prev}><ChevronLeft size={20} /></button>
          <h2>{MONTHS_ES[month]} {year}</h2>
          <button className="btn btn-ghost btn-icon" onClick={next}><ChevronRight size={20} /></button>
          <button className="btn btn-secondary btn-sm" onClick={goToday}>Hoy</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="cal-views">
            <button className={`btn btn-sm ${view === 'month' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('month')}>
              <CalendarDays size={14} /> Mes
            </button>
            <button className={`btn btn-sm ${view === 'agenda' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('agenda')}>
              <List size={14} /> Agenda
            </button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => openNew()}><Plus size={14} /> Evento</button>
        </div>
      </div>

      {/* Month View */}
      {view === 'month' && (
        <div className="cal-grid">
          {DAYS_ES.map(d => <div key={d} className="cal-day-header">{d}</div>)}
          {days.map((day, i) => {
            const dayEvents = eventsForDay(day.date);
            const isToday = isSameDay(day.date, today);
            return (
              <div
                key={i}
                className={`cal-day ${!day.current ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => setDayDetail(day.date)}
              >
                <div className="day-num">{day.date.getDate()}</div>
                {dayEvents.slice(0, 3).map(ev => (
                  <div
                    key={ev.id}
                    className={`event-pill ${ev.type}`}
                    onClick={e => { e.stopPropagation(); openEdit(ev); }}
                  >
                    {!ev.allDay && fmtTime(ev.startDate) + ' '}{ev.title}
                  </div>
                ))}
                {dayEvents.length > 3 && <div className="more-events">+{dayEvents.length - 3} más</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Agenda View */}
      {view === 'agenda' && (
        <div className="agenda-list">
          {agendaEvents.length === 0 ? (
            <div className="empty-state">
              <CalendarDays size={48} />
              <h3>Sin eventos este mes</h3>
              <p>Creá tu primer evento.</p>
            </div>
          ) : agendaEvents.map(({ date, events: dayEvs }) => (
            <div key={date.toISOString()} className="agenda-day">
              <div className="agenda-date">
                <div className="day-big">{date.getDate()}</div>
                <div className="day-label">{DAYS_ES[date.getDay()]}</div>
              </div>
              <div className="agenda-events">
                {dayEvs.map(ev => (
                  <div key={ev.id} className="agenda-event">
                    <div style={{ width: 4, height: '100%', minHeight: 40, borderRadius: 2, background: ev.color, flexShrink: 0 }} />
                    <div className="event-time">
                      {ev.allDay ? 'Todo el día' : `${fmtTime(ev.startDate)} - ${fmtTime(ev.endDate)}`}
                    </div>
                    <div className="event-info" style={{ flex: 1 }}>
                      <h4>{ev.title}</h4>
                      {ev.description && <p>{ev.description}</p>}
                      {ev.assignedTo.length > 0 && (
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Con: {ev.assignedTo.join(', ')}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(ev)}><Pencil size={14} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setConfirm(ev.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button className="btn-fab" onClick={() => openNew()}><Plus size={24} /></button>

      {/* Day Detail Modal */}
      {dayDetail && (
        <div className="modal-overlay" onClick={() => setDayDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{fmt(dayDetail.getTime())}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {eventsForDay(dayDetail).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Sin eventos</p>
              ) : eventsForDay(dayDetail).map(ev => (
                <div key={ev.id} className="agenda-event" style={{ cursor: 'pointer' }} onClick={() => { setDayDetail(null); openEdit(ev); }}>
                  <div style={{ width: 4, minHeight: 36, borderRadius: 2, background: ev.color, flexShrink: 0 }} />
                  <div className="event-time">{ev.allDay ? 'Todo el día' : fmtTime(ev.startDate)}</div>
                  <div className="event-info"><h4>{ev.title}</h4></div>
                </div>
              ))}
            </div>
            <div className="modal-actions" style={{ borderTop: 'none', paddingTop: 0 }}>
              <button className="btn btn-secondary" onClick={() => setDayDetail(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={() => { setDayDetail(null); openNew(dayDetail); }}>
                <Plus size={14} /> Agregar evento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {modal && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Editar Evento' : 'Nuevo Evento'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="input-group">
                <label>Título *</label>
                <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Título del evento" />
              </div>
              <div className="input-group">
                <label>Descripción</label>
                <textarea className="textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalles..." />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.allDay} onChange={e => setForm(f => ({ ...f, allDay: e.target.checked }))} />
                Todo el día
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Inicio</label>
                  <input className="input" type={form.allDay ? 'date' : 'datetime-local'}
                    value={form.allDay ? new Date(form.startDate).toISOString().split('T')[0] : fmtDTLocal(form.startDate)}
                    onChange={e => setForm(f => ({ ...f, startDate: new Date(e.target.value).getTime() }))} />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Fin</label>
                  <input className="input" type={form.allDay ? 'date' : 'datetime-local'}
                    value={form.allDay ? new Date(form.endDate).toISOString().split('T')[0] : fmtDTLocal(form.endDate)}
                    onChange={e => setForm(f => ({ ...f, endDate: new Date(e.target.value).getTime() }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Tipo</label>
                  <select className="select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as CalEvent['type'] }))}>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{EVENT_LABELS[t]}</option>)}
                  </select>
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Color</label>
                  <div className="color-picker">
                    {COLORS.slice(0, 5).map(c => (
                      <div key={c} className={`color-dot ${form.color === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => setForm(f => ({ ...f, color: c }))} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="input-group">
                <label>Participantes</label>
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
              {editing && <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => { setConfirm(editing.id); close(); }}>Eliminar</button>}
              <button className="btn btn-secondary" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>{editing ? 'Guardar' : 'Crear Evento'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm */}
      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2>¿Eliminar evento?</h2>
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
