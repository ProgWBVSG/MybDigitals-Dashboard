import { useState, useMemo, useEffect } from 'react';
import { History as HistoryIcon, Search, Plus, Trash2, Image as ImageIcon, Upload, Paperclip } from 'lucide-react';
import { useHistory, useClients, toast } from './hooks';
import {
  HISTORY_KINDS, HISTORY_KIND_LABELS, DATE_RANGES, fmtMoney, fmtUSD,
  type HistoryEntry, type HistoryKind,
} from './utils';

const DAY = 86400000;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const KIND_COLOR = Object.fromEntries(HISTORY_KINDS.map(k => [k.key, k.color])) as Record<HistoryKind, string>;

type Form = {
  id?: string; clientId: string | null; kind: HistoryKind; title: string; detail: string;
  amount: number; currency: 'ARS' | 'USD'; receiptPath: string | null; happenedAt: number;
};
const emptyForm = (): Form => ({ clientId: null, kind: 'pago', title: '', detail: '', amount: 0, currency: 'ARS', receiptPath: null, happenedAt: Date.now() });

export default function History() {
  const { entries, add, update, remove, uploadReceipt, signedUrl } = useHistory();
  const { clients } = useClients();
  const [folder, setFolder] = useState<string>('all'); // 'all' | 'general' | clientId
  const [search, setSearch] = useState('');
  const [rangeKey, setRangeKey] = useState('15');
  const [modal, setModal] = useState<Form | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const clientName = (id: string | null) => id ? (clients.find(c => c.id === id)?.name || 'Cliente') : 'General';

  const cutoff = useMemo(() => {
    const r = DATE_RANGES.find(x => x.key === rangeKey)!;
    if (r.days === null) return 0;
    if (r.days === 0) return startOfToday();
    return Date.now() - r.days * DAY;
  }, [rangeKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter(e => {
      if (folder === 'general' ? !!e.clientId : folder !== 'all' && e.clientId !== folder) return false;
      if (e.happenedAt < cutoff) return false;
      if (q && !(`${e.title} ${e.detail} ${clientName(e.clientId)}`.toLowerCase().includes(q))) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, folder, cutoff, search, clients]);

  const totals = useMemo(() => {
    let ars = 0, usd = 0;
    for (const e of filtered) if (e.kind === 'pago') { if (e.currency === 'USD') usd += e.amount; else ars += e.amount; }
    return { ars, usd };
  }, [filtered]);

  // Carpetas: cuenta por cliente
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) { const k = e.clientId || 'general'; m.set(k, (m.get(k) || 0) + 1); }
    return m;
  }, [entries]);

  // Agrupar por día
  const groups = useMemo(() => {
    const m = new Map<string, HistoryEntry[]>();
    for (const e of filtered) {
      const key = new Date(e.happenedAt).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
    }
    return [...m.entries()];
  }, [filtered]);

  const openNew = () => setModal({ ...emptyForm(), clientId: folder !== 'all' && folder !== 'general' ? folder : null });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!modal || saving) return;
    if (!modal.title.trim()) { toast('Ponele un título al registro', 'error'); return; }
    setSaving(true);
    const payload = { clientId: modal.clientId, kind: modal.kind, title: modal.title.trim(), detail: modal.detail.trim(), amount: modal.amount || 0, currency: modal.currency, receiptPath: modal.receiptPath, happenedAt: modal.happenedAt };
    const ok = modal.id ? await update(modal.id, payload) : await add(payload);
    setSaving(false);
    if (ok) setModal(null); // si falla, dejar el modal abierto para reintentar (el toast muestra el motivo)
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f || !modal) return;
    setUploading(true);
    const path = await uploadReceipt(f);
    setUploading(false);
    if (path) setModal({ ...modal, receiptPath: path });
  };

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HistoryIcon size={22} />
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Historial</h2>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}><Plus size={15} /> Nuevo registro</button>
      </div>

      {/* Carpetas por cliente */}
      <div className="hist-folders">
        <button className={`hist-folder ${folder === 'all' ? 'active' : ''}`} onClick={() => setFolder('all')}>Todos <span>{entries.length}</span></button>
        {counts.get('general') && <button className={`hist-folder ${folder === 'general' ? 'active' : ''}`} onClick={() => setFolder('general')}>General <span>{counts.get('general')}</span></button>}
        {clients.filter(c => counts.get(c.id)).map(c => (
          <button key={c.id} className={`hist-folder ${folder === c.id ? 'active' : ''}`} onClick={() => setFolder(c.id)}>{c.name} <span>{counts.get(c.id)}</span></button>
        ))}
      </div>

      {/* Filtros */}
      <div className="hist-filters">
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <Search size={16} />
          <input placeholder="Buscar en el historial…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select" value={rangeKey} onChange={e => setRangeKey(e.target.value)} style={{ maxWidth: 200 }}>
          {DATE_RANGES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
      </div>

      {/* Resumen cobrado */}
      {(totals.ars > 0 || totals.usd > 0) && (
        <div className="hist-summary">
          Cobrado en este período:&nbsp;<strong>{fmtMoney(totals.ars)}</strong>{totals.usd > 0 && <> · <strong>{fmtUSD(totals.usd)}</strong></>}
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="notif-empty"><HistoryIcon size={32} /><p>No hay registros en este filtro. Tocá "Nuevo registro" para empezar a anotar.</p></div>
      ) : (
        <div className="hist-list">
          {groups.map(([day, items]) => (
            <div key={day}>
              <div className="hist-day">{day}</div>
              {items.map(e => (
                <div key={e.id} className="hist-item" onClick={() => setModal({ ...e })}>
                  <span className="hist-kind-dot" style={{ background: KIND_COLOR[e.kind] }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="hist-title">{e.title}</div>
                    <div className="hist-sub">{HISTORY_KIND_LABELS[e.kind]} · {clientName(e.clientId)}{e.detail ? ` · ${e.detail}` : ''}</div>
                  </div>
                  {e.receiptPath && <Receipt path={e.receiptPath} signedUrl={signedUrl} />}
                  {e.kind === 'pago' && e.amount > 0 && (
                    <div className="hist-amount">{e.currency === 'USD' ? fmtUSD(e.amount) : fmtMoney(e.amount)}</div>
                  )}
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={ev => { ev.stopPropagation(); setConfirm(e.id); }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Modal nuevo/editar */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h2>{modal.id ? 'Editar registro' : 'Nuevo registro'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Tipo</label>
                  <select className="select" value={modal.kind} onChange={e => setModal({ ...modal, kind: e.target.value as HistoryKind })}>
                    {HISTORY_KINDS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                  </select>
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Cliente</label>
                  <select className="select" value={modal.clientId || ''} onChange={e => setModal({ ...modal, clientId: e.target.value || null })}>
                    <option value="">General (sin cliente)</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="input-group"><label>Título *</label>
                <input className="input" value={modal.title} autoFocus placeholder="Ej: Pago seña / Entregué el diseño" onChange={e => setModal({ ...modal, title: e.target.value })} /></div>
              <div className="input-group"><label>Detalle</label>
                <textarea className="input" rows={2} value={modal.detail} placeholder="Notas opcionales" onChange={e => setModal({ ...modal, detail: e.target.value })} /></div>
              {modal.kind === 'pago' && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <div className="input-group" style={{ flex: 1 }}><label>Monto</label>
                    <input className="input" type="number" value={modal.amount || ''} onChange={e => setModal({ ...modal, amount: Number(e.target.value) || 0 })} /></div>
                  <div className="input-group" style={{ width: 90 }}><label>Moneda</label>
                    <select className="select" value={modal.currency} onChange={e => setModal({ ...modal, currency: e.target.value as 'ARS' | 'USD' })}>
                      <option value="ARS">ARS</option><option value="USD">USD</option>
                    </select></div>
                </div>
              )}
              <div className="input-group"><label>Fecha</label>
                <input className="input" type="date" value={new Date(modal.happenedAt).toISOString().split('T')[0]}
                  onChange={e => setModal({ ...modal, happenedAt: e.target.value ? new Date(e.target.value + 'T12:00').getTime() : Date.now() })} /></div>
              <div className="input-group">
                <label>Comprobante (foto)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                    {uploading ? 'Subiendo…' : <><Upload size={14} /> {modal.receiptPath ? 'Cambiar' : 'Subir foto'}</>}
                    <input type="file" accept="image/*" hidden onChange={onUpload} />
                  </label>
                  {modal.receiptPath && <span style={{ fontSize: 12, color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><Paperclip size={13} /> Adjunto</span>}
                  {modal.receiptPath && <button type="button" className="btn btn-ghost btn-icon btn-sm" title="Quitar comprobante" onClick={() => setModal({ ...modal, receiptPath: null })}><Trash2 size={13} /></button>}
                </div>
                {modal.receiptPath && <ReceiptPreview path={modal.receiptPath} signedUrl={signedUrl} />}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || uploading}>{saving ? 'Guardando…' : (modal.id ? 'Guardar' : 'Registrar')}</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h2>¿Borrar registro?</h2>
            <p className="confirm-text">No se puede deshacer.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => { remove(confirm); setConfirm(null); }}>Borrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Miniatura del comprobante (genera URL firmada del bucket privado al vuelo)
function Receipt({ path, signedUrl }: { path: string; signedUrl: (p: string) => Promise<string | null> }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let on = true; signedUrl(path).then(u => { if (on) setUrl(u); }); return () => { on = false; }; }, [path, signedUrl]);
  if (!url) return <div className="hist-receipt loading"><ImageIcon size={15} /></div>;
  return <a href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}><img className="hist-receipt" src={url} alt="comprobante" /></a>;
}

// Vista previa grande del comprobante recién adjuntado, dentro del modal
function ReceiptPreview({ path, signedUrl }: { path: string; signedUrl: (p: string) => Promise<string | null> }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let on = true; setUrl(null); signedUrl(path).then(u => { if (on) setUrl(u); }); return () => { on = false; }; }, [path, signedUrl]);
  if (!url) return null;
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="comprobante" style={{ marginTop: 8, maxHeight: 140, borderRadius: 8, border: '1px solid var(--border)' }} /></a>;
}
