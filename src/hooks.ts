import { useState, useEffect, useCallback } from 'react';
import { uuid, type Skill, type Board, type TaskCard, type CalEvent, type Client, type Expense, type Goal } from './utils';
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
    if (!error && data) setSkills(data.map(mapToCamel));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const sub = supabase.channel('skills_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'skills' }, load)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load]);

  const create = async (data: Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>) => {
    const { error } = await supabase.from('skills').insert([mapToSnake(data)]);
    if (error) toast('Error al crear skill', 'error');
    else toast('Skill creada');
  };

  const update = async (id: string, updates: Partial<Skill>) => {
    const { error } = await supabase.from('skills').update(mapToSnake({ ...updates, updatedAt: Date.now() })).eq('id', id);
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
    } else { toast('Error al crear tablero', 'error'); }
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
    const sub = supabase.channel('cal_changes')
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
          projects: projectsData ? projectsData.filter(p => p.client_id === c.id).map(mapToCamel) : [],
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

  const create = async (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'projects' | 'notes'>) => {
    // IMPORTANTE: Quitamos proyectos y notas porque son tablas aparte
    const { projects, notes, ...rest } = data as any;
    
    // Manda el objeto 'contact' entero tal como está
    const payload = mapToSnake(rest);
    
    const { error } = await supabase.from('clients').insert([payload]);
    if (error) {
      console.error('Full DB Error:', error);
      alert('Error de Base de Datos: ' + error.message + '\nDetalle: ' + error.details);
      toast('Error al crear cliente', 'error');
    } else {
      toast('Cliente creado');
    }
  };

  const update = async (id: string, updates: Partial<Client>) => {
    // Quitamos proyectos y notas
    const { projects, notes, ...clientFields } = updates;
    
    // Mapeamos a snake_case, el contact pasará directo como JSON
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
        if (p.id) {
           await supabase.from('client_projects').upsert(mapToSnake({ ...p, clientId: id }));
        } else {
           await supabase.from('client_projects').insert(mapToSnake({ ...p, clientId: id }));
        }
      }
      // Delete removed projects
      const toDelete = existing.filter(p => !incomingIds.includes(p.id));
      if (toDelete.length > 0) {
        await supabase.from('client_projects').delete().in('id', toDelete.map(d => d.id));
      }

      // Recalcular Total Revenue (Opcional, pero util si queremos persistirlo en BD en tabla clients)
      const revenue = projects.filter(p => p.status !== 'cancelled').reduce((s, p) => s + p.value, 0);
      await supabase.from('clients').update({ total_revenue: revenue }).eq('id', id);
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
