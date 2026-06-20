import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Trash2, CheckCircle2, Circle, Link as LinkIcon, MessageCircle, Globe,
  FileText, Copy, X, ChevronDown, ChevronRight, ExternalLink, FolderPlus, Sparkles,
  Map as MapIcon, ListChecks, Lock, DollarSign, Palette, Code2, Search, Rocket, Trophy, BookOpen,
} from 'lucide-react';
import { toast } from './hooks';
import { supabase } from './supabase';
import { buildAcuerdo } from './playbooks';
import { STEP_GUIDES, PHASE_GUIDES, type StepGuide, type PhaseGuide } from './guides';
import {
  SERVICE_LABELS, ONBOARDING_STATUSES, ONBOARDING_STATUS_LABELS,
  STEP_STATUSES, STEP_STATUS_LABELS,
  OWNER_LABELS, OWNER_COLORS, DOC_LABELS, DISCOVERY_FIELDS,
  onboardingProgress, fmt, fmtMoney, fmtUSD,
  type Onboarding, type OnboardingStep, type OnboardingPayment, type OnboardingDocument, type StepStatus, type Discovery,
} from './utils';

interface Props {
  onboarding: Onboarding;
  onBack: () => void;
  update: (id: string, updates: Partial<Onboarding>) => Promise<void>;
  updateStep: (id: string, updates: Partial<OnboardingStep>) => Promise<void>;
  updatePayment: (id: string, updates: Partial<OnboardingPayment>) => Promise<void>;
  updateDocument: (id: string, updates: Partial<OnboardingDocument>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export default function OnboardingDetail({ onboarding: o, onBack, update, updateStep, updatePayment, updateDocument, remove }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Record<number, boolean>>({});
  const [docModal, setDocModal] = useState<OnboardingDocument | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [creatingFolders, setCreatingFolders] = useState(false);
  const [slots, setSlots] = useState({ driveRootLink: '', whatsappLink: '', domain: '' });
  const [discovery, setDiscovery] = useState<Partial<Discovery>>({});
  const [discoveryOpen, setDiscoveryOpen] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'mapa' | 'tecnico'>('mapa');
  const [mapPhase, setMapPhase] = useState<number | null>(null);

  useEffect(() => {
    setSlots({ driveRootLink: o.driveRootLink || '', whatsappLink: o.whatsappLink || '', domain: o.domain || '' });
    setDiscovery(o.discovery || {});
  }, [o.id]);

  const pct = onboardingProgress(o.steps);

  // Agrupar pasos por fase
  const phases = useMemo(() => {
    const map = new Map<number, { phase: number; name: string; steps: OnboardingStep[] }>();
    [...o.steps].sort((a, b) => a.order - b.order).forEach(s => {
      if (!map.has(s.phase)) map.set(s.phase, { phase: s.phase, name: s.phaseName, steps: [] });
      map.get(s.phase)!.steps.push(s);
    });
    return Array.from(map.values()).sort((a, b) => a.phase - b.phase);
  }, [o.steps]);

  const mapPhaseObj = mapPhase !== null ? (phases.find(p => p.phase === mapPhase) ?? null) : null;

  const saveSlot = (field: 'driveRootLink' | 'whatsappLink' | 'domain') => {
    if (slots[field] !== (o[field] || '')) update(o.id, { [field]: slots[field] } as any);
  };

  // ID de la carpeta raíz ya creada (para reutilizar y no duplicar en Drive)
  const driveFolderId = () => (o.driveRootLink.match(/folders\/([^?/]+)/) || [])[1] || undefined;

  // Llama a la Edge Function que crea la estructura de carpetas en el Drive de MYB
  const createDriveFolders = async () => {
    if (!o.clientName) { toast('El onboarding no tiene cliente asociado', 'error'); return; }
    setCreatingFolders(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-drive-folders', {
        body: {
          clientName: o.clientName,
          rootFolderId: driveFolderId(),
          documents: o.documents.map(d => ({ title: d.title, content: d.content })),
        },
      });
      let errMsg = '';
      if (error) {
        errMsg = error.message;
        try { const b = await (error as any).context?.json?.(); if (b?.error) errMsg = b.error; } catch { /* noop */ }
      } else if (!data?.ok) {
        errMsg = data?.error || 'Respuesta inesperada';
      }
      if (errMsg) { toast(`Error al crear carpetas: ${errMsg}`, 'error'); return; }
      setSlots(s => ({ ...s, driveRootLink: data.link }));
      await update(o.id, { driveRootLink: data.link });
      toast('Carpetas creadas en Drive ✨');
    } catch (e: any) {
      toast(`Error: ${e?.message || e}`, 'error');
    } finally {
      setCreatingFolders(false);
    }
  };

  const persistDiscovery = (next: Partial<Discovery>) => {
    if (JSON.stringify(next) !== JSON.stringify(o.discovery || {})) update(o.id, { discovery: next });
  };

  const saveDocContent = async (docType: string, content: string) => {
    const doc = o.documents.find(d => d.docType === docType);
    if (doc) await supabase.from('onboarding_documents').update({ content, status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', doc.id);
  };

  // Genera el Brief (IA/Gemini) + el Acuerdo (plantilla) desde los datos de la reunión
  const generateDocs = async () => {
    if (!discovery.marca && !discovery.queHace && !discovery.notas) {
      toast('Completá al menos el nombre de la marca y las notas de la reunión antes de generar', 'error'); return;
    }
    setGenerating(true);
    try {
      await update(o.id, { discovery });
      const acuerdoContent = buildAcuerdo(discovery);
      // Acuerdo: plantilla, instantáneo
      await saveDocContent('acuerdo', acuerdoContent);
      // Brief: IA
      const { data, error } = await supabase.functions.invoke('generate-brief', { body: { discovery } });
      let errMsg = '';
      if (error) {
        errMsg = error.message;
        try { const b = await (error as any).context?.json?.(); if (b?.error) errMsg = b.error; } catch { /* noop */ }
      } else if (!data?.ok) errMsg = data?.error || 'Respuesta inesperada';
      if (errMsg) { toast(`Acuerdo generado. El Brief (IA) falló: ${errMsg}`, 'error'); return; }
      await saveDocContent('brief', data.brief);
      toast('¡Listo! Brief y Acuerdo generados ✨');
      // Abrir el Brief recién generado para que se vea al instante
      const briefDoc = o.documents.find(d => d.docType === 'brief');
      if (briefDoc) setDocModal({ ...briefDoc, content: data.brief, status: 'in_progress' });

      // Sincronizar el contenido generado a los Google Docs de Drive (en segundo plano, idempotente)
      const docsForDrive = o.documents.map(d => ({
        title: d.title,
        content: d.docType === 'brief' ? data.brief : d.docType === 'acuerdo' ? acuerdoContent : (d.content || ''),
      }));
      supabase.functions.invoke('create-drive-folders', { body: { clientName: o.clientName, rootFolderId: driveFolderId(), documents: docsForDrive } })
        .then(({ data: dr }: any) => {
          if (dr?.ok) {
            if (dr.link && !o.driveRootLink) update(o.id, { driveRootLink: dr.link });
            toast('Documentos sincronizados a Drive 📁');
          }
        })
        .catch(() => { /* silencioso: el contenido ya quedó en el dashboard */ });
    } catch (e: any) {
      toast(`Error: ${e?.message || e}`, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const toggleStep = (s: OnboardingStep) => {
    updateStep(s.id, { status: s.status === 'done' ? 'pending' : 'done' });
  };

  const openExternal = (url: string) => {
    const full = url.startsWith('http') ? url : `https://${url}`;
    window.open(full, '_blank', 'noreferrer');
  };

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div className="onb-detail-header">
        <button className="btn btn-ghost btn-sm" onClick={onBack}><ArrowLeft size={16} /> Volver</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{o.clientName || 'Cliente'}</h2>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{SERVICE_LABELS[o.serviceType] || o.serviceType} · iniciado {fmt(o.startedAt || o.createdAt)}</div>
        </div>
        <select className="select" style={{ width: 150 }} value={o.status}
          onChange={e => update(o.id, { status: e.target.value as Onboarding['status'], launchedAt: e.target.value === 'launched' ? Date.now() : o.launchedAt })}>
          {ONBOARDING_STATUSES.map(s => <option key={s} value={s}>{ONBOARDING_STATUS_LABELS[s]}</option>)}
        </select>
        <button className="btn btn-ghost btn-icon" onClick={() => setConfirmDel(true)}><Trash2 size={16} /></button>
      </div>

      {/* PASO 1 — Datos del cliente → genera Brief + Acuerdo */}
      <div className="card card-3d" style={{ padding: 22, marginBottom: 20, border: '1.5px solid var(--primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setDiscoveryOpen(v => !v)}>
          <h3 style={{ fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={20} color="var(--primary-light)" /> Datos del cliente — Brief &amp; Acuerdo
          </h3>
          <ChevronDown size={18} style={{ transform: discoveryOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', color: 'var(--text-muted)' }} />
        </div>
        {discoveryOpen && (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '10px 0 18px', lineHeight: 1.5 }}>
              📝 Cargá acá todo lo que salió de la reunión con el cliente (lo más importante es <strong>"Notas libres"</strong>: pegá ahí todo, aunque esté desordenado). Cuando termines, tocá <strong>"Generar Brief + Acuerdo"</strong> y la IA arma los dos documentos automáticamente.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              {DISCOVERY_FIELDS.map(f => (
                <div key={f.key} className="input-group" style={f.big ? { gridColumn: '1 / -1' } : undefined}>
                  <label>{f.label}</label>
                  {f.big ? (
                    <textarea className="textarea" value={discovery[f.key] || ''} placeholder={f.placeholder}
                      onChange={e => setDiscovery(d => ({ ...d, [f.key]: e.target.value }))}
                      onBlur={() => persistDiscovery(discovery)} style={{ minHeight: 70 }} />
                  ) : (
                    <input className="input" value={discovery[f.key] || ''} placeholder={f.placeholder}
                      onChange={e => setDiscovery(d => ({ ...d, [f.key]: e.target.value }))}
                      onBlur={() => persistDiscovery(discovery)} />
                  )}
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={generateDocs} disabled={generating}
              style={{ marginTop: 18, fontSize: 15, padding: '12px 26px' }}>
              <Sparkles size={17} /> {generating ? 'Generando Brief + Acuerdo…' : 'Generar Brief + Acuerdo'}
            </button>
          </>
        )}
      </div>

      {/* Progreso global */}
      <div className="card card-3d" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Progreso general</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary-light)' }}>{pct}%</span>
        </div>
        <div className="onb-progress-bar" style={{ height: 12 }}>
          <div className="onb-progress-fill" style={{ width: `${pct}%` }} />
        </div>

        {/* Slots */}
        <div className="onb-slots">
          <SlotInput icon={<LinkIcon size={14} color="#3b82f6" />} label="Carpeta Drive" value={slots.driveRootLink}
            onChange={v => setSlots(s => ({ ...s, driveRootLink: v }))} onBlur={() => saveSlot('driveRootLink')} onOpen={openExternal} placeholder="Link de la carpeta…" />
          <SlotInput icon={<MessageCircle size={14} color="#25D366" />} label="Grupo WhatsApp" value={slots.whatsappLink}
            onChange={v => setSlots(s => ({ ...s, whatsappLink: v }))} onBlur={() => saveSlot('whatsappLink')} onOpen={openExternal} placeholder="Link de invitación…" />
          <SlotInput icon={<Globe size={14} color="#f59e0b" />} label="Dominio" value={slots.domain}
            onChange={v => setSlots(s => ({ ...s, domain: v }))} onBlur={() => saveSlot('domain')} onOpen={openExternal} placeholder="midominio.com" />
        </div>

        {/* Crear carpetas automáticamente en Drive */}
        <button className="btn btn-secondary" onClick={createDriveFolders} disabled={creatingFolders}
          style={{ marginTop: 14 }}>
          <FolderPlus size={15} />
          {creatingFolders ? 'Sincronizando con Drive…' : slots.driveRootLink ? 'Actualizar carpetas en Drive' : 'Crear carpetas en Drive'}
        </button>
      </div>

      {/* Pagos */}
      <div className="card card-3d" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Hitos de pago</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {o.payments.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin hitos de pago.</p>}
          {o.payments.map(p => (
            <div key={p.id} className="onb-payment">
              <button className={`onb-check ${p.paid ? 'done' : ''}`} onClick={() => updatePayment(p.id, { paid: !p.paid })}>
                {p.paid ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.label}</div>
                <div style={{ fontSize: 12, color: p.paid ? 'var(--secondary)' : 'var(--text-muted)' }}>
                  {p.paid ? `Cobrado${p.paidAt ? ' el ' + fmt(p.paidAt) : ''}` : `${p.percentage}% del total`}
                </div>
              </div>
              <input className="input" type="number" defaultValue={p.amount || ''} placeholder="Monto"
                style={{ width: 110 }} onBlur={e => { const v = Number(e.target.value); if (v !== p.amount) updatePayment(p.id, { amount: v }); }} />
              <select className="select" defaultValue={p.currency} style={{ width: 80 }}
                onChange={e => updatePayment(p.id, { currency: e.target.value as 'ARS' | 'USD' })}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
              <div style={{ width: 90, textAlign: 'right', fontSize: 13, fontWeight: 700, color: p.paid ? 'var(--secondary)' : 'var(--warning)' }}>
                {p.amount > 0 ? (p.currency === 'USD' ? fmtUSD(p.amount) : fmtMoney(p.amount)) : '—'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Documentos */}
      <div className="card card-3d" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Documentos</h3>
        <div className="onb-docs-grid">
          {o.documents.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin documentos.</p>}
          {o.documents.map(d => (
            <button key={d.id} className="onb-doc-btn" onClick={() => setDocModal(d)}>
              <FileText size={18} color={d.status === 'done' ? 'var(--secondary)' : 'var(--text-muted)'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="onb-doc-title">{DOC_LABELS[d.docType] || d.title}</div>
                <div className="onb-doc-status" style={{ color: d.status === 'done' ? 'var(--secondary)' : 'var(--text-muted)' }}>
                  {d.status === 'done' ? 'Completado' : d.status === 'in_progress' ? 'En progreso' : 'Pendiente'}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Toggle Mapa / Técnico */}
      <div className="onb-viewtoggle">
        <button className={viewMode === 'mapa' ? 'active' : ''} onClick={() => setViewMode('mapa')}><MapIcon size={15} /> Mapa</button>
        <button className={viewMode === 'tecnico' ? 'active' : ''} onClick={() => setViewMode('tecnico')}><ListChecks size={15} /> Técnico</button>
      </div>

      {/* Fases / pasos */}
      {viewMode === 'mapa' ? (
        <>
          <ProjectMap phases={phases} progress={pct} selected={mapPhase}
            onPick={(phase: number) => setMapPhase(mapPhase === phase ? null : phase)} />
          {mapPhaseObj && (
            <PhasePanel ph={mapPhaseObj} intro={PHASE_GUIDES[mapPhaseObj.name]}
              onClose={() => setMapPhase(null)} toggleStep={toggleStep} />
          )}
        </>
      ) : phases.map(ph => {
        const phPct = onboardingProgress(ph.steps);
        const collapsed = collapsedPhases[ph.phase];
        return (
          <div key={ph.phase} id={'onb-phase-' + ph.phase} className="onb-phase">
            <div className="onb-phase-header" onClick={() => setCollapsedPhases(c => ({ ...c, [ph.phase]: !c[ph.phase] }))}>
              {collapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
              <span className="onb-phase-num">{ph.phase}</span>
              <h3>{ph.name}</h3>
              <div className="onb-phase-mini">
                <div className="onb-progress-bar" style={{ width: 80, height: 6 }}>
                  <div className="onb-progress-fill" style={{ width: `${phPct}%` }} />
                </div>
                <span>{phPct}%</span>
              </div>
            </div>

            {!collapsed && (
              <>
                {PHASE_GUIDES[ph.name] && <p className="onb-phase-intro-line">{PHASE_GUIDES[ph.name].que}</p>}
              <div className="onb-steps">
                {ph.steps.map(s => {
                  const isOpen = expanded === s.id;
                  const done = s.status === 'done';
                  return (
                    <div key={s.id} className={`onb-step ${done ? 'done' : ''} ${s.status === 'skipped' ? 'skipped' : ''}`}>
                      <div className="onb-step-main">
                        <button className={`onb-check ${done ? 'done' : ''}`} onClick={() => toggleStep(s)}>
                          {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                        </button>
                        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : s.id)}>
                          <div className="onb-step-title">
                            {s.title}
                            {s.isOptional && <span className="onb-opt">opcional</span>}
                          </div>
                          {s.description && <div className="onb-step-desc">{s.description}</div>}
                        </div>
                        <span className="badge" style={{ background: `${OWNER_COLORS[s.owner]}22`, color: OWNER_COLORS[s.owner], flexShrink: 0 }}>
                          {OWNER_LABELS[s.owner]}
                        </span>
                        {s.assignedTo && <span className="avatar" title={s.assignedTo} style={{ width: 24, height: 24, fontSize: 11 }}>{s.assignedTo.charAt(0).toUpperCase()}</span>}
                        {s.link && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openExternal(s.link)}><ExternalLink size={14} /></button>}
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setExpanded(isOpen ? null : s.id)}>
                          <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                        </button>
                      </div>

                      {isOpen && STEP_GUIDES[s.title] && <StepGuideBlock guide={STEP_GUIDES[s.title]} />}
                      {isOpen && (
                        <div className="onb-step-edit">
                          <div className="input-group">
                            <label>Estado</label>
                            <select className="select" value={s.status} onChange={e => updateStep(s.id, { status: e.target.value as StepStatus })}>
                              {STEP_STATUSES.map(st => <option key={st} value={st}>{STEP_STATUS_LABELS[st]}</option>)}
                            </select>
                          </div>
                          <div className="input-group">
                            <label>Responsable</label>
                            <input className="input" defaultValue={s.assignedTo} placeholder="Vos / tu socio…"
                              onBlur={e => { if (e.target.value !== s.assignedTo) updateStep(s.id, { assignedTo: e.target.value }); }} />
                          </div>
                          <div className="input-group">
                            <label>Fecha límite</label>
                            <input className="input" type="date"
                              defaultValue={s.dueDate ? new Date(s.dueDate).toISOString().split('T')[0] : ''}
                              onChange={e => updateStep(s.id, { dueDate: e.target.value ? new Date(e.target.value).getTime() : null })} />
                          </div>
                          <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Link (Drive, Figma, etc.)</label>
                            <input className="input" defaultValue={s.link} placeholder="https://…"
                              onBlur={e => { if (e.target.value !== s.link) updateStep(s.id, { link: e.target.value }); }} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </div>
        );
      })}

      {/* Modal documento */}
      {docModal && (
        <DocEditor doc={docModal} onClose={() => setDocModal(null)} onSave={updateDocument} />
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <div className="modal-overlay" onClick={() => setConfirmDel(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2>¿Eliminar onboarding?</h2>
            <p className="confirm-text">Se borrarán todos los pasos, pagos y documentos de esta guía. No se puede deshacer.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDel(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => remove(o.id)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Slot input con botón "abrir" ───
function SlotInput({ icon, label, value, onChange, onBlur, onOpen, placeholder }: {
  icon: React.ReactNode; label: string; value: string;
  onChange: (v: string) => void; onBlur: () => void; onOpen: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="onb-slot">
      <div className="onb-slot-label">{icon} {label}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="input" value={value} placeholder={placeholder}
          onChange={e => onChange(e.target.value)} onBlur={onBlur} style={{ fontSize: 13 }} />
        {value && <button className="btn btn-ghost btn-icon" onClick={() => onOpen(value)}><ExternalLink size={14} /></button>}
      </div>
    </div>
  );
}

// ─── Editor de documento ───
function DocEditor({ doc, onClose, onSave }: {
  doc: OnboardingDocument;
  onClose: () => void;
  onSave: (id: string, updates: Partial<OnboardingDocument>) => Promise<void>;
}) {
  const [content, setContent] = useState(doc.content);
  const [externalLink, setExternalLink] = useState(doc.externalLink || '');
  const [status, setStatus] = useState(doc.status);

  const save = async () => {
    await onSave(doc.id, { content, externalLink, status });
    onClose();
  };

  const copy = () => {
    navigator.clipboard.writeText(content).then(() => toast('Contenido copiado')).catch(() => toast('No se pudo copiar', 'error'));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{DOC_LABELS[doc.docType] || doc.title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div className="input-group" style={{ flex: 1, minWidth: 160 }}>
            <label>Estado</label>
            <select className="select" value={status} onChange={e => setStatus(e.target.value as OnboardingDocument['status'])}>
              <option value="pending">Pendiente</option>
              <option value="in_progress">En progreso</option>
              <option value="done">Completado</option>
            </select>
          </div>
          <div className="input-group" style={{ flex: 2, minWidth: 200 }}>
            <label>Link externo (Google Docs, opcional)</label>
            <input className="input" value={externalLink} onChange={e => setExternalLink(e.target.value)} placeholder="https://docs.google.com/…" />
          </div>
        </div>

        <div className="input-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>Contenido (Markdown)</label>
            <button className="btn btn-ghost btn-sm" onClick={copy}><Copy size={13} /> Copiar</button>
          </div>
          <textarea className="textarea onb-doc-textarea" value={content} onChange={e => setContent(e.target.value)} />
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar documento</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAPA DEL PROYECTO (vista "recorrido") ───
const PHASE_ICONS = [DollarSign, FolderPlus, FileText, Palette, Code2, Search, Rocket, Trophy];

// Spline suave (Catmull-Rom -> Bézier) que pasa por todos los puntos
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x},${p2.y}`;
  }
  return d;
}

function ProjectMap({ phases, progress, selected, onPick }: {
  phases: { phase: number; name: string; steps: OnboardingStep[] }[];
  progress: number;
  selected?: number | null;
  onPick: (phase: number) => void;
}) {
  const VB_W = 1000, VB_H = 440;
  const N = phases.length;
  const perRow = Math.max(1, Math.ceil(N / 2));
  const xAt = (col: number) => 110 + (780 / Math.max(1, perRow - 1)) * col;
  // Caminito serpenteante con leve onda (más orgánico que 2 filas rectas)
  const pts = phases.map((_, i) => {
    const wave = i % 2 === 0 ? -18 : 18;
    if (i < perRow) return { x: xAt(i), y: 160 + wave };
    return { x: xAt(perRow - 1 - (i - perRow)), y: 320 - wave };
  });
  const doneArr = phases.map(p => p.steps.length > 0 && onboardingProgress(p.steps) === 100);
  const currentIdx = doneArr.findIndex(d => !d);
  const d = smoothPath(pts);

  // Campo de estrellas (estable por montaje)
  const stars = useMemo(() => Array.from({ length: 54 }, () => ({
    cx: +(Math.random() * VB_W).toFixed(0),
    cy: +(Math.random() * VB_H).toFixed(0),
    r: +(Math.random() * 1.6 + 0.4).toFixed(2),
    o: +(Math.random() * 0.5 + 0.15).toFixed(2),
    dur: +(Math.random() * 3 + 2).toFixed(1),
  })), []);

  const C = 2 * Math.PI * 16; // ring de progreso

  return (
    <div className="onb-map">
      <div className="onb-map-canvas">
        {/* Encabezado superpuesto */}
        <div className="onb-map-head">
          <div>
            <div className="onb-map-eyebrow">Recorrido del proyecto</div>
            <h3 className="onb-map-title">Mapa del proyecto</h3>
          </div>
          <div className="onb-map-ring">
            <svg width="46" height="46" viewBox="0 0 46 46">
              <circle cx="23" cy="23" r="16" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
              <circle cx="23" cy="23" r="16" fill="none" stroke="#818cf8" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - progress / 100)} transform="rotate(-90 23 23)"
                style={{ transition: 'stroke-dashoffset 1s ease' }} />
            </svg>
            <span>{progress}%</span>
          </div>
        </div>

        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet" className="onb-map-svg">
          <defs>
            <linearGradient id="onbPathGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="55%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <filter id="onbGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* estrellas */}
          {stars.map((s, i) => (
            <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#cbd5e1" opacity={s.o}>
              <animate attributeName="opacity" values={`${s.o};${s.o * 0.25};${s.o}`} dur={`${s.dur}s`} repeatCount="indefinite" />
            </circle>
          ))}
          {/* camino base (la ruta por delante) */}
          <path d={d} fill="none" stroke="#334155" strokeWidth={9} strokeLinecap="round" opacity={0.55} />
          <path className="onb-road-march" d={d} fill="none" stroke="#475569" strokeWidth={3} strokeLinecap="round" strokeDasharray="1 18" opacity={0.8} />
          {/* progreso (camino recorrido, con glow) */}
          <path d={d} fill="none" stroke="url(#onbPathGrad)" strokeWidth={7} strokeLinecap="round" filter="url(#onbGlow)"
            pathLength={100}
            style={{ strokeDasharray: 100, strokeDashoffset: 100 - progress, transition: 'stroke-dashoffset 1.2s ease' }} />
        </svg>

        {/* nodos */}
        {phases.map((p, i) => {
          const Icon = PHASE_ICONS[i % PHASE_ICONS.length];
          const state = doneArr[i] ? 'done' : (currentIdx === -1 || i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'locked');
          return (
            <button key={p.phase} className={`onb-node onb-node-${state}${selected === p.phase ? ' onb-node-selected' : ''}`}
              style={{ left: `${(pts[i].x / VB_W) * 100}%`, top: `${(pts[i].y / VB_H) * 100}%` }}
              onClick={() => onPick(p.phase)}>
              {state === 'current' && (
                <span className="onb-node-ship" aria-hidden="true"><Rocket size={20} /></span>
              )}
              <span className="onb-node-halo" />
              <span className="onb-node-circle">
                {state === 'done' ? <CheckCircle2 size={26} /> : state === 'locked' ? <Lock size={20} /> : <Icon size={26} />}
              </span>
              <span className="onb-node-label">
                <span className="onb-node-eyebrow">Fase {p.phase}</span>
                {p.name}
              </span>
            </button>
          );
        })}
      </div>
      <p className="onb-map-hint">Tocá una etapa para ver y completar sus pasos.</p>
    </div>
  );
}

// ─── Ficha/guía consultiva de un paso ───
function StepGuideBlock({ guide }: { guide: StepGuide }) {
  return (
    <div className="onb-guide">
      <div className="onb-guide-title"><BookOpen size={14} /> Guía del paso</div>
      <div className="onb-guide-sec"><span className="onb-guide-h">Qué es</span><p>{guide.que}</p></div>
      <div className="onb-guide-sec"><span className="onb-guide-h">Cómo se hace</span><p>{guide.como}</p></div>
      {guide.preguntas && guide.preguntas.length > 0 && (
        <div className="onb-guide-sec">
          <span className="onb-guide-h">Preguntas para la reunión</span>
          <ul>{guide.preguntas.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </div>
      )}
      {guide.dolor && (
        <div className="onb-guide-pain">
          <div><span className="onb-guide-h">El dolor a detectar</span><p>{guide.dolor}</p></div>
          {guide.identificar && <div><span className="onb-guide-h">Cómo identificarlo</span><p>{guide.identificar}</p></div>}
          {guide.solucion && <div><span className="onb-guide-h">Cómo se soluciona</span><p>{guide.solucion}</p></div>}
        </div>
      )}
      <div className="onb-guide-sec">
        <span className="onb-guide-h">Listo cuando</span>
        <ul className="onb-guide-check">{guide.listo.map((l, i) => <li key={i}>{l}</li>)}</ul>
      </div>
    </div>
  );
}

// ─── Panel inline de fase (se despliega dentro del Mapa) ───
function PhasePanel({ ph, intro, onClose, toggleStep }: {
  ph: { phase: number; name: string; steps: OnboardingStep[] };
  intro?: PhaseGuide;
  onClose: () => void;
  toggleStep: (s: OnboardingStep) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const pct = onboardingProgress(ph.steps);
  return (
    <div className="onb-phasepanel">
      <div className="onb-phasepanel-head">
        <div>
          <div className="onb-map-eyebrow" style={{ color: 'var(--primary-light)' }}>Fase {ph.phase} · {pct}% completada</div>
          <h3 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 800 }}>{ph.name}</h3>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
      </div>

      {intro && (
        <div className="onb-phase-intro">
          <div><span className="onb-guide-h">Qué es</span><p>{intro.que}</p></div>
          <div><span className="onb-guide-h">Por qué importa</span><p>{intro.porque}</p></div>
          <div><span className="onb-guide-h">Cuándo</span><p>{intro.cuando}</p></div>
        </div>
      )}

      <div className="onb-guide-h" style={{ marginBottom: 8 }}>Pasos de esta fase</div>
      <div className="onb-pm-steps">
        {ph.steps.map(s => {
          const done = s.status === 'done';
          const g = STEP_GUIDES[s.title];
          const isOpen = open === s.id;
          return (
            <div key={s.id} className="onb-pm-step">
              <div className="onb-pm-row">
                <button className={`onb-check ${done ? 'done' : ''}`} onClick={() => toggleStep(s)}>
                  {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </button>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none' }}>{s.title}</span>
                <span className="badge" style={{ background: `${OWNER_COLORS[s.owner]}22`, color: OWNER_COLORS[s.owner], flexShrink: 0 }}>{OWNER_LABELS[s.owner]}</span>
                {g && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setOpen(isOpen ? null : s.id)}>
                    <BookOpen size={14} /> {isOpen ? 'Ocultar' : 'Guía'}
                  </button>
                )}
              </div>
              {isOpen && g && <StepGuideBlock guide={g} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
