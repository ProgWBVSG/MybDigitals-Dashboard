// Catálogo de servicios: tipos, formato de precios, presupuesto, carga inicial.
import { uuid } from './utils';

export type SvcCurrency = 'ARS' | 'USD';
export type SvcPeriod = 'unico' | 'mes' | 'anio';
export type SvcStatus = 'en_venta' | 'se_cotiza' | 'en_desarrollo' | 'idea' | 'pausado';

export interface SvcPrice {
  id: string;
  label: string;
  amount: number;
  max?: number | null;      // rango: US$50 a US$70
  before?: number | null;   // precio de lista tachado
  currency: SvcCurrency;
  period: SvcPeriod;
  optional?: boolean;       // va aparte (dominio): no suma al total
}
export interface SvcLink { label: string; url: string; }
export interface Service {
  id: string; name: string; area: string; status: SvcStatus; summary: string;
  includes: string[]; prices: SvcPrice[]; costMonthly: number | null;
  delivery: string; links: SvcLink[]; notes: string;
  priceHistory: { at: number; prices: SvcPrice[] }[];
  sort: number; createdAt: number; updatedAt: number;
}
export type ServiceInput = Omit<Service, 'id' | 'createdAt' | 'updatedAt' | 'priceHistory'>;

export const SVC_STATUSES: { key: SvcStatus; label: string; color: string }[] = [
  { key: 'en_venta', label: 'En venta', color: '#f4f4f4' },
  { key: 'se_cotiza', label: 'Se cotiza', color: '#adadad' },
  { key: 'en_desarrollo', label: 'En desarrollo', color: '#bdbdbd' },
  { key: 'idea', label: 'Idea', color: '#b1b1b1' },
  { key: 'pausado', label: 'Pausado', color: '#8d8d8d' },
];
export const SVC_STATUS_MAP = Object.fromEntries(SVC_STATUSES.map(s => [s.key, s])) as Record<SvcStatus, typeof SVC_STATUSES[number]>;

export const SVC_PERIODS: { key: SvcPeriod; label: string; col: string; suffix: string }[] = [
  { key: 'unico', label: 'Pago único', col: 'Para empezar', suffix: '' },
  { key: 'mes', label: 'Por mes', col: 'Por mes', suffix: ' por mes' },
  { key: 'anio', label: 'Por año', col: 'Por año', suffix: ' por año' },
];
export const SVC_AREAS = ['Belleza', 'Deportes', 'Gastronomía y noche', 'Comercios', 'Eventos', 'Consultorías', 'Talleres', 'Educación', 'Web', 'Todo rubro'];

export const money = (n: number, c: SvcCurrency) =>
  (c === 'USD' ? 'US$' : '$') + new Intl.NumberFormat('es-AR', { maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);

export const priceText = (p: Pick<SvcPrice, 'amount' | 'max' | 'currency'>) =>
  p.max && p.max !== p.amount
    ? `${money(p.amount, p.currency)} a ${money(p.max, p.currency)}`
    : money(p.amount, p.currency);

export const hasPrice = (s: Service) => s.prices.some(p => p.amount > 0);
export const pricesOf = (s: Service, period: SvcPeriod) => s.prices.filter(p => p.period === period);

/** Redondeo para que un precio convertido se pueda decir en voz alta. */
const round = (n: number, c: SvcCurrency) => (c === 'ARS' ? Math.round(n / 100) * 100 : Math.round(n));
export const convert = (n: number, from: SvcCurrency, to: SvcCurrency, rate: number) =>
  from === to ? n : round(from === 'USD' ? n * rate : n / rate, to);

/** Precio de un período en la moneda pedida: usa el cargado y, si no hay, convierte al blue. */
export function priceIn(s: Service, period: SvcPeriod, cur: SvcCurrency, rate: number) {
  const list = pricesOf(s, period).filter(p => !p.optional && p.amount > 0);
  if (!list.length) return null;
  const same = list.filter(p => p.currency === cur);
  const use = same.length ? same : list;
  let min = 0, max = 0, converted = false;
  for (const p of use) {
    if (p.currency !== cur) converted = true;
    min += convert(p.amount, p.currency, cur, rate);
    max += convert(p.max || p.amount, p.currency, cur, rate);
  }
  return { min, max, converted };
}

export function quoteTotals(list: Service[], cur: SvcCurrency, rate: number) {
  const out = {} as Record<SvcPeriod, { min: number; max: number } | null>;
  let converted = false;
  for (const { key } of SVC_PERIODS) {
    let min = 0, max = 0;
    for (const s of list) {
      const p = priceIn(s, key, cur, rate);
      if (p) { min += p.min; max += p.max; converted = converted || p.converted; }
    }
    out[key] = max > 0 ? { min, max } : null;
  }
  return { totals: out, converted, missing: list.filter(s => !hasPrice(s)) };
}

export const rangeText = (r: { min: number; max: number }, cur: SvcCurrency) =>
  priceText({ amount: r.min, max: r.max, currency: cur });

export function quoteMessage(list: Service[], cur: SvcCurrency, rate: number, client: string) {
  const { totals } = quoteTotals(list, cur, rate);
  const lines: string[] = [];
  lines.push(client.trim() ? `Hola ${client.trim()}, te paso el presupuesto.` : 'Te paso el presupuesto.', '');
  for (const s of list) {
    const main = SVC_PERIODS.map(p => {
      const v = priceIn(s, p.key, cur, rate);
      return v ? rangeText(v, cur) + p.suffix : '';
    }).filter(Boolean).join(' + ');
    lines.push(`*${s.name}*${main ? `: ${main}` : ''}`);
    s.includes.forEach(i => lines.push(`• ${i}`));
    s.prices.filter(p => p.optional).filter((p, _i, all) => p.currency === cur || !all.some(o => o.label === p.label && o.currency === cur))
      .forEach(p => lines.push(`Aparte: ${p.label || 'adicional'}, ${money(convert(p.amount, p.currency, cur, rate), cur)}${SVC_PERIODS.find(x => x.key === p.period)!.suffix}`));
    if (s.delivery) lines.push(`Entrega: ${s.delivery}`);
    lines.push('');
  }
  if (list.length > 1) {
    const t = SVC_PERIODS.map(p => totals[p.key] ? rangeText(totals[p.key]!, cur) + p.suffix : '').filter(Boolean).join(' + ');
    if (t) lines.push(`*Total: ${t}*`);
  }
  return lines.join('\n').trim();
}

// ─── CARGA INICIAL: lo que MYB ya tiene registrado. Sin precio = no está definido. ───
const p = (amount: number, currency: SvcCurrency, period: SvcPeriod, extra: Partial<SvcPrice> = {}): SvcPrice =>
  ({ id: uuid(), label: '', amount, currency, period, ...extra });

export const servicesSeed = (): ServiceInput[] => ([
  {
    name: 'Sistema para barberías y peluquerías', area: 'Belleza', status: 'en_desarrollo',
    summary: 'Tarjeta de fidelización, turnos y panel del dueño, con la marca del local.',
    includes: ['Tarjeta de sellos digital', 'Descuento en el 5.º, 7.º y 10.º corte', 'Sello con tarjeta NFC en el mostrador', 'Turnos online por barbero', 'Cambiar o cancelar el turno solo', 'Lista de espera para días llenos', 'Cuota mensual de socios', 'Panel del dueño'],
    prices: [p(45000, 'ARS', 'mes', { label: 'Con todo' }), p(29, 'USD', 'mes', { label: 'Con todo' })],
    links: [{ label: 'Demo cliente', url: 'https://www.mybdigitals.com/demos/tarjeta/og-barbershop/cliente.html' }, { label: 'Demo dueño', url: 'https://www.mybdigitals.com/demos/tarjeta/og-barbershop/dueno.html' }],
    notes: 'La demo guarda los datos en cada celular: falta la versión real con servidor antes de cobrar. Dominio propio aparte por año (propuesto: $45.000 o US$29, sin confirmar). El aviso por cercanía necesita Apple o Google Wallet.',
  },
  {
    name: 'App para gimnasios', area: 'Deportes', status: 'en_desarrollo',
    summary: 'App del alumno y panel del entrenador, con nombre, logo y colores del gimnasio.',
    includes: ['Rutinas con video en el celular del alumno', 'Progreso y aviso para subir la carga', 'Ficha de ingreso del alumno', 'Feedback de cada rutina', 'Panel del entrenador', 'Ventas: horarios, pagos y quién falta', 'QR en cada máquina', 'Control desde el celular'],
  },
  {
    name: 'Barra sin fila (boliches y bares)', area: 'Gastronomía y noche', status: 'en_desarrollo',
    summary: 'El cliente pide y paga desde el celular, la barra sólo entrega y el dueño ve la noche en vivo.',
    includes: ['App del cliente para pedir y pagar', 'Pantalla de barra', 'Carta editable por el dueño', 'Ventas y alertas en vivo', 'Cierre de caja', 'Happy hour', 'Base de clientes con segmentos'],
    notes: 'Prototipo. El pago está en modo prueba y falta la base en servidor.',
  },
  { name: 'Menú digital para restaurantes', area: 'Gastronomía y noche', status: 'idea', summary: 'Carta digital siempre al día.', includes: ['Carta con QR en cada mesa', 'Cambio de precios al instante'] },
  {
    name: 'Infraestructura y panel con IA', area: 'Todo rubro', status: 'en_venta',
    summary: 'Sistema a medida para el cuello de botella del negocio, con mantenimiento.',
    prices: [p(500, 'USD', 'unico', { label: 'Desarrollo' }), p(50, 'USD', 'mes', { label: 'Mantenimiento', max: 70 })],
    includes: ['Análisis de cuellos de botella', 'Desarrollo del sistema', 'Panel de control', 'Puesta en marcha con el equipo', 'Soporte mensual'],
  },
  {
    name: 'Infraestructura de comunicación', area: 'Todo rubro', status: 'en_venta',
    summary: 'Asistente con IA que responde, agenda y registra.',
    prices: [p(50, 'USD', 'mes', { max: 70 })],
    includes: ['Respuesta automática a toda hora', 'Agenda de turnos con recordatorio', 'Datos del contacto guardados', 'Seguimiento automático'],
  },
  {
    name: 'Web de presencia digital', area: 'Web', status: 'en_venta', delivery: '14 días',
    summary: 'Web profesional con asistente y automatizaciones.',
    prices: [p(400, 'USD', 'unico')],
    includes: ['Sesión de diagnóstico', 'Diseño a medida', 'Formularios y panel de contactos', 'Asistente virtual con IA', 'Aviso automático de cada contacto', 'SEO, SSL y hosting'],
  },
  {
    name: 'Landing page', area: 'Web', status: 'en_venta',
    summary: 'Página única pensada para vender.',
    prices: [p(200, 'USD', 'unico')],
    includes: ['Sesión inicial', 'Diseño a medida de una página', 'Más de 5 secciones', 'Hosting por 1 año', 'Dominio .com o .com.ar por 1 año', 'Certificado SSL', '2 correos profesionales', 'Integración con WhatsApp o CRM'],
    notes: 'La web publica US$200 (60 % de adelanto, 40 % contra entrega) y la guía interna dice US$250. Definir cuál vale.',
  },
  { name: 'Cartel de reseñas de Google', area: 'Todo rubro', status: 'en_venta', summary: 'El cliente apoya el celular y deja la reseña.', prices: [p(30000, 'ARS', 'unico')], includes: ['Cartel para el mostrador', 'Enlace directo a la reseña'] },
  {
    name: 'Invitación digital completa', area: 'Eventos', status: 'en_venta',
    summary: 'Casamientos, XV y eventos. Va por la cuenta de invitaciones.',
    prices: [p(75000, 'ARS', 'unico', { before: 99000 }), p(60, 'USD', 'unico', { before: 79 })],
    includes: ['Diseño personalizado', 'Cuenta regresiva y mapa', 'Datos del regalo', 'Confirmación dentro de la invitación', 'Lista de invitados en vivo', 'Restricciones de comida', 'Galería y música', 'Plano del salón con medidas', 'Mesas y familias', 'Panel con sus colores', 'Un link por invitado', 'Trivia para los invitados'],
    links: [{ label: 'Web', url: 'https://www.mybdigitals.com/tuinvitaciondigital' }],
    notes: 'Los precios en dólares son de referencia: revisarlos antes de vender en dólares.',
  },
  { name: 'Caja con lector para comercios', area: 'Comercios', status: 'se_cotiza', summary: 'Escaneás, descuenta stock y cierra la caja.', includes: ['Caja con lector', 'Pedido y pago desde el celular', 'Tarjeta de fidelización y base de clientes'] },
  { name: 'Reservas y cuotas para clubes', area: 'Deportes', status: 'se_cotiza', summary: 'Canchas, cuotas y socios desde el celular.', includes: ['Reserva de canchas y clases', 'Cuotas con aviso de vencimiento', 'Socios y asistencia'] },
  { name: 'Entradas y accesos para productoras', area: 'Eventos', status: 'se_cotiza', summary: 'Venta de entradas, control en puerta y panel en vivo.', includes: ['Entradas con pago online', 'Acceso con código', 'Panel en tiempo real'] },
  { name: 'Turnos y propuestas para consultorías', area: 'Consultorías', status: 'se_cotiza', summary: 'Agenda, diagnóstico previo y seguimiento.', includes: ['Turnos con recordatorio', 'Diagnóstico antes de la reunión', 'Propuestas y seguimiento en un panel'] },
  { name: 'Órdenes de trabajo para talleres', area: 'Talleres', status: 'se_cotiza', summary: 'El cliente ve el estado y aprueba el presupuesto online.', includes: ['Orden con estado a la vista', 'Presupuesto aprobado online', 'Aviso de próximo service'] },
  { name: 'Inscripción y cuotas para institutos', area: 'Educación', status: 'se_cotiza', summary: 'Alumnos, cuotas, asistencia y material.', includes: ['Inscripción y cuotas online', 'Asistencia por curso', 'Material en un solo lugar'] },
] as Partial<ServiceInput>[]).map((s, i) => ({
  summary: '', includes: [], prices: [], costMonthly: null, delivery: '', links: [], notes: '', ...s, sort: i,
})) as ServiceInput[];

export const emptyService = (): ServiceInput => ({
  name: '', area: '', status: 'en_venta', summary: '', includes: [], prices: [], costMonthly: null, delivery: '', links: [], notes: '', sort: 0,
});
