import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Proposal } from './utils';

type DeckSlide = { kind: 'portada' | 'diagnostico' | 'seccion' | 'inversion' | 'cierre'; idx?: number };

function buildSlides(p: Proposal): DeckSlide[] {
  const s: DeckSlide[] = [{ kind: 'portada' }, { kind: 'diagnostico' }];
  (p.secciones || []).forEach((_, idx) => s.push({ kind: 'seccion', idx }));
  if (p.inversion && (p.inversion.texto || (p.inversion.items || []).length > 0)) s.push({ kind: 'inversion' });
  s.push({ kind: 'cierre' });
  return s;
}

// Deck de la propuesta. Si recibe onClose muestra la X (uso dentro del dashboard);
// sin onClose es un visor a pantalla completa (link público para el prospecto).
export default function ProposalDeck({ proposal, onClose }: { proposal: Proposal; onClose?: () => void }) {
  const slides = buildSlides(proposal);
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

  const s = slides[i];
  return (
    <div className="deck-overlay" onClick={() => go(1)}>
      <div className="deck-progress"><div style={{ width: `${((i + 1) / slides.length) * 100}%` }} /></div>
      {onClose && <button className="deck-close" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Cerrar"><X size={20} /></button>}

      <div className="deck-stage" onClick={e => e.stopPropagation()}>
        {s.kind === 'portada' && (
          <div className="deck-slide deck-cover">
            <div className="deck-logo-mark">M</div>
            <div className="deck-eyebrow">{proposal.subtitulo || 'Propuesta de valor'}</div>
            <h1>{proposal.cliente}</h1>
            <div className="deck-by">Presentado por <strong>MYB Digitals</strong> · soluciones digitales</div>
          </div>
        )}
        {s.kind === 'diagnostico' && (
          <div className="deck-slide">
            <div className="deck-eyebrow"><span className="deck-tick" />Diagnóstico</div>
            <h2>Lo que necesita {proposal.cliente}</h2>
            <p className="deck-lead">{proposal.diagnostico?.texto}</p>
            <div className="deck-pillars">
              {(proposal.diagnostico?.pilares || []).map((p, k) => (
                <div key={k} className="deck-pillar"><span>{String(k + 1).padStart(2, '0')}</span>{p}</div>
              ))}
            </div>
          </div>
        )}
        {s.kind === 'seccion' && (() => {
          const sec = proposal.secciones[s.idx!];
          return (
            <div className="deck-slide deck-section">
              <div className="deck-num">{String(s.idx! + 1).padStart(2, '0')}</div>
              <div className="deck-section-body">
                <div className="deck-eyebrow"><span className="deck-tick" />Solución</div>
                <h2>{sec.titulo}</h2>
                <div className="deck-cols">
                  <ul className="deck-bullets">{(sec.bullets || []).map((b, k) => <li key={k}>{b}</li>)}</ul>
                  <p className="deck-desc">{sec.descripcion}</p>
                </div>
              </div>
            </div>
          );
        })()}
        {s.kind === 'inversion' && (
          <div className="deck-slide">
            <div className="deck-eyebrow"><span className="deck-tick" />Inversión</div>
            <h2>Inversión</h2>
            <p className="deck-lead">{proposal.inversion?.texto}</p>
            {(proposal.inversion?.items || []).length > 0 && (
              <ul className="deck-bullets" style={{ maxWidth: 620, marginTop: 18 }}>{proposal.inversion!.items.map((it, k) => <li key={k}>{it}</li>)}</ul>
            )}
          </div>
        )}
        {s.kind === 'cierre' && (
          <div className="deck-slide deck-cover">
            <div className="deck-eyebrow">Próximos pasos</div>
            <h2 style={{ maxWidth: 820 }}>{proposal.proximosPasos}</h2>
            <div className="deck-by">Gracias · <strong>MYB Digitals</strong></div>
          </div>
        )}
      </div>

      <div className="deck-footer" onClick={e => e.stopPropagation()}>
        <span className="deck-foot-brand"><span className="deck-logo-mini">M</span> MYB Digitals</span>
        <span className="deck-foot-client">{proposal.cliente}</span>
        <div className="deck-nav">
          <button className="btn btn-ghost btn-icon" onClick={() => go(-1)} disabled={i === 0}><ChevronLeft size={18} /></button>
          <span>{i + 1} / {slides.length}</span>
          <button className="btn btn-ghost btn-icon" onClick={() => go(1)} disabled={i === slides.length - 1}><ChevronRight size={18} /></button>
        </div>
      </div>
    </div>
  );
}
