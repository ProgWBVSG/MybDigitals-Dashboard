import { useState, useMemo, useEffect } from 'react';
import {
  DoorOpen, Plus, Copy, ExternalLink, Pencil, Trash2, RefreshCw, Power, X, Check, Megaphone,
  MessageSquareWarning, Image as ImageIcon, ListPlus, CheckCircle2, Eye, EyeOff, Lock, Shuffle,
} from 'lucide-react';
import { usePortals, useClients, useOnboardings, useTasks, usePortalUpdates, usePortalTickets, usePortalViews, portalUploadSignedUrl, uploadPortalImage, toast } from './hooks';
import { supabase } from './supabase';
import { DOMAIN_STATUS_LABELS, fmt, fmtRel, type ClientPortal, type PortalConfig, type DomainStatus, type Brand, type PortalTicket, type Onboarding } from './utils';

const TICKET_STATUS: { key: PortalTicket['status']; label: string; color: string }[] = [
  { key: 'open', label: 'Sin ver', color: '#ef4444' },
  { key: 'in_progress', label: 'En curso', color: '#3b82f6' },
  { key: 'resolved', label: 'Resuelto', color: '#10b981' },
];

const portalLink = (token: string) => `${window.location.origin}/?portal=${token}`;
const SECTIONS: { key: keyof NonNullable<PortalConfig['sections']>; label: string }[] = [
  { key: 'objetivos', label: 'Objetivos' }, { key: 'avance', label: 'Avance / ruta' },
  { key: 'actualizaciones', label: 'Novedades' }, { key: 'disenos', label: 'Archivos y diseños' },
  { key: 'tickets', label: 'Correcciones' },
];

export default function Portals() {
  const { portals, create, updateConfig, setEnabled, regenerateToken, setPin, remove } = usePortals();
  const { clients } = useClients();
  const { onboardings } = useOnboardings();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [updatesForId, setUpdatesForId] = useState<string | null>(null);
  const [ticketsForId, setTicketsForId] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<{ token: string; pin: string } | null>(null);
  // Siempre el portal "vivo" (con realtime), no una foto fija del momento en que se abrió el modal
  const editing = portals.find(p => p.id === editingId) || null;
  const updatesFor = portals.find(p => p.id === updatesForId) || null;
  const ticketsFor = portals.find(p => p.id === ticketsForId) || null;

  const clientName = (id: string | null) => clients.find(c => c.id === id)?.name || 'Cliente';

  const copy = (token: string) => { navigator.clipboard.writeText(portalLink(token)); toast('Link copiado'); };
  const copyText = (text: string, label: string) => { navigator.clipboard.writeText(text); toast(`${label} copiado`); };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DoorOpen size={22} />
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Portales de clientes</h2>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Plus size={15} /> Nuevo portal</button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 18px' }}>
        Un espacio privado, con la marca del cliente, donde ve objetivos, avance, novedades y sus archivos. Se autollena desde el onboarding. Solo entra quien tiene el link.
      </p>

      {portals.length === 0 ? (
        <div className="notif-empty"><DoorOpen size={32} /><p>Todavía no armaste ningún portal. Cerrá un cliente y creale el suyo.</p></div>
      ) : (
        <div className="strat-grid">
          {portals.map(p => (
            <div key={p.id} className="strat-card" style={{ cursor: 'default' }}>
              <div className="strat-card-top">
                <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{clientName(p.clientId)}{p.pin && <span title="Con PIN" style={{ display: 'inline-flex', color: 'var(--text-muted)' }}><Lock size={11} /></span>}</strong>
                <span className="ig-badge soft" style={{ background: p.enabled ? '#10b98122' : '#64748b22', color: p.enabled ? '#10b981' : '#64748b' }}>
                  {p.enabled ? 'Activo' : 'Pausado'}
                </span>
              </div>
              <div className="strat-card-meta">{p.config.title || 'Portal del cliente'}</div>
              <ViewsStat portalId={p.id} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => copy(p.token)}><Copy size={13} /> Copiar link</button>
                <a className="btn btn-ghost btn-sm" href={portalLink(p.token)} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Ver</a>
                <button className="btn btn-ghost btn-sm" onClick={() => setUpdatesForId(p.id)}><Megaphone size={13} /> Novedades</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setTicketsForId(p.id)}><MessageSquareWarning size={13} /> Correcciones</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(p.id)}><Pencil size={13} /> Editar</button>
                <button className="btn btn-ghost btn-icon btn-sm" title={p.enabled ? 'Pausar' : 'Activar'} onClick={() => setEnabled(p.id, !p.enabled)}><Power size={14} /></button>
                <button className="btn btn-ghost btn-icon btn-sm" title="Eliminar" onClick={() => setConfirmDel(p.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <CreateModal
          clients={clients} onboardings={onboardings}
          onClose={() => setCreating(false)}
          onCreate={async (clientId, onboardingId, config) => {
            const res = await create(clientId, { onboardingId, config });
            setCreating(false);
            if (res) setJustCreated(res);
          }}
        />
      )}

      {editing && (
        <EditModal
          portal={editing} clientName={clientName(editing.clientId)}
          onboarding={onboardings.find(o => o.id === editing.onboardingId) || null}
          onClose={() => setEditingId(null)}
          onSave={async (config) => { await updateConfig(editing.id, config); setEditingId(null); }}
          onRegen={async () => { const t = await regenerateToken(editing.id); if (t) copy(t); setEditingId(null); }}
          onSetPin={pin => setPin(editing.id, pin)}
        />
      )}

      {confirmDel && (
        <div className="modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h2>¿Eliminar el portal?</h2>
            <p className="confirm-text">El link deja de funcionar. No se puede deshacer.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => { remove(confirmDel); setConfirmDel(null); }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {updatesFor && (
        <UpdatesModal portal={updatesFor} clientName={clientName(updatesFor.clientId)} onClose={() => setUpdatesForId(null)} />
      )}

      {ticketsFor && (
        <TicketsModal portal={ticketsFor} clientName={clientName(ticketsFor.clientId)} onClose={() => setTicketsForId(null)} />
      )}

      {justCreated && (
        <div className="modal-overlay" onClick={() => setJustCreated(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h2>Portal creado</h2>
            <p className="confirm-text">Mandale al cliente el link Y el código, por separado (ej. link por mail, código por WhatsApp) — así ninguno de los dos por sí solo abre el portal.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
              <div className="input-group">
                <label>Link</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" readOnly value={portalLink(justCreated.token)} />
                  <button className="btn btn-secondary btn-sm" onClick={() => copy(justCreated.token)}><Copy size={13} /></button>
                </div>
              </div>
              <div className="input-group">
                <label>Código de acceso</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 22, letterSpacing: 3, fontWeight: 700 }}>{justCreated.pin}</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => copyText(justCreated.pin, 'Código')}><Copy size={13} /> Copiar código</button>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setJustCreated(null)}>Listo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Novedades (timeline que ve el cliente en su portal) ───
function UpdateImageThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let on = true; portalUploadSignedUrl(path).then(u => { if (on) setUrl(u); }); return () => { on = false; }; }, [path]);
  if (!url) return null;
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" style={{ marginTop: 8, maxHeight: 110, borderRadius: 8, border: '1px solid var(--border)' }} /></a>;
}

function UpdatesModal({ portal, clientName, onClose }: { portal: ClientPortal; clientName: string; onClose: () => void }) {
  const { updates, add, remove } = usePortalUpdates(portal.id);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setUploading(true);
    const path = await uploadPortalImage(f);
    setUploading(false);
    if (path) setImagePath(path);
  };

  const publish = async () => {
    if (!title.trim()) { toast('Ponele un título a la novedad', 'error'); return; }
    setBusy(true);
    await add(portal.id, title.trim(), body.trim(), imagePath);
    setBusy(false);
    setTitle(''); setBody(''); setImagePath(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Novedades — {clientName}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '6px 0 16px' }}>
          Aparece al toque en su portal, ordenado por fecha. Ej: "Subimos la web a staging", "Terminamos el diseño de la home".
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
          <input className="input" placeholder="Título de la novedad" value={title} onChange={e => setTitle(e.target.value)} />
          <textarea className="input" rows={3} placeholder="Detalle (opcional) — podés pegar un link" value={body} onChange={e => setBody(e.target.value)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
              {uploading ? 'Subiendo…' : <><ImageIcon size={13} /> {imagePath ? 'Cambiar imagen' : 'Adjuntar imagen'}</>}
              <input type="file" accept="image/*" hidden onChange={onPickImage} />
            </label>
            {imagePath && <button className="btn btn-ghost btn-icon btn-sm" title="Quitar imagen" onClick={() => setImagePath(null)}><X size={13} /></button>}
          </div>
          <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={publish} disabled={busy || uploading}>
            <Megaphone size={13} /> {busy ? 'Publicando…' : 'Publicar novedad'}
          </button>
        </div>

        {updates.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Todavía no publicaste ninguna novedad.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {updates.map(u => (
              <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{fmt(u.createdAt)} · {fmtRel(u.createdAt)}</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{u.title}</div>
                  {u.body && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3, whiteSpace: 'pre-wrap' }}>{u.body}</div>}
                  {u.imagePath && <UpdateImageThumb path={u.imagePath} />}
                </div>
                <button className="btn btn-ghost btn-icon btn-sm" style={{ flexShrink: 0 }} onClick={() => setConfirmDel(u.id)}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}

        {confirmDel && (
          <div className="modal-overlay" onClick={() => setConfirmDel(null)} style={{ zIndex: 60 }}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 340 }}>
              <h2>¿Borrar esta novedad?</h2>
              <p className="confirm-text">Desaparece del portal del cliente.</p>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setConfirmDel(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={() => { remove(confirmDel); setConfirmDel(null); }}>Borrar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Crear (elige cliente + onboarding → autollena) ───
function CreateModal({ clients, onboardings, onClose, onCreate }: {
  clients: { id: string; name: string }[];
  onboardings: { id: string; clientId: string | null; title: string; domain: string; driveRootLink: string; discovery: { objetivos?: string }; serviceType: string }[];
  onClose: () => void;
  onCreate: (clientId: string, onboardingId: string | null, config: PortalConfig) => void;
}) {
  const [clientId, setClientId] = useState('');
  const [onboardingId, setOnboardingId] = useState('');
  const [busy, setBusy] = useState(false);
  const clientOnbs = useMemo(() => onboardings.filter(o => o.clientId === clientId), [onboardings, clientId]);

  const go = async () => {
    if (!clientId) { toast('Elegí un cliente', 'error'); return; }
    setBusy(true);
    const ob = clientOnbs.find(o => o.id === onboardingId) || clientOnbs[0] || null;
    // marca: la traemos de la propuesta del prospecto (si existe) para que el portal salga con su identidad
    let brand: Brand = {};
    const { data } = await supabase.from('prospects').select('brand').eq('client_id', clientId).limit(1);
    if (data && data[0]?.brand) brand = data[0].brand as Brand;
    const config: PortalConfig = {
      title: ob?.title || clients.find(c => c.id === clientId)?.name || 'Portal del cliente',
      objectives: ob?.discovery?.objetivos || '',
      domain: ob?.domain || '',
      domainStatus: ob?.domain ? 'pending' : 'none',
      brand,
      sections: { objetivos: true, avance: true, actualizaciones: true, disenos: true, tickets: true },
    };
    onCreate(clientId, ob?.id || null, config);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h2>Nuevo portal</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="input-group">
            <label>Cliente</label>
            <select className="select" value={clientId} onChange={e => { setClientId(e.target.value); setOnboardingId(''); }}>
              <option value="">Elegí un cliente…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {clientId && (
            <div className="input-group">
              <label>Onboarding (para autollenar objetivos, dominio y avance)</label>
              <select className="select" value={onboardingId} onChange={e => setOnboardingId(e.target.value)}>
                <option value="">{clientOnbs.length ? 'El más reciente' : 'Este cliente no tiene onboarding'}</option>
                {clientOnbs.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
              </select>
            </div>
          )}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Se crea con la marca del cliente y los datos del onboarding. Después podés editar todo.</p>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={go} disabled={busy || !clientId}>{busy ? 'Creando…' : 'Crear y copiar link'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Cuántas veces (y cuándo) abrió el cliente su portal ───
function ViewsStat({ portalId }: { portalId: string }) {
  const { count, lastViewedAt } = usePortalViews(portalId);
  if (count === 0) return <div className="strat-card-meta" style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}><Eye size={11} /> Todavía no lo abrió</div>;
  return (
    <div className="strat-card-meta" style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
      <Eye size={11} /> {count} {count === 1 ? 'apertura' : 'aperturas'}{lastViewedAt ? ` · última ${fmtRel(lastViewedAt)}` : ''}
    </div>
  );
}

// ─── Editar config ───
function EditModal({ portal, clientName, onboarding, onClose, onSave, onRegen, onSetPin }: {
  portal: ClientPortal; clientName: string; onboarding: Onboarding | null;
  onClose: () => void; onSave: (c: PortalConfig) => void; onRegen: () => void; onSetPin: (pin: string | null) => void;
}) {
  const [c, setC] = useState<PortalConfig>({ sections: {}, designs: [], phaseLabels: {}, ...portal.config });
  const set = (patch: Partial<PortalConfig>) => setC(prev => ({ ...prev, ...patch }));
  const sections = c.sections || {};
  const designs = c.designs || [];
  const phaseLabels = c.phaseLabels || {};
  // Fases reales del onboarding, en orden, sin repetir (los pasos vienen 1 a 1)
  const phases = useMemo(() => {
    const seen = new Map<string, number>();
    for (const s of onboarding?.steps || []) if (!seen.has(s.phaseName)) seen.set(s.phaseName, s.phase);
    return [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name);
  }, [onboarding]);
  const setPhase = (name: string, patch: { label?: string; hidden?: boolean }) =>
    set({ phaseLabels: { ...phaseLabels, [name]: { ...phaseLabels[name], ...patch } } });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Portal de {clientName}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          <div className="input-group"><label>Título del proyecto</label>
            <input className="input" value={c.title || ''} onChange={e => set({ title: e.target.value })} /></div>
          <div className="input-group"><label>Mensaje de bienvenida</label>
            <textarea className="input" rows={2} value={c.welcome || ''} placeholder="Ej: Arrancamos con el diseño de tu web. Acá vas a ver todo el avance." onChange={e => set({ welcome: e.target.value })} /></div>
          <div className="input-group"><label>Objetivos</label>
            <textarea className="input" rows={3} value={c.objectives || ''} onChange={e => set({ objectives: e.target.value })} /></div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div className="input-group" style={{ flex: 1 }}><label>Dominio</label>
              <input className="input" value={c.domain || ''} placeholder="tumarca.com" onChange={e => set({ domain: e.target.value })} /></div>
            <div className="input-group" style={{ width: 160 }}><label>Estado dominio</label>
              <select className="select" value={c.domainStatus || 'none'} onChange={e => set({ domainStatus: e.target.value as DomainStatus })}>
                {Object.entries(DOMAIN_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
          </div>
          <div className="input-group"><label>Link "en vivo" (web / staging)</label>
            <input className="input" value={c.liveUrl || ''} placeholder="https://…" onChange={e => set({ liveUrl: e.target.value })} /></div>

          <div className="input-group">
            <label>Diseños / links extra</label>
            {designs.map((d, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input className="input" style={{ flex: 1 }} placeholder="Título" value={d.title} onChange={e => { const n = [...designs]; n[i] = { ...d, title: e.target.value }; set({ designs: n }); }} />
                <input className="input" style={{ flex: 2 }} placeholder="https://…" value={d.url} onChange={e => { const n = [...designs]; n[i] = { ...d, url: e.target.value }; set({ designs: n }); }} />
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => set({ designs: designs.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" onClick={() => set({ designs: [...designs, { title: '', url: '' }] })}><Plus size={13} /> Agregar link</button>
          </div>

          <div className="input-group">
            <label>Color de marca (acento del portal)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="color" value={c.brand?.primary || '#6366f1'} onChange={e => set({ brand: { ...c.brand, primary: e.target.value } })} style={{ width: 44, height: 34, border: 'none', background: 'none', cursor: 'pointer' }} />
              <input className="input" style={{ flex: 1 }} placeholder="URL del logo del cliente" value={c.brand?.logoUrl || ''} onChange={e => set({ brand: { ...c.brand, logoUrl: e.target.value } })} />
            </div>
          </div>

          <div className="input-group">
            <label>Secciones visibles</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SECTIONS.map(s => {
                const on = sections[s.key] !== false;
                return (
                  <button key={s.key} className="ig-badge" style={{ cursor: 'pointer', border: 'none', background: on ? 'var(--primary)' : 'var(--bg-hover)', color: on ? '#fff' : 'var(--text-muted)' }}
                    onClick={() => set({ sections: { ...sections, [s.key]: !on } })}>
                    {on && <Check size={11} style={{ marginRight: 4, verticalAlign: '-1px' }} />}{s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {phases.length > 0 && (
            <div className="input-group">
              <label>Fases que ve el cliente (podés renombrarlas u ocultarlas)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {phases.map(name => {
                  const p = phaseLabels[name] || {};
                  return (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input className="input" style={{ flex: 1, opacity: p.hidden ? 0.5 : 1 }} placeholder={name}
                        value={p.label ?? ''} onChange={e => setPhase(name, { label: e.target.value })} disabled={!!p.hidden} />
                      <button className="btn btn-ghost btn-icon btn-sm" title={p.hidden ? 'Mostrar al cliente' : 'Ocultar al cliente'}
                        onClick={() => setPhase(name, { hidden: !p.hidden })}>
                        {p.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                El texto gris de cada campo es el nombre real en tu onboarding. Dejalo vacío para mostrarlo tal cual, o escribí uno nuevo para el cliente.
              </p>
            </div>
          )}

          <div className="input-group">
            <label>PIN de acceso (opcional, extra seguridad además del link)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {portal.pin ? (
                <>
                  <span className="ig-badge soft" style={{ background: 'var(--bg-hover)', fontFamily: 'monospace', fontSize: 15, letterSpacing: 2, padding: '6px 12px' }}>{portal.pin}</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => onSetPin(String(Math.floor(100000 + Math.random() * 900000)))}><Shuffle size={13} /> Generar otro</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => onSetPin(null)}>Quitar</button>
                </>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={() => onSetPin(String(Math.floor(100000 + Math.random() * 900000)))}><Lock size={13} /> Activar PIN</button>
              )}
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '6px 0 0' }}>Se lo pasás al cliente aparte del link (ej. por WhatsApp).</p>
          </div>

          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', color: 'var(--warning)' }} onClick={onRegen}>
            <RefreshCw size={13} /> Regenerar link (el actual deja de andar)
          </button>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave(c)}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Correcciones (bandeja de tickets que sube el cliente, con captura) ───
function TicketsModal({ portal, clientName, onClose }: { portal: ClientPortal; clientName: string; onClose: () => void }) {
  const { tickets, update } = usePortalTickets(portal.id);
  const { boards, createCard } = useTasks();

  const createTask = async (t: PortalTicket) => {
    const board = boards[0];
    if (!board) { toast('Creá primero un tablero en Tasks', 'error'); return; }
    const firstCol = [...board.columns].sort((a, b) => a.order - b.order)[0];
    const id = await createCard({
      boardId: board.id, columnId: firstCol.id, title: t.title, description: t.description,
      assignedTo: [], priority: 'medium', dueDate: null, tags: ['portal'],
      clientId: portal.clientId, portalVisible: false,
    });
    if (id) { await update(t.id, { taskId: id }); toast('Tarea creada en ' + board.name); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Correcciones — {clientName}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '6px 0 16px' }}>Lo que el cliente reporta desde su portal, con captura si adjuntó.</p>

        {tickets.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Todavía no hay correcciones reportadas.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {tickets.map(t => (
              <TicketRow key={t.id} ticket={t} onUpdate={patch => update(t.id, patch)} onCreateTask={() => createTask(t)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TicketRow({ ticket, onUpdate, onCreateTask }: { ticket: PortalTicket; onUpdate: (p: Partial<PortalTicket>) => void; onCreateTask: () => void }) {
  const [reply, setReply] = useState(ticket.reply || '');
  const [shotUrl, setShotUrl] = useState<string | null>(null);
  const st = TICKET_STATUS.find(s => s.key === ticket.status) || TICKET_STATUS[0];

  useEffect(() => {
    let on = true;
    if (ticket.screenshotPath) portalUploadSignedUrl(ticket.screenshotPath).then(u => { if (on) setShotUrl(u); });
    return () => { on = false; };
  }, [ticket.screenshotPath]);

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <strong style={{ fontSize: 14.5 }}>{ticket.title}</strong>
        <span className="ig-badge soft" style={{ background: `${st.color}22`, color: st.color, flexShrink: 0 }}>{st.label}</span>
      </div>
      {ticket.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{ticket.description}</p>}
      {ticket.screenshotPath && (
        shotUrl
          ? <a href={shotUrl} target="_blank" rel="noreferrer"><img src={shotUrl} alt="captura" style={{ maxHeight: 130, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 10 }} /></a>
          : <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}><ImageIcon size={14} /> Cargando captura…</div>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{fmt(ticket.createdAt)} · {fmtRel(ticket.createdAt)}</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        {TICKET_STATUS.map(s => (
          <button key={s.key} className="ig-badge" style={{ cursor: 'pointer', border: 'none', background: ticket.status === s.key ? s.color : 'var(--bg-hover)', color: ticket.status === s.key ? '#fff' : 'var(--text-muted)' }}
            onClick={() => onUpdate({ status: s.key })}>{s.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <input className="input" style={{ flex: 1 }} placeholder="Responderle al cliente…" value={reply} onChange={e => setReply(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && reply.trim() !== (ticket.reply || '') && onUpdate({ reply: reply.trim() })} />
        <button className="btn btn-secondary btn-sm" onClick={() => onUpdate({ reply: reply.trim() })}><CheckCircle2 size={13} /> Guardar</button>
      </div>

      <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={onCreateTask} disabled={!!ticket.taskId}>
        <ListPlus size={13} /> {ticket.taskId ? 'Ya tiene una tarea creada' : 'Crear Task'}
      </button>
    </div>
  );
}
