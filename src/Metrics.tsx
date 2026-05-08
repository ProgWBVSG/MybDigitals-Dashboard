import { useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { CheckCircle2, Clock, AlertTriangle, CalendarDays, TrendingUp, Users } from 'lucide-react';
import { useTasks, useCalendar, useClients } from './hooks';
import { storage, fmt, isOverdue, fmtMoney, type Board, type TaskCard } from './utils';

const CHART_COLORS = ['#6366f1', '#3b82f6', '#f59e0b', '#10b981'];

export default function Metrics() {
  const { boards, cards } = useTasks();
  const { events } = useCalendar();
  const { clients } = useClients();

  // Load ALL cards across ALL boards
  const allCards = useMemo(() => {
    const all: TaskCard[] = [];
    boards.forEach(b => {
      const ids: string[] = storage.get(`tasks:cards:${b.id}`) || [];
      ids.forEach(id => {
        const c = storage.get<TaskCard>(`tasks:card:${id}`);
        if (c) all.push(c);
      });
    });
    return all;
  }, [boards]);

  // KPIs
  const totalTasks = allCards.length;
  const completedCols = boards.flatMap(b => b.columns.filter(c => c.name === 'Completado').map(c => c.id));
  const completed = allCards.filter(c => completedCols.includes(c.columnId)).length;
  const overdue = allCards.filter(c => c.dueDate && isOverdue(c.dueDate) && !completedCols.includes(c.columnId)).length;
  const upcomingEvents = events.filter(e => e.startDate > Date.now()).sort((a, b) => a.startDate - b.startDate).slice(0, 5);
  const completionRate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;
  const totalRevenue = clients.reduce((s, c) => s + c.totalRevenue, 0);
  const activeClients = clients.filter(c => c.status === 'active').length;

  // Donut data
  const donutData = [
    { name: 'Completadas', value: completed, color: '#10b981' },
    { name: 'Pendientes', value: totalTasks - completed, color: '#334155' },
  ];

  // Bar data: tasks per column (active board)
  const activeBoard = boards[0] as Board | undefined;
  const barData = useMemo(() => {
    if (!activeBoard) return [];
    return activeBoard.columns.sort((a, b) => a.order - b.order).map((col, i) => ({
      name: col.name,
      tareas: allCards.filter(c => c.columnId === col.id && c.boardId === activeBoard.id).length,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [activeBoard, allCards]);

  // Priority breakdown
  const priorityData = [
    { name: 'Urgente', value: allCards.filter(c => c.priority === 'urgent').length, color: '#ef4444' },
    { name: 'Alta', value: allCards.filter(c => c.priority === 'high').length, color: '#f59e0b' },
    { name: 'Media', value: allCards.filter(c => c.priority === 'medium').length, color: '#3b82f6' },
    { name: 'Baja', value: allCards.filter(c => c.priority === 'low').length, color: '#10b981' },
  ];

  // Overdue tasks list
  const overdueTasks = allCards
    .filter(c => c.dueDate && isOverdue(c.dueDate) && !completedCols.includes(c.columnId))
    .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))
    .slice(0, 5);

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <KPI icon={<CheckCircle2 size={20} />} label="Completadas" value={`${completed}/${totalTasks}`} sub={`${completionRate}%`} color="#10b981" />
        <KPI icon={<Clock size={20} />} label="En Proceso" value={String(totalTasks - completed)} sub="pendientes" color="#3b82f6" />
        <KPI icon={<AlertTriangle size={20} />} label="Atrasadas" value={String(overdue)} sub={overdue > 0 ? '⚠️ requieren atención' : 'todo al día'} color={overdue > 0 ? '#ef4444' : '#10b981'} />
        <KPI icon={<CalendarDays size={20} />} label="Próx. Eventos" value={String(upcomingEvents.length)} sub="esta semana" color="#6366f1" />
        <KPI icon={<Users size={20} />} label="Clientes Activos" value={String(activeClients)} sub={`de ${clients.length} total`} color="#f59e0b" />
        <KPI icon={<TrendingUp size={20} />} label="Facturación" value={fmtMoney(totalRevenue)} sub="total proyectos" color="#10b981" />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* Completion Donut */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Progreso General</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={70} outerRadius={95} dataKey="value" strokeWidth={0}>
                  {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#10b981' }}>{completionRate}%</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>completado</div>
            </div>
          </div>
        </div>

        {/* Tasks by Column */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
            Tareas por Columna {activeBoard && <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 13 }}>— {activeBoard.name}</span>}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barCategoryGap="20%">
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 13 }} />
              <Bar dataKey="tareas" radius={[6, 6, 0, 0]}>
                {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Priority breakdown */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Prioridades</h3>
          {priorityData.map(p => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14, color: 'var(--text-secondary)' }}>{p.name}</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: p.color }}>{p.value}</span>
              <div style={{ width: 80, height: 6, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${totalTasks > 0 ? (p.value / totalTasks) * 100 : 0}%`, height: '100%', background: p.color, borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Upcoming / Overdue */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
            {overdueTasks.length > 0 ? '⚠️ Tareas Atrasadas' : '📅 Próximos Eventos'}
          </h3>
          {overdueTasks.length > 0 ? (
            overdueTasks.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <AlertTriangle size={16} color="#ef4444" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: '#ef4444' }}>Venció {fmt(t.dueDate!)}</div>
                </div>
                <span className={`badge badge-${t.priority}`} style={{ fontSize: 11 }}>{t.priority}</span>
              </div>
            ))
          ) : upcomingEvents.length > 0 ? (
            upcomingEvents.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 4, height: 32, borderRadius: 2, background: e.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{e.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(e.startDate)}</div>
                </div>
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No hay eventos próximos</p>
          )}
        </div>
      </div>
    </div>
  );
}

function KPI({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ color }}>{icon}</div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}
