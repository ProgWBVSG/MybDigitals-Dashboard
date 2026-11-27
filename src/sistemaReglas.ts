// Cuentas de los sistemas que les vendemos a los negocios: qué mes pagaron, qué deben y en qué estado están.
import type { Row } from './base';
import type { SvcCurrency } from './services';

export type SysStatus = 'prueba' | 'activo' | 'suspendido' | 'baja';
export interface Sistema extends Row {
  name: string; rubro: string; city: string; plan: string; notes: string;
  client_id: string | null; owner: { name?: string; whatsapp?: string; email?: string };
  price: number; currency: SvcCurrency; bill_day: number; bill_from: string; grace_days: number;
  status: SysStatus; status_at: number; status_reason: string; status_msg: string; status_by: string; ended_at: number | null;
  links: { label: string; url: string }[]; fields: { k: string; v: string }[]; tags: string[]; service_key: string;
}
export interface SysPago extends Row { sistema_id: string; period: string; amount: number; currency: SvcCurrency; paid_at: number; method: string; note: string; movement_id: string | null; by: string }
export interface SysNota extends Row { sistema_id: string; text: string; pinned: boolean; by: string }
export interface SysLog extends Row { sistema_id: string | null; sistema: string; action: string; detail: string; by: string; at: number }

export const STATUS: Record<SysStatus, string> = { prueba: 'En prueba', activo: 'Activo', suspendido: 'Suspendido', baja: 'De baja' };
export const RUBROS = ['Barbería', 'Peluquería', 'Restaurante', 'Cafetería', 'Boliche', 'Bar', 'Gimnasio', 'Estética', 'Comercio'];

const p2 = (n: number) => String(n).padStart(2, '0');
export const periodOf = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`; };
export const nextPeriod = (p: string) => { const [y, m] = p.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${p2(m + 1)}`; };
export const periodLabel = (p: string) => { const [y, m] = p.split('-').map(Number); const s = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }); return s[0].toUpperCase() + s.slice(1); };
export const periodShort = (p: string) => { const [y, m] = p.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''); };
/** Fecha en que vence ese mes (si el día no existe, el último del mes). */
export const dueOf = (p: string, day: number) => { const [y, m] = p.split('-').map(Number); const last = new Date(y, m, 0).getDate(); return new Date(y, m - 1, Math.min(Math.max(1, day || 1), last), 23, 59).getTime(); };

export type MonthState = 'pagado' | 'bonificado' | 'vencido' | 'por_vencer';
export interface Month { period: string; due_at: number; state: MonthState; pago?: SysPago }

/** Meses que corresponde cobrar: desde el primero hasta hoy (o hasta la baja). En prueba no se cobra. */
export function monthsOf(s: Sistema, pagos: SysPago[], now = Date.now()): Month[] {
  if (!/^\d{4}-\d\d$/.test(s.bill_from || '')) return [];
  const mine = new Map(pagos.filter(p => p.sistema_id === s.id).map(p => [p.period, p]));
  const end = periodOf(s.status === 'baja' && s.ended_at ? s.ended_at : now);
  const out: Month[] = [];
  for (let p = s.bill_from, i = 0; p <= end && i < 240; p = nextPeriod(p), i++) {
    const pago = mine.get(p), due_at = dueOf(p, s.bill_day);
    if (s.status === 'prueba' && !pago) continue;
    // Si se empieza a cobrar el mes del alta y ese día ya había vencido, arranca el mes siguiente
    if (!pago && p === s.bill_from && p === periodOf(Number(s.created_at) || 0) && due_at < Number(s.created_at)) continue;
    out.push({ period: p, due_at, pago, state: pago ? (pago.amount > 0 ? 'pagado' : 'bonificado') : due_at < now ? 'vencido' : 'por_vencer' });
  }
  return out;
}

export type SysHealth = 'cortar' | 'debe' | 'por_vencer' | 'al_dia' | 'prueba' | 'suspendido' | 'baja';
export const HEALTH: Record<SysHealth, { label: string; hot: boolean; rank: number }> = {
  cortar: { label: 'Para suspender', hot: true, rank: 0 },
  debe: { label: 'Debe', hot: true, rank: 1 },
  suspendido: { label: 'Suspendido', hot: false, rank: 2 },
  por_vencer: { label: 'Por vencer', hot: false, rank: 3 },
  prueba: { label: 'En prueba', hot: false, rank: 4 },
  al_dia: { label: 'Al día', hot: false, rank: 5 },
  baja: { label: 'De baja', hot: false, rank: 6 },
};
export interface SysView { s: Sistema; months: Month[]; owed: Month[]; debt: number; health: SysHealth; why: string; lastPay: SysPago | null }

const DAY = 86400000;
export function viewSys(s: Sistema, pagos: SysPago[], now = Date.now()): SysView {
  const months = monthsOf(s, pagos, now);
  const owed = months.filter(m => m.state === 'vencido');
  const debt = owed.length * (s.price || 0);
  const lastPay = pagos.filter(p => p.sistema_id === s.id).sort((a, b) => b.paid_at - a.paid_at)[0] || null;
  const cur = months.find(m => m.period === periodOf(now));
  const late = owed.length ? Math.floor((now - owed[0].due_at) / DAY) : 0;
  let health: SysHealth, why: string;
  if (s.status === 'baja') { health = 'baja'; why = s.status_reason || 'Dado de baja'; }
  else if (s.status === 'suspendido') { health = 'suspendido'; why = owed.length ? `Debe ${owed.length === 1 ? 'un mes' : owed.length + ' meses'}. ${s.status_reason}` : s.status_reason || 'Servicio cortado'; }
  else if (s.status === 'prueba') { health = 'prueba'; why = 'Todavía no paga'; }
  else if (owed.length && late > (s.grace_days ?? 5)) { health = 'cortar'; why = `Debe ${owed.length === 1 ? 'un mes' : owed.length + ' meses'}, ${late} días de atraso`; }
  else if (owed.length) { health = 'debe'; why = `Venció el ${new Date(owed[0].due_at).getDate()}, le quedan ${Math.max(0, (s.grace_days ?? 5) - late)} días de gracia`; }
  else if (cur && cur.state === 'por_vencer') { health = 'por_vencer'; const d = Math.ceil((cur.due_at - now) / DAY); why = d <= 0 ? 'Vence hoy' : `Vence en ${d === 1 ? 'un día' : d + ' días'}`; }
  else { health = 'al_dia'; why = lastPay ? 'Pagó este mes' : 'Sin meses para cobrar'; }
  return { s, months, owed, debt, health, why, lastPay };
}

/** Sólo direcciones web de verdad: evita que un enlace guardado ejecute código. */
export function safeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  try { const u = new URL(/^[a-z]+:/i.test(t) ? t : 'https://' + t); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; } catch { return ''; }
}

/** Lo que se pega en el panel y en la app del negocio para que se corte si lo suspendemos. */
export function snippet(origin: string, key: string) {
  return `<script>
/* MYB: corte de servicio. Si no hay respuesta, la app sigue andando. */
fetch('${origin}/api/servicio/${key}', { cache: 'no-store' })
  .then(r => r.ok ? r.json() : null)
  .then(s => {
    if (!s || s.activo !== false) return;
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:#0b0b0b;color:#fff;font:600 18px/1.5 system-ui;text-align:center';
    d.textContent = s.mensaje;
    document.body.replaceChildren(d);
  })
  .catch(() => {});
</script>`;
}
