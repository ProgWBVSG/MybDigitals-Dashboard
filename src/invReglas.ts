// Invitaciones digitales vendidas: quién es, cuánto pagó, hasta cuándo está online.
import type { Row } from './base';
import type { SvcCurrency } from './services';

export interface InvPago { id: string; at: number; amount: number; movement_id: string | null; method?: string }
export interface Invitacion extends Row {
  name: string; event: string; event_date: number | null; ends_at: number | null; style: string; url: string; notes: string;
  contact: { name?: string; whatsapp?: string; email?: string }; client_id: string | null;
  price: number; currency: SvcCurrency; pagos: InvPago[];
  status: 'activa' | 'baja'; status_at: number; status_reason: string; status_msg: string; status_by: string; service_key: string;
}

export const EVENTS = ['Casamiento', 'XV', 'Cumpleaños', 'Bautismo', 'Bar Mitzvá', 'Egresados', 'Empresa'];
export const STYLES = ['Rosa', 'Rosedal', 'Lavanda', 'Rasgado', 'Guirnalda', 'Fotomatón', 'Garabato', 'Cinta', 'Mesa', 'Jardín', 'Cupido', 'Hilo rojo', 'Vinilo', 'XOXO'];
/** Cuánto queda online después del evento. */
export const DURATIONS: [string, number][] = [['1 semana', 7], ['1 mes', 30], ['3 meses', 90], ['6 meses', 180], ['1 año', 365]];

const DAY = 86400000;
const day0 = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const daysFrom = (t: number, now = Date.now()) => Math.round((day0(t) - day0(now)) / DAY);
export const paidOf = (i: Invitacion) => (i.pagos || []).reduce((s, p) => s + (p.amount || 0), 0);

export type InvHealth = 'vencida' | 'debe' | 'sin_pago' | 'sena' | 'pagada' | 'baja';
export const INV_HEALTH: Record<InvHealth, { label: string; hot: boolean; rank: number }> = {
  vencida: { label: 'Para dar de baja', hot: true, rank: 0 },
  debe: { label: 'Debe', hot: true, rank: 1 },
  sin_pago: { label: 'Sin pagar', hot: false, rank: 2 },
  sena: { label: 'Señada', hot: false, rank: 3 },
  pagada: { label: 'Pagada', hot: false, rank: 4 },
  baja: { label: 'De baja', hot: false, rank: 5 },
};
export interface InvView { i: Invitacion; paid: number; owe: number; health: InvHealth; why: string }

const eventText = (t: number | null, now: number) => {
  if (!t) return 'Sin fecha de evento';
  const d = daysFrom(t, now);
  return d === 0 ? 'El evento es hoy' : d === 1 ? 'El evento es mañana' : d > 0 ? `Evento en ${d} días` : d === -1 ? 'El evento fue ayer' : `El evento fue hace ${-d} días`;
};
export function viewInv(i: Invitacion, now = Date.now()): InvView {
  const paid = paidOf(i), owe = Math.max(0, (i.price || 0) - paid);
  const soon = !!i.event_date && daysFrom(i.event_date, now) <= 7;
  let health: InvHealth, why: string;
  if (i.status === 'baja') { health = 'baja'; why = i.status_reason || 'Ya no está online'; }
  else if (i.ends_at && i.ends_at < now) { health = 'vencida'; why = `Terminó su tiempo hace ${-daysFrom(i.ends_at, now)} días`; }
  else if (owe > 0 && soon) { health = 'debe'; why = `${eventText(i.event_date, now)} y no terminó de pagar`; }
  else if (owe > 0 && paid === 0) { health = 'sin_pago'; why = eventText(i.event_date, now); }
  else if (owe > 0) { health = 'sena'; why = eventText(i.event_date, now); }
  else { health = 'pagada'; why = eventText(i.event_date, now); }
  return { i, paid, owe, health, why };
}
