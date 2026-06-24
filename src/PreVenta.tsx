import { useState, useMemo, useEffect } from 'react';
import { Plus, Search, X, Trash2, Target, CalendarPlus, MessageCircle, Sparkles, Presentation, Share2, Eye, UserCheck } from 'lucide-react';
import { useProspects, useClients, toast } from './hooks';
import { supabase } from './supabase';
import ProposalDeck from './ProposalDeck';
import BrandEditor from './BrandEditor';
import {
  PRESALE_PIPELINE, PRESALE_STAGES, PRESALE_STAGE_LABELS, PRESALE_STAGE_COLORS,
  MINT_FIELDS, PREP_ITEMS, PROSPECT_DISCOVERY_FIELDS, PROSPECT_DISCOVERY_REQUIRED, fmt, fmtDTLocal,
  type Prospect, type PresaleStage, type Proposal, type Brand,
} from './utils';

const emptyProspect: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '', business: '', source: '', stage: 'prospeccion',
  contact: { whatsapp: '', email: '', instagram: '' },
  meetingAt: null, mint: {}, prep: {}, discovery: {}, notes: '', proposal: null,
};

export default function PreVenta() {
  const { prospects, create, update, remove } = useProspects();
  const { create: createClient } = useClients();
  const [converting, setConverting] = useState(false);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Prospect | null>(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyProspect);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [generatingProp, setGeneratingProp] = useState(false);
  const [deck, setDeck] = useState<Proposal | null>(null);
  const [deckBrand, setDeckBrand] = useState<Brand>({});
  // Estado local de los campos editables (evita que un guardado pise a otro)
  const [disc, setDisc] = useState<Record<string, string>>({});
  const [mintL, setMintL] = useState<Record<string, string>>({});
  const [contactL, setContactL] = useState<{ whatsapp?: string; email?: string; instagram?: string }>({});
  const [prepL, setPrepL] = useState<Record<string, boolean>>({});
  const [brandL, setBrandL] = useState<Brand>({});
  const [views, setViews] = useState<{ count: number; last: string | null } | null>(null);

  // Mantener el panel sincronizado con datos frescos
  useEffect(() => {
    if (detail) {
      const fresh = prospects.find(p => p.id === detail.id);
      if (fresh) setDetail(fresh);
    }
  }, [prospects]);

  // Sincronizar el estado local SOLO cuando cambia el prospecto seleccionado
  useEffect(() => {
    setDisc(detail?.discovery || {});
    setMintL(detail?.mint || {});
    setContactL(detail?.contact || {});
    setPrepL(detail?.prep || {});
    setBrandL(detail?.brand || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id]);

  // Aperturas de la propuesta (tracking)
  useEffect(() => {
    if (!detail?.shareToken) { setViews(null); return; }
    supabase.from('proposal_views').select('viewed_at', { count: 'exact' })
      .eq('token', detail.shareToken).order('viewed_at', { ascending: false }).limit(1)
      .then(({ data, count }) => setViews({ count: count || 0, last: data?.[0]?.viewed_at || null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.shareToken]);

  const saveBrand = (next: Brand) => { setBrandL(next); if (detail) update(detail.id, { brand: next }); };

  const missing = PROSPECT_DISCOVERY_REQUIRED.filter(f => !(disc[f.key] || '').trim());

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

  const waLink = () => {
    const num = (contactL.whatsapp || '').replace(/[^\d]/g, '');
    const msg = encodeURIComponent(`Hola ${detail?.name || ''}! Soy de MYB Digitals. `);
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

  const shareLink = (token: string) => `${window.location.origin}/?p=${token}`;

  // Pasa el prospecto a la sección Clientes con todo lo cargado (sin re-tipear nada).
  const convertirEnCliente = async (p: Prospect) => {
    if (p.clientId) { toast('Este prospecto ya es cliente', 'info'); return; }
    setConverting(true);
    try {
      const d = p.discovery || {};
      const c = p.contact || {};
      const lines: string[] = [`Convertido desde Pre-venta el ${fmt(Date.now())}.`, ''];
      const add = (lbl: string, v?: string) => { if (v && v.trim()) lines.push(`${lbl}: ${v.trim()}`); };
      if (p.business?.trim()) add('Negocio', p.business);
      add('Qué hace', d.queHace); add('Cliente ideal', d.publico); add('Dolor', d.dolor);
      add('Objetivo', d.objetivo); add('Situación actual', d.situacion);
      add('Servicio propuesto', d.servicio); add('Diferencial', d.diferencial); add('Qué probó', d.queProbo);
      const cont = [c.whatsapp && `WhatsApp ${c.whatsapp}`, c.email && `Email ${c.email}`, c.instagram && `IG ${c.instagram}`].filter(Boolean).join(' · ');
      if (cont) lines.push('', 'Contacto: ' + cont);
      if (p.notes?.trim()) lines.push('', 'Notas de pre-venta: ' + p.notes.trim());
      if (p.shareToken) lines.push('', 'Propuesta: ' + shareLink(p.shareToken));

      const projects = d.servicio?.trim() ? [{
        id: crypto.randomUUID(), name: d.servicio.trim(), description: 'Servicio acordado en la propuesta de pre-venta.',
        status: 'pending' as const, value: 0, currency: 'ARS' as const, paidPercentage: 0,
        startDate: Date.now(), endDate: null, links: '',
      }] : [];

      const clientId = await createClient({
        name: p.business?.trim() || p.name,
        contact: { email: c.email || '', whatsapp: c.whatsapp || '', instagram: c.instagram || '' },
        status: 'active',
        totalRevenue: 0,
        projects,
      } as Parameters<typeof createClient>[0]);
      if (!clientId) return; // createClient ya mostró el error

      await supabase.from('client_notes').insert({ id: crypto.randomUUID(), client_id: clientId, content: lines.join('\n'), created_at: Date.now() });
      await update(p.id, { clientId, stage: 'ganado' });
      toast('¡Cliente creado! Lo encontrás en la pestaña Clientes 🎉');
    } catch (e) {
      toast('No se pudo convertir: ' + ((e as Error)?.message || e), 'error');
    } finally {
      setConverting(false);
    }
  };

  const compartirPropuesta = async (p: Prospect) => {
    if (!p.proposal) { toast('Primero generá la propuesta', 'error'); return; }
    const token = p.shareToken || crypto.randomUUID();
    const vigente = p.shareExpires && p.shareExpires > Date.now();
    const expires = vigente ? p.shareExpires! : Date.now() + 30 * 24 * 3600 * 1000;
    if (!p.shareToken || !vigente) await update(p.id, { shareToken: token, shareExpires: expires });
    const link = shareLink(token);
    try { await navigator.clipboard.writeText(link); toast('Link copiado · válido 30 días 📋'); }
    catch { toast('Link: ' + link, 'info'); }
  };

  const generarPropuesta = async (p: Prospect) => {
    if (missing.length) {
      toast(`Cargá estos datos antes de generar: ${missing.map(m => m.label).join(', ')}`, 'error');
      return;
    }
    setGeneratingProp(true);
    try {
      await update(p.id, { discovery: disc, mint: mintL, contact: contactL }); // persistir lo último cargado
      const { data, error } = await supabase.functions.invoke('generate-proposal', {
        body: { prospect: { name: p.name, business: p.business, ...disc, mint: mintL, notas: p.notes } },
      });
      let err = '';
      if (error) { err = error.message; try { const b = await (error as any).context?.json?.(); if (b?.error) err = b.error; } catch { /* noop */ } }
      else if (!data?.ok) err = data?.error || 'Respuesta inesperada';
      if (err) { toast(`Error al generar propuesta: ${err}`, 'error'); return; }
      // Generar (o reusar) el link compartible automáticamente al armar la propuesta
      const token = p.shareToken || crypto.randomUUID();
      const vigente = p.shareExpires && p.shareExpires > Date.now();
      const expires = vigente ? p.shareExpires! : Date.now() + 30 * 24 * 3600 * 1000;
      await update(p.id, { proposal: data.proposal, shareToken: token, shareExpires: expires });
      setDeck(data.proposal);
      setDeckBrand(brandL);
      try { await navigator.clipboard.writeText(shareLink(token)); toast('Propuesta lista ✨ Link copiado (30 días)'); }
      catch { toast('Propuesta generada ✨'); }
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
            <div className="input-group" style={{ marginBottom: 14 }}>
              <label>Etapa del pipeline</label>
              <select className="select" value={detail.stage} onChange={e => update(detail.id, { stage: e.target.value as PresaleStage })}>
                {PRESALE_STAGES.map(s => <option key={s} value={s}>{PRESALE_STAGE_LABELS[s]}</option>)}
              </select>
            </div>

            {/* Convertir en cliente (cierra el ciclo de pre-venta) */}
            {detail.clientId ? (
              <div className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginBottom: 18, cursor: 'default', color: 'var(--secondary)', borderColor: 'var(--secondary)' }}>
                <UserCheck size={15} /> Ya es cliente
              </div>
            ) : (
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 18, background: 'var(--secondary)' }}
                onClick={() => convertirEnCliente(detail)} disabled={converting}>
                <UserCheck size={15} /> {converting ? 'Pasando a Clientes…' : 'Cerrar y pasar a Clientes'}
              </button>
            )}

            {/* Contacto */}
            <Section title="Contacto">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                <input className="input" placeholder="WhatsApp (+54 9 351...)" value={contactL.whatsapp || ''} onChange={e => setContactL(c => ({ ...c, whatsapp: e.target.value }))} onBlur={() => update(detail.id, { contact: contactL })} />
                <input className="input" placeholder="Email" value={contactL.email || ''} onChange={e => setContactL(c => ({ ...c, email: e.target.value }))} onBlur={() => update(detail.id, { contact: contactL })} />
                <input className="input" placeholder="Instagram" value={contactL.instagram || ''} onChange={e => setContactL(c => ({ ...c, instagram: e.target.value }))} onBlur={() => update(detail.id, { contact: contactL })} />
              </div>
              {contactL.whatsapp && (
                <a className="btn btn-secondary btn-sm" href={waLink()} target="_blank" rel="noreferrer" style={{ width: '100%', justifyContent: 'center' }}>
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

            {/* Discovery: datos para la propuesta */}
            <Section title="Datos para la propuesta">
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '-2px 0 12px', lineHeight: 1.45 }}>
                Completá con lo que sacaste de la reunión. Los campos con <span style={{ color: 'var(--danger)' }}>*</span> son obligatorios para generar la propuesta.
              </p>
              {PROSPECT_DISCOVERY_FIELDS.map(f => {
                const faltante = f.req && !(disc[f.key] || '').trim();
                return (
                  <div key={f.key} className="input-group" style={{ marginBottom: 10 }}>
                    <label style={{ textTransform: 'none', letterSpacing: 0 }}>
                      {f.label}{f.req && <span style={{ color: 'var(--danger)' }}> *</span>}
                      {faltante && <span style={{ color: 'var(--danger)', fontSize: 10, fontWeight: 600, marginLeft: 6 }}>(falta)</span>}
                    </label>
                    {f.big ? (
                      <textarea className="textarea" placeholder={f.ph} value={disc[f.key] || ''}
                        style={{ minHeight: 58, borderColor: faltante ? 'var(--danger)' : undefined }}
                        onChange={e => setDisc(d => ({ ...d, [f.key]: e.target.value }))}
                        onBlur={() => update(detail.id, { discovery: disc })} />
                    ) : (
                      <input className="input" placeholder={f.ph} value={disc[f.key] || ''}
                        style={{ borderColor: faltante ? 'var(--danger)' : undefined }}
                        onChange={e => setDisc(d => ({ ...d, [f.key]: e.target.value }))}
                        onBlur={() => update(detail.id, { discovery: disc })} />
                    )}
                  </div>
                );
              })}
            </Section>

            {/* Propuesta de valor */}
            <Section title="Propuesta de valor">
              {detail.proposal ? (
                <>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setDeck(detail.proposal); setDeckBrand(brandL); }}>
                      <Presentation size={14} /> Ver presentación
                    </button>
                    <button className="btn btn-secondary btn-sm" title="Regenerar con IA" onClick={() => generarPropuesta(detail)} disabled={generatingProp}>
                      <Sparkles size={14} />
                    </button>
                  </div>
                  <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => compartirPropuesta(detail)}>
                    <Share2 size={14} /> {detail.shareToken ? 'Copiar link de la propuesta' : 'Crear link (30 días)'}
                  </button>
                  {detail.shareToken && (
                    <input className="input" readOnly value={shareLink(detail.shareToken)} onClick={e => { (e.target as HTMLInputElement).select(); compartirPropuesta(detail); }}
                      style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }} title="Click para copiar" />
                  )}
                  {detail.shareExpires && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>🔗 Aislado del dashboard · vence el {fmt(detail.shareExpires)}</div>}
                  {views && (
                    <div style={{ fontSize: 11, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, color: views.count ? 'var(--secondary)' : 'var(--text-muted)' }}>
                      <Eye size={12} /> {views.count
                        ? `La abrió ${views.count} ${views.count === 1 ? 'vez' : 'veces'}${views.last ? ' · última: ' + fmt(new Date(views.last).getTime()) : ''}`
                        : 'Todavía no la abrió'}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => generarPropuesta(detail)} disabled={generatingProp || missing.length > 0}>
                    <Sparkles size={15} /> {generatingProp ? 'Armando la presentación…' : 'Generar propuesta con IA'}
                  </button>
                  {missing.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 7, lineHeight: 1.4 }}>
                      Completá para habilitar: {missing.map(m => m.label).join(', ')}
                    </div>
                  )}
                </>
              )}
            </Section>

            {/* Diseño de la presentación */}
            <Section title="Diseño de la presentación">
              <BrandEditor
                brand={brandL}
                prospectId={detail.id}
                sectionTitles={detail.proposal?.secciones?.map(s => s.titulo) || []}
                onChange={saveBrand}
              />
            </Section>

            {/* Preparación */}
            <Section title="Preparación previa">
              {PREP_ITEMS.map(item => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" style={{ accentColor: 'var(--primary)', width: 16, height: 16 }}
                    checked={!!prepL[item.key]}
                    onChange={e => { const np = { ...prepL, [item.key]: e.target.checked }; setPrepL(np); update(detail.id, { prep: np }); }} />
                  <span style={{ color: prepL[item.key] ? 'var(--text-muted)' : 'var(--text-secondary)', textDecoration: prepL[item.key] ? 'line-through' : 'none' }}>{item.label}</span>
                </label>
              ))}
            </Section>

            {/* Calificación MINT */}
            <Section title="Calificación MINT">
              {MINT_FIELDS.map(f => (
                <div key={f.key} className="input-group" style={{ marginBottom: 10 }}>
                  <label style={{ textTransform: 'none', letterSpacing: 0 }}>{f.label}</label>
                  <input className="input" placeholder={f.hint} value={mintL[f.key] || ''}
                    onChange={e => setMintL(m => ({ ...m, [f.key]: e.target.value }))}
                    onBlur={() => update(detail.id, { mint: mintL })} />
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
      {deck && <ProposalDeck proposal={deck} brand={deckBrand} onClose={() => setDeck(null)} />}

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
