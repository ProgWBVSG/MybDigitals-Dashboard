import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { isCloud, post } from './base';
import { toast } from './hooks';

// Activa los avisos diarios en este celular o compu (Web Push). Sólo en la versión de internet.
const key = (b64: string) => { const s = atob((b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); };
const device = () => { const u = navigator.userAgent; return /iphone/i.test(u) ? 'iPhone' : /ipad/i.test(u) ? 'iPad' : /android/i.test(u) ? 'Android' : /windows/i.test(u) ? 'Windows' : /mac/i.test(u) ? 'Mac' : 'Navegador'; };

export default function AvisosCelular() {
  const can = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const ios = /iphone|ipad/i.test(navigator.userAgent), app = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  const [on, setOn] = useState<boolean | null>(null), [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!can) return;
    navigator.serviceWorker.getRegistration('/sw.js').then(r => r?.pushManager.getSubscription()).then(s => setOn(!!s)).catch(() => setOn(false));
  }, [can]);
  if (!isCloud()) return null;

  const activar = async () => {
    setBusy(true);
    try {
      if (await Notification.requestPermission() !== 'granted') return toast('Hay que permitir las notificaciones en el navegador', 'error');
      const reg = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
      const k = await post<{ publicKey: string }>('push/clave');
      if (!k.data) return toast(k.error?.message || 'No se pudo activar', 'error');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(k.data.publicKey) });
      const r = await post('push/alta', { subscription: sub.toJSON(), device: device() });
      if (r.error) { await sub.unsubscribe(); return toast(r.error.message, 'error'); }
      setOn(true); toast('Avisos activados');
    } catch { toast('Este navegador no dejó activar los avisos', 'error'); }
    finally { setBusy(false); }
  };
  const desactivar = async () => {
    setBusy(true);
    const sub = await (await navigator.serviceWorker.getRegistration('/sw.js'))?.pushManager.getSubscription();
    if (sub) { await post('push/baja', { endpoint: sub.endpoint }); await sub.unsubscribe(); }
    setOn(false); setBusy(false); toast('Avisos desactivados');
  };
  const probar = async () => { setBusy(true); const r = await post('push/probar'); setBusy(false); toast(r.error ? r.error.message : 'Aviso enviado', r.error ? 'error' : 'success'); };

  return (
    <section className="pn" style={{ marginBottom: 18 }}>
      <div className="pn-h"><div><h2><BellRing size={17} style={{ verticalAlign: -3, marginRight: 6 }} />Avisos en este celular</h2>
        <p>{!can ? (ios && !app ? 'En iPhone: tocá Compartir, "Agregar a inicio", y abrí el dashboard desde ese ícono.' : 'Este navegador no permite avisos.') : on ? 'Activados. Cada mañana te llega lo que hay que mirar ese día.' : 'Cada mañana: quién debe, invitaciones que terminan y tus tareas del día.'}</p></div>
        {can && on !== null && <div className="row">{on ? <><button className="btn btn-secondary btn-sm" disabled={busy} onClick={probar}>Probar</button><button className="btn btn-ghost btn-sm" disabled={busy} onClick={desactivar}>Desactivar</button></>
          : <button className="btn btn-primary btn-sm" disabled={busy} onClick={activar}>Activar</button>}</div>}
      </div>
    </section>
  );
}
