import { storage, uuid } from './utils';
import type { Skill, Board, TaskCard, CalEvent } from './utils';

export function loadDemoData() {
  // Clear old
  const sIds: string[] = storage.get('skills:list') || [];
  sIds.forEach(id => storage.del(`skills:detail:${id}`));
  const bIds: string[] = storage.get('tasks:boards') || [];
  bIds.forEach(id => {
    const cIds: string[] = storage.get(`tasks:cards:${id}`) || [];
    cIds.forEach(cid => storage.del(`tasks:card:${cid}`));
    storage.del(`tasks:cards:${id}`);
    storage.del(`tasks:board:${id}`);
  });
  const eIds: string[] = storage.get('calendar:events') || [];
  eIds.forEach(id => storage.del(`calendar:event:${id}`));

  // ─── SKILLS ───
  const skills: Skill[] = [
    { id: uuid(), name: 'React / Next.js', category: 'Frontend', level: 5, description: 'Desarrollo de interfaces modernas con React 19 y Next.js 16. SSR, SSG, App Router.', assignedTo: ['Benjamín'], color: '#6366f1', createdAt: Date.now(), updatedAt: Date.now() },
    { id: uuid(), name: 'Automatización con IA', category: 'IA/Automation', level: 5, description: 'Diseño de flujos automatizados con n8n, Make, Claude y agentes autónomos.', assignedTo: ['Benjamín', 'Matías'], color: '#10b981', createdAt: Date.now(), updatedAt: Date.now() },
    { id: uuid(), name: 'Supabase / PostgreSQL', category: 'Backend', level: 4, description: 'Bases de datos, RLS, Edge Functions, realtime subscriptions.', assignedTo: ['Benjamín'], color: '#3b82f6', createdAt: Date.now(), updatedAt: Date.now() },
    { id: uuid(), name: 'Diseño UI/UX', category: 'Design', level: 4, description: 'Interfaces premium, animaciones, diseño mobile-first, sistemas de diseño.', assignedTo: ['Benjamín'], color: '#8b5cf6', createdAt: Date.now(), updatedAt: Date.now() },
    { id: uuid(), name: 'Marketing de Contenidos', category: 'Marketing', level: 3, description: 'Estrategia de carruseles, copywriting, funnels de conversión para Instagram.', assignedTo: ['Matías'], color: '#f59e0b', createdAt: Date.now(), updatedAt: Date.now() },
  ];
  storage.set('skills:list', skills.map(s => s.id));
  skills.forEach(s => storage.set(`skills:detail:${s.id}`, s));

  // ─── BOARD ───
  const cols = [
    { id: uuid(), name: 'Por Hacer', order: 0 },
    { id: uuid(), name: 'En Proceso', order: 1 },
    { id: uuid(), name: 'Revisión', order: 2 },
    { id: uuid(), name: 'Completado', order: 3 },
  ];
  const board: Board = { id: uuid(), name: 'MYB Digitals — General', description: 'Tablero principal del equipo', columns: cols, createdAt: Date.now() };
  storage.set('tasks:boards', [board.id]);
  storage.set(`tasks:board:${board.id}`, board);

  const now = Date.now();
  const DAY = 86400000;
  const tasks: TaskCard[] = [
    { id: uuid(), boardId: board.id, columnId: cols[0].id, title: 'Diseñar carrusel de n8n', description: 'Crear carrusel educativo sobre automatizaciones con n8n', assignedTo: ['Matías'], priority: 'medium', dueDate: now + 3 * DAY, tags: ['contenido', 'instagram'], createdAt: now, updatedAt: now, order: 1 },
    { id: uuid(), boardId: board.id, columnId: cols[0].id, title: 'Landing page para cliente X', description: 'Diseñar y desarrollar landing de conversión', assignedTo: ['Benjamín'], priority: 'high', dueDate: now + 5 * DAY, tags: ['web', 'cliente'], createdAt: now, updatedAt: now, order: 2 },
    { id: uuid(), boardId: board.id, columnId: cols[0].id, title: 'Configurar ManyChat para DMs', description: 'Automatizar respuestas en Instagram DMs', assignedTo: ['Matías'], priority: 'low', dueDate: now + 7 * DAY, tags: ['automatización'], createdAt: now, updatedAt: now, order: 3 },
    { id: uuid(), boardId: board.id, columnId: cols[1].id, title: 'Dashboard de gestión MYB', description: 'App interna para gestionar tareas y skills', assignedTo: ['Benjamín'], priority: 'urgent', dueDate: now + 1 * DAY, tags: ['interno', 'dev'], createdAt: now, updatedAt: now, order: 4 },
    { id: uuid(), boardId: board.id, columnId: cols[1].id, title: 'Auditoría SEO - Imperio Moda', description: 'Revisar meta tags, velocidad y estructura del sitio', assignedTo: ['Benjamín'], priority: 'high', dueDate: now + 2 * DAY, tags: ['seo', 'cliente'], createdAt: now, updatedAt: now, order: 5 },
    { id: uuid(), boardId: board.id, columnId: cols[2].id, title: 'Batch carruseles de valor', description: 'Revisar y aprobar los 3 carruseles de valor (A1, A9, A2)', assignedTo: ['Benjamín', 'Matías'], priority: 'medium', dueDate: now + 1 * DAY, tags: ['contenido'], createdAt: now, updatedAt: now, order: 6 },
    { id: uuid(), boardId: board.id, columnId: cols[2].id, title: 'Flujo WhatsApp automatizado', description: 'Testear flow de respuesta automática con IA', assignedTo: ['Benjamín'], priority: 'high', dueDate: now, tags: ['automatización', 'testing'], createdAt: now, updatedAt: now, order: 7 },
    { id: uuid(), boardId: board.id, columnId: cols[3].id, title: 'Web MYB Digitals v2', description: 'Redesign completo con esporas y cursor custom', assignedTo: ['Benjamín'], priority: 'urgent', dueDate: now - 2 * DAY, tags: ['web', 'branding'], createdAt: now, updatedAt: now, order: 8 },
    { id: uuid(), boardId: board.id, columnId: cols[3].id, title: 'Invitaciones digitales', description: 'Módulo de invitaciones de boda funcional', assignedTo: ['Benjamín'], priority: 'high', dueDate: now - 5 * DAY, tags: ['web', 'producto'], createdAt: now, updatedAt: now, order: 9 },
    { id: uuid(), boardId: board.id, columnId: cols[3].id, title: 'Propuesta comercial Imperio', description: 'Documento PDF con propuesta de e-commerce', assignedTo: ['Matías'], priority: 'medium', dueDate: now - 7 * DAY, tags: ['ventas'], createdAt: now, updatedAt: now, order: 10 },
  ];
  storage.set(`tasks:cards:${board.id}`, tasks.map(t => t.id));
  tasks.forEach(t => storage.set(`tasks:card:${t.id}`, t));

  // ─── EVENTS ───
  const events: CalEvent[] = [
    { id: uuid(), title: 'Call con cliente potencial', description: 'Diagnóstico gratuito de automatización', startDate: now + 1 * DAY + 36000000, endDate: now + 1 * DAY + 39600000, type: 'meeting', assignedTo: ['Benjamín'], relatedTaskId: null, color: '#3b82f6', allDay: false, createdAt: now },
    { id: uuid(), title: 'Entrega Landing Page', description: 'Entregar landing page al cliente X', startDate: now + 5 * DAY, endDate: now + 5 * DAY, type: 'deadline', assignedTo: ['Benjamín'], relatedTaskId: null, color: '#ef4444', allDay: true, createdAt: now },
    { id: uuid(), title: 'Publicar carrusel V2', description: 'Publicar carrusel de automatización', startDate: now + 2 * DAY + 50400000, endDate: now + 2 * DAY + 54000000, type: 'task', assignedTo: ['Matías'], relatedTaskId: null, color: '#10b981', allDay: false, createdAt: now },
    { id: uuid(), title: 'Review semanal MYB', description: 'Reunión de equipo semanal', startDate: now + 3 * DAY + 36000000, endDate: now + 3 * DAY + 39600000, type: 'meeting', assignedTo: ['Benjamín', 'Matías'], relatedTaskId: null, color: '#6366f1', allDay: false, createdAt: now },
    { id: uuid(), title: 'Renovar dominio mybdigitals.com', description: 'Vence el dominio principal', startDate: now + 15 * DAY, endDate: now + 15 * DAY, type: 'reminder', assignedTo: ['Benjamín'], relatedTaskId: null, color: '#f59e0b', allDay: true, createdAt: now },
    { id: uuid(), title: 'Publicar carrusel A1', description: 'IA mal usada — carrusel de valor', startDate: now + 4 * DAY + 50400000, endDate: now + 4 * DAY + 54000000, type: 'task', assignedTo: ['Matías'], relatedTaskId: null, color: '#10b981', allDay: false, createdAt: now },
    { id: uuid(), title: 'Call Imperio de la Moda', description: 'Review de avances del e-commerce', startDate: now + 6 * DAY + 32400000, endDate: now + 6 * DAY + 36000000, type: 'meeting', assignedTo: ['Benjamín', 'Matías'], relatedTaskId: null, color: '#3b82f6', allDay: false, createdAt: now },
    { id: uuid(), title: 'Facturación mensual', description: 'Facturar clientes activos', startDate: now + 20 * DAY, endDate: now + 20 * DAY, type: 'deadline', assignedTo: ['Matías'], relatedTaskId: null, color: '#ef4444', allDay: true, createdAt: now },
  ];
  storage.set('calendar:events', events.map(e => e.id));
  events.forEach(e => storage.set(`calendar:event:${e.id}`, e));
}
