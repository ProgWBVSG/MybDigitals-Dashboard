// Selector y administración de cuentas de Instagram.
//
// Todo el módulo IG Content trabaja sobre una cuenta a la vez para que no se
// mezclen guiones, métricas ni referentes entre la cuenta de la agencia, la
// personal y las de clientes. La cuenta elegida se guarda en localStorage para
// que se mantenga al recargar.
import { useState } from 'react';
import { Plus, Trash2, Pencil, Check, ChevronDown } from 'lucide-react';
import { useClients } from './hooks';
import { ACCOUNT_COLORS, type ContentAccount } from './utils';

export const ACCOUNT_STORAGE_KEY = 'myb_ig_account';

// Devuelve la cuenta guardada solo si sigue existiendo (se pudo haber borrado).
export const resolveStoredAccount = (accounts: ContentAccount[]): string | null => {
  if (!accounts.length) return null;
  const stored = localStorage.getItem(ACCOUNT_STORAGE_KEY);
  return stored && accounts.some(a => a.id === stored) ? stored : accounts[0].id;
};

export function AccountSwitcher({ accounts, accountId, onSelect, onManage, counts }: {
  accounts: ContentAccount[]; accountId: string | null;
  onSelect: (id: string) => void; onManage: () => void;
  counts: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const active = accounts.find(a => a.id === accountId);
  const live = accounts.filter(a => !a.archived);

  if (!accounts.length) {
    return (
      <button className="btn btn-primary btn-sm" onClick={onManage}>
        <Plus size={14} /> Agregar cuenta
      </button>
    );
  }

  return (
    <div className="acc-switch">
      <button className="acc-current" onClick={() => setOpen(v => !v)}>
        <span className="acc-dot" style={{ background: active?.color || '#64748b' }} />
        <span className="acc-current-txt">
          <strong>{active?.name || 'Elegir cuenta'}</strong>
          {active?.handle && <em>@{active.handle}</em>}
        </span>
        <ChevronDown size={14} className={open ? 'rot' : ''} />
      </button>

      {open && (
        <>
          <div className="acc-backdrop" onClick={() => setOpen(false)} />
          <div className="acc-menu">
            {live.map(a => (
              <button key={a.id} className={`acc-item ${a.id === accountId ? 'active' : ''}`}
                onClick={() => { onSelect(a.id); setOpen(false); }}>
                <span className="acc-dot" style={{ background: a.color }} />
                <span className="acc-item-txt">
                  <strong>{a.name}</strong>
                  {a.handle && <em>@{a.handle}</em>}
                </span>
                <span className="acc-count">{counts[a.id] || 0}</span>
                {a.id === accountId && <Check size={13} />}
              </button>
            ))}
            <button className="acc-manage" onClick={() => { onManage(); setOpen(false); }}>
              <Plus size={13} /> Administrar cuentas
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const emptyAccount = (): Partial<ContentAccount> => ({ name: '', handle: '', niche: '', color: ACCOUNT_COLORS[0], notes: '', clientId: null });

export function AccountsModal({ accounts, counts, onClose, onAdd, onUpdate, onRemove }: {
  accounts: ContentAccount[]; counts: Record<string, number>; onClose: () => void;
  onAdd: (a: Partial<ContentAccount>) => Promise<string | null>;
  onUpdate: (id: string, u: Partial<ContentAccount>) => void;
  onRemove: (id: string) => void;
}) {
  const { clients } = useClients();
  const [form, setForm] = useState<Partial<ContentAccount> | null>(accounts.length ? null : emptyAccount());
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const save = async () => {
    if (!form || !(form.name || '').trim()) return;
    if (form.id) onUpdate(form.id, form); else await onAdd(form);
    setForm(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="ig-card-head" style={{ marginBottom: 4 }}>
          <div><p className="ig-eyebrow">IG Content</p><h3>Cuentas</h3></div>
          {!form && <button className="btn btn-primary btn-sm" onClick={() => setForm(emptyAccount())}><Plus size={14} /> Nueva</button>}
        </div>

        {form ? (
          <div className="ig-form">
            <label>Nombre<input className="input" autoFocus value={form.name || ''} placeholder="Ej: MYB Digitals"
              onChange={e => setForm({ ...form, name: e.target.value })} /></label>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ flex: 1 }}>Usuario de IG
                <input className="input" value={form.handle || ''} placeholder="mybdigitals"
                  onChange={e => setForm({ ...form, handle: e.target.value })} /></label>
              <label style={{ flex: 1 }}>Nicho
                <input className="input" value={form.niche || ''} placeholder="Marketing para pymes"
                  onChange={e => setForm({ ...form, niche: e.target.value })} /></label>
            </div>
            <label>Cliente asociado (opcional)
              <select className="select" value={form.clientId || ''}
                onChange={e => setForm({ ...form, clientId: e.target.value || null })}>
                <option value="">Cuenta propia</option>
                {clients.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
              </select></label>
            <div>
              <span className="acc-color-lbl">Color</span>
              <div className="acc-colors">
                {ACCOUNT_COLORS.map(col => (
                  <button key={col} type="button" className={form.color === col ? 'sel' : ''}
                    style={{ background: col }} onClick={() => setForm({ ...form, color: col })} />
                ))}
              </div>
            </div>
            <label>Notas<textarea className="input" rows={2} value={form.notes || ''}
              placeholder="Tono, temas que funcionan, qué evitar…"
              onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setForm(accounts.length ? null : emptyAccount())}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>{form.id ? 'Guardar' : 'Crear cuenta'}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="acc-list">
              {accounts.map(a => (
                <div key={a.id} className="acc-row">
                  <span className="acc-dot" style={{ background: a.color }} />
                  <div className="acc-row-txt">
                    <strong>{a.name}</strong>
                    <em>{a.handle ? `@${a.handle}` : 'sin usuario'}{a.niche ? ` · ${a.niche}` : ''}</em>
                  </div>
                  <span className="acc-count">{counts[a.id] || 0} piezas</span>
                  <div className="acc-row-actions">
                    <button title="Editar" onClick={() => setForm(a)}><Pencil size={13} /></button>
                    <button title="Borrar" onClick={() => setConfirmId(a.id)}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
              {!accounts.length && <div className="ig-empty-inline">Todavía no hay cuentas.</div>}
            </div>

            {confirmId && (
              <div className="ig-notice warn">
                Borrar esta cuenta no borra su contenido: las {counts[confirmId] || 0} piezas quedan sin cuenta asignada y las podés reasignar después. ¿Seguimos?
                <div className="modal-actions" style={{ marginTop: 10 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setConfirmId(null)}>No</button>
                  <button className="btn btn-danger btn-sm" onClick={() => { onRemove(confirmId); setConfirmId(null); }}>Borrar cuenta</button>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
