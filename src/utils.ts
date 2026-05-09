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
