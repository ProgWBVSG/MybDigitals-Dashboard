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
