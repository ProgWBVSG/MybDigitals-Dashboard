import { SlidersHorizontal, Clock } from 'lucide-react';
import { useAppSettings } from './hooks';
import type { AppSettings } from './utils';

// Centro de configuración: normativas de plazos compartidas por el equipo.
export default function Settings() {
  const { settings, update } = useAppSettings();

  const fields: { key: keyof AppSettings; label: string; hint: string }[] = [
    { key: 'stepDeadlineDays', label: 'Plazo por paso (nosotros)', hint: 'Días que nos damos para completar cada paso del onboarding antes de que aparezca como atrasado.' },
    { key: 'clientDeadlineDays', label: 'Plazo cuando depende del cliente', hint: 'Días de espera cuando el cliente nos tiene que pasar info/accesos. Pasado ese plazo, te avisa para reclamarle.' },
    { key: 'paymentDeadlineDays', label: 'Plazo por pago', hint: 'Días para registrar/cobrar un hito de pago antes de marcarlo como vencido.' },
  ];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <SlidersHorizontal size={22} />
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Configuración</h2>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 22px' }}>
        Reglas de plazos para mantener el ritmo. Aplican a las notificaciones: cuando algo pasa su plazo, aparece como <strong>atrasado</strong> y con prioridad alta. Son compartidas entre vos y tu socio.
      </p>

      <div className="cfg-card">
        <div className="cfg-card-title"><Clock size={16} /> Plazos por defecto</div>
        {fields.map(f => (
          <div key={f.key} className="cfg-row">
            <div style={{ flex: 1 }}>
              <div className="cfg-label">{f.label}</div>
              <div className="cfg-hint">{f.hint}</div>
            </div>
            <div className="cfg-input">
              <input className="input" type="number" min={1} max={60} value={settings[f.key]}
                onChange={e => update({ [f.key]: Math.max(1, Math.min(60, Number(e.target.value) || 1)) } as Partial<AppSettings>)} />
              <span>días</span>
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.5 }}>
        💡 Estos plazos se calculan desde que la tarea se vuelve la actual (al completar el paso anterior) o desde el arranque del onboarding. Igual podés ponerle una fecha límite manual a un paso o pago puntual desde su ficha.
      </p>
    </div>
  );
}
