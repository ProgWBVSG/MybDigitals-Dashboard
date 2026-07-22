import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Home, FolderOpen, MessageCircle, Search, ExternalLink, ArrowUpRight, Globe,
  Paperclip, Send, X, ListChecks, CalendarClock,
} from 'lucide-react';
import { DOMAIN_STATUS_LABELS, type PortalBundle, type DomainStatus } from './utils';
import './portal.css';

// Visor PÚBLICO del Portal del Cliente: /?portal=TOKEN
// Pide el bundle curado a `client-portal` y lo dibuja con la marca del cliente. No tiene
// sesión ni acceso al dashboard. Las correcciones se mandan a `portal-ticket` (con captura
// opcional codificada en base64) — el cliente nunca toca Storage/DB directo.

const SERVICE_LABEL: Record<string, string> = {
  landing: 'tu landing', web_pro: 'tu sitio web', automation_ai: 'tu automatización con IA',
  own_product: 'el proyecto', consulting: 'la consultoría',
};
const DOMAIN_PILL: Record<DomainStatus, string> = {
  none: '#94a3b8', pending: '#f59e0b', purchased: '#3b82f6', pointed: '#8b5cf6', live: '#10b981',
};
const fmtShort = (ms: number) => new Date(ms).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).replace('.', '');
const fmtMonth = (ms: number) => new Date(ms).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '').toUpperCase();
const fmtDay = (ms: number) => new Date(ms).getDate();
const fmtRelDate = (ms: number) => new Date(ms).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');

async function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      resolve({ base64, mime: file.type || 'image/png' });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ClientPortalView({ token }: { token: string }) {
  const [bundle, setBundle] = useState<PortalBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsPin, setNeedsPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const pinRef = useRef(''); // el PIN ya verificado, para recargas silenciosas (sin re-loguear apertura)

  const base = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const fetchBundle = async (pin: string, logView: boolean) => {
    const res = await fetch(`${base}/functions/v1/client-portal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ token, pin, logView }),
    });
    return res.json().catch(() => ({ ok: false, error: 'Respuesta inválida' }));
  };

  // Primera carga: registra la apertura (una sola vez por visita, no en cada recarga silenciosa)
  useEffect(() => {
    fetchBundle('', true)
      .then(d => {
        if (d?.ok && d.bundle) { setBundle(d.bundle); setNeedsPin(false); }
        else if (d?.needsPin) setNeedsPin(true);
        else setError(d?.error || 'No pudimos abrir el portal.');
      })
      .catch(() => setError('No pudimos cargar el portal. Revisá tu conexión.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submitPin = async (pin: string) => {
    setPinBusy(true); setPinError(null);
    const d = await fetchBundle(pin, true).catch(() => null);
    setPinBusy(false);
    if (d?.ok && d.bundle) { pinRef.current = pin; setBundle(d.bundle); setNeedsPin(false); }
    else setPinError(d?.error || 'No se pudo verificar el PIN.');
  };

  // Recarga silenciosa (ej: después de mandar un ticket) — no vuelve a loguear la apertura
  const silentReload = () => {
    fetchBundle(pinRef.current, false).then(d => { if (d?.ok && d.bundle) setBundle(d.bundle); });
  };

  if (error) return <div className="cp"><div className="cp-center"><div><h1>Portal no disponible</h1><p>{error}</p></div></div></div>;
  if (needsPin) return <PinGate error={pinError} busy={pinBusy} onSubmit={submitPin} />;
  if (!bundle) return <div className="cp"><div className="cp-center"><p>Abriendo tu portal…</p></div></div>;

  return <PortalDashboard bundle={bundle} token={token} onSent={silentReload} />;
}

function PinGate({ error, busy, onSubmit }: { error: string | null; busy: boolean; onSubmit: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  return (
    <div className="cp"><div className="cp-center">
      <div style={{ width: '100%', maxWidth: 300 }}>
        <h1>Portal privado</h1>
        <p style={{ marginBottom: 18 }}>Ingresá el PIN que te compartió MYB Digitals para entrar.</p>
        <input
          className="cp-pin-input" type="tel" inputMode="numeric" autoFocus maxLength={8} value={pin}
          placeholder="• • • •" onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => e.key === 'Enter' && pin && onSubmit(pin)}
        />
        {error && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 10 }}>{error}</p>}
        <button className="cp-pin-btn" disabled={!pin || busy} onClick={() => onSubmit(pin)}>{busy ? 'Verificando…' : 'Entrar'}</button>
      </div>
    </div></div>
  );
}

function PortalDashboard({ bundle, token, onSent }: { bundle: PortalBundle; token: string; onSent: () => void }) {
  const { clientName, brand, config, phases, progress, tasks, setupSteps, updates, tickets, driveLink, serviceType, keyDates } = bundle;
  const sec = config.sections || {};
  const show = (k: keyof NonNullable<typeof config.sections>) => sec[k] !== false;
  const brandVars = { ['--cp-brand' as string]: brand.primary || '#6366f1' } as React.CSSProperties;
  const whatDesc = serviceType ? SERVICE_LABEL[serviceType] || 'tu proyecto' : 'tu proyecto';
  const domainStatus = (config.domainStatus || 'none') as DomainStatus;
  const currentPhase = phases.find(p => p.status === 'active');

  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const filteredTasks = q ? tasks.filter(t => t.title.toLowerCase().includes(q)) : tasks;
  const filteredUpdates = q ? updates.filter(u => `${u.title} ${u.body}`.toLowerCase().includes(q)) : updates;
  const filteredSetup = q ? setupSteps.filter(s => s.title.toLowerCase().includes(q)) : setupSteps;

  const refs = { top: useRef<HTMLDivElement>(null), timeline: useRef<HTMLDivElement>(null), chat: useRef<HTMLDivElement>(null), files: useRef<HTMLDivElement>(null) };
  const goTo = (key: keyof typeof refs) => refs[key].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const hasFiles = !!driveLink || (config.designs && config.designs.length > 0) || !!config.domain || !!config.liveUrl;

  return (
    <div className="cp" style={brandVars}>
      <div className="cp-shell">
        <nav className="cp-rail">
          {brand.logoUrl ? <img className="cp-rail-logo" src={brand.logoUrl} alt={clientName} /> : <div className="cp-rail-logo-txt">{initials(clientName)}</div>}
          <button className="cp-rail-btn active" title="Inicio" onClick={() => goTo('top')}><Home size={18} /></button>
          {show('avance') && <button className="cp-rail-btn" title="Tu avance" onClick={() => goTo('timeline')}><ListChecks size={18} /></button>}
          {show('tickets') && <button className="cp-rail-btn" title="Correcciones" onClick={() => goTo('chat')}><MessageCircle size={18} /></button>}
          {show('disenos') && hasFiles && <button className="cp-rail-btn" title="Archivos" onClick={() => goTo('files')}><FolderOpen size={18} /></button>}
          <div className="cp-rail-spacer" />
        </nav>

        <div className="cp-main" ref={refs.top}>
          <header className="cp-top cp-rise">
            <div className="cp-top-row">
              <div>
                <p className="cp-eyebrow">Hola de nuevo, <strong>{clientName.split(' ')[0]}</strong> — sigamos construyendo</p>
                <h1 className="cp-h1">Tu Portal del Proyecto</h1>
              </div>
              <div className="cp-search">
                <Search size={15} />
                <input placeholder="Buscar en tu proyecto…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <p className="cp-welcome">{config.welcome || `Este es el espacio donde vas a poder seguir de cerca cómo avanza ${whatDesc}. Lo actualizamos a medida que avanzamos, y acá también podés avisarnos cualquier cosa a corregir.`}</p>
            {show('objetivos') && config.objectives && (
              <p className="cp-welcome" style={{ marginTop: 8 }}><strong style={{ color: 'var(--cp-ink)' }}>Objetivo: </strong>{config.objectives}</p>
            )}
          </header>

          <div className="cp-grid">
            {/* columna izquierda: avance + primeros pasos */}
            <div className="cp-col">
              {show('avance') && (
                <div className="cp-card cp-rise" ref={refs.timeline} style={{ animationDelay: '0.05s' }}>
                  <div className="cp-card-head">
                    <span className="cp-card-title"><ListChecks size={16} /> Tu avance</span>
                    <div className="cp-ring">
                      <svg width="46" height="46"><circle className="cp-ring-track" cx="23" cy="23" r="19" /><circle className="cp-ring-val" cx="23" cy="23" r="19" strokeDasharray={119.4} strokeDashoffset={119.4 * (1 - progress / 100)} /></svg>
                      <span className="cp-ring-num">{progress}%</span>
                    </div>
                  </div>
                  {currentPhase && <span className="cp-phase-chip"><span className="dot" /> Ahora: {currentPhase.name}</span>}
                  {filteredTasks.length === 0 ? (
                    <p className="cp-empty-mini">{q ? 'Nada por acá con esa búsqueda.' : 'Todavía no hay tareas puntuales cargadas para vos.'}</p>
                  ) : (
                    <ul className="cp-list">
                      {filteredTasks.map((t, i) => (
                        <li key={i}>
                          <span className={`cp-check ${t.done ? 'on' : ''}`}>{t.done && <Check />}</span>
                          <span className={`cp-item-tt ${t.done ? 'done' : ''}`}>{t.title}</span>
                          {t.dueDate && !t.done && <span className="cp-item-due">{fmtShort(t.dueDate)}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {setupSteps.length > 0 && (
                <div className="cp-card cp-rise" style={{ animationDelay: '0.1s' }}>
                  <span className="cp-card-title" style={{ marginBottom: 16 }}><ListChecks size={16} /> Primeros pasos</span>
                  {filteredSetup.length === 0 && <p className="cp-empty-mini">Nada por acá con esa búsqueda.</p>}
                  <ul className="cp-list">
                    {filteredSetup.map((s, i) => (
                      <li key={i}>
                        <span className={`cp-check ${s.done ? 'on' : ''}`}>{s.done && <Check />}</span>
                        <span className={`cp-item-tt ${s.done ? 'done' : ''}`}>{s.title}</span>
                        {!s.done && <span className="cp-item-due" style={{ color: 'var(--cp-brand)', fontWeight: 700 }}>Te toca a vos</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* columna central: fechas clave + novedades + chat */}
            <div className="cp-col">
              {(keyDates.length > 0 || config.domain) && (
                <div className="cp-card cp-rise" style={{ animationDelay: '0.05s' }}>
                  <span className="cp-card-title" style={{ marginBottom: 16 }}><CalendarClock size={16} /> Fechas clave</span>
                  <div className="cp-dates">
                    {keyDates.map((d, i) => (
                      <div key={i} className="cp-date-row">
                        <div className="cp-date-badge"><b>{fmtDay(d.date)}</b><span>{fmtMonth(d.date)}</span></div>
                        <div><div className="cp-date-label">{d.label}</div><div className="cp-date-sub">{fmtRelDate(d.date)}</div></div>
                      </div>
                    ))}
                    {config.domain && (
                      <div className="cp-domain-row">
                        <Globe size={17} />
                        <span className="cp-date-label">{config.domain}</span>
                        <span className="cp-pill" style={{ background: `${DOMAIN_PILL[domainStatus]}22`, color: DOMAIN_PILL[domainStatus] }}>{DOMAIN_STATUS_LABELS[domainStatus]}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {show('actualizaciones') && filteredUpdates.length > 0 && (
                <div className="cp-card cp-rise" style={{ animationDelay: '0.1s' }}>
                  <span className="cp-card-title" style={{ marginBottom: 16 }}>📣 Novedades</span>
                  <ul className="cp-list" style={{ gap: 10 }}>
                    {filteredUpdates.slice(0, 5).map((u, i) => (
                      <li key={i} style={{ display: 'block', padding: '9px 6px' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{u.title}</div>
                        {u.body && <div style={{ fontSize: 12.5, color: 'var(--cp-sub)', marginTop: 2 }}>{u.body}</div>}
                        <div style={{ fontSize: 10.5, color: 'var(--cp-sub)', marginTop: 3 }}>{fmtRelDate(u.createdAt)}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {show('tickets') && (
                <div className="cp-card cp-chat cp-rise" ref={refs.chat} style={{ animationDelay: '0.15s' }}>
                  <span className="cp-card-title" style={{ marginBottom: 16 }}><MessageCircle size={16} /> Correcciones y errores</span>
                  <ChatThread tickets={tickets} clientName={clientName} token={token} onSent={onSent} />
                </div>
              )}
            </div>

            {/* columna derecha: archivos */}
            {show('disenos') && hasFiles && (
              <div className="cp-col" ref={refs.files}>
                <div className="cp-card cp-rise" style={{ animationDelay: '0.2s' }}>
                  <span className="cp-card-title" style={{ marginBottom: 10 }}><FolderOpen size={16} /> Tus archivos</span>
                  {driveLink && (
                    <a className="cp-file" href={driveLink} target="_blank" rel="noreferrer">
                      <span className="cp-file-ic"><FolderOpen size={16} /></span>
                      <span style={{ minWidth: 0 }}><div className="cp-file-tt">Carpeta del proyecto</div><div className="cp-file-sb">Drive</div></span>
                      <ArrowUpRight size={15} className="cp-file-arrow" />
                    </a>
                  )}
                  {(config.designs || []).map((d, i) => (
                    <a key={i} className="cp-file" href={d.url} target="_blank" rel="noreferrer">
                      <span className="cp-file-ic">🎨</span>
                      <span className="cp-file-tt">{d.title}</span>
                      <ArrowUpRight size={15} className="cp-file-arrow" />
                    </a>
                  ))}
                  {config.liveUrl && (
                    <a className="cp-live-btn" href={config.liveUrl} target="_blank" rel="noreferrer">Ver en vivo <ExternalLink size={15} /></a>
                  )}
                </div>
              </div>
            )}
          </div>

          <footer className="cp-foot">Hecho junto a <strong>MYB Digitals</strong></footer>
        </div>
      </div>
    </div>
  );
}

// ─── Chat de correcciones: lista de tickets como conversación + composer con captura ───
function ChatThread({ tickets, clientName, token, onSent }: {
  tickets: PortalBundle['tickets']; clientName: string; token: string; onSent: () => void;
}) {
  const [msg, setMsg] = useState('');
  const [attach, setAttach] = useState<{ file: File; preview: string } | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const ordered = useMemo(() => [...tickets].sort((a, b) => a.createdAt - b.createdAt), [tickets]);

  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight }); }, [ordered.length]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { alert('La imagen supera los 5 MB.'); return; }
    setAttach({ file: f, preview: URL.createObjectURL(f) });
  };

  const send = async () => {
    if (!msg.trim() || sending) return;
    setSending(true);
    const base = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    const screenshot = attach ? await fileToBase64(attach.file) : undefined;
    try {
      const res = await fetch(`${base}/functions/v1/portal-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({ token, title: msg.trim(), description: '', screenshot }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || 'Error');
      setMsg(''); setAttach(null); onSent();
    } catch {
      alert('No se pudo enviar. Probá de nuevo.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="cp-thread" ref={threadRef}>
        {ordered.length === 0 && <p className="cp-empty-mini">Si ves algo para ajustar, contanoslo acá abajo.</p>}
        {ordered.map(t => (
          <div key={t.id}>
            <div className="cp-bubble-row mine">
              <div className="cp-avatar" style={{ background: 'var(--cp-brand)' }}>{initials(clientName)}</div>
              <div className="cp-bubble">
                <div className="cp-bubble-text">{t.title}</div>
                {t.screenshotUrl && <img className="cp-bubble-img" src={t.screenshotUrl} alt="captura" />}
                <div className="cp-bubble-meta">{fmtRelDate(t.createdAt)}{t.status === 'resolved' && <span className="cp-status-chip" style={{ background: '#10b98122', color: '#10b981' }}>Resuelto</span>}</div>
              </div>
            </div>
            {t.reply && (
              <div className="cp-bubble-row" style={{ marginTop: 8 }}>
                <div className="cp-avatar" style={{ background: '#1e1f26' }}>M</div>
                <div className="cp-bubble"><div className="cp-bubble-text">{t.reply}</div></div>
              </div>
            )}
          </div>
        ))}
      </div>

      {attach && (
        <div className="cp-attach-preview">
          <img src={attach.preview} alt="" />
          <span>{attach.file.name}</span>
          <button onClick={() => setAttach(null)}><X size={13} /></button>
        </div>
      )}
      <div className="cp-composer">
        <button className="cp-composer-btn" title="Adjuntar captura" onClick={() => fileRef.current?.click()}><Paperclip size={16} /></button>
        <input type="file" accept="image/*" hidden ref={fileRef} onChange={onPickFile} />
        <input type="text" placeholder="Contanos qué encontraste…" value={msg} onChange={e => setMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()} />
        <button className="cp-composer-btn cp-composer-send" onClick={send} disabled={!msg.trim() || sending}><Send size={15} /></button>
      </div>
    </>
  );
}

function Check() {
  return <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2L4.8 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
