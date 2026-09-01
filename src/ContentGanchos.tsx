// Biblioteca de ganchos y frameworks.
//
// Es material de consulta mientras se escribe: fórmulas de hook, mecánicas visuales,
// la matriz de dolor/ganancia por escalón de consciencia, niveles de sofisticación
// y el checklist de producción. Todo copiable con un click.
import { useState } from 'react';
import { Copy, Check, Search, Plus, Star, Trash2, Pencil, X } from 'lucide-react';
import { AWARENESS_LEVELS } from './utils';
import { useCustomHooks } from './hooks';
import {
  HOOK_LAYERS, HOOK_FORMULAS, VISUAL_HOOKS, SOPHISTICATION, DRIVER_LOGIC,
  NARRATIVES, CTAS, PRODUCTION_CHECKS,
} from './hooks-data';

type Sec = 'mios' | 'formulas' | 'capas' | 'matriz' | 'visual' | 'narrativa' | 'cta' | 'sofisticacion' | 'checklist';
const SECTIONS: { k: Sec; label: string }[] = [
  { k: 'mios', label: 'Mis ganchos ⭐' },
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

export default function Ganchos({ accountId = null, accountName }: { accountId?: string | null; accountName?: string }) {
  const [sec, setSec] = useState<Sec>('mios');
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

      {sec === 'mios' && <MisGanchos accountId={accountId} accountName={accountName} />}

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

// ─── Mis ganchos: banco propio por cuenta ───
type HookForm = { id?: string; text: string; driver: string; note: string; general: boolean };
const emptyHook = (): HookForm => ({ text: '', driver: 'curiosidad', note: '', general: false });

function MisGanchos({ accountId, accountName }: { accountId: string | null; accountName?: string }) {
  const { hooks, add, update, remove } = useCustomHooks(accountId);
  const [q, setQ] = useState('');
  const [driver, setDriver] = useState<'todos' | 'dolor' | 'ganancia' | 'curiosidad'>('todos');
  const [modal, setModal] = useState<HookForm | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const list = hooks.filter(h => {
    if (driver !== 'todos' && h.driver !== driver) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return h.text.toLowerCase().includes(s) || (h.note || '').toLowerCase().includes(s);
  });

  const save = async () => {
    if (!modal || !modal.text.trim()) return;
    const ok = modal.id
      ? await update(modal.id, { text: modal.text, driver: modal.driver, note: modal.note, accountId: modal.general ? null : accountId })
      : await add({ text: modal.text, driver: modal.driver, note: modal.note, general: modal.general });
    if (ok) setModal(null);
  };

  return (
    <>
      <div className="ig-notice">
        Guardá acá los ganchos que se te ocurren para reusar más adelante. Se guardan para
        <b> {accountName || 'esta cuenta'}</b>; marcá "para todas las cuentas" si querés que aparezca en todas.
      </div>

      <div className="gh-filters">
        <div className="gh-search">
          <Search size={14} />
          <input className="input" placeholder="Buscar en mis ganchos…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="gh-driver-filter">
          {(['todos', 'dolor', 'ganancia', 'curiosidad'] as const).map(d => (
            <button key={d} className={driver === d ? 'active' : ''} onClick={() => setDriver(d)}
              style={driver === d && d !== 'todos' ? { borderColor: DRIVER_COLOR[d], color: DRIVER_COLOR[d] } : undefined}>
              {d === 'todos' ? 'Todos' : DRIVER_LABEL[d]}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(emptyHook())}><Plus size={14} /> Nuevo gancho</button>
      </div>

      {list.length === 0 ? (
        <div className="ig-empty-inline">
          {q || driver !== 'todos' ? 'Sin resultados.' : 'Todavía no guardaste ganchos para esta cuenta. Tocá "Nuevo gancho".'}
        </div>
      ) : (
        <div className="gh-grid">
          {list.map(h => (
            <div key={h.id} className="gh-card">
              <div className="gh-card-head">
                <span className="gh-driver" style={{ background: DRIVER_COLOR[h.driver as keyof typeof DRIVER_COLOR] || '#64748b' }}>
                  {DRIVER_LABEL[h.driver as keyof typeof DRIVER_LABEL] || h.driver}
                </span>
                <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
                  {h.accountId === null && <span className="gh-general-tag" title="Sirve para todas las cuentas"><Star size={11} /> Todas</span>}
                  <button className="gh-copy" title="Editar" onClick={() => setModal({ id: h.id, text: h.text, driver: h.driver, note: h.note || '', general: h.accountId === null })}><Pencil size={13} /></button>
                  <button className="gh-copy" title="Borrar" onClick={() => setConfirm(h.id)}><Trash2 size={13} /></button>
                </div>
              </div>
              <div className="gh-template">
                <code>{h.text}</code>
                <CopyBtn text={h.text} />
              </div>
              {h.note && <p className="gh-when">{h.note}</p>}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>{modal.id ? 'Editar gancho' : 'Nuevo gancho'}</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <div className="input-group">
                <label>Gancho *</label>
                <textarea className="input" rows={3} autoFocus value={modal.text} placeholder="Ej: Si tenés un gimnasio y tus socios se van a los 2 meses, mirá esto…"
                  onChange={e => setModal({ ...modal, text: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Tipo</label>
                <div className="gh-driver-filter">
                  {(['dolor', 'ganancia', 'curiosidad'] as const).map(d => (
                    <button key={d} className={modal.driver === d ? 'active' : ''} onClick={() => setModal({ ...modal, driver: d })}
                      style={modal.driver === d ? { borderColor: DRIVER_COLOR[d], color: DRIVER_COLOR[d] } : undefined}>
                      {DRIVER_LABEL[d]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="input-group">
                <label>Nota (opcional): cuándo usarlo, para qué tema…</label>
                <input className="input" value={modal.note} placeholder="Ej: para el reel de retención de socios" onChange={e => setModal({ ...modal, note: e.target.value })} />
              </div>
              <label className="notif-toggle">
                <input type="checkbox" checked={modal.general} onChange={e => setModal({ ...modal, general: e.target.checked })} />
                Guardar para todas las cuentas (no solo {accountName || 'esta'})
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>{modal.id ? 'Guardar' : 'Guardar gancho'}</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 340 }}>
            <h2>¿Borrar gancho?</h2>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => { remove(confirm); setConfirm(null); }}>Borrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
