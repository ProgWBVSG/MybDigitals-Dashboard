import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Play, MessageCircle } from 'lucide-react';
import type { Proposal, Brand } from './utils';
import { toEmbed } from './embed';

type DeckSlide = { kind: 'portada' | 'video' | 'diagnostico' | 'seccion' | 'prueba' | 'inversion' | 'cierre'; idx?: number };

function buildSlides(p: Proposal, b: Brand): DeckSlide[] {
  const s: DeckSlide[] = [{ kind: 'portada' }];
  if (b.videoUrl) s.push({ kind: 'video' });
  s.push({ kind: 'diagnostico' });
  (p.secciones || []).forEach((_, idx) => s.push({ kind: 'seccion', idx }));
  const hayPrueba = (b.metricas || []).length > 0 || (b.testimonios || []).length > 0;
  if (hayPrueba) s.push({ kind: 'prueba' });
  if (p.inversion && (p.inversion.texto || (p.inversion.items || []).length > 0)) s.push({ kind: 'inversion' });
  s.push({ kind: 'cierre' });
  return s;
}

// Deck de la propuesta, temable con la marca del cliente. Con onClose muestra la X
// (uso dentro del dashboard); sin onClose es el visor a pantalla completa (link público).
export default function ProposalDeck({ proposal, brand, onClose }: { proposal: Proposal; brand?: Brand; onClose?: () => void }) {
  const b: Brand = brand || {};
  const slides = buildSlides(proposal, b);
  const [i, setI] = useState(0);
  const go = (d: number) => setI(v => Math.max(0, Math.min(slides.length - 1, v + d)));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  const themeVars = {
    '--dp': b.primary || '#6366f1',
    '--ds': b.secondary || '#10b981',
  } as React.CSSProperties;

  const s = slides[i];
  const waCTA = (b.waMyb || '').replace(/[^\d]/g, '');
  const waHref = waCTA ? `https://wa.me/${waCTA}?text=${encodeURIComponent(`Hola MYB Digitals! Vi la propuesta para ${proposal.cliente} y quiero avanzar.`)}` : '';

  const Logo = () => b.logoUrl
    ? <img className="deck-logo-img" src={b.logoUrl} alt="logo" />
    : <div className="deck-logo-mark">M</div>;

  return (
    <div className="deck-overlay" style={themeVars} onClick={() => go(1)} data-key={i}>
      {/* Fondo ambiente: esporas/círculos difuminados, temados con la marca */}
      <div className="deck-aura" aria-hidden="true">
        <span className="deck-blob b1" /><span className="deck-blob b2" /><span className="deck-blob b3" /><span className="deck-blob b4" />
      </div>
      <div className="deck-progress"><div style={{ width: `${((i + 1) / slides.length) * 100}%` }} /></div>
      {onClose && <button className="deck-close" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Cerrar"><X size={20} /></button>}

      <div className="deck-stage" onClick={e => e.stopPropagation()}>
        {s.kind === 'portada' && (
          <div className={`deck-slide deck-cover${b.coverUrl ? ' has-cover' : ''}`} key={`s${i}`}>
            {b.coverUrl && <div className="deck-cover-bg" style={{ backgroundImage: `url(${b.coverUrl})` }} />}
            <div className="deck-cover-inner">
              <Logo />
              <div className="deck-eyebrow deck-center">{proposal.subtitulo || 'Propuesta de valor'}</div>
              <h1>{proposal.cliente}</h1>
              <div className="deck-by">Presentado por <strong>MYB Digitals</strong> · soluciones digitales</div>
            </div>
          </div>
        )}

        {s.kind === 'video' && (
          <div className="deck-slide" key={`s${i}`}>
            <div className="deck-eyebrow"><span className="deck-tick" />Un mensaje para vos</div>
            <h2 style={{ marginBottom: 18 }}>Te grabamos esto a medida</h2>
            <div className="deck-video"><iframe src={toEmbed(b.videoUrl!)} allow="fullscreen" title="video" /></div>
          </div>
        )}

        {s.kind === 'diagnostico' && (
          <div className="deck-slide" key={`s${i}`}>
            <div className="deck-eyebrow"><span className="deck-tick" />Diagnóstico</div>
            <h2>Lo que necesita {proposal.cliente}</h2>
            <p className="deck-lead">{proposal.diagnostico?.texto}</p>
            <div className="deck-pillars">
              {(proposal.diagnostico?.pilares || []).map((p, k) => (
                <div key={k} className="deck-pillar reveal" style={{ animationDelay: `${0.1 + k * 0.08}s` }}>
                  <span>{String(k + 1).padStart(2, '0')}</span>{p}
                </div>
              ))}
            </div>
          </div>
        )}

        {s.kind === 'seccion' && (() => {
          const sec = proposal.secciones[s.idx!];
          const img = b.sectionImages?.[s.idx!];
          return (
            <div className={`deck-slide deck-section${img ? ' has-img' : ''}`} key={`s${i}`}>
              {img && <div className="deck-sec-img" style={{ backgroundImage: `url(${img})` }} />}
              <div className="deck-section-body">
                <div className="deck-eyebrow"><span className="deck-tick" />Solución {String(s.idx! + 1).padStart(2, '0')}</div>
                <h2>{sec.titulo}</h2>
                {sec.descripcion && <p className="deck-lead deck-sec-desc">{sec.descripcion}</p>}
                <ul className="deck-bullets">
                  {(sec.bullets || []).map((bl, k) => (
                    <li key={k} className="reveal" style={{ animationDelay: `${0.1 + k * 0.07}s` }}>{bl}</li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })()}

        {s.kind === 'prueba' && (
          <div className="deck-slide" key={`s${i}`}>
            <div className="deck-eyebrow"><span className="deck-tick" />Por qué confiar en nosotros</div>
            <h2>Respaldo real</h2>
            {(b.metricas || []).length > 0 && (
              <div className="deck-metrics">
                {b.metricas!.map((m, k) => (
                  <div key={k} className="deck-metric reveal" style={{ animationDelay: `${0.1 + k * 0.09}s` }}>
                    <div className="deck-metric-val">{m.valor}</div>
                    <div className="deck-metric-lbl">{m.label}</div>
                  </div>
                ))}
              </div>
            )}
            {(b.testimonios || []).length > 0 && (
              <div className="deck-quotes">
                {b.testimonios!.map((t, k) => (
                  <figure key={k} className="deck-quote reveal" style={{ animationDelay: `${0.2 + k * 0.1}s` }}>
                    <blockquote>“{t.texto}”</blockquote>
                    <figcaption>— {t.autor}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        )}

        {s.kind === 'inversion' && (
          <div className="deck-slide" key={`s${i}`}>
            <div className="deck-eyebrow"><span className="deck-tick" />Inversión</div>
            <h2>Inversión</h2>
            <p className="deck-lead">{proposal.inversion?.texto}</p>
            {(proposal.inversion?.items || []).length > 0 && (
              <ul className="deck-bullets" style={{ maxWidth: 620, marginTop: 22 }}>
                {proposal.inversion!.items.map((it, k) => <li key={k}>{it}</li>)}
              </ul>
            )}
          </div>
        )}

        {s.kind === 'cierre' && (
          <div className="deck-slide deck-cover deck-closing" key={`s${i}`}>
            <div className="deck-cover-inner">
              <div className="deck-eyebrow deck-center">Próximos pasos</div>
              <h2>Hagamos crecer a {proposal.cliente}</h2>
              <p className="deck-lead deck-center-text">{proposal.proximosPasos}</p>
              {waHref && (
                <a className="deck-cta" href={waHref} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                  <MessageCircle size={20} /> Quiero avanzar
                </a>
              )}
              <div className="deck-by" style={{ marginTop: 26 }}>Gracias · <strong>MYB Digitals</strong></div>
            </div>
          </div>
        )}
      </div>

      <div className="deck-footer" onClick={e => e.stopPropagation()}>
        <span className="deck-foot-brand"><span className="deck-logo-mini">{b.logoUrl ? <img src={b.logoUrl} alt="" /> : 'M'}</span> MYB Digitals</span>
        <span className="deck-foot-client">{proposal.cliente}</span>
        <div className="deck-nav">
          <button className="btn btn-ghost btn-icon" onClick={() => go(-1)} disabled={i === 0}><ChevronLeft size={18} /></button>
          <span>{i + 1} / {slides.length}</span>
          <button className="btn btn-ghost btn-icon" onClick={() => go(1)} disabled={i === slides.length - 1}><ChevronRight size={18} /></button>
        </div>
      </div>

      {/* hint sutil de avance en la portada */}
      {i === 0 && <div className="deck-hint"><Play size={12} /> Tocá o usá las flechas para avanzar</div>}
    </div>
  );
}
