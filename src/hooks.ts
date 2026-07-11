import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { uuid, type Skill, type Board, type TaskCard, type CalEvent, type Client, type Expense, type Goal, type ClientProject, type ClientNote,
  type Onboarding, type OnboardingStep, type OnboardingPayment, type OnboardingDocument, type ServiceType, type Prospect,
  type Reminder, type NotifItem, type NotifSettings, NOTIF_DEFAULTS, fmtRel,
  type AppSettings, APP_SETTINGS_DEFAULTS, type HistoryEntry, type GuideTopic,
  type ContentPost, type ContentSource, type Competitor } from './utils';
import { getPlaybook } from './playbooks';
import { GUIDE_SEED } from './guideSeed';
import { supabase } from './supabase';

// ─── TOAST ───
type ToastType = 'success' | 'error' | 'info';
interface Toast { id: string; msg: string; type: ToastType; }

let _setToasts: React.Dispatch<React.SetStateAction<Toast[]>> | null = null;

export function useToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  _setToasts = setToasts;
  return toasts;
}

export function toast(msg: string, type: ToastType = 'success') {
  if (!_setToasts) return;
  const id = uuid();
  _setToasts(prev => [...prev, { id, msg, type }]);
  setTimeout(() => _setToasts!(prev => prev.filter(t => t.id !== id)), 3000);
}

// ─── MAPPERS (camelCase <-> snake_case) ───
const mapToCamel = (obj: any) => {
  if (!obj) return obj;
  const newObj: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
    // Convert date strings to timestamps for frontend
    if (['created_at', 'updated_at'].includes(key) && typeof obj[key] === 'string') {
      newObj[camelKey] = new Date(obj[key]).getTime();
    } else {
      newObj[camelKey] = obj[key];
    }
  }
  return newObj;
};

const mapToSnake = (obj: any) => {
  if (!obj) return obj;
  const newObj: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    // Don't override created_at/updated_at manually, DB handles it usually, but we pass it anyway
    if (['createdAt', 'updatedAt'].includes(key)) {
      newObj[snakeKey] = new Date(obj[key]).toISOString();
    } else {
      newObj[snakeKey] = obj[key];
    }
  }
  return newObj;
};

// ─── SKILLS HOOK ───
export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('skills').select('*');
    if (!error && data) {
      setSkills(data.map(d => {
        const camel = mapToCamel(d);
        let desc = camel.description || '';
        let links = '';
        try {
          if (desc.startsWith('{')) {
            const meta = JSON.parse(desc);
            if (meta.text !== undefined) {
              desc = meta.text;
              links = meta.links || '';
            }
          }
        } catch (e) {}
        return { ...camel, description: desc, links, importance: camel.importance || 'recomendada', serviceTypes: camel.serviceTypes || [] };
      }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const sub = supabase.channel('skills_changes_' + uuid())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'skills' }, load)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load]);

  const create = async (data: Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>) => {
    const metaDesc = JSON.stringify({ text: data.description, links: data.links || '' });
    const { links, description, ...rest } = data as any;
    const { error } = await supabase.from('skills').insert([mapToSnake({ ...rest, description: metaDesc })]);
    if (error) {
      console.error('Skill DB Error:', error);
      toast(`Error: ${error.message}`, 'error');
    } else toast('Skill creada');
  };

  const update = async (id: string, updates: Partial<Skill>) => {
    let payload = { ...updates, updatedAt: Date.now() };
    if (updates.description !== undefined || updates.links !== undefined) {
      const current = skills.find(s => s.id === id);
      const newDesc = updates.description !== undefined ? updates.description : (current?.description || '');
      const newLinks = updates.links !== undefined ? updates.links : (current?.links || '');
      const metaDesc = JSON.stringify({ text: newDesc, links: newLinks });
      const { links, description, ...rest } = payload as any;
      payload = { ...rest, description: metaDesc };
    }
    const { error } = await supabase.from('skills').update(mapToSnake(payload)).eq('id', id);
    if (error) toast('Error al actualizar', 'error');
    else toast('Skill actualizada');
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('skills').delete().eq('id', id);
    if (error) toast('Error al eliminar', 'error');
    else toast('Skill eliminada');
  };

  return { skills, loading, create, update, remove, refresh: load };
}

// ─── BOARDS + TASKS HOOK ───
export function useTasks() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [cards, setCards] = useState<TaskCard[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBoards = useCallback(async () => {
    const { data, error } = await supabase.from('boards').select('*');
    if (!error && data) {
      const mapped = data.map(mapToCamel);
      setBoards(mapped);
      if (mapped.length > 0 && !activeBoardId) setActiveBoardId(mapped[0].id);
    }
    setLoading(false);
  }, [activeBoardId]);

  const loadCards = useCallback(async (boardId: string) => {
    const { data, error } = await supabase.from('tasks').select('*').eq('board_id', boardId);
    if (!error && data) setCards(data.map(mapToCamel));
  }, []);

  useEffect(() => { loadBoards(); }, [loadBoards]);
  useEffect(() => { if (activeBoardId) loadCards(activeBoardId); }, [activeBoardId, loadCards]);

  useEffect(() => {
    const subBoards = supabase.channel('boards_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, loadBoards).subscribe();
    const subTasks = supabase.channel('tasks_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
      if (activeBoardId) loadCards(activeBoardId);
    }).subscribe();
    return () => { supabase.removeChannel(subBoards); supabase.removeChannel(subTasks); };
  }, [loadBoards, loadCards, activeBoardId]);

  const createBoard = async (name: string, description = '') => {
    const cols = [
      { id: uuid(), name: 'Por Hacer', order: 0 },
      { id: uuid(), name: 'En Proceso', order: 1 },
      { id: uuid(), name: 'Revisión', order: 2 },
      { id: uuid(), name: 'Completado', order: 3 },
    ];
    const { data, error } = await supabase.from('boards').insert([{ name, description, columns: cols }]).select().single();
    if (!error && data) {
      setActiveBoardId(data.id);
      toast('Tablero creado');
    } else {
      console.error('Board creation error:', error);
      toast(`Error al crear tablero: ${error?.message || 'Desconocido'}`, 'error');
    }
  };

  const deleteBoard = async (id: string) => {
    const { error } = await supabase.from('boards').delete().eq('id', id);
    if (error) toast('Error al eliminar', 'error');
    else {
      if (activeBoardId === id) setActiveBoardId(null);
      toast('Tablero eliminado');
    }
  };

  const createCard = async (data: Omit<TaskCard, 'id' | 'createdAt' | 'updatedAt' | 'order'>) => {
    const payload = { ...data, order: Date.now() };
    const { error } = await supabase.from('tasks').insert([mapToSnake(payload)]);
    if (error) toast('Error al crear tarea', 'error');
    else toast('Tarea creada');
  };

  const updateCard = async (id: string, updates: Partial<TaskCard>) => {
    const { error } = await supabase.from('tasks').update(mapToSnake({ ...updates, updatedAt: Date.now() })).eq('id', id);
    if (error) toast('Error al actualizar', 'error');
    else toast('Tarea actualizada');
  };

  const moveCard = async (cardId: string, newColumnId: string) => {
    // Optimistic update
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, columnId: newColumnId } : c));
    await supabase.from('tasks').update({ column_id: newColumnId, updated_at: new Date().toISOString() }).eq('id', cardId);
  };

  const deleteCard = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) toast('Error al eliminar', 'error');
    else toast('Tarea eliminada');
  };

  return {
    boards, cards, activeBoardId, loading,
    setActiveBoardId, createBoard, deleteBoard,
    createCard, updateCard, moveCard, deleteCard,
    refresh: () => { loadBoards(); if (activeBoardId) loadCards(activeBoardId); }
  };
}

// ─── CALENDAR HOOK ───
export function useCalendar() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('calendar_events').select('*');
    if (!error && data) setEvents(data.map(mapToCamel));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const sub = supabase.channel('cal_changes_' + uuid())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, load)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load]);

  const create = async (data: Omit<CalEvent, 'id' | 'createdAt'>) => {
    const { error } = await supabase.from('calendar_events').insert([mapToSnake(data)]);
    if (error) toast('Error al crear evento', 'error');
    else toast('Evento creado');
  };

  const update = async (id: string, updates: Partial<CalEvent>) => {
    const { error } = await supabase.from('calendar_events').update(mapToSnake(updates)).eq('id', id);
    if (error) toast('Error al actualizar', 'error');
    else toast('Evento actualizado');
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id);
    if (error) toast('Error al eliminar', 'error');
    else toast('Evento eliminado');
  };

  return { events, loading, create, update, remove, refresh: load };
}

// ─── CLIENTS HOOK (CRM) ───
export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: clientsData, error: errC } = await supabase.from('clients').select('*');
    const { data: projectsData } = await supabase.from('client_projects').select('*');
    const { data: notesData } = await supabase.from('client_notes').select('*');

    if (!errC && clientsData) {
      setClients(clientsData.map(c => {
        const camel = mapToCamel(c);
        return {
          ...camel,
          contact: c.contact || { email: '', whatsapp: '', instagram: '' },
          projects: projectsData ? projectsData.filter(p => p.client_id === c.id).map(p => {
            const mappedProj = mapToCamel(p);
            let desc = mappedProj.description || '';
            let currency = 'ARS';
            let links = '';
            let paidPercentage = 0;
            try {
              if (desc.startsWith('{')) {
                const meta = JSON.parse(desc);
                if (meta.text !== undefined) {
                  desc = meta.text;
                  currency = meta.currency || 'ARS';
                  links = meta.links || '';
                  paidPercentage = meta.paidPercentage || 0;
                }
              }
            } catch (e) {}
            return { ...mappedProj, description: desc, currency, links, paidPercentage };
          }) : [],
          notes: notesData ? notesData.filter(n => n.client_id === c.id).map(mapToCamel).sort((a: any, b: any) => b.createdAt - a.createdAt) : []
        };
      }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const subC = supabase.channel('clients_ch').on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, load).subscribe();
    const subP = supabase.channel('projs_ch').on('postgres_changes', { event: '*', schema: 'public', table: 'client_projects' }, load).subscribe();
    const subN = supabase.channel('notes_ch').on('postgres_changes', { event: '*', schema: 'public', table: 'client_notes' }, load).subscribe();
    return () => { supabase.removeChannel(subC); supabase.removeChannel(subP); supabase.removeChannel(subN); };
  }, [load]);

  const create = async (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'projects' | 'notes'> & { projects?: ClientProject[], notes?: ClientNote[] }) => {
    // Remove projects, notes, and the derived totalRevenueUSD
    const { projects, notes, totalRevenueUSD, ...rest } = data as any;
    const payload = mapToSnake(rest);
    
    const { data: createdClient, error } = await supabase.from('clients').insert([payload]).select().single();
    if (error) {
      console.error('Full DB Error:', error);
      toast('Error al crear cliente', 'error');
      return null;
    } else {
      if (createdClient && projects && projects.length > 0) {
        for (const p of projects) {
          const metaDesc = JSON.stringify({ text: p.description, currency: p.currency, links: p.links, paidPercentage: p.paidPercentage || 0 });
          const { currency, links, description, paidPercentage, ...dbProj } = p as any;
          const mapped = mapToSnake({ ...dbProj, description: metaDesc, clientId: createdClient.id });
          await supabase.from('client_projects').insert(mapped);
        }
        const revenueARS = projects.filter((p: any) => p.status !== 'cancelled' && p.currency === 'ARS').reduce((s: number, p: any) => s + p.value, 0);
        await supabase.from('clients').update({ total_revenue: revenueARS }).eq('id', createdClient.id);
      }
      toast('Cliente creado');
      return createdClient?.id as string ?? null;
    }
  };

  const update = async (id: string, updates: Partial<Client>) => {
    // Remove projects, notes, and the derived totalRevenueUSD
    const { projects, notes, totalRevenueUSD, ...clientFields } = updates;
    const payload = mapToSnake(clientFields);

    if (Object.keys(payload).length > 0) {
      const { error } = await supabase.from('clients').update({
        ...payload,
        updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) toast('Error al actualizar cliente', 'error');
    }

    // Proyectos (Add/Update/Delete)
    if (projects) {
      const existing = clients.find(c => c.id === id)?.projects || [];
      const incomingIds = projects.map(p => p.id);
      
      // Upsert projects
      for (const p of projects) {
        // Pack metadata into description to avoid schema errors
        const metaDesc = JSON.stringify({ text: p.description, currency: p.currency, links: p.links, paidPercentage: p.paidPercentage || 0 });
        const { currency, links, description, paidPercentage, ...dbProj } = p as any;
        const mapped = mapToSnake({ ...dbProj, description: metaDesc, clientId: id });
        
        if (p.id) {
           await supabase.from('client_projects').upsert(mapped);
        } else {
           await supabase.from('client_projects').insert(mapped);
        }
      }
      // Delete removed projects
      const toDelete = existing.filter(p => !incomingIds.includes(p.id));
      if (toDelete.length > 0) {
        await supabase.from('client_projects').delete().in('id', toDelete.map(d => d.id));
      }

      const revenueARS = projects.filter(p => p.status !== 'cancelled' && p.currency === 'ARS').reduce((s, p) => s + p.value, 0);
      await supabase.from('clients').update({ total_revenue: revenueARS }).eq('id', id);
    }

    // Notas (Add only)
    if (notes) {
      const existing = clients.find(c => c.id === id)?.notes || [];
      const newNotes = notes.filter(n => !existing.some(e => e.id === n.id));
      for (const n of newNotes) {
         await supabase.from('client_notes').insert(mapToSnake({ ...n, clientId: id }));
      }
    }
    
    toast('Cliente guardado');
  };

  const remove = async (id: string) => {
    // Delete Cascade configurado en DB, basta con borrar el cliente
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) toast('Error al eliminar', 'error');
    else toast('Cliente eliminado');
  };

  return { clients, loading, create, update, remove, refresh: load };
}

// ─── FINANCE HOOK (Expenses & Goals) ───
export function useFinance() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: expData } = await supabase.from('expenses').select('*');
    const { data: goalData } = await supabase.from('goals').select('*');
    if (expData) setExpenses(expData.map(mapToCamel));
    if (goalData) setGoals(goalData.map(mapToCamel));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const subE = supabase.channel('exp_ch').on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, load).subscribe();
    const subG = supabase.channel('goal_ch').on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, load).subscribe();
    return () => { supabase.removeChannel(subE); supabase.removeChannel(subG); };
  }, [load]);

  const addExpense = async (data: Omit<Expense, 'id' | 'date'>) => {
    const { error } = await supabase.from('expenses').insert([mapToSnake(data)]);
    if (error) toast('Error al agregar gasto', 'error');
    else toast('Gasto registrado');
  };

  const removeExpense = async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id);
    toast('Gasto eliminado');
  };

  const addGoal = async (data: Omit<Goal, 'id' | 'createdAt'>) => {
    const { error } = await supabase.from('goals').insert([mapToSnake(data)]);
    if (error) toast('Error al crear objetivo', 'error');
    else toast('Objetivo creado');
  };

  const updateGoal = async (id: string, updates: Partial<Goal>) => {
    await supabase.from('goals').update(mapToSnake(updates)).eq('id', id);
  };

  const removeGoal = async (id: string) => {
    await supabase.from('goals').delete().eq('id', id);
    toast('Objetivo eliminado');
  };

  return { expenses, goals, loading, addExpense, removeExpense, addGoal, updateGoal, removeGoal, refresh: load };
}

// ─── ONBOARDINGS HOOK ───
export function useOnboardings() {
  const [onboardings, setOnboardings] = useState<Onboarding[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: obData, error } = await supabase.from('onboardings').select('*');
    const { data: stepData } = await supabase.from('onboarding_steps').select('*');
    const { data: payData } = await supabase.from('onboarding_payments').select('*');
    const { data: docData } = await supabase.from('onboarding_documents').select('*');
    const { data: clientData } = await supabase.from('clients').select('id, name');

    if (!error && obData) {
      const nameOf = (id: string) => clientData?.find((c: any) => c.id === id)?.name || '';
      setOnboardings(obData.map(o => {
        const camel = mapToCamel(o);
        return {
          ...camel,
          clientName: nameOf(o.client_id),
          steps: stepData ? stepData.filter(s => s.onboarding_id === o.id).map(mapToCamel).sort((a: any, b: any) => a.order - b.order) : [],
          payments: payData ? payData.filter(p => p.onboarding_id === o.id).map(mapToCamel) : [],
          documents: docData ? docData.filter(d => d.onboarding_id === o.id).map(mapToCamel) : [],
        };
      }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel('onboarding_all_' + uuid())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'onboardings' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'onboarding_steps' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'onboarding_payments' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'onboarding_documents' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  // Crea el onboarding y "materializa" el playbook en filas reales
  const create = async (clientId: string, serviceType: ServiceType, title: string): Promise<string | null> => {
    const playbook = getPlaybook(serviceType);
    if (!playbook) { toast('Ese servicio todavía no tiene playbook', 'error'); return null; }

    const now = Date.now();
    const { data: ob, error } = await supabase.from('onboardings').insert([mapToSnake({
      clientId, serviceType, title, status: 'active', currentPhase: 0,
      driveRootLink: '', whatsappLink: '', domain: '', startedAt: now, launchedAt: null,
    })]).select().single();

    if (error || !ob) {
      console.error('Onboarding create error:', error);
      toast(`Error al crear onboarding: ${error?.message || ''}`, 'error');
      return null;
    }

    const steps = playbook.steps.map((s, i) => mapToSnake({
      onboardingId: ob.id, phase: s.phase, phaseName: s.phaseName, title: s.title,
      description: s.description, owner: s.owner, assignedTo: '', status: 'pending',
      isOptional: !!s.isOptional, link: '', dueDate: null, order: i, completedAt: null,
    }));
    const payments = playbook.payments.map(p => mapToSnake({
      onboardingId: ob.id, label: p.label, amount: 0, currency: 'ARS',
      percentage: p.percentage, paid: false, paidAt: null,
    }));
    const documents = playbook.documents.map(d => mapToSnake({
      onboardingId: ob.id, docType: d.docType, title: d.title,
      content: d.content, externalLink: '', status: 'pending',
    }));

    const [{ error: e1 }, { error: e2 }, { error: e3 }] = await Promise.all([
      supabase.from('onboarding_steps').insert(steps),
      supabase.from('onboarding_payments').insert(payments),
      supabase.from('onboarding_documents').insert(documents),
    ]);
    if (e1 || e2 || e3) {
      console.error('Materialize error:', e1 || e2 || e3);
      toast('Onboarding creado, pero falló parte del playbook', 'error');
    } else {
      toast('Onboarding creado');
    }
    return ob.id as string;
  };

  const update = async (id: string, updates: Partial<Onboarding>) => {
    const { steps, payments, documents, clientName, createdAt, ...fields } = updates as any;
    const { error } = await supabase.from('onboardings').update(mapToSnake({ ...fields, updatedAt: Date.now() })).eq('id', id);
    if (error) toast('Error al actualizar', 'error');
  };

  const updateStep = async (id: string, updates: Partial<OnboardingStep>) => {
    const payload: any = { ...updates };
    if (updates.status !== undefined) {
      payload.completedAt = updates.status === 'done' ? Date.now() : null;
    }
    const { error } = await supabase.from('onboarding_steps').update(mapToSnake(payload)).eq('id', id);
    if (error) toast('Error al actualizar el paso', 'error');
  };

  // Agrega un paso personalizado a un onboarding (al final de su fase)
  const addStep = async (onboardingId: string, step: { phase: number; phaseName: string; title: string; owner: OnboardingStep['owner']; isOptional?: boolean }) => {
    const ob = onboardings.find(o => o.id === onboardingId);
    const maxOrder = ob && ob.steps.length ? Math.max(...ob.steps.map(s => s.order)) : -1;
    const { error } = await supabase.from('onboarding_steps').insert(mapToSnake({
      onboardingId, phase: step.phase, phaseName: step.phaseName, title: step.title,
      description: '', owner: step.owner, assignedTo: '', status: 'pending',
      isOptional: !!step.isOptional, link: '', dueDate: null, order: maxOrder + 1, completedAt: null,
    }));
    if (error) toast('No se pudo agregar el paso', 'error'); else toast('Paso agregado');
  };

  const removeStep = async (id: string) => {
    const { error } = await supabase.from('onboarding_steps').delete().eq('id', id);
    if (error) toast('No se pudo borrar el paso', 'error');
  };

  const updatePayment = async (id: string, updates: Partial<OnboardingPayment>) => {
    const payload: any = { ...updates };
    if (updates.paid !== undefined) payload.paidAt = updates.paid ? Date.now() : null;
    const { error } = await supabase.from('onboarding_payments').update(mapToSnake(payload)).eq('id', id);
    if (error) toast('Error al actualizar el pago', 'error');
  };

  const updateDocument = async (id: string, updates: Partial<OnboardingDocument>) => {
    const { error } = await supabase.from('onboarding_documents').update(mapToSnake({ ...updates, updatedAt: Date.now() })).eq('id', id);
    if (error) toast('Error al guardar el documento', 'error');
    else toast('Documento guardado');
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('onboardings').delete().eq('id', id);
    if (error) toast('Error al eliminar', 'error');
    else toast('Onboarding eliminado');
  };

  return { onboardings, loading, create, update, updateStep, updatePayment, updateDocument, addStep, removeStep, remove, refresh: load };
}

// ─── PRE-VENTA (PROSPECTS) HOOK ───
export function useProspects() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('prospects').select('*');
    if (!error && data) {
      setProspects(data.map(p => {
        const c = mapToCamel(p);
        return { ...c, contact: p.contact || {}, mint: p.mint || {}, prep: p.prep || {}, discovery: p.discovery || {}, proposal: p.proposal ?? null, brand: p.brand || {} };
      }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel('prospects_ch_' + uuid())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prospects' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const create = async (data: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> => {
    const { data: created, error } = await supabase.from('prospects').insert([mapToSnake(data)]).select().single();
    if (error) { console.error('Prospect create error:', error); toast('Error al crear prospecto', 'error'); return null; }
    toast('Prospecto creado');
    return created?.id ?? null;
  };

  const update = async (id: string, updates: Partial<Prospect>) => {
    const { error } = await supabase.from('prospects').update(mapToSnake({ ...updates, updatedAt: Date.now() })).eq('id', id);
    if (error) toast('Error al actualizar', 'error');
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('prospects').delete().eq('id', id);
    if (error) toast('Error al eliminar', 'error');
    else toast('Prospecto eliminado');
  };

  return { prospects, loading, create, update, remove, refresh: load };
}

// ─── CONFIGURACIÓN GLOBAL (normativas de plazos, compartida) ───
export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(APP_SETTINGS_DEFAULTS);
  const load = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('data').eq('id', 'global').maybeSingle();
    if (data?.data) setSettings({ ...APP_SETTINGS_DEFAULTS, ...data.data });
  }, []);
  useEffect(() => {
    load();
    const ch = supabase.channel('appsettings_' + uuid()).on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);
  const update = async (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    const { error } = await supabase.from('app_settings').update({ data: next, updated_at: Date.now() }).eq('id', 'global');
    if (error) toast('No se pudo guardar la configuración', 'error'); else toast('Configuración guardada');
  };
  return { settings, update };
}

// ─── NOTIFICACIONES (centro / "secretario" que vigila lo pendiente) ───
const LS_NOTIF_SETTINGS = 'myb_notif_settings';
const LS_NOTIF_READ = 'myb_notif_read';
const LS_NOTIF_PUSHED = 'myb_notif_pushed';
const DAY = 86400000;

export function useNotifications() {
  const { onboardings } = useOnboardings();
  const { events } = useCalendar();
  const { prospects } = useProspects();
  const { settings: rules } = useAppSettings();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [settings, setSettingsState] = useState<NotifSettings>(() => {
    try { const v = localStorage.getItem(LS_NOTIF_SETTINGS); return v ? { ...NOTIF_DEFAULTS, ...JSON.parse(v) } : NOTIF_DEFAULTS; } catch { return NOTIF_DEFAULTS; }
  });
  const [readIds, setReadIds] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(LS_NOTIF_READ) || '[]'); } catch { return []; } });
  const [tick, setTick] = useState(0);

  const loadRem = useCallback(async () => {
    const { data } = await supabase.from('reminders').select('*').eq('done', false);
    if (data) setReminders(data.map(mapToCamel) as Reminder[]);
  }, []);
  useEffect(() => {
    loadRem();
    const ch = supabase.channel('reminders_ch').on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, loadRem).subscribe();
    const t = setInterval(() => setTick(x => x + 1), 60000); // re-evalúa tiempos cada minuto
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [loadRem]);

  const setSettings = (patch: Partial<NotifSettings>) =>
    setSettingsState(prev => { const next = { ...prev, ...patch }; localStorage.setItem(LS_NOTIF_SETTINGS, JSON.stringify(next)); return next; });

  const items = useMemo<NotifItem[]>(() => {
    void tick;
    const now = Date.now();
    const lead = (settings.leadDays || 7) * DAY;
    const out: NotifItem[] = [];

    if (settings.payments) for (const o of onboardings) {
      if (o.status === 'archived') continue;
      const lastPaid = Math.max(o.startedAt || 0, ...(o.payments || []).filter(x => x.paid && x.paidAt).map(x => x.paidAt as number));
      for (const p of (o.payments || [])) if (!p.paid) {
        const due = p.dueDate || (lastPaid || now) + rules.paymentDeadlineDays * DAY;
        const overdue = due < now;
        out.push({ id: `pay:${p.id}`, kind: 'payment', priority: overdue || o.status === 'launched' ? 'high' : 'normal',
          title: `${overdue ? 'Pago vencido: ' : 'Cobro pendiente: '}${p.label}`,
          body: `${o.clientName || o.title}${p.percentage ? ` · ${p.percentage}%` : ''} · vence ${fmtRel(due)}`, dueAt: due, goto: 'onboarding' });
      }
    }

    if (settings.steps) for (const o of onboardings) {
      if (o.status !== 'active') continue;
      const next = (o.steps || []).find(s => !s.isOptional && (s.status === 'pending' || s.status === 'in_progress'));
      if (next) {
        // referencia = cuándo se volvió el paso actual (último paso completado, o el arranque)
        const ref = Math.max(o.startedAt || 0, ...(o.steps || []).filter(s => s.completedAt).map(s => s.completedAt as number));
        const days = next.owner === 'client' ? rules.clientDeadlineDays : rules.stepDeadlineDays;
        const due = next.dueDate || (ref || now) + days * DAY;
        const overdue = due < now;
        const waiting = next.owner === 'client';
        out.push({ id: `step:${next.id}`, kind: 'step', priority: overdue ? 'high' : 'normal',
          title: `${overdue ? (waiting ? 'Reclamar al cliente: ' : 'Atrasado: ') : (waiting ? 'Esperando al cliente: ' : 'Seguir: ')}${next.title}`,
          body: `${o.clientName || o.title} · ${next.phaseName} · vence ${fmtRel(due)}`, dueAt: due, goto: 'onboarding' });
      }
    }

    if (settings.calendar) for (const e of events) {
      const t = e.startDate;
      if (t > now && t <= now + lead) out.push({ id: `evt:${e.id}`, kind: 'calendar', priority: t <= now + DAY ? 'high' : 'normal',
        title: e.title, body: `${fmtRel(t)} · ${new Date(t).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`, dueAt: t, goto: 'calendar' });
      else if (t < now && t > now - DAY) out.push({ id: `evt:${e.id}`, kind: 'calendar', priority: 'normal', title: `Pasó: ${e.title}`, body: fmtRel(t), dueAt: t, goto: 'calendar' });
    }

    if (settings.meetings) for (const p of prospects) {
      if (p.meetingAt && p.meetingAt > now && p.meetingAt <= now + lead) out.push({
        id: `mtg:${p.id}`, kind: 'meeting', priority: p.meetingAt <= now + DAY ? 'high' : 'normal',
        title: `Reunión con ${p.name}`, body: `${p.business || ''} · ${fmtRel(p.meetingAt)}`, dueAt: p.meetingAt, goto: 'preventa' });
    }

    if (settings.proposals) for (const p of prospects) {
      if (p.proposal && p.shareToken && p.stage === 'propuesta' && !p.clientId && (now - p.updatedAt) > 3 * DAY) out.push({
        id: `prop:${p.id}`, kind: 'proposal', priority: 'normal',
        title: `Seguí a ${p.name}`, body: `Propuesta enviada ${fmtRel(p.updatedAt)}, todavía sin cerrar`, goto: 'preventa' });
    }

    if (settings.reminders) for (const r of reminders) {
      if (!r.dueAt || r.dueAt <= now + DAY) out.push({
        id: `rem:${r.id}`, kind: 'reminder', priority: r.dueAt && r.dueAt < now ? 'high' : 'normal',
        title: r.title, body: r.dueAt ? fmtRel(r.dueAt) : 'Sin fecha', dueAt: r.dueAt || undefined, goto: 'notifications' });
    }

    const rank = { high: 0, normal: 1, low: 2 };
    out.sort((a, b) => rank[a.priority] - rank[b.priority] || (a.dueAt || Infinity) - (b.dueAt || Infinity));
    return out;
  }, [onboardings, events, prospects, reminders, settings, tick]);

  const unread = useMemo(() => items.filter(i => !readIds.includes(i.id)).length, [items, readIds]);
  const isRead = (id: string) => readIds.includes(id);
  const markRead = (id: string) => setReadIds(prev => { if (prev.includes(id)) return prev; const next = [...prev, id]; localStorage.setItem(LS_NOTIF_READ, JSON.stringify(next.slice(-800))); return next; });
  const markAllRead = () => setReadIds(() => { const next = items.map(i => i.id); localStorage.setItem(LS_NOTIF_READ, JSON.stringify(next.slice(-800))); return next; });

  const addReminder = async (title: string, dueAt: number | null) => {
    if (!title.trim()) return;
    const { error } = await supabase.from('reminders').insert(mapToSnake({ title: title.trim(), dueAt, done: false, createdAt: Date.now() }));
    if (error) toast('No se pudo crear el recordatorio', 'error'); else { toast('Recordatorio agregado'); loadRem(); }
  };
  const completeReminder = async (id: string) => { await supabase.from('reminders').update({ done: true }).eq('id', id); loadRem(); };

  // Pop-ups del navegador para lo urgente/vencido (sin repetir)
  const pushedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!settings.browserPush || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    let pushed: Record<string, number> = {};
    try { pushed = JSON.parse(localStorage.getItem(LS_NOTIF_PUSHED) || '{}'); } catch { /* noop */ }
    const now = Date.now();
    for (const k of Object.keys(pushed)) if (now - pushed[k] > 2 * DAY) delete pushed[k];
    for (const it of items) {
      const urgent = it.priority === 'high' || (it.kind === 'reminder' && !!it.dueAt && it.dueAt <= now);
      if (urgent && !pushed[it.id] && !pushedRef.current.has(it.id)) {
        try { new Notification(it.title, { body: it.body || '' }); } catch { /* noop */ }
        pushed[it.id] = now; pushedRef.current.add(it.id);
      }
    }
    localStorage.setItem(LS_NOTIF_PUSHED, JSON.stringify(pushed));
  }, [items, settings.browserPush]);

  const enableBrowserPush = async () => {
    if (typeof Notification === 'undefined') { toast('Tu navegador no soporta notificaciones', 'error'); return; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') { setSettings({ browserPush: true }); toast('Notificaciones del navegador activadas 🔔'); }
    else toast('El navegador bloqueó el permiso', 'error');
  };

  return { items, unread, reminders, settings, setSettings, isRead, markRead, markAllRead, addReminder, completeReminder, enableBrowserPush };
}

// ─── HISTORIAL / LEDGER ───
export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data } = await supabase.from('history').select('*').order('happened_at', { ascending: false });
    if (data) setEntries(data.map(mapToCamel) as HistoryEntry[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const ch = supabase.channel('history_' + uuid()).on('postgres_changes', { event: '*', schema: 'public', table: 'history' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const add = async (e: Omit<HistoryEntry, 'id' | 'createdAt'>) => {
    const { error } = await supabase.from('history').insert(mapToSnake({ ...e, createdAt: Date.now() }));
    if (error) toast('No se pudo guardar en el historial', 'error'); else toast('Registrado en el historial');
  };
  const update = async (id: string, updates: Partial<HistoryEntry>) => {
    const { error } = await supabase.from('history').update(mapToSnake(updates)).eq('id', id);
    if (error) toast('Error al actualizar', 'error');
  };
  const remove = async (id: string) => { await supabase.from('history').delete().eq('id', id); };

  const uploadReceipt = async (file: File): Promise<string | null> => {
    if (file.size > 10 * 1024 * 1024) { toast('El comprobante supera los 10 MB', 'error'); return null; }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${uuid()}.${ext}`;
    const { error } = await supabase.storage.from('receipts').upload(path, file, { upsert: false });
    if (error) { toast('No se pudo subir el comprobante: ' + error.message, 'error'); return null; }
    return path;
  };
  const signedUrl = async (path: string): Promise<string | null> => {
    const { data } = await supabase.storage.from('receipts').createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  };

  return { entries, loading, add, update, remove, uploadReceipt, signedUrl, refresh: load };
}

// ─── GUÍA / CENTRO DE CONOCIMIENTO ───
export function useGuide() {
  const [topics, setTopics] = useState<GuideTopic[]>([]);
  const [loading, setLoading] = useState(true);

  const seedIfEmpty = useCallback(async (current: GuideTopic[]) => {
    if (current.length > 0 || localStorage.getItem('myb_guide_seeded')) return;
    localStorage.setItem('myb_guide_seeded', '1');
    const now = Date.now();
    const rows = GUIDE_SEED.map(s => mapToSnake({ ...s, createdAt: now, updatedAt: now }));
    const { error } = await supabase.from('guide_topics').insert(rows);
    if (error) { localStorage.removeItem('myb_guide_seeded'); console.error('seed guide:', error); }
  }, []);

  const load = useCallback(async () => {
    const { data } = await supabase.from('guide_topics').select('*');
    const list = ((data || []).map(mapToCamel) as GuideTopic[])
      .map(t => ({ ...t, resources: Array.isArray(t.resources) ? t.resources : [] }))
      .sort((a, b) => (a.category < b.category ? -1 : a.category > b.category ? 1 : a.order - b.order));
    setTopics(list);
    setLoading(false);
    seedIfEmpty(list);
  }, [seedIfEmpty]);

  useEffect(() => {
    load();
    const ch = supabase.channel('guide_' + uuid()).on('postgres_changes', { event: '*', schema: 'public', table: 'guide_topics' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const add = async (t: Omit<GuideTopic, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    const { error } = await supabase.from('guide_topics').insert(mapToSnake({ ...t, createdAt: now, updatedAt: now }));
    if (error) toast('No se pudo guardar el tema', 'error'); else toast('Tema guardado');
  };
  const update = async (id: string, updates: Partial<GuideTopic>) => {
    const { error } = await supabase.from('guide_topics').update(mapToSnake({ ...updates, updatedAt: Date.now() })).eq('id', id);
    if (error) toast('Error al guardar', 'error'); else toast('Guardado');
  };
  const remove = async (id: string) => { await supabase.from('guide_topics').delete().eq('id', id); };

  return { topics, loading, add, update, remove, refresh: load };
}

// ─── IG CONTENT ───
export function useContent() {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data: p } = await supabase.from('content_posts').select('*').order('updated_at', { ascending: false });
    const { data: s } = await supabase.from('content_sources').select('*').order('created_at', { ascending: false });
    if (p) setPosts(p.map(mapToCamel) as ContentPost[]);
    if (s) setSources(s.map(mapToCamel) as ContentSource[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const ch = supabase.channel('content_' + uuid())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_posts' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_sources' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const addPost = async (p: Partial<ContentPost>) => {
    const { error } = await supabase.from('content_posts').insert(mapToSnake({
      format: p.format || 'reel', objective: p.objective || '', status: p.status || 'borrador',
      title: p.title || '', content: p.content || '', edgeLevel: p.edgeLevel ?? 3, score: p.score ?? 0,
      scheduledFor: p.scheduledFor ?? null,
    }));
    if (error) toast('No se pudo crear la pieza', 'error'); else { toast('Pieza creada'); load(); }
  };
  const updatePost = async (id: string, u: Partial<ContentPost>) => {
    const { error } = await supabase.from('content_posts').update(mapToSnake({ ...u, updatedAt: new Date().toISOString() })).eq('id', id);
    if (error) toast('Error al actualizar', 'error'); else load();
  };
  const removePost = async (id: string) => { await supabase.from('content_posts').delete().eq('id', id); load(); };

  const addSource = async (s: Partial<ContentSource>) => {
    const { error } = await supabase.from('content_sources').insert(mapToSnake({ type: s.type || 'nota', title: s.title || '', content: s.content || '', tags: s.tags || '' }));
    if (error) toast('No se pudo guardar la fuente', 'error'); else { toast('Fuente agregada'); load(); }
  };
  const removeSource = async (id: string) => { await supabase.from('content_sources').delete().eq('id', id); load(); };

  // Genera una pieza con IA (guion/caption/hashtags). Devuelve el contenido o null.
  const generateScript = async (input: { format?: string; objective?: string; tema: string; notas?: string }): Promise<any | null> => {
    const { data, error } = await supabase.functions.invoke('generate-content', { body: input });
    let err = '';
    if (error) { err = error.message; try { const b = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); if (b?.error) err = b.error; } catch { /* noop */ } }
    else if (!data?.ok) err = data?.error || 'Respuesta inesperada';
    if (err) { toast('Error al generar: ' + err, 'error'); return null; }
    return data.content;
  };

  // Agente de ideas de contenido (investigación + generación por nicho)
  const generateIdeas = async (input: Record<string, string | boolean>): Promise<any | null> => {
    const { data, error } = await supabase.functions.invoke('content-ideas', { body: input });
    let err = '';
    if (error) { err = error.message; try { const b = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); if (b?.error) err = b.error; } catch { /* noop */ } }
    else if (!data?.ok) err = data?.error || 'Respuesta inesperada';
    if (err) { toast('Error al generar ideas: ' + err, 'error'); return null; }
    return data.ideas;
  };

  // Estudio de guiones virales (Reels/Shorts/TikTok/ventas)
  const generateViralScript = async (input: { plataforma: string; objetivo: string; duracion: string; tema: string; publico?: string }): Promise<any | null> => {
    const { data, error } = await supabase.functions.invoke('generate-viral-script', { body: input });
    let err = '';
    if (error) { err = error.message; try { const b = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); if (b?.error) err = b.error; } catch { /* noop */ } }
    else if (!data?.ok) err = data?.error || 'Respuesta inesperada';
    if (err) { toast('Error al generar el guion: ' + err, 'error'); return null; }
    return data.script;
  };

  return { posts, sources, loading, addPost, updatePost, removePost, addSource, removeSource, generateScript, generateIdeas, generateViralScript, refresh: load };
}

// ─── ANÁLISIS DE COMPETENCIA ───
export function useCompetitors() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data } = await supabase.from('competitors').select('*').order('updated_at', { ascending: false });
    if (data) setCompetitors(data.map(mapToCamel) as Competitor[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const ch = supabase.channel('competitors_' + uuid()).on('postgres_changes', { event: '*', schema: 'public', table: 'competitors' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const add = async (c: Partial<Competitor>) => {
    const { data, error } = await supabase.from('competitors').insert(mapToSnake({
      clientId: c.clientId ?? null, name: c.name || '', instagram: c.instagram || '', website: c.website || '',
      rubro: c.rubro || '', notes: c.notes || '',
    })).select().single();
    if (error) { toast('No se pudo agregar el competidor', 'error'); return null; }
    toast('Competidor agregado'); load();
    return data?.id as string;
  };
  const update = async (id: string, u: Partial<Competitor>) => {
    const { error } = await supabase.from('competitors').update(mapToSnake({ ...u, updatedAt: Date.now() })).eq('id', id);
    if (error) toast('Error al actualizar', 'error'); else load();
  };
  const remove = async (id: string) => { await supabase.from('competitors').delete().eq('id', id); load(); };

  const analyze = async (c: Competitor): Promise<boolean> => {
    const { data, error } = await supabase.functions.invoke('analyze-competitor', {
      body: { competitor: { nombre: c.name, instagram: c.instagram, website: c.website, rubro: c.rubro, observaciones: c.notes } },
    });
    let err = '';
    if (error) { err = error.message; try { const b = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); if (b?.error) err = b.error; } catch { /* noop */ } }
    else if (!data?.ok) err = data?.error || 'Respuesta inesperada';
    if (err) { toast('Error al analizar: ' + err, 'error'); return false; }
    await supabase.from('competitors').update(mapToSnake({ analysis: data.analysis, analyzedAt: Date.now(), updatedAt: Date.now() })).eq('id', c.id);
    toast('Análisis listo ✨'); load();
    return true;
  };

  // Analiza el copy de un anuncio del competidor con IA y lo guarda en competitors.ads
  const analyzeAd = async (c: Competitor, texto: string): Promise<boolean> => {
    const { data, error } = await supabase.functions.invoke('analyze-ad', { body: { texto, rubro: c.rubro, competidor: c.name } });
    let err = '';
    if (error) { err = error.message; try { const b = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); if (b?.error) err = b.error; } catch { /* noop */ } }
    else if (!data?.ok) err = data?.error || 'Respuesta inesperada';
    if (err) { toast('Error al analizar el anuncio: ' + err, 'error'); return false; }
    const a = data.analysis;
    const ad = { id: uuid(), texto: String(texto).slice(0, 700), gancho: a.gancho || '', oferta: a.oferta || '', formato: a.formato || '', porQue: a.porQue || '', adaptar: a.adaptar || '', createdAt: Date.now() };
    const ads = [ad, ...(c.ads || [])];
    // update directo (keys camelCase, no pasa por mapToSnake) para no romper el jsonb
    await supabase.from('competitors').update({ ads, updated_at: Date.now() }).eq('id', c.id);
    toast('Anuncio analizado ✨'); load();
    return true;
  };
  const removeAd = async (c: Competitor, adId: string) => {
    const ads = (c.ads || []).filter(a => a.id !== adId);
    await supabase.from('competitors').update({ ads, updated_at: Date.now() }).eq('id', c.id);
    load();
  };

  return { competitors, loading, add, update, remove, analyze, analyzeAd, removeAd, refresh: load };
}

// ─── EXCHANGE RATE HOOK ───
export function useExchangeRate() {
  const [rate, setRate] = useState<number>(1400); // Fallback
  useEffect(() => {
    fetch('https://dolarapi.com/v1/dolares/blue')
      .then(res => res.json())
      .then(data => { if (data.venta) setRate(data.venta); })
      .catch(() => console.log('Usando cotización por defecto'));
  }, []);
  return rate;
}
