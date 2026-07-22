import { useState, useEffect } from 'react';
import { FolderOpen, ExternalLink, ArrowUpRight, Palette, Globe, MessageCircle } from 'lucide-react';
import { DOMAIN_STATUS_LABELS, type PortalBundle, type DomainStatus } from './utils';
import './portal.css';

// Visor PÚBLICO del Portal del Cliente: /?portal=TOKEN
// Pide el bundle curado a la función pública `client-portal` y lo dibuja con la marca del
// cliente. No tiene sesión ni acceso al dashboard, ni link hacia él.

const SERVICE_LABEL: Record<string, string> = {
  landing: 'tu landing', web_pro: 'tu sitio web', automation_ai: 'tu automatización con IA',
  own_product: 'el proyecto', consulting: 'la consultoría',
};

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}

const DOMAIN_PILL: Record<DomainStatus, string> = {
  none: '#94a3b8', pending: '#f59e0b', purchased: '#3b82f6', pointed: '#8b5cf6', live: '#10b981',
};

export default function ClientPortalView({ token }: { token: string }) {
  const [bundle, setBundle] = useState<PortalBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const base = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    fetch(`${base}/functions/v1/client-portal?token=${encodeURIComponent(token)}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
      .then(async r => {
        const d = await r.json().catch(() => ({ ok: false, error: 'Respuesta inválida' }));
        if (d?.ok && d.bundle) setBundle(d.bundle);
        else setError(d?.error || 'No pudimos abrir el portal.');
      })
      .catch(() => setError('No pudimos cargar el portal. Revisá tu conexión.'));
  }, [token]);

  if (error) return (
    <div className="cp"><div className="cp-center"><div>
      <h1>Portal no disponible</h1>
      <p>{error}</p>
    </div></div></div>
  );
  if (!bundle) return <div className="cp"><div className="cp-center"><p>Abriendo tu portal…</p></div></div>;

  const { clientName, brand, config, phases, progress, tasks, updates, driveLink, serviceType } = bundle;
  const sec = config.sections || {};
  const show = (k: keyof NonNullable<typeof config.sections>) => sec[k] !== false; // por defecto visible
  const brandVars = {
    ['--cp-brand' as string]: brand.primary || '#6366f1',
    ['--cp-brand-ink' as string]: '#ffffff',
  } as React.CSSProperties;
  const whatDesc = serviceType ? SERVICE_LABEL[serviceType] || 'tu proyecto' : 'tu proyecto';
  const domainStatus = (config.domainStatus || 'none') as DomainStatus;
  const hasFiles = !!driveLink || (config.designs && config.designs.length > 0) || !!config.domain || !!config.liveUrl;

  return (
    <div className="cp" style={brandVars}>
      <div className="cp-wrap">
        <div className="cp-top cp-rise">
          {brand.logoUrl ? <img className="cp-logo" src={brand.logoUrl} alt={clientName} /> : <span className="cp-logo-txt">{clientName}</span>}
          <span className="cp-top-tag">Portal privado</span>
        </div>

        {/* Hero */}
        <header className="cp-section cp-rise" style={{ animationDelay: '0.05s' }}>
          <p className="cp-eyebrow">Tu proyecto con MYB Digitals</p>
          <h1 className="cp-greet">Hola, {clientName.split(' ')[0]}.</h1>
          <p className="cp-lead">{config.welcome || `Este es el espacio donde vas a poder seguir de cerca cómo avanza ${whatDesc}. Lo actualizamos a medida que avanzamos.`}</p>
        </header>

        {/* Objetivo */}
        {show('objetivos') && config.objectives && (
          <section className="cp-section cp-rise" style={{ animationDelay: '0.1s' }}>
            <p className="cp-eyebrow">El objetivo</p>
            <div className="cp-quote"><p className="cp-body">{config.objectives}</p></div>
          </section>
        )}

        {/* La ruta del proyecto (firma) */}
        {show('avance') && phases.length > 0 && (
          <section className="cp-section cp-rise" style={{ animationDelay: '0.15s' }}>
            <div className="cp-ruta-head">
              <p className="cp-eyebrow" style={{ margin: 0 }}>La ruta de tu proyecto</p>
              <div className="cp-progress">{progress}<span>%</span></div>
            </div>
            <ul className="cp-ruta">
              {phases.map((p, i) => (
                <li key={i} className={`cp-phase ${p.status}`}>
                  <span className="cp-dot">{p.status === 'done' && <Check />}</span>
                  <div className="cp-phase-name">{p.name}</div>
                  <div className="cp-phase-meta">
                    {p.status === 'done' ? 'Listo' : p.status === 'active' ? 'En esto estamos ahora' : 'Por venir'}
                    {p.total > 0 && p.status !== 'pending' ? ` · ${p.done}/${p.total}` : ''}
                  </div>
                </li>
              ))}
            </ul>

            {tasks.length > 0 && (
              <div className="cp-next">
                <p className="cp-next-h">Lo que sigue</p>
                <ul>{tasks.map((t, i) => <li key={i}>{t.title}</li>)}</ul>
              </div>
            )}
          </section>
        )}

        {/* Novedades */}
        {show('actualizaciones') && updates.length > 0 && (
          <section className="cp-section cp-rise">
            <h2 className="cp-h">Novedades</h2>
            {updates.map((u, i) => (
              <div key={i} className="cp-update">
                <div className="cp-update-date">{fmtDate(u.createdAt)}</div>
                <h3 className="cp-update-title">{u.title}</h3>
                {u.body && <p className="cp-update-body">{u.body}</p>}
              </div>
            ))}
          </section>
        )}

        {/* Archivos y diseños */}
        {show('disenos') && hasFiles && (
          <section className="cp-section cp-rise">
            <h2 className="cp-h">Tus archivos y diseños</h2>
            <div className="cp-files">
              {driveLink && (
                <a className="cp-file" href={driveLink} target="_blank" rel="noreferrer">
                  <FolderOpen className="cp-file-ic" />
                  <span><span className="cp-file-tt">Carpeta del proyecto</span><br /><span className="cp-file-sb">Fotos, documentos y material en Drive</span></span>
                  <ArrowUpRight size={17} className="cp-file-arrow" />
                </a>
              )}
              {(config.designs || []).map((d, i) => (
                <a key={i} className="cp-file" href={d.url} target="_blank" rel="noreferrer">
                  <Palette className="cp-file-ic" />
                  <span className="cp-file-tt">{d.title}</span>
                  <ArrowUpRight size={17} className="cp-file-arrow" />
                </a>
              ))}
              {config.domain && (
                <div className="cp-domain">
                  <Globe size={18} style={{ color: 'var(--cp-brand)' }} />
                  <span className="cp-file-tt">{config.domain}</span>
                  <span className="cp-pill" style={{ background: `${DOMAIN_PILL[domainStatus]}22`, color: DOMAIN_PILL[domainStatus] }}>{DOMAIN_STATUS_LABELS[domainStatus]}</span>
                </div>
              )}
            </div>
            {config.liveUrl && (
              <div style={{ marginTop: 20 }}>
                <a className="cp-live" href={config.liveUrl} target="_blank" rel="noreferrer">Ver en vivo <ExternalLink size={17} /></a>
              </div>
            )}
          </section>
        )}

        {/* Correcciones (Fase 1: canal por WhatsApp; el formulario llega en la próxima fase) */}
        {brand.waMyb && (
          <section className="cp-section cp-rise">
            <div className="cp-fix">
              <h2 className="cp-h" style={{ marginBottom: 12 }}>¿Viste algo para corregir?</h2>
              <p>Contanos qué encontraste y lo resolvemos. Cuanto más claro (una captura ayuda), más rápido lo arreglamos.</p>
              <a className="cp-wa" href={`https://wa.me/${brand.waMyb.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                <MessageCircle size={17} /> Escribirnos por WhatsApp
              </a>
            </div>
          </section>
        )}

        <footer className="cp-foot">
          Hecho junto a <strong>MYB Digitals</strong>{config.domain ? <> · {config.domain}</> : null}
        </footer>
      </div>
    </div>
  );
}

// tilde del check en las fases completadas
function Check() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2L4.8 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
