// Biblioteca de ganchos y frameworks.
//
// Es material de consulta mientras se escribe: fórmulas de hook, mecánicas visuales,
// la matriz de dolor/ganancia por escalón de consciencia, niveles de sofisticación
// y el checklist de producción. Todo copiable con un click.
import { useState } from 'react';
import { Copy, Check, Search } from 'lucide-react';
import { AWARENESS_LEVELS } from './utils';
import {
  HOOK_LAYERS, HOOK_FORMULAS, VISUAL_HOOKS, SOPHISTICATION, DRIVER_LOGIC,
  NARRATIVES, CTAS, PRODUCTION_CHECKS,
} from './hooks-data';

type Sec = 'formulas' | 'capas' | 'matriz' | 'visual' | 'narrativa' | 'cta' | 'sofisticacion' | 'checklist';
const SECTIONS: { k: Sec; label: string }[] = [
  { k: 'formulas', label: 'Fórmulas de hook' },
  { k: 'capas', label: 'Las 3 capas' },
  { k: 'matriz', label: 'Dolor / Ganancia' },
  { k: 'visual', label: 'Hooks visuales' },
  { k: 'narrativa', label: 'Formatos narrativos' },
  { k: 'cta', label: 'CTAs' },
  { k: 'sofisticacion', label: 'Sofisticación' },
  { k: 'checklist', label: 'Checklist' },
];

const DRIVER_COLOR = { dolor: '#ef4444', ganancia: '#10b981', curiosidad: '#a855f7' } as const;
const DRIVER_LABEL = { dolor: 'Dolor', ganancia: 'Ganancia', curiosidad: 'Curiosidad' } as const;

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="gh-copy" title="Copiar" onClick={() => {
      navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1400);
    }}>
      {ok ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

export default function Ganchos() {
  const [sec, setSec] = useState<Sec>('formulas');
  const [q, setQ] = useState('');
  const [driver, setDriver] = useState<'todos' | 'dolor' | 'ganancia' | 'curiosidad'>('todos');

  const formulas = HOOK_FORMULAS.filter(f => {
    if (driver !== 'todos' && f.driver !== driver) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return f.label.toLowerCase().includes(s) || f.template.toLowerCase().includes(s) || f.example.toLowerCase().includes(s);
  });

  return (
    <div className="ig-card">
      <div className="ig-card-head">
        <div><p className="ig-eyebrow">Material de consulta</p><h3>Ganchos y frameworks</h3></div>
      </div>

      <div className="gh-tabs">
        {SECTIONS.map(s => (
          <button key={s.k} className={sec === s.k ? 'active' : ''} onClick={() => setSec(s.k)}>{s.label}</button>
        ))}
      </div>

      {sec === 'formulas' && (
        <>
          <div className="gh-filters">
            <div className="gh-search">
              <Search size={14} />
              <input className="input" placeholder="Buscar fórmula…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div className="gh-driver-filter">
              {(['todos', 'dolor', 'ganancia', 'curiosidad'] as const).map(d => (
                <button key={d} className={driver === d ? 'active' : ''} onClick={() => setDriver(d)}
                  style={driver === d && d !== 'todos' ? { borderColor: DRIVER_COLOR[d], color: DRIVER_COLOR[d] } : undefined}>
                  {d === 'todos' ? 'Todas' : DRIVER_LABEL[d]}
                </button>
              ))}
            </div>
          </div>
          <div className="gh-grid">
            {formulas.map(f => (
              <div key={f.key} className="gh-card">
                <div className="gh-card-head">
                  <h4>{f.label}</h4>
                  <span className="gh-driver" style={{ background: DRIVER_COLOR[f.driver] }}>{DRIVER_LABEL[f.driver]}</span>
                </div>
                <div className="gh-template">
                  <code>{f.template}</code>
                  <CopyBtn text={f.template} />
                </div>
                <p className="gh-when">{f.when}</p>
                <div className="gh-example">
                  <span>Ejemplo</span>
                  <p>{f.example}</p>
                  <CopyBtn text={f.example} />
                </div>
              </div>
            ))}
            {formulas.length === 0 && <div className="ig-empty-inline">Sin resultados para "{q}".</div>}
          </div>
        </>
      )}

      {sec === 'capas' && (
        <>
          <div className="ig-notice">
            El 85% mira sin sonido. Si las tres capas no dicen lo <b>mismo</b>, la primera capa se pierde
            y el video arranca ya perdido.
          </div>
          <div className="gh-layers">
            {HOOK_LAYERS.map(l => (
              <div key={l.key} className="gh-layer">
                <span className="gh-layer-icon">{l.icon}</span>
                <h4>{l.label}</h4>
                <p className="gh-layer-what">{l.what}</p>
                <p className="gh-layer-rule">{l.rule}</p>
              </div>
            ))}
          </div>
          <div className="gh-order">
            <p className="ig-eyebrow">Orden en que el cerebro procesa</p>
            <div className="gh-order-steps">
              <span>1. Ve el visual</span><span>→</span><span>2. Lee el texto</span><span>→</span><span>3. Procesa el audio</span>
            </div>
            <p className="gh-order-note">Por eso el visual tiene que frenar el scroll solo, sin ayuda del resto.</p>
          </div>
        </>
      )}

      {sec === 'matriz' && (
        <>
          <div className="ig-notice">
            <b>Regla base:</b> el dolor mueve al que <b>no sabe</b> que tiene un problema.
            La ganancia mueve al que <b>ya está buscando</b> solución.
          </div>
          <div className="gh-ladder">
            {AWARENESS_LEVELS.map(a => (
              <div key={a.key} className="gh-step" style={{ borderLeftColor: a.driver === 'dolor' ? '#ef4444' : '#10b981' }}>
                <div className="gh-step-head">
                  <span className="gh-step-n">{a.step}</span>
                  <h4>{a.label}</h4>
                  <span className="gh-driver" style={{ background: DRIVER_COLOR[a.driver] }}>{DRIVER_LABEL[a.driver]}</span>
                </div>
                <p>{a.hint}</p>
              </div>
            ))}
          </div>
          <div className="gh-drivers">
            {DRIVER_LOGIC.map(d => (
              <div key={d.desire} className="gh-desire">
                <h4>{d.desire}</h4>
                <div className="gh-desire-cols">
                  <div className="gh-desire-col dolor">
                    <span>🔴 Dolor · evitar</span>
                    <ul>{d.dolor.map((x, i) => <li key={i}>{x}<CopyBtn text={x} /></li>)}</ul>
                  </div>
                  <div className="gh-desire-col ganancia">
                    <span>🟢 Ganancia · lograr</span>
                    <ul>{d.ganancia.map((x, i) => <li key={i}>{x}<CopyBtn text={x} /></li>)}</ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {sec === 'visual' && (
        <div className="gh-visual">
          {VISUAL_HOOKS.map(g => (
            <div key={g.category} className="gh-visual-group">
              <h4>{g.category}</h4>
              <div className="gh-chips">
                {g.items.map((x, i) => <span key={i} className="gh-chip">{x}<CopyBtn text={x} /></span>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {sec === 'narrativa' && (
        <div className="gh-grid">
          {NARRATIVES.map(n => (
            <div key={n.key} className="gh-card">
              <div className="gh-card-head">
                <h4>{n.label}</h4>
                <span className="gh-driver" style={{ background: n.kind === 'educativo' ? '#6366f1' : '#f59e0b' }}>
                  {n.kind === 'educativo' ? 'Educativo' : 'Storytelling'}
                </span>
              </div>
              <ol className="gh-steps">
                {n.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
          ))}
        </div>
      )}

      {sec === 'cta' && (
        <>
          <div className="ig-notice">Un solo CTA por pieza. Tres pedidos a la vez es cero pedidos.</div>
          {(['leads', 'interaccion', 'seguir'] as const).map(cat => (
            <div key={cat} className="gh-cta-group">
              <h4>{cat === 'leads' ? 'Para conseguir leads' : cat === 'interaccion' ? 'Para generar interacción' : 'Para sumar seguidores'}</h4>
              {CTAS.filter(c => c.category === cat).map((c, i) => (
                <div key={i} className="gh-cta">
                  <div className="gh-cta-main">
                    <strong>{c.label}</strong>
                    <p>{c.text}</p>
                  </div>
                  <span className="gh-cta-when">{c.when}</span>
                  <CopyBtn text={c.text} />
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {sec === 'sofisticacion' && (
        <>
          <div className="ig-notice">
            Cuanto más gastado está el mercado, más abajo estás: prometer el resultado ya no alcanza
            y hay que trabajar el <b>cómo</b> o directamente la <b>identidad</b> del que mira.
          </div>
          <div className="gh-soph">
            {SOPHISTICATION.map(s => (
              <div key={s.level} className="gh-soph-row">
                <span className="gh-soph-n">{s.level}</span>
                <div>
                  <h4>{s.label}</h4>
                  <p className="gh-soph-claim">{s.claim}</p>
                  <p className="gh-soph-signal"><b>Señal:</b> {s.signal}</p>
                  <p className="gh-soph-angle"><b>Qué hacer:</b> {s.angle}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {sec === 'checklist' && (
        <div className="gh-checks">
          {PRODUCTION_CHECKS.map(p => (
            <div key={p.phase} className="gh-check-group">
              <h4>{p.phase}</h4>
              <ul>{p.items.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
