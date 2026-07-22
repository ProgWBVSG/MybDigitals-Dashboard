import { useState, useMemo } from 'react';
import {
  DoorOpen, Plus, Copy, ExternalLink, Pencil, Trash2, RefreshCw, Power, X, Check, Megaphone,
} from 'lucide-react';
import { usePortals, useClients, useOnboardings, usePortalUpdates, toast } from './hooks';
import { supabase } from './supabase';
import { DOMAIN_STATUS_LABELS, fmt, fmtRel, type ClientPortal, type PortalConfig, type DomainStatus, type Brand } from './utils';

const portalLink = (token: string) => `${window.location.origin}/?portal=${token}`;
const SECTIONS: { key: keyof NonNullable<PortalConfig['sections']>; label: string }[] = [
  { key: 'objetivos', label: 'Objetivos' }, { key: 'avance', label: 'Avance / ruta' },
  { key: 'actualizaciones', label: 'Novedades' }, { key: 'disenos', label: 'Archivos y diseños' },
  { key: 'tickets', label: 'Correcciones' },
];

export default function Portals() {
  const { portals, create, updateConfig, setEnabled, regenerateToken, remove } = usePortals();
  const { clients } = useClients();
  const { onboardings } = useOnboardings();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ClientPortal | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [updatesFor, setUpdatesFor] = useState<ClientPortal | null>(null);

  const clientName = (id: string | null) => clients.find(c => c.id === id)?.name || 'Cliente';

  const copy = (token: string) => { navigator.clipboard.writeText(portalLink(token)); toast('Link copiado'); };

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
                <strong>{clientName(p.clientId)}</strong>
                <span className="ig-badge soft" style={{ background: p.enabled ? '#10b98122' : '#64748b22', color: p.enabled ? '#10b981' : '#64748b' }}>
                  {p.enabled ? 'Activo' : 'Pausado'}
                </span>
              </div>
              <div className="strat-card-meta">{p.config.title || 'Portal del cliente'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => copy(p.token)}><Copy size={13} /> Copiar link</button>
                <a className="btn btn-ghost btn-sm" href={portalLink(p.token)} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Ver</a>
                <button className="btn btn-ghost btn-sm" onClick={() => setUpdatesFor(p)}><Megaphone size={13} /> Novedades</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}><Pencil size={13} /> Editar</button>
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
            const token = await create(clientId, { onboardingId, config });
            setCreating(false);
            if (token) { copy(token); }
          }}
        />
      )}

      {editing && (
        <EditModal
          portal={editing} clientName={clientName(editing.clientId)}
          onClose={() => setEditing(null)}
          onSave={async (config) => { await updateConfig(editing.id, config); setEditing(null); }}
          onRegen={async () => { const t = await regenerateToken(editing.id); if (t) copy(t); setEditing(null); }}
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
        <UpdatesModal portal={updatesFor} clientName={clientName(updatesFor.clientId)} onClose={() => setUpdatesFor(null)} />
      )}
    </div>
  );
}

// ─── Novedades (timeline que ve el cliente en su portal) ───
function UpdatesModal({ portal, clientName, onClose }: { portal: ClientPortal; clientName: string; onClose: () => void }) {
  const { updates, add, remove } = usePortalUpdates(portal.id);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const publish = async () => {
    if (!title.trim()) { toast('Ponele un título a la novedad', 'error'); return; }
    setBusy(true);
    await add(portal.id, title.trim(), body.trim());
    setBusy(false);
    setTitle(''); setBody('');
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
          <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={publish} disabled={busy}>
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

// ─── Editar config ───
function EditModal({ portal, clientName, onClose, onSave, onRegen }: {
  portal: ClientPortal; clientName: string;
  onClose: () => void; onSave: (c: PortalConfig) => void; onRegen: () => void;
}) {
  const [c, setC] = useState<PortalConfig>({ sections: {}, designs: [], ...portal.config });
  const set = (patch: Partial<PortalConfig>) => setC(prev => ({ ...prev, ...patch }));
  const sections = c.sections || {};
  const designs = c.designs || [];

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
