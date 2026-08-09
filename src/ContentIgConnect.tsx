// Conexión de una cuenta del dashboard con Instagram.
//
// El token se pega una vez, se valida contra la Graph API (que además descubre
// las cuentas de IG disponibles) y se guarda server-side vía la Edge Function
// `ig-connect` — nunca queda en la base a la que llega el navegador.
import { useState } from 'react';
import { Camera, Check, AlertCircle, Unplug, Loader2 } from 'lucide-react';
import type { useContent } from './hooks';
import type { ContentAccount } from './utils';

interface IgOption { igUserId: string; username: string; followers: number; page: string; avatar: string }

export default function IgConnect({ c, account, onClose }: {
  c: ReturnType<typeof useContent>; account: ContentAccount; onClose: () => void;
}) {
  const [token, setToken] = useState('');
  const [options, setOptions] = useState<IgOption[] | null>(null);
  const [busy, setBusy] = useState(false);
  const connected = !!account.igUserId;

  const check = async () => {
    if (!token.trim()) return;
    setBusy(true);
    const r = await c.igConnect('check', { token: token.trim() });
    setBusy(false);
    if (r?.accounts) setOptions(r.accounts as IgOption[]);
  };

  const connect = async (igUserId: string) => {
    setBusy(true);
    const r = await c.igConnect('connect', { accountId: account.id, token: token.trim(), igUserId });
    setBusy(false);
    if (r?.ok) onClose();
  };

  const disconnect = async () => {
    setBusy(true);
    await c.igConnect('disconnect', { accountId: account.id });
    setBusy(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="ig-card-head" style={{ marginBottom: 10 }}>
          <div>
            <p className="ig-eyebrow">Instagram</p>
            <h3>{connected ? 'Cuenta conectada' : 'Conectar Instagram'}</h3>
          </div>
        </div>

        {connected ? (
          <>
            <div className="igc-ok">
              <Check size={16} />
              <div>
                <strong>{account.name} está conectada</strong>
                <em>
                  ID {account.igUserId}
                  {account.igSyncedAt && ` · última sincronización ${new Date(account.igSyncedAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                </em>
              </div>
            </div>
            <p className="scr-tip">
              Las métricas se traen solas desde la pestaña Métricas. El token de Instagram
              dura 60 días: cuando expire vas a ver un aviso acá y lo reconectás.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
              <button className="btn btn-danger" disabled={busy} onClick={disconnect}>
                <Unplug size={14} /> Desconectar
              </button>
            </div>
          </>
        ) : !options ? (
          <>
            <div className="igc-steps">
              <p><b>1.</b> Entrá a <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">Graph API Explorer</a> y elegí tu app.</p>
              <p><b>2.</b> En permisos agregá: <code>instagram_basic</code>, <code>instagram_manage_insights</code>, <code>pages_show_list</code>, <code>pages_read_engagement</code>.</p>
              <p><b>3.</b> Generá el token y pegalo acá abajo.</p>
            </div>
            <div className="ig-form">
              <label>Token de acceso
                <input className="input" type="password" autoFocus value={token}
                  placeholder="EAAG…" onChange={e => setToken(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && check()} />
              </label>
            </div>
            <p className="igc-note">
              <AlertCircle size={13} />
              El token se guarda del lado del servidor, en una tabla sin acceso desde el navegador.
              La cuenta tiene que ser <b>Business o Creator</b> y estar vinculada a una Página de Facebook.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" disabled={busy || !token.trim()} onClick={check}>
                {busy ? <><Loader2 size={14} className="spin" /> Validando…</> : <><Camera size={14} /> Validar token</>}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="scr-tip" style={{ marginBottom: 12 }}>
              Token válido. Elegí qué cuenta de Instagram corresponde a <b>{account.name}</b>:
            </p>
            <div className="igc-list">
              {options.map(o => (
                <button key={o.igUserId} className="igc-option" disabled={busy} onClick={() => connect(o.igUserId)}>
                  {o.avatar && <img src={o.avatar} alt="" />}
                  <div className="igc-option-txt">
                    <strong>@{o.username}</strong>
                    <em>{o.followers.toLocaleString('es-AR')} seguidores · Página: {o.page}</em>
                  </div>
                  <Check size={15} />
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setOptions(null)}>Volver</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
