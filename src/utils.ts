// ─── UUID ───
export const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

// ─── DATES ───
export const fmt = (ts: number) =>
  new Date(ts).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });

export const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export const fmtDTLocal = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const isOverdue = (ts: number) => ts < Date.now();

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// ─── CALENDAR UTILS ───
export const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export const calendarDays = (year: number, month: number) => {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay();
  const days: { date: Date; current: boolean }[] = [];
  for (let i = startDay - 1; i >= 0; i--)
    days.push({ date: new Date(year, month, -i), current: false });
  for (let i = 1; i <= last.getDate(); i++)
    days.push({ date: new Date(year, month, i), current: true });
  while (days.length < 42)
    days.push({ date: new Date(year, month + 1, days.length - startDay - last.getDate() + 1), current: false });
  return days;
};

// ─── STORAGE WRAPPER ───
export const storage = {
  get<T>(key: string): T | null {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  },
  set(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.error('Storage set error:', e); }
  },
  del(key: string) {
    try { localStorage.removeItem(key); }
    catch (e) { console.error('Storage del error:', e); }
  }
};

// ─── CATEGORIES ───
export const CATEGORIES = ['Frontend', 'Backend', 'Design', 'Marketing', 'IA/Automation', 'DevOps', 'Management'];
export const LEVELS = ['Principiante', 'Básico', 'Intermedio', 'Avanzado', 'Experto'];
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const PRIORITY_LABELS: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
export const EVENT_TYPES = ['meeting', 'deadline', 'reminder', 'task'] as const;
export const EVENT_LABELS: Record<string, string> = { meeting: 'Reunión', deadline: 'Fecha límite', reminder: 'Recordatorio', task: 'Tarea' };
export const COLORS = ['#6366f1', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
export const CLIENT_STATUSES = ['prospect', 'active', 'completed', 'paused'] as const;
export const CLIENT_STATUS_LABELS: Record<string, string> = { prospect: 'Prospecto', active: 'Activo', completed: 'Completado', paused: 'Pausado' };
export const CLIENT_STATUS_COLORS: Record<string, string> = { prospect: '#f59e0b', active: '#10b981', completed: '#6366f1', paused: '#64748b' };
export const PROJECT_STATUSES = ['pending', 'in_progress', 'delivered', 'cancelled'] as const;
export const PROJECT_STATUS_LABELS: Record<string, string> = { pending: 'Pendiente', in_progress: 'En curso', delivered: 'Entregado', cancelled: 'Cancelado' };

// ─── ONBOARDING ───
export const SERVICE_TYPES = ['landing', 'web_pro', 'automation', 'consulting'] as const;
export type ServiceType = typeof SERVICE_TYPES[number];
export const SERVICE_LABELS: Record<ServiceType, string> = {
  landing: 'Landing Page',
  web_pro: 'Web Profesional',
  automation: 'Automatización IA',
  consulting: 'Consultoría',
};
// Servicios con playbook ya disponible (el resto se muestra "próximamente")
export const SERVICE_AVAILABLE: Record<ServiceType, boolean> = {
  landing: true, web_pro: false, automation: false, consulting: false,
};

export const ONBOARDING_STATUSES = ['active', 'paused', 'launched', 'archived'] as const;
export const ONBOARDING_STATUS_LABELS: Record<string, string> = { active: 'En curso', paused: 'Pausado', launched: 'Lanzado', archived: 'Archivado' };
export const ONBOARDING_STATUS_COLORS: Record<string, string> = { active: '#10b981', paused: '#64748b', launched: '#6366f1', archived: '#475569' };

export const STEP_STATUSES = ['pending', 'in_progress', 'done', 'blocked', 'skipped'] as const;
export type StepStatus = typeof STEP_STATUSES[number];
export const STEP_STATUS_LABELS: Record<StepStatus, string> = { pending: 'Pendiente', in_progress: 'En proceso', done: 'Hecho', blocked: 'Bloqueado', skipped: 'Omitido' };
export const STEP_STATUS_COLORS: Record<StepStatus, string> = { pending: '#64748b', in_progress: '#3b82f6', done: '#10b981', blocked: '#ef4444', skipped: '#475569' };

export type StepOwner = 'myb' | 'client' | 'both';
export const OWNER_LABELS: Record<StepOwner, string> = { myb: 'MYB', client: 'Cliente', both: 'Ambos' };
export const OWNER_COLORS: Record<StepOwner, string> = { myb: '#6366f1', client: '#f59e0b', both: '#14b8a6' };

export const DOC_TYPES = ['acuerdo', 'brief', 'kb_ia', 'guia_admin', 'feedback', 'testimonios', 'credenciales'] as const;
export type DocType = typeof DOC_TYPES[number];
export const DOC_LABELS: Record<DocType, string> = {
  acuerdo: 'Acuerdo de buena fe',
  brief: 'Brief de marca',
  kb_ia: 'Base de conocimiento IA',
  guia_admin: 'Guía de uso / Admin',
  feedback: 'Feedback del cliente',
  testimonios: 'Testimonios',
  credenciales: 'Accesos y credenciales',
};

// ─── CURRENCY ───
export const fmtMoney = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
export const fmtUSD = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

// ─── TYPES ───
export interface Skill {
  id: string; name: string; category: string; level: number;
  description: string; assignedTo: string[]; createdAt: number;
  updatedAt: number; color: string; links?: string;
}

export interface Board {
  id: string; name: string; description: string;
  columns: Column[]; createdAt: number;
}
export interface Column { id: string; name: string; order: number; }

export interface TaskCard {
  id: string; boardId: string; columnId: string;
  title: string; description: string; assignedTo: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: number | null; tags: string[];
  createdAt: number; updatedAt: number; order: number;
}

export interface CalEvent {
  id: string; title: string; description: string;
  startDate: number; endDate: number;
  type: 'meeting' | 'deadline' | 'reminder' | 'task';
  assignedTo: string[]; relatedTaskId: string | null;
  color: string; allDay: boolean; createdAt: number;
}

// ─── CRM TYPES ───
export interface ClientProject {
  id: string; name: string; description: string;
  status: 'pending' | 'in_progress' | 'delivered' | 'cancelled';
  value: number; currency: 'ARS' | 'USD';
  paidPercentage: number;
  startDate: number; endDate: number | null;
  links: string;
}

export interface ClientNote {
  id: string; content: string; createdAt: number;
}

export interface Expense {
  id: string; amount: number; description: string;
  category: string; date: number;
}

export interface Goal {
  id: string; name: string; targetAmount: number;
  currentAmount: number; deadline: string | null;
  createdAt: number;
}

export interface Client {
  id: string; name: string;
  contact: { email: string; whatsapp: string; instagram: string; };
  status: 'prospect' | 'active' | 'completed' | 'paused';
  projects: ClientProject[];
  notes: ClientNote[];
  totalRevenue: number;
  totalRevenueUSD: number;
  createdAt: number; updatedAt: number;
}

// ─── ONBOARDING TYPES ───
// Datos crudos de la reunión de discovery con el cliente (input para generar docs)
export interface Discovery {
  marca: string;
  sector: string;
  tipoProyecto: string;
  queHace: string;
  queQuiere: string;
  dolores: string;
  objetivos: string;
  publico: string;
  diferencial: string;
  tono: string;
  paleta: string;
  referencias: string;
  credenciales: string;
  contacto: string;
  monto: string;
  moneda: string;
  notas: string;
}

export const DISCOVERY_FIELDS: { key: keyof Discovery; label: string; placeholder: string; big?: boolean }[] = [
  { key: 'marca', label: 'Nombre de la marca / cliente', placeholder: 'Ej: Roberto Corvalán — Coach Profesional' },
  { key: 'sector', label: 'Sector / rubro', placeholder: 'Ej: Coaching ejecutivo · Formación' },
  { key: 'tipoProyecto', label: 'Tipo de proyecto', placeholder: 'Ej: Landing Page de marca personal' },
  { key: 'queHace', label: '¿Qué hace la marca?', placeholder: 'En 1-2 frases, a qué se dedica', big: true },
  { key: 'queQuiere', label: '¿Qué quiere el cliente? (objetivo de la reunión)', placeholder: 'Qué pidió, qué espera lograr con la web', big: true },
  { key: 'dolores', label: 'Dolores / problemas', placeholder: 'Del cliente y de su público objetivo', big: true },
  { key: 'objetivos', label: 'Objetivos', placeholder: 'De negocio y de la web (qué acción buscar)', big: true },
  { key: 'publico', label: 'Público objetivo / segmentos', placeholder: 'A quién le habla, edad, perfil, varios segmentos', big: true },
  { key: 'diferencial', label: 'Diferencial / por qué lo elegirían', placeholder: 'Qué lo hace único frente a la competencia', big: true },
  { key: 'credenciales', label: 'Autoridad / credenciales / números', placeholder: 'Certificaciones, años, casos, cifras reales', big: true },
  { key: 'tono', label: 'Tono / personalidad deseada', placeholder: 'Ej: experto, cercano, premium; trato de vos/usted' },
  { key: 'paleta', label: 'Paleta / estética / referencias', placeholder: 'Colores, estilo, webs de referencia' },
  { key: 'contacto', label: 'Contacto y redes', placeholder: 'WhatsApp, email, IG, LinkedIn' },
  { key: 'monto', label: 'Monto del proyecto', placeholder: 'Ej: 500' },
  { key: 'moneda', label: 'Moneda', placeholder: 'ARS / USD' },
  { key: 'notas', label: 'Notas libres de la reunión', placeholder: 'Todo lo demás que se dijo (la IA lo usa)', big: true },
];

export interface Onboarding {
  id: string;
  clientId: string;
  serviceType: ServiceType;
  title: string;
  status: 'active' | 'paused' | 'launched' | 'archived';
  currentPhase: number;
  driveRootLink: string;
  whatsappLink: string;
  domain: string;
  startedAt: number;
  launchedAt: number | null;
  createdAt: number;
  updatedAt: number;
  discovery: Partial<Discovery>;
  // Relaciones (se cargan en el hook, no son columnas)
  steps: OnboardingStep[];
  payments: OnboardingPayment[];
  documents: OnboardingDocument[];
  clientName?: string;
}

export interface OnboardingStep {
  id: string;
  onboardingId: string;
  phase: number;
  phaseName: string;
  title: string;
  description: string;
  owner: StepOwner;
  assignedTo: string;
  status: StepStatus;
  isOptional: boolean;
  link: string;
  dueDate: number | null;
  order: number;
  completedAt: number | null;
}

export interface OnboardingPayment {
  id: string;
  onboardingId: string;
  label: string;
  amount: number;
  currency: 'ARS' | 'USD';
  percentage: number;
  paid: boolean;
  paidAt: number | null;
  dueDate?: number | null;
}

// Reglas/normativas globales (compartidas por el equipo, guardadas en app_settings)
export interface AppSettings {
  stepDeadlineDays: number;     // plazo por defecto para cada paso de MYB
  clientDeadlineDays: number;   // plazo cuando depende del cliente (info, accesos...)
  paymentDeadlineDays: number;  // plazo para registrar/cobrar un pago
}
export const APP_SETTINGS_DEFAULTS: AppSettings = { stepDeadlineDays: 3, clientDeadlineDays: 2, paymentDeadlineDays: 3 };

// ─── HISTORIAL / LEDGER ───
export type HistoryKind = 'pago' | 'entrega' | 'recibido' | 'nota';
export interface HistoryEntry {
  id: string;
  clientId: string | null;
  kind: HistoryKind;
  title: string;
  detail: string;
  amount: number;
  currency: 'ARS' | 'USD';
  receiptPath: string | null;  // path en el bucket privado 'receipts'
  happenedAt: number;
  createdAt: number;
}
export const HISTORY_KINDS: { key: HistoryKind; label: string; color: string }[] = [
  { key: 'pago', label: 'Cobro recibido', color: '#10b981' },
  { key: 'entrega', label: 'Entrega / lo que hicimos', color: '#6366f1' },
  { key: 'recibido', label: 'Recibido del cliente', color: '#0ea5e9' },
  { key: 'nota', label: 'Nota', color: '#64748b' },
];
export const HISTORY_KIND_LABELS: Record<HistoryKind, string> = Object.fromEntries(HISTORY_KINDS.map(k => [k.key, k.label])) as Record<HistoryKind, string>;

// ─── IG CONTENT ───
export type ContentStatus = 'borrador' | 'aprobado' | 'listo';
export type ContentFormat = 'reel' | 'carrusel' | 'story' | 'ad';
export interface ContentPost {
  id: string; format: ContentFormat; objective: string; status: ContentStatus;
  title: string; content: string; edgeLevel: number; score: number;
  scheduledFor: number | null; createdAt: string; updatedAt: string;
}
export interface ContentSource { id: string; type: string; title: string; content: string; tags: string; createdAt: string; updatedAt: string; }
export const CONTENT_STATUSES: { key: ContentStatus; label: string }[] = [
  { key: 'borrador', label: 'Borrador' },
  { key: 'aprobado', label: 'Aprobado' },
  { key: 'listo', label: 'Listo para publicar' },
];
export const CONTENT_FORMATS: ContentFormat[] = ['reel', 'carrusel', 'story', 'ad'];
export const CONTENT_FORMAT_LABELS: Record<ContentFormat, string> = { reel: 'Reel', carrusel: 'Carrusel', story: 'Story', ad: 'Ad' };
export const CONTENT_OBJECTIVES = ['Mensajes (DM)', 'Venta', 'Alcance', 'Seguidores', 'Autoridad'];

// ─── ANÁLISIS DE COMPETENCIA ───
export interface CompetitorAnalysis {
  posicionamiento: string;
  fortalezas: string[];
  debilidades: string[];
  oportunidades: string[];
  recomendaciones: string[];
}
export interface Competitor {
  id: string; clientId: string | null; name: string; instagram: string; website: string;
  rubro: string; notes: string; analysis: CompetitorAnalysis | null; analyzedAt: number | null;
  createdAt: number; updatedAt: number;
}

// Presets de rango de fechas (días hacia atrás; null = todo, 0 = hoy)
export const DATE_RANGES: { key: string; label: string; days: number | null }[] = [
  { key: 'hoy', label: 'Hoy', days: 0 },
  { key: '7', label: 'Últimos 7 días', days: 7 },
  { key: '15', label: 'Últimos 15 días', days: 15 },
  { key: '30', label: 'Últimos 30 días', days: 30 },
  { key: '90', label: 'Últimos 90 días', days: 90 },
  { key: 'all', label: 'Todo el historial', days: null },
];

// ─── GUÍA / CENTRO DE CONOCIMIENTO ───
export type GuideCategory = 'marca' | 'comercial' | 'entrega' | 'tecnico' | 'crecimiento' | 'finanzas';
export interface GuideResource { type: 'video' | 'link' | 'app'; title: string; url: string; platform?: string; }
export interface GuideTopic {
  id: string;
  category: GuideCategory;
  title: string;
  emoji: string;
  summary: string;
  content: string;          // markdown
  resources: GuideResource[];
  order: number;
  createdAt: number;
  updatedAt: number;
}
export const GUIDE_CATEGORIES: { key: GuideCategory; label: string; emoji: string; color: string }[] = [
  { key: 'marca', label: 'Marca & Posicionamiento', emoji: '🎯', color: '#6366f1' },
  { key: 'comercial', label: 'Comercial & Ventas', emoji: '💼', color: '#10b981' },
  { key: 'entrega', label: 'Entrega & Operaciones', emoji: '🚀', color: '#0ea5e9' },
  { key: 'tecnico', label: 'Técnico & Herramientas', emoji: '🛠️', color: '#f59e0b' },
  { key: 'crecimiento', label: 'Crecimiento & Marketing', emoji: '📈', color: '#d946ef' },
  { key: 'finanzas', label: 'Finanzas & Gestión', emoji: '💰', color: '#64748b' },
];
export const GUIDE_CAT_MAP = Object.fromEntries(GUIDE_CATEGORIES.map(c => [c.key, c])) as Record<GuideCategory, typeof GUIDE_CATEGORIES[number]>;

// Spline suave (Catmull-Rom → Bézier) que pasa por todos los puntos. Compartido por
// el mapa del onboarding y el de la guía.
export function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x},${pts[0].y}` : '';
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x},${p2.y}`;
  }
  return d;
}

export interface OnboardingDocument {
  id: string;
  onboardingId: string;
  docType: DocType;
  title: string;
  content: string;
  externalLink: string;
  status: 'pending' | 'in_progress' | 'done';
  updatedAt: number;
}

// % de avance: pasos hechos sobre el total (excluyendo los omitidos)
export const onboardingProgress = (steps: OnboardingStep[]): number => {
  const countable = steps.filter(s => s.status !== 'skipped');
  if (countable.length === 0) return 0;
  const done = countable.filter(s => s.status === 'done').length;
  return Math.round((done / countable.length) * 100);
};

// Próxima acción pendiente (la primera sin hacer ni omitir, por orden)
export const onboardingNextStep = (steps: OnboardingStep[]): OnboardingStep | null =>
  [...steps].sort((a, b) => a.order - b.order).find(s => s.status !== 'done' && s.status !== 'skipped') || null;

// ─── PRE-VENTA ───
export const PRESALE_STAGES = ['prospeccion', 'contacto', 'agendado', 'reunion', 'calificacion', 'propuesta', 'ganado', 'perdido'] as const;
export type PresaleStage = typeof PRESALE_STAGES[number];
export const PRESALE_STAGE_LABELS: Record<PresaleStage, string> = {
  prospeccion: 'Prospección', contacto: 'Contacto', agendado: 'Agendado', reunion: 'Reunión',
  calificacion: 'Calificación', propuesta: 'Propuesta', ganado: 'Ganado', perdido: 'Perdido',
};
export const PRESALE_STAGE_COLORS: Record<PresaleStage, string> = {
  prospeccion: '#64748b', contacto: '#3b82f6', agendado: '#f59e0b', reunion: '#8b5cf6',
  calificacion: '#6366f1', propuesta: '#14b8a6', ganado: '#10b981', perdido: '#ef4444',
};
// Columnas del pipeline (las etapas activas; ganado/perdido se manejan aparte)
export const PRESALE_PIPELINE: PresaleStage[] = ['prospeccion', 'contacto', 'agendado', 'reunion', 'calificacion', 'propuesta'];

// Calificación MINT (Money, Influence, Need, Time)
export const MINT_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: 'money', label: 'Money — Presupuesto', hint: '¿Tiene con qué invertir? ¿Cuánto maneja?' },
  { key: 'influence', label: 'Influence — Decisión', hint: '¿Decide él/ella o hay que convencer a otro?' },
  { key: 'need', label: 'Need — Necesidad', hint: '¿Qué tan real y urgente es el problema?' },
  { key: 'time', label: 'Time — Timing', hint: '¿Para cuándo lo necesita?' },
];

// Checklist de preparación previa a la reunión
export const PREP_ITEMS: { key: string; label: string }[] = [
  { key: 'datos', label: 'Recopilé datos de contacto y del negocio' },
  { key: 'investig', label: 'Investigué su negocio (web, IG, competencia)' },
  { key: 'hipotesis', label: 'Hipótesis de qué necesita / su objetivo' },
  { key: 'preguntas', label: 'Preparé las preguntas de discovery' },
  { key: 'oferta', label: 'Pensé qué servicio le encaja' },
];

// Discovery del prospecto (info de empresa + reunión) → base para la propuesta
export const PROSPECT_DISCOVERY_FIELDS: { key: string; label: string; ph: string; req: boolean; big: boolean }[] = [
  { key: 'queHace', label: '¿Qué hace la empresa?', ph: 'En detalle: a qué se dedica, qué vende, hace cuánto', req: true, big: true },
  { key: 'publico', label: 'Cliente ideal', ph: 'A quién le vende, perfil, zona', req: false, big: true },
  { key: 'dolor', label: 'Principal dolor / problema', ph: 'Lo que más le duele hoy (lo que dijo en la reunión)', req: true, big: true },
  { key: 'objetivo', label: '¿Qué quiere lograr?', ph: 'El resultado concreto que busca', req: true, big: true },
  { key: 'situacion', label: '¿Cómo lo resuelve hoy?', ph: 'Web actual, Instagram, todo a mano...', req: false, big: false },
  { key: 'servicio', label: 'Servicio que le proponemos', ph: 'Landing, Web profesional, Automatización IA...', req: true, big: false },
  { key: 'diferencial', label: '¿Qué lo hace único?', ph: 'Frente a su competencia', req: false, big: true },
  { key: 'queProbo', label: '¿Qué probó y no funcionó?', ph: 'Opcional', req: false, big: false },
];
export const PROSPECT_DISCOVERY_REQUIRED = PROSPECT_DISCOVERY_FIELDS.filter(f => f.req);

export interface Proposal {
  cliente: string;
  subtitulo: string;
  diagnostico: { texto: string; pilares: string[] };
  secciones: { titulo: string; bullets: string[]; descripcion: string }[];
  inversion?: { texto: string; items: string[] };
  proximosPasos: string;
}

// Personalización de marca y contenido de la presentación (lo carga MYB, no la IA)
export interface Brand {
  primary?: string;       // color principal
  secondary?: string;     // color de acento
  logoUrl?: string;       // logo de la marca del cliente
  coverUrl?: string;      // foto de portada (hero)
  videoUrl?: string;      // link de video (Loom / YouTube)
  waMyb?: string;         // WhatsApp de MYB para el botón "Quiero avanzar"
  sectionImages?: Record<number, string>; // foto por sección (índice del pilar)
  metricas?: { valor: string; label: string }[];
  testimonios?: { texto: string; autor: string }[];
}

// Paletas listas para elegir al armar la propuesta
export const PROPOSAL_THEMES: { name: string; primary: string; secondary: string }[] = [
  { name: 'MYB (índigo)', primary: '#6366f1', secondary: '#10b981' },
  { name: 'Esmeralda', primary: '#10b981', secondary: '#6366f1' },
  { name: 'Océano', primary: '#0ea5e9', secondary: '#22d3ee' },
  { name: 'Atardecer', primary: '#f59e0b', secondary: '#ef4444' },
  { name: 'Magenta', primary: '#d946ef', secondary: '#8b5cf6' },
  { name: 'Rubí', primary: '#e11d48', secondary: '#f59e0b' },
  { name: 'Bosque', primary: '#16a34a', secondary: '#84cc16' },
  { name: 'Grafito', primary: '#64748b', secondary: '#0ea5e9' },
];

export interface Prospect {
  id: string;
  name: string;
  business: string;
  source: string;
  stage: PresaleStage;
  contact: { whatsapp?: string; email?: string; instagram?: string };
  meetingAt: number | null;
  mint: Record<string, string>;
  prep: Record<string, boolean>;
  discovery: Record<string, string>;
  notes: string;
  proposal: Proposal | null;
  brand?: Brand;
  shareToken?: string | null;
  shareExpires?: number | null;
  clientId?: string | null;   // si ya se convirtió en cliente
  createdAt: number;
  updatedAt: number;
}

// ─── NOTIFICACIONES / RECORDATORIOS ───
export interface Reminder { id: string; title: string; dueAt: number | null; done: boolean; createdAt: number; }

export type NotifKind = 'payment' | 'step' | 'calendar' | 'meeting' | 'proposal' | 'reminder';
export interface NotifItem {
  id: string;            // clave estable (ej: "pay:<id>") para marcar como leído
  kind: NotifKind;
  title: string;
  body?: string;
  dueAt?: number | null; // cuándo aplica (orden / "vencido")
  priority: 'high' | 'normal' | 'low';
  goto?: string;         // pestaña a la que lleva al tocarla
}
export interface NotifSettings {
  payments: boolean; steps: boolean; calendar: boolean; meetings: boolean; proposals: boolean; reminders: boolean;
  leadDays: number;      // ventana de anticipación para eventos del calendario
  browserPush: boolean;  // notificaciones del navegador (pop-ups)
}
export const NOTIF_DEFAULTS: NotifSettings = { payments: true, steps: true, calendar: true, meetings: true, proposals: true, reminders: true, leadDays: 7, browserPush: false };
export const NOTIF_KIND_LABELS: Record<NotifKind, string> = { payment: 'Pago', step: 'Onboarding', calendar: 'Calendario', meeting: 'Reunión', proposal: 'Propuesta', reminder: 'Recordatorio' };

// Tiempo relativo en español ("en 2 h", "hace 3 días")
export function fmtRel(ms: number): string {
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  let unit: string;
  if (abs < 3600000) unit = `${Math.max(1, Math.round(abs / 60000))} min`;
  else if (abs < 86400000) unit = `${Math.round(abs / 3600000)} h`;
  else { const d = Math.round(abs / 86400000); unit = `${d} día${d === 1 ? '' : 's'}`; }
  return diff < 0 ? `hace ${unit}` : `en ${unit}`;
}

