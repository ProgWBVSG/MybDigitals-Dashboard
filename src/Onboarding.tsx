import { useState, useMemo } from 'react';
import { Plus, Rocket, ArrowRight, Search, Users } from 'lucide-react';
import { useOnboardings, useClients, toast } from './hooks';
import { supabase } from './supabase';
import { getPlaybook } from './playbooks';
import OnboardingDetail from './OnboardingDetail';
import {
  SERVICE_TYPES, SERVICE_LABELS, SERVICE_AVAILABLE,
  ONBOARDING_STATUS_LABELS, ONBOARDING_STATUS_COLORS,
  onboardingProgress, onboardingNextStep,
  type ServiceType,
} from './utils';

export default function Onboarding() {
  const ob = useOnboardings();
  const { clients, create: createClient } = useClients();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const [search, setSearch] = useState('');

  // Wizard state
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [clientId, setClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [service, setService] = useState<ServiceType>('landing');
  const [creating, setCreating] = useState(false);

  const detail = detailId ? ob.onboardings.find(o => o.id === detailId) : null;

  const filtered = useMemo(() => {
    let list = [...ob.onboardings];
    if (search) list = list.filter(o => (o.clientName || '').toLowerCase().includes(search.toLowerCase()) || o.title.toLowerCase().includes(search.toLowerCase()));
    // Activos primero, después por más reciente
    return list.sort((a, b) => {
      const order = (s: string) => (s === 'active' ? 0 : s === 'paused' ? 1 : s === 'launched' ? 2 : 3);
      if (order(a.status) !== order(b.status)) return order(a.status) - order(b.status);
      return b.createdAt - a.createdAt;
    });
  }, [ob.onboardings, search]);

  const openWizard = () => {
    setClientMode(clients.length > 0 ? 'existing' : 'new');
    setClientId('');
    setNewClientName('');
    setService('landing');
    setWizard(true);
  };

  const handleCreate = async () => {
    if (!SERVICE_AVAILABLE[service]) { toast('Ese servicio todavía no tiene playbook', 'error'); return; }
    setCreating(true);
    try {
      let cid = clientId;
      let cname = clients.find(c => c.id === clientId)?.name || '';
      if (clientMode === 'new') {
        if (!newClientName.trim()) { toast('Poné el nombre del cliente', 'error'); setCreating(false); return; }
        const created = await createClient({
          name: newClientName.trim(),
          contact: { email: '', whatsapp: '', instagram: '' },
          status: 'active', projects: [], notes: [], totalRevenue: 0, totalRevenueUSD: 0,
        } as any);
        if (!created) { setCreating(false); return; }
        cid = created;
        cname = newClientName.trim();
      }
      if (!cid) { toast('Elegí un cliente', 'error'); setCreating(false); return; }

      const title = `${SERVICE_LABELS[service]} — ${cname}`;
      const newId = await ob.create(cid, service, title);
      setWizard(false);
      if (newId) {
        setDetailId(newId);
        // Crear las carpetas + documentos de Drive automáticamente (en segundo plano)
        const playbookDocs = getPlaybook(service)?.documents.map(d => ({ title: d.title, content: d.content })) || [];
        supabase.functions.invoke('create-drive-folders', { body: { clientName: cname, documents: playbookDocs } })
          .then(({ data, error }) => {
            if (!error && data?.ok) {
              ob.update(newId, { driveRootLink: data.link });
              toast('Carpetas de Drive creadas ✨');
            } else {
              toast('Onboarding creado. Podés crear las carpetas con el botón de Drive.', 'info');
            }
          })
          .catch(() => toast('Onboarding creado. Podés crear las carpetas con el botón de Drive.', 'info'));
      }
    } finally {
      setCreating(false);
    }
  };

  // ─── Vista detalle ───
  if (detail) {
    return (
      <OnboardingDetail
        onboarding={detail}
        onBack={() => setDetailId(null)}
        update={ob.update}
        updateStep={ob.updateStep}
        updatePayment={ob.updatePayment}
        updateDocument={ob.updateDocument}
        remove={async (id) => { await ob.remove(id); setDetailId(null); }}
      />
    );
  }

  // ─── Vista lista ───
  return (
    <div style={{ paddingBottom: 60 }}>
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
            <Search size={16} />
            <input placeholder="Buscar onboarding..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={openWizard}><Plus size={16} /> Nuevo Onboarding</button>
        </div>
      </div>

      {ob.loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Cargando…</p>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Rocket size={48} />
          <h3>Sin onboardings activos</h3>
          <p>Cada vez que cerrás un cliente, creá su onboarding y seguí la guía paso a paso.</p>
          <button className="btn btn-primary" onClick={openWizard}><Plus size={16} /> Crear el primero</button>
        </div>
      ) : (
        <div className="onb-grid">
          {filtered.map(o => {
            const pct = onboardingProgress(o.steps);
            const next = onboardingNextStep(o.steps);
            const pendingPay = o.payments.filter(p => !p.paid).length;
            return (
              <div key={o.id} className="card card-3d onb-card" onClick={() => setDetailId(o.id)}>
                <div className="onb-card-top">
                  <div>
                    <div className="onb-card-client">{o.clientName || 'Cliente'}</div>
                    <div className="onb-card-service">{SERVICE_LABELS[o.serviceType] || o.serviceType}</div>
                  </div>
                  <span className="badge" style={{ background: `${ONBOARDING_STATUS_COLORS[o.status]}22`, color: ONBOARDING_STATUS_COLORS[o.status] }}>
                    {ONBOARDING_STATUS_LABELS[o.status]}
                  </span>
                </div>

                {/* Progress */}
                <div className="onb-progress-wrap">
                  <div className="onb-progress-bar">
                    <div className="onb-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="onb-progress-pct">{pct}%</span>
                </div>

                {/* Next action */}
                <div className="onb-next">
                  <ArrowRight size={14} />
                  {next ? (
                    <span><span className="onb-next-label">Próximo:</span> {next.title}</span>
                  ) : (
                    <span style={{ color: 'var(--secondary)' }}>¡Todo completado! 🎉</span>
                  )}
                </div>

                {pendingPay > 0 && (
                  <div className="onb-paytag">{pendingPay} cobro{pendingPay > 1 ? 's' : ''} pendiente{pendingPay > 1 ? 's' : ''}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button className="btn-fab" onClick={openWizard}><Plus size={24} /></button>

      {/* Wizard */}
      {wizard && (
        <div className="modal-overlay" onClick={() => setWizard(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h2>Nuevo Onboarding</h2>

            {/* Cliente */}
            <div className="input-group">
              <label>Cliente</label>
              <div className="filters" style={{ marginBottom: 10 }}>
                <button className={`filter-chip ${clientMode === 'existing' ? 'active' : ''}`} onClick={() => setClientMode('existing')}>
                  <Users size={13} /> Existente
                </button>
                <button className={`filter-chip ${clientMode === 'new' ? 'active' : ''}`} onClick={() => setClientMode('new')}>
                  <Plus size={13} /> Nuevo
                </button>
              </div>
              {clientMode === 'existing' ? (
                <select className="select" value={clientId} onChange={e => setClientId(e.target.value)}>
                  <option value="" disabled>Elegir cliente…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : (
                <input className="input" value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Nombre / Empresa" autoFocus />
              )}
            </div>

            {/* Servicio */}
            <div className="input-group" style={{ marginTop: 18 }}>
              <label>Servicio</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {SERVICE_TYPES.map(s => {
                  const available = SERVICE_AVAILABLE[s];
                  return (
                    <button key={s} type="button" disabled={!available}
                      className={`onb-service-opt ${service === s ? 'active' : ''} ${!available ? 'disabled' : ''}`}
                      onClick={() => available && setService(s)}>
                      <Rocket size={16} />
                      <span>{SERVICE_LABELS[s]}</span>
                      {!available && <span className="onb-soon">Próximamente</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setWizard(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creando…' : 'Crear guía'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
