import { useState } from 'react';
import { Bell, CheckCheck, Plus, CreditCard, Rocket, CalendarDays, Users, FileText, Clock, Settings, Check, BellRing } from 'lucide-react';
import type { useNotifications } from './hooks';
import { NOTIF_KIND_LABELS, type NotifKind, type NotifItem } from './utils';

type NotifApi = ReturnType<typeof useNotifications>;

const ICONS: Record<NotifKind, typeof Bell> = {
  payment: CreditCard, step: Rocket, calendar: CalendarDays, meeting: Users, proposal: FileText, reminder: Clock,
};

export default function Notifications({ notif, onGoto }: { notif: NotifApi; onGoto: (tab: string) => void }) {
  const { items, unread, settings, setSettings, isRead, markRead, markAllRead, addReminder, completeReminder, enableBrowserPush } = notif;
  const [showCfg, setShowCfg] = useState(false);
  const [rTitle, setRTitle] = useState('');
  const [rWhen, setRWhen] = useState('');

  const onAdd = () => {
    if (!rTitle.trim()) return;
    addReminder(rTitle, rWhen ? new Date(rWhen).getTime() : null);
    setRTitle(''); setRWhen('');
  };

  const click = (it: NotifItem) => {
    markRead(it.id);
    if (it.goto && it.goto !== 'notifications') onGoto(it.goto);
  };

  const toggles: { key: 'payments' | 'steps' | 'calendar' | 'meetings' | 'proposals' | 'reminders'; label: string }[] = [
    { key: 'payments', label: 'Pagos pendientes' },
    { key: 'steps', label: 'Avance de onboarding' },
    { key: 'calendar', label: 'Eventos del calendario' },
    { key: 'meetings', label: 'Reuniones de prospectos' },
    { key: 'proposals', label: 'Propuestas sin seguimiento' },
    { key: 'reminders', label: 'Mis recordatorios' },
  ];

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="notif-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bell size={22} />
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Notificaciones</h2>
          {unread > 0 && <span className="notif-count">{unread}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unread > 0 && <button className="btn btn-secondary btn-sm" onClick={markAllRead}><CheckCheck size={14} /> Marcar todo leído</button>}
          <button className="btn btn-ghost btn-icon" onClick={() => setShowCfg(s => !s)} title="Configurar"><Settings size={16} /></button>
        </div>
      </div>

      {/* Agregar recordatorio propio */}
      <div className="notif-add">
        <input className="input" placeholder="Nuevo recordatorio (ej: Pasar factura a Estudio Alba)" value={rTitle}
          onChange={e => setRTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && onAdd()} />
        <input className="input" type="datetime-local" value={rWhen} onChange={e => setRWhen(e.target.value)} style={{ maxWidth: 210 }} />
        <button className="btn btn-primary btn-sm" onClick={onAdd}><Plus size={15} /> Agregar</button>
      </div>

      {/* Configuración */}
      {showCfg && (
        <div className="notif-cfg">
          <div className="notif-cfg-grid">
            {toggles.map(t => (
              <label key={t.key} className="notif-toggle">
                <input type="checkbox" checked={!!settings[t.key]} onChange={e => setSettings({ [t.key]: e.target.checked })} />
                {t.label}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
            <label className="notif-toggle" style={{ gap: 8 }}>
              Avisar eventos con
              <input className="input" type="number" min={1} max={60} value={settings.leadDays}
                onChange={e => setSettings({ leadDays: Math.max(1, Number(e.target.value) || 7) })} style={{ width: 64, padding: '6px 8px' }} />
              días de anticipación
            </label>
            <button className="btn btn-secondary btn-sm" onClick={enableBrowserPush} disabled={settings.browserPush}>
              <BellRing size={14} /> {settings.browserPush ? 'Pop-ups activados' : 'Activar pop-ups del navegador'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {items.length === 0 ? (
        <div className="notif-empty">
          <Check size={34} />
          <p>¡Todo al día! No tenés nada pendiente ahora mismo.</p>
        </div>
      ) : (
        <div className="notif-list">
          {items.map(it => {
            const Icon = ICONS[it.kind];
            const read = isRead(it.id);
            return (
              <div key={it.id} className={`notif-item ${it.priority}${read ? ' read' : ''}`} onClick={() => click(it)}>
                <div className={`notif-ic ${it.kind}`}><Icon size={16} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="notif-title">{it.title}</div>
                  {it.body && <div className="notif-body">{it.body}</div>}
                </div>
                <div className="notif-meta">
                  <span className="notif-kind">{NOTIF_KIND_LABELS[it.kind]}</span>
                  {it.kind === 'reminder' && (
                    <button className="btn btn-ghost btn-sm" title="Completar" onClick={e => { e.stopPropagation(); completeReminder(it.id.slice(4)); }}>
                      <Check size={14} />
                    </button>
                  )}
                  {!read && <span className="notif-dot" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
