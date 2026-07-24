import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { uuid, type Skill, type Board, type TaskCard, type CalEvent, type Client, type Expense, type Goal, type ClientProject, type ClientNote,
  type Onboarding, type OnboardingStep, type OnboardingPayment, type OnboardingDocument, type ServiceType, type Prospect,
  type Reminder, type NotifItem, type NotifSettings, NOTIF_DEFAULTS, fmtRel,
  type AppSettings, APP_SETTINGS_DEFAULTS, type HistoryEntry, type GuideTopic,
  type ContentPost, type ContentSource, type Competitor,
  type Note, type Whiteboard, type BoardData, EMPTY_BOARD_DATA, REPEAT_LABELS, type NodeEvent, type BoardNode,
  type ClientPortal, type PortalConfig, type PortalUpdate, type PortalTicket,
  type StrategyDoc, type DocBlock } from './utils';
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
    const subBoards = supabase.channel('boards_changes_' + uuid()).on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, loadBoards).subscribe();
    const subTasks = supabase.channel('tasks_changes_' + uuid()).on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
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

  const createCard = async (data: Omit<TaskCard, 'id' | 'createdAt' | 'updatedAt' | 'order'>): Promise<string | null> => {
    const payload = { ...data, order: Date.now() };
    const { data: row, error } = await supabase.from('tasks').insert([mapToSnake(payload)]).select('id').single();
    if (error) { toast('Error al crear tarea', 'error'); return null; }
    toast('Tarea creada');
    return row?.id as string;
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
    const subC = supabase.channel('clients_ch_' + uuid()).on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, load).subscribe();
    const subP = supabase.channel('projs_ch_' + uuid()).on('postgres_changes', { event: '*', schema: 'public', table: 'client_projects' }, load).subscribe();
    const subN = supabase.channel('notes_ch_' + uuid()).on('postgres_changes', { event: '*', schema: 'public', table: 'client_notes' }, load).subscribe();
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
    // 'date' es timestamptz (string ISO) y mapToCamel solo convierte created_at/updated_at
    // a epoch — se convierte acá para que el tipo Expense.date:number sea real.
    if (expData) setExpenses(expData.map(e => { const c = mapToCamel(e); return { ...c, date: new Date(c.date).getTime() }; }));
    if (goalData) setGoals(goalData.map(mapToCamel));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const subE = supabase.channel('exp_ch_' + uuid()).on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, load).subscribe();
    const subG = supabase.channel('goal_ch_' + uuid()).on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, load).subscribe();
    return () => { supabase.removeChannel(subE); supabase.removeChannel(subG); };
  }, [load]);

  // Cada gasto queda espejado como entrada 'gasto' en el Historial (mismo comprobante),
  // así todo el movimiento de plata de la agencia queda en un solo lugar.
  const addExpense = async (data: Omit<Expense, 'id' | 'date' | 'historyId'>) => {
    const { data: hist, error: histErr } = await supabase.from('history').insert({
      client_id: null, kind: 'gasto', title: data.description, detail: data.category,
      amount: data.amount, currency: 'ARS', receipt_path: data.receiptPath, happened_at: Date.now(),
    }).select('id').single();
    if (histErr) { toast('Error al agregar gasto: ' + histErr.message, 'error'); return; }
    const { error } = await supabase.from('expenses').insert([mapToSnake({ ...data, historyId: hist.id })]);
    if (error) { await supabase.from('history').delete().eq('id', hist.id); toast('Error al agregar gasto: ' + error.message, 'error'); return; }
    toast('Gasto registrado');
  };

  const removeExpense = async (id: string) => {
    const exp = expenses.find(e => e.id === id);
    await supabase.from('expenses').delete().eq('id', id);
    if (exp?.historyId) await supabase.from('history').delete().eq('id', exp.historyId);
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
      const nameOf = (id: string | null) => clientData?.find((c: any) => c.id === id)?.name || '';
      setOnboardings(obData.map(o => {
        const camel = mapToCamel(o);
        return {
          ...camel,
          clientName: o.client_id ? nameOf(o.client_id) : (o.product_name || ''),
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
  const create = async (clientId: string | null, serviceType: ServiceType, title: string, productName?: string): Promise<string | null> => {
    const playbook = getPlaybook(serviceType);
    if (!playbook) { toast('Ese servicio todavía no tiene playbook', 'error'); return null; }

    const now = Date.now();
    const { data: ob, error } = await supabase.from('onboardings').insert([mapToSnake({
      clientId, serviceType, title, status: 'active', currentPhase: 0, productName: productName || null,
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
    const ch = supabase.channel('reminders_ch_' + uuid()).on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, loadRem).subscribe();
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
    // No pasar createdAt (mapToSnake lo haría ISO string, pero la columna es bigint) — usa el default de la DB.
    const { error } = await supabase.from('reminders').insert(mapToSnake({ title: title.trim(), dueAt, done: false }));
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

// Comprobantes: bucket privado compartido 'receipts' (usado por Historial y Gastos)
export const uploadReceipt = async (file: File): Promise<string | null> => {
  if (file.size > 10 * 1024 * 1024) { toast('El comprobante supera los 10 MB', 'error'); return null; }
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${uuid()}.${ext}`;
  const { error } = await supabase.storage.from('receipts').upload(path, file, {
    upsert: false, cacheControl: '3600', contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  });
  if (error) { toast('No se pudo subir el comprobante: ' + error.message, 'error'); return null; }
  return path;
};
export const receiptSignedUrl = async (path: string): Promise<string | null> => {
  const { data } = await supabase.storage.from('receipts').createSignedUrl(path, 3600);
  return data?.signedUrl || null;
};

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

  const add = async (e: Omit<HistoryEntry, 'id' | 'createdAt'>): Promise<boolean> => {
    // No pasar createdAt: mapToSnake lo convertiría a fecha ISO, pero la columna es
    // bigint (epoch ms) — se deja que el default de la DB lo complete.
    const { error } = await supabase.from('history').insert(mapToSnake(e));
    if (error) { toast('No se pudo guardar: ' + error.message, 'error'); return false; }
    toast('Registrado en el historial'); return true;
  };
  const update = async (id: string, updates: Partial<HistoryEntry>): Promise<boolean> => {
    const { error } = await supabase.from('history').update(mapToSnake(updates)).eq('id', id);
    if (error) { toast('No se pudo actualizar: ' + error.message, 'error'); return false; }
    return true;
  };
  const remove = async (id: string) => { await supabase.from('history').delete().eq('id', id); };

  return { entries, loading, add, update, remove, uploadReceipt, signedUrl: receiptSignedUrl, refresh: load };
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

  // created_at/updated_at son bigint (epoch ms): no pasar por mapToSnake (los haría ISO string).
  const add = async (t: Omit<GuideTopic, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    const { error } = await supabase.from('guide_topics').insert({ ...mapToSnake(t), created_at: now, updated_at: now });
    if (error) toast('No se pudo guardar el tema', 'error'); else toast('Tema guardado');
  };
  const update = async (id: string, updates: Partial<GuideTopic>) => {
    const { error } = await supabase.from('guide_topics').update({ ...mapToSnake(updates), updated_at: Date.now() }).eq('id', id);
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
    // updated_at es bigint (epoch ms): no pasar por mapToSnake (lo haría ISO string).
    const { error } = await supabase.from('competitors').update({ ...mapToSnake(u), updated_at: Date.now() }).eq('id', id);
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
    // analyzed_at / updated_at son bigint (epoch ms): no pasar por mapToSnake.
    await supabase.from('competitors').update({ analysis: data.analysis, analyzed_at: Date.now(), updated_at: Date.now() }).eq('id', c.id);
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

// ─── NOTAS / IDEAS (bloc de notas con seguimiento + calendario) ───
export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data } = await supabase.from('notes').select('*').order('pinned', { ascending: false }).order('updated_at', { ascending: false });
    if (data) setNotes(data.map(mapToCamel) as Note[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const ch = supabase.channel('notes_' + uuid()).on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  // Sincroniza el seguimiento de una nota con un evento en el Calendario (crea/mueve/borra).
  const syncCalendar = async (note: Note, title: string): Promise<string | null> => {
    if (!note.followUpAt) {
      if (note.calendarEventId) await supabase.from('calendar_events').delete().eq('id', note.calendarEventId);
      return null;
    }
    const desc = note.repeatRule !== 'none' ? `Repite: ${REPEAT_LABELS[note.repeatRule]} (recordatorio manual, no se re-crea solo).` : 'Seguimiento de idea.';
    const payload = { title: `💡 ${title}`, description: desc, startDate: note.followUpAt, endDate: note.followUpAt + 3600000, type: 'reminder' as const, assignedTo: [], relatedTaskId: null, color: '#a78bfa', allDay: false };
    if (note.calendarEventId) {
      await supabase.from('calendar_events').update(mapToSnake(payload)).eq('id', note.calendarEventId);
      return note.calendarEventId;
    }
    const { data, error } = await supabase.from('calendar_events').insert([mapToSnake(payload)]).select().single();
    if (error) { toast('La nota se guardó, pero no se pudo crear el recordatorio en el calendario', 'error'); return null; }
    return data?.id as string;
  };

  const add = async (n: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'calendarEventId'>): Promise<string | null> => {
    const calendarEventId = n.followUpAt ? await syncCalendar({ ...n, id: '', calendarEventId: null, createdAt: 0, updatedAt: 0 }, n.title || 'Idea sin título') : null;
    const { data, error } = await supabase.from('notes').insert(mapToSnake({ ...n, calendarEventId })).select().single();
    if (error) { toast('No se pudo guardar la idea', 'error'); return null; }
    toast('Idea guardada');
    return data?.id as string;
  };
  const update = async (id: string, u: Partial<Note>) => {
    const current = notes.find(x => x.id === id);
    let calendarEventId = current?.calendarEventId ?? null;
    if (current && 'followUpAt' in u) {
      calendarEventId = await syncCalendar({ ...current, ...u } as Note, (u.title ?? current.title) || 'Idea sin título');
    }
    const { error } = await supabase.from('notes').update({ ...mapToSnake(u), calendar_event_id: calendarEventId, updated_at: Date.now() }).eq('id', id);
    if (error) toast('Error al guardar', 'error'); else load();
  };
  const remove = async (id: string) => {
    const n = notes.find(x => x.id === id);
    if (n?.calendarEventId) await supabase.from('calendar_events').delete().eq('id', n.calendarEventId);
    await supabase.from('notes').delete().eq('id', id);
    load();
  };

  return { notes, loading, add, update, remove, refresh: load };
}

// ─── PIZARRAS ESTILO MIRO (compartidas por Ideas y Estrategia/Embudos) ───
export function useWhiteboards(kind?: 'idea' | 'embudo') {
  const [boards, setBoards] = useState<Whiteboard[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    let q = supabase.from('whiteboards').select('*').order('updated_at', { ascending: false });
    if (kind) q = q.eq('kind', kind);
    const { data } = await q;
    if (data) setBoards(data.map(mapToCamel) as Whiteboard[]);
    setLoading(false);
  }, [kind]);
  useEffect(() => {
    load();
    const ch = supabase.channel('whiteboards_' + uuid()).on('postgres_changes', { event: '*', schema: 'public', table: 'whiteboards' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const create = async (title: string, k: 'idea' | 'embudo', clientId: string | null = null, noteId: string | null = null): Promise<string | null> => {
    const { data, error } = await supabase.from('whiteboards').insert(mapToSnake({ title, kind: k, clientId, noteId, data: EMPTY_BOARD_DATA })).select().single();
    if (error) { toast('No se pudo crear la pizarra', 'error'); return null; }
    toast('Pizarra creada');
    return data?.id as string;
  };
  const saveData = async (id: string, data: BoardData) => {
    await supabase.from('whiteboards').update({ data, updated_at: Date.now() }).eq('id', id);
  };
  const rename = async (id: string, title: string) => { await supabase.from('whiteboards').update({ title, updated_at: Date.now() }).eq('id', id); };
  const remove = async (id: string) => { await supabase.from('whiteboards').delete().eq('id', id); load(); };

  return { boards, loading, create, saveData, rename, remove, refresh: load };
}

// ─── AUTOMATIZACIÓN DE NODOS (Estrategia → disparo manual de webhooks n8n) ───
// El fetch al webhook lo hace la Edge Function `trigger-node-webhook` (server-side, evita
// exponer el token del webhook en el navegador). El cliente solo llama a la función y
// después inserta el log en `node_events` para tener auditoría de qué se disparó y cuándo.
export function useNodeEvents(boardId: string | null) {
  const [events, setEvents] = useState<NodeEvent[]>([]);
  const load = useCallback(async () => {
    if (!boardId) { setEvents([]); return; }
    const { data } = await supabase.from('node_events').select('*').eq('board_id', boardId).order('created_at', { ascending: false }).limit(50);
    if (data) setEvents(data.map(mapToCamel) as NodeEvent[]);
  }, [boardId]);
  useEffect(() => {
    load();
    if (!boardId) return;
    const ch = supabase.channel('node_events_' + uuid()).on('postgres_changes', { event: '*', schema: 'public', table: 'node_events' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, boardId]);
  return { events, refresh: load };
}

export async function fireNodeWebhook(boardId: string, node: BoardNode): Promise<{ ok: boolean; summary: string }> {
  const webhookUrl = node.webhookUrl?.trim();
  if (!webhookUrl) return { ok: false, summary: 'Este nodo no tiene webhook configurado' };
  const payload = {
    nodeId: node.id, boardId, clientId: node.clientId || null,
    text: node.text, stageStatus: node.stageStatus || null, conversionRate: node.conversionRate ?? null,
    triggeredAt: Date.now(),
  };
  const { data, error } = await supabase.functions.invoke('trigger-node-webhook', { body: { webhookUrl, payload } });
  const ok = !error && !!data?.ok;
  const summary = error ? (error.message || 'Error de red') : ok ? `HTTP ${data.status}` : (data?.error || `HTTP ${data?.status ?? '?'}`);
  await supabase.from('node_events').insert({
    board_id: boardId, node_id: node.id, client_id: node.clientId || null, action: 'webhook',
    webhook_url: webhookUrl, status: ok ? 'success' : 'error', response_summary: summary.slice(0, 500), created_at: Date.now(),
  });
  toast(ok ? `Webhook disparado (${summary})` : `Falló el webhook: ${summary}`, ok ? 'success' : 'error');
  return { ok, summary };
}

// ─── DOCUMENTOS ESTRATÉGICOS (editor por bloques, tipo Google Doc) ───
export function useStrategyDocs() {
  const [docs, setDocs] = useState<StrategyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data } = await supabase.from('strategy_docs').select('*').order('updated_at', { ascending: false });
    if (data) setDocs(data.map(mapToCamel) as StrategyDoc[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const ch = supabase.channel('strategy_docs_' + uuid()).on('postgres_changes', { event: '*', schema: 'public', table: 'strategy_docs' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const create = async (title: string, docType: string, blocks: DocBlock[] = []): Promise<string | null> => {
    const { data, error } = await supabase.from('strategy_docs').insert(mapToSnake({ title, docType, blocks, tags: [], clientId: null })).select('id').single();
    if (error) { toast('No se pudo crear el documento: ' + error.message, 'error'); return null; }
    toast('Documento creado');
    return data?.id as string;
  };
  const saveBlocks = async (id: string, blocks: DocBlock[]) => {
    await supabase.from('strategy_docs').update({ blocks, updated_at: Date.now() }).eq('id', id);
  };
  const update = async (id: string, patch: Partial<StrategyDoc>) => {
    // updated_at es bigint (epoch ms): se escribe crudo, NUNCA vía mapToSnake (convertiría
    // 'updatedAt' a fecha ISO y rompería el insert — mismo bug ya visto en otras tablas).
    await supabase.from('strategy_docs').update({ ...mapToSnake(patch), updated_at: Date.now() }).eq('id', id);
  };
  const remove = async (id: string) => { await supabase.from('strategy_docs').delete().eq('id', id); toast('Documento eliminado'); };

  return { docs, loading, create, saveBlocks, update, remove, refresh: load };
}

// ─── PORTAL DEL CLIENTE (lado interno / dashboard) ───
export function usePortals() {
  const [portals, setPortals] = useState<ClientPortal[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data } = await supabase.from('client_portals').select('*').order('updated_at', { ascending: false });
    if (data) setPortals(data.map(mapToCamel) as ClientPortal[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const ch = supabase.channel('portals_' + uuid()).on('postgres_changes', { event: '*', schema: 'public', table: 'client_portals' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  // Crea el portal autollenando desde el cliente/onboarding (objetivos del discovery, dominio,
  // marca de la propuesta si existe). Cada portal nace con un código de acceso propio (6
  // dígitos, único por cliente) además del link — hace falta el link Y el código, y el
  // código tiene protección anti fuerza-bruta en la Edge Function (bloqueo tras 5 intentos).
  const create = async (clientId: string, opts: { onboardingId?: string | null; config?: PortalConfig } = {}): Promise<{ token: string; pin: string } | null> => {
    const token = uuid() + uuid().replace(/-/g, ''); // token largo, difícil de adivinar
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const { error } = await supabase.from('client_portals').insert({
      client_id: clientId, onboarding_id: opts.onboardingId || null, token, pin, enabled: true, config: opts.config || {},
    });
    if (error) { toast('No se pudo crear el portal: ' + error.message, 'error'); return null; }
    toast('Portal creado'); return { token, pin };
  };
  const updateConfig = async (id: string, config: PortalConfig) => {
    const { error } = await supabase.from('client_portals').update({ config, updated_at: Date.now() }).eq('id', id);
    if (error) toast('No se pudo guardar: ' + error.message, 'error');
  };
  const setEnabled = async (id: string, enabled: boolean) => {
    await supabase.from('client_portals').update({ enabled, updated_at: Date.now() }).eq('id', id);
    toast(enabled ? 'Portal activado' : 'Portal pausado');
  };
  const regenerateToken = async (id: string): Promise<string | null> => {
    const token = uuid() + uuid().replace(/-/g, '');
    const { error } = await supabase.from('client_portals').update({ token, updated_at: Date.now() }).eq('id', id);
    if (error) { toast('No se pudo regenerar el link', 'error'); return null; }
    toast('Link regenerado — el anterior dejó de funcionar');
    return token;
  };
  const remove = async (id: string) => { await supabase.from('client_portals').delete().eq('id', id); toast('Portal eliminado'); };
  const setPin = async (id: string, pin: string | null) => {
    const { error } = await supabase.from('client_portals').update({ pin, updated_at: Date.now() }).eq('id', id);
    if (error) { toast('No se pudo guardar el PIN', 'error'); return; }
    toast(pin ? 'PIN activado' : 'PIN quitado');
  };

  return { portals, loading, create, updateConfig, setEnabled, regenerateToken, setPin, remove, refresh: load };
}

// Estadística de aperturas del portal (para el lado interno)
export function usePortalViews(portalId: string | null) {
  const [count, setCount] = useState(0);
  const [lastViewedAt, setLastViewedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!portalId) { setCount(0); setLastViewedAt(null); return; }
    let on = true;
    (async () => {
      const { count: c } = await supabase.from('portal_views').select('*', { count: 'exact', head: true }).eq('portal_id', portalId);
      const { data } = await supabase.from('portal_views').select('viewed_at').eq('portal_id', portalId).order('viewed_at', { ascending: false }).limit(1);
      if (!on) return;
      setCount(c || 0);
      setLastViewedAt(data?.[0]?.viewed_at ?? null);
    })();
    return () => { on = false; };
  }, [portalId]);
  return { count, lastViewedAt };
}

// Actualizaciones que publica MYB (timeline que ve el cliente)
export function usePortalUpdates(portalId: string | null) {
  const [updates, setUpdates] = useState<PortalUpdate[]>([]);
  const load = useCallback(async () => {
    if (!portalId) { setUpdates([]); return; }
    const { data } = await supabase.from('portal_updates').select('*').eq('portal_id', portalId).order('created_at', { ascending: false });
    if (data) setUpdates(data.map(mapToCamel) as PortalUpdate[]);
  }, [portalId]);
  useEffect(() => {
    load();
    if (!portalId) return;
    const ch = supabase.channel('portal_updates_' + uuid()).on('postgres_changes', { event: '*', schema: 'public', table: 'portal_updates' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, portalId]);
  const add = async (portalId: string, title: string, body: string, imagePath: string | null = null) => {
    const { error } = await supabase.from('portal_updates').insert({ portal_id: portalId, title, body, image_path: imagePath, created_at: Date.now() });
    if (error) toast('No se pudo publicar: ' + error.message, 'error'); else toast('Actualización publicada');
  };
  const remove = async (id: string) => { await supabase.from('portal_updates').delete().eq('id', id); };
  return { updates, add, remove, refresh: load };
}

// Subir una imagen para una novedad del portal (bucket privado compartido 'portal-uploads',
// mismo que usan las capturas de los tickets del cliente)
// Sube una imagen o video a la pizarra (bucket público 'board-uploads' — como brand-assets,
// solo vos podés escribir pero el link es de lectura directa, sin firmar; nadie lo
// encuentra sin el link porque el nombre de archivo es un uuid). Devuelve la URL pública
// lista para usar en el nodo, no un path.
export const uploadBoardAsset = async (file: File, kind: 'image' | 'video'): Promise<string | null> => {
  const maxMB = kind === 'video' ? 50 : 8;
  if (file.size > maxMB * 1024 * 1024) { toast(`El archivo supera los ${maxMB} MB`, 'error'); return null; }
  const ext = (file.name.split('.').pop() || (kind === 'video' ? 'mp4' : 'jpg')).toLowerCase();
  const path = `${kind}s/${uuid()}.${ext}`;
  const { error } = await supabase.storage.from('board-uploads').upload(path, file, { upsert: false, cacheControl: '3600', contentType: file.type || undefined });
  if (error) { toast('No se pudo subir el archivo: ' + error.message, 'error'); return null; }
  return supabase.storage.from('board-uploads').getPublicUrl(path).data.publicUrl;
};

export const uploadPortalImage = async (file: File): Promise<string | null> => {
  if (file.size > 5 * 1024 * 1024) { toast('La imagen supera los 5 MB', 'error'); return null; }
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `updates/${uuid()}.${ext}`;
  const { error } = await supabase.storage.from('portal-uploads').upload(path, file, {
    upsert: false, cacheControl: '3600', contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  });
  if (error) { toast('No se pudo subir la imagen: ' + error.message, 'error'); return null; }
  return path;
};

// Tickets (correcciones/errores) que sube el cliente; MYB los ve y responde
export function usePortalTickets(portalId: string | null) {
  const [tickets, setTickets] = useState<PortalTicket[]>([]);
  const load = useCallback(async () => {
    if (!portalId) { setTickets([]); return; }
    const { data } = await supabase.from('portal_tickets').select('*').eq('portal_id', portalId).order('created_at', { ascending: false });
    if (data) setTickets(data.map(mapToCamel) as PortalTicket[]);
  }, [portalId]);
  useEffect(() => {
    load();
    if (!portalId) return;
    const ch = supabase.channel('portal_tickets_' + uuid()).on('postgres_changes', { event: '*', schema: 'public', table: 'portal_tickets' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, portalId]);
  const update = async (id: string, patch: Partial<PortalTicket>) => {
    await supabase.from('portal_tickets').update(mapToSnake(patch)).eq('id', id);
  };
  return { tickets, update, refresh: load };
}

// URL firmada de la captura de un ticket, para verla del lado MYB (autenticado)
export const portalUploadSignedUrl = async (path: string): Promise<string | null> => {
  const { data } = await supabase.storage.from('portal-uploads').createSignedUrl(path, 3600);
  return data?.signedUrl || null;
};

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
