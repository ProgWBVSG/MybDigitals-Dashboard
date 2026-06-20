import { useState, useMemo, useEffect } from 'react';
import { Plus, Search, X, Trash2, Target, CalendarPlus, MessageCircle, Sparkles, Presentation, ChevronLeft, ChevronRight } from 'lucide-react';
import { useProspects, toast } from './hooks';
import { supabase } from './supabase';
import {
  PRESALE_PIPELINE, PRESALE_STAGES, PRESALE_STAGE_LABELS, PRESALE_STAGE_COLORS,
  MINT_FIELDS, PREP_ITEMS, fmt, fmtDTLocal,
  type Prospect, type PresaleStage, type Proposal,
} from './utils';

const emptyProspect: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '', business: '', source: '', stage: 'prospeccion',
  contact: { whatsapp: '', email: '', instagram: '' },
  meetingAt: null, mint: {}, prep: {}, notes: '', proposal: null,
};

export default function PreVenta() {
  const { prospects, create, update, remove } = useProspects();
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Prospect | null>(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyProspect);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [generatingProp, setGeneratingProp] = useState(false);
  const [deck, setDeck] = useState<Proposal | null>(null);

  // Mantener el panel sincronizado con datos frescos
  useEffect(() => {
    if (detail) {
      const fresh = prospects.find(p => p.id === detail.id);
      if (fresh) setDetail(fresh);
    }
  }, [prospects]);

  const filtered = useMemo(() => {
    let list = prospects;
    if (search) list = list.filter(p => (p.name + p.business).toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [prospects, search]);

  const byStage = (stage: PresaleStage) => filtered.filter(p => p.stage === stage).sort((a, b) => b.updatedAt - a.updatedAt);
  const won = filtered.filter(p => p.stage === 'ganado');
  const lost = filtered.filter(p => p.stage === 'perdido');

  const openNew = () => { setForm(emptyProspect); setModal(true); };
  const save = async () => {
    if (!form.name.trim()) { toast('El nombre es obligatorio', 'error'); return; }
    const id = await create(form);
    setModal(false);
    if (id) setTimeout(() => { const p = { ...form, id, createdAt: Date.now(), updatedAt: Date.now() } as Prospect; setDetail(p); }, 100);
  };

  const waLink = (p: Prospect) => {
    const num = (p.contact.whatsapp || '').replace(/[^\d]/g, '');
    const msg = encodeURIComponent(`Hola ${p.name}! Soy de MYB Digitals. `);
    return `https://wa.me/${num}?text=${msg}`;
  };

  const crearEvento = async (p: Prospect) => {
    if (!p.meetingAt) { toast('Primero poné fecha y hora de la reunión', 'error'); return; }
    const { error } = await supabase.from('calendar_events').insert([{
      title: `Reunión discovery: ${p.name}`,
      description: `Prospecto: ${p.business || p.name}. Pre-venta.`,
      start_date: p.meetingAt, end_date: p.meetingAt + 3600000,
      type: 'meeting', assigned_to: [], related_task_id: null,
      color: '#8b5cf6', all_day: false,
    }]);
    if (error) toast('Error al crear el evento', 'error');
    else { update(p.id, { stage: p.stage === 'prospeccion' || p.stage === 'contacto' ? 'agendado' : p.stage }); toast('Evento creado en el calendario 📅'); }
  };

  const generarPropuesta = async (p: Prospect) => {
    setGeneratingProp(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-proposal', {
        body: { prospect: { name: p.name, business: p.business, source: p.source, stage: p.stage, notes: p.notes, mint: p.mint } },
      });
      let err = '';
      if (error) { err = error.message; try { const b = await (error as any).context?.json?.(); if (b?.error) err = b.error; } catch { /* noop */ } }
      else if (!data?.ok) err = data?.error || 'Respuesta inesperada';
      if (err) { toast(`Error al generar propuesta: ${err}`, 'error'); return; }
      await update(p.id, { proposal: data.proposal });
      setDeck(data.proposal);
      toast('Propuesta generada ✨');
    } catch (e: any) {
      toast(`Error: ${e?.message || e}`, 'error');
    } finally {
      setGeneratingProp(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 120px)' }}>
      <div style={{ flex: 1, overflow: 'auto', paddingRight: detail ? 20 : 0 }}>
        <div className="toolbar">
          <div className="toolbar-left">
            <div className="search-bar" style={{ flex: 1, maxWidth: 360 }}>
              <Search size={16} />
              <input placeholder="Buscar prospecto..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="toolbar-right">
            <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Nuevo Prospecto</button>
          </div>
        </div>

        {prospects.length === 0 ? (
          <div className="empty-state">
            <Target size={48} />
            <h3>Sin prospectos</h3>
            <p>Cargá tu primer prospecto y seguilo desde la prospección hasta la reunión.</p>
            <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Agregar prospecto</button>
          </div>
        ) : (
          <>
            <div className="kanban">
              {PRESALE_PIPELINE.map(stage => {
                const cards = byStage(stage);
                return (
                  <div key={stage} className="kanban-col">
                    <div className="col-header">
                      <h3>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRESALE_STAGE_COLORS[stage], display: 'inline-block' }} />
                        {PRESALE_STAGE_LABELS[stage]} <span className="col-count">{cards.length}</span>
                      </h3>
                    </div>
                    <div className="col-cards">
                      {cards.map(p => (
                        <div key={p.id} className="task-card" style={{ cursor: 'pointer', borderColor: detail?.id === p.id ? 'var(--primary)' : undefined }} onClick={() => setDetail(p)}>
                          <div className="card-title"><span>{p.name}</span></div>
                          {p.business && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 6px' }}>{p.business}</p>}
                          {p.meetingAt && (
                            <div className="card-meta"><CalendarPlus size={12} /> <span>{fmt(p.meetingAt)}</span></div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {(won.length > 0 || lost.length > 0) && (
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                {won.map(p => <button key={p.id} className="filter-chip" style={{ borderColor: '#10b981', color: '#10b981' }} onClick={() => setDetail(p)}>✓ {p.name}</button>)}
                {lost.map(p => <button key={p.id} className="filter-chip" style={{ borderColor: '#ef4444', color: '#ef4444', opacity: 0.7 }} onClick={() => setDetail(p)}>✕ {p.name}</button>)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Panel de detalle */}
      {detail && (
        <div style={{ width: 420, flexShrink: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'auto', animation: 'slideIn 0.2s ease' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{detail.name}</h2>
              {detail.business && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{detail.business}</div>}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost btn-icon" onClick={() => setConfirm(detail.id)}><Trash2 size={16} /></button>
              <button className="btn btn-ghost btn-icon" onClick={() => setDetail(null)}><X size={16} /></button>
            </div>
          </div>

          <div style={{ padding: '18px 22px' }}>
            {/* Etapa */}
            <div className="input-group" style={{ marginBottom: 18 }}>
              <label>Etapa del pipeline</label>
              <select className="select" value={detail.stage} onChange={e => update(detail.id, { stage: e.target.value as PresaleStage })}>
                {PRESALE_STAGES.map(s => <option key={s} value={s}>{PRESALE_STAGE_LABELS[s]}</option>)}
              </select>
            </div>

            {/* Contacto */}
            <Section title="Contacto">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                <input className="input" placeholder="WhatsApp (+54 9 351...)" defaultValue={detail.contact.whatsapp || ''} onBlur={e => update(detail.id, { contact: { ...detail.contact, whatsapp: e.target.value } })} />
                <input className="input" placeholder="Email" defaultValue={detail.contact.email || ''} onBlur={e => update(detail.id, { contact: { ...detail.contact, email: e.target.value } })} />
                <input className="input" placeholder="Instagram" defaultValue={detail.contact.instagram || ''} onBlur={e => update(detail.id, { contact: { ...detail.contact, instagram: e.target.value } })} />
              </div>
              {detail.contact.whatsapp && (
                <a className="btn btn-secondary btn-sm" href={waLink(detail)} target="_blank" rel="noreferrer" style={{ width: '100%', justifyContent: 'center' }}>
                  <MessageCircle size={14} color="#25D366" /> Escribir por WhatsApp
                </a>
              )}
            </Section>

            {/* Reunión */}
            <Section title="Reunión de discovery">
              <input className="input" type="datetime-local"
                value={detail.meetingAt ? fmtDTLocal(detail.meetingAt) : ''}
                onChange={e => update(detail.id, { meetingAt: e.target.value ? new Date(e.target.value).getTime() : null })} />
              <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => crearEvento(detail)}>
                <CalendarPlus size={14} /> Crear evento en el calendario
              </button>
            </Section>

            {/* Propuesta de valor */}
            <Section title="Propuesta de valor">
              {detail.proposal ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setDeck(detail.proposal)}>
                    <Presentation size={14} /> Ver presentación
                  </button>
                  <button className="btn btn-secondary btn-sm" title="Regenerar con IA" onClick={() => generarPropuesta(detail)} disabled={generatingProp}>
                    <Sparkles size={14} />
                  </button>
                </div>
              ) : (
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => generarPropuesta(detail)} disabled={generatingProp}>
                  <Sparkles size={15} /> {generatingProp ? 'Generando propuesta…' : 'Generar propuesta con IA'}
                </button>
              )}
            </Section>

            {/* Preparación */}
            <Section title="Preparación previa">
              {PREP_ITEMS.map(item => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" style={{ accentColor: 'var(--primary)', width: 16, height: 16 }}
                    checked={!!detail.prep[item.key]}
                    onChange={e => update(detail.id, { prep: { ...detail.prep, [item.key]: e.target.checked } })} />
                  <span style={{ color: detail.prep[item.key] ? 'var(--text-muted)' : 'var(--text-secondary)', textDecoration: detail.prep[item.key] ? 'line-through' : 'none' }}>{item.label}</span>
                </label>
              ))}
            </Section>

            {/* Calificación MINT */}
            <Section title="Calificación MINT">
              {MINT_FIELDS.map(f => (
                <div key={f.key} className="input-group" style={{ marginBottom: 10 }}>
                  <label style={{ textTransform: 'none', letterSpacing: 0 }}>{f.label}</label>
                  <input className="input" placeholder={f.hint} defaultValue={detail.mint[f.key] || ''}
                    onBlur={e => update(detail.id, { mint: { ...detail.mint, [f.key]: e.target.value } })} />
                </div>
              ))}
            </Section>

            {/* Notas */}
            <Section title="Notas de la reunión">
              <textarea className="textarea" placeholder="Qué se charló, dolores, próximos pasos..." defaultValue={detail.notes}
                style={{ minHeight: 100 }} onBlur={e => update(detail.id, { notes: e.target.value })} />
            </Section>
          </div>
        </div>
      )}

      <button className="btn-fab" onClick={openNew}><Plus size={24} /></button>

      {/* Presentación de la propuesta */}
      {deck && <ProposalDeck proposal={deck} onClose={() => setDeck(null)} />}

      {/* Modal nuevo prospecto */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h2>Nuevo Prospecto</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="input-group"><label>Nombre / Referente *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Juan Pérez" autoFocus /></div>
              <div className="input-group"><label>Negocio / Marca</label><input className="input" value={form.business} onChange={e => setForm(f => ({ ...f, business: e.target.value }))} placeholder="Ej: Estudio Alba" /></div>
              <div className="input-group"><label>¿De dónde salió?</label><input className="input" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="Ej: Instagram, referido, frío..." /></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="input-group" style={{ flex: 1 }}><label>WhatsApp</label><input className="input" value={form.contact.whatsapp} onChange={e => setForm(f => ({ ...f, contact: { ...f.contact, whatsapp: e.target.value } }))} placeholder="+54 9..." /></div>
                <div className="input-group" style={{ flex: 1 }}><label>Instagram</label><input className="input" value={form.contact.instagram} onChange={e => setForm(f => ({ ...f, contact: { ...f.contact, instagram: e.target.value } }))} placeholder="@..." /></div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Crear Prospecto</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar borrar */}
      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h2>¿Eliminar prospecto?</h2>
            <p className="confirm-text">No se puede deshacer.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => { remove(confirm); setConfirm(null); setDetail(null); }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 10px' }}>{title}</h4>
      {children}
    </div>
  );
}

// ─── Presentación de la propuesta (modo deck) ───
function ProposalDeck({ proposal, onClose }: { proposal: Proposal; onClose: () => void }) {
  const slides = _memoSlides(proposal);
  const [i, setI] = useState(0);
  const go = (d: number) => setI(v => Math.max(0, Math.min(slides.length - 1, v + d)));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  const s = slides[i];
  return (
    <div className="deck-overlay" onClick={() => go(1)}>
      <button className="deck-close" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Cerrar"><X size={20} /></button>
      <div className="deck-stage" onClick={e => e.stopPropagation()}>
        {s.kind === 'portada' && (
          <div className="deck-slide deck-portada">
            <div className="deck-eyebrow">{proposal.subtitulo || 'Propuesta de valor'}</div>
            <h1>{proposal.cliente}</h1>
            <div className="deck-by">Presentado por <strong>MYB Digitals</strong> · soluciones digitales</div>
          </div>
        )}
        {s.kind === 'diagnostico' && (
          <div className="deck-slide">
            <div className="deck-eyebrow">Diagnóstico</div>
            <h2>Lo que necesita {proposal.cliente}</h2>
            <p className="deck-lead">{proposal.diagnostico?.texto}</p>
            <div className="deck-pillars">
              {(proposal.diagnostico?.pilares || []).map((p, k) => (
                <div key={k} className="deck-pillar"><span>{k + 1}</span>{p}</div>
              ))}
            </div>
          </div>
        )}
        {s.kind === 'seccion' && (() => {
          const sec = proposal.secciones[s.idx!];
          return (
            <div className="deck-slide">
              <div className="deck-eyebrow">Solución · {s.idx! + 1} de {proposal.secciones.length}</div>
              <h2>{sec.titulo}</h2>
              <div className="deck-cols">
                <ul className="deck-bullets">{(sec.bullets || []).map((b, k) => <li key={k}>{b}</li>)}</ul>
                <p className="deck-desc">{sec.descripcion}</p>
              </div>
            </div>
          );
        })()}
        {s.kind === 'inversion' && (
          <div className="deck-slide">
            <div className="deck-eyebrow">Inversión</div>
            <h2>Inversión</h2>
            <p className="deck-lead">{proposal.inversion?.texto}</p>
            {(proposal.inversion?.items || []).length > 0 && (
              <ul className="deck-bullets" style={{ maxWidth: 620 }}>{proposal.inversion!.items.map((it, k) => <li key={k}>{it}</li>)}</ul>
            )}
          </div>
        )}
        {s.kind === 'cierre' && (
          <div className="deck-slide deck-portada">
            <div className="deck-eyebrow">Próximos pasos</div>
            <h2 style={{ maxWidth: 760 }}>{proposal.proximosPasos}</h2>
            <div className="deck-by">Gracias · <strong>MYB Digitals</strong></div>
          </div>
        )}
      </div>
      <div className="deck-nav" onClick={e => e.stopPropagation()}>
        <button className="btn btn-ghost btn-icon" onClick={() => go(-1)} disabled={i === 0}><ChevronLeft size={20} /></button>
        <span>{i + 1} / {slides.length}</span>
        <button className="btn btn-ghost btn-icon" onClick={() => go(1)} disabled={i === slides.length - 1}><ChevronRight size={20} /></button>
      </div>
    </div>
  );
}

type DeckSlide = { kind: 'portada' | 'diagnostico' | 'seccion' | 'inversion' | 'cierre'; idx?: number };
function _memoSlides(p: Proposal): DeckSlide[] {
  const s: DeckSlide[] = [{ kind: 'portada' }, { kind: 'diagnostico' }];
  (p.secciones || []).forEach((_, idx) => s.push({ kind: 'seccion', idx }));
  if (p.inversion && (p.inversion.texto || (p.inversion.items || []).length > 0)) s.push({ kind: 'inversion' });
  s.push({ kind: 'cierre' });
  return s;
}
