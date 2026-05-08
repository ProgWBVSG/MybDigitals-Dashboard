import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  CheckCircle2, Clock, AlertTriangle, CalendarDays, TrendingUp, 
  Users, Wallet, MinusCircle, Target, Plus, Trash2, TrendingDown, Receipt, Calendar 
} from 'lucide-react';
import { useTasks, useCalendar, useClients, useFinance, useExchangeRate } from './hooks';
import { fmt, isOverdue, fmtMoney, fmtUSD, type Board } from './utils';

const CHART_COLORS = ['#6366f1', '#3b82f6', '#f59e0b', '#10b981'];

export default function Metrics() {
  const { boards, cards } = useTasks();
  const { events } = useCalendar();
  const { clients } = useClients();
  const { expenses, goals, addExpense, removeExpense, addGoal, removeGoal } = useFinance();
  const dolarRate = useExchangeRate();

  const [showExpModal, setShowExpModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [expForm, setExpForm] = useState({ amount: 0, description: '', category: 'General' });
  const [goalForm, setGoalForm] = useState({ name: '', targetAmount: 0 });

  // Calculations
  const totalRevenue = useMemo(() => clients.reduce((s, c) => s + c.totalRevenue, 0), [clients]);
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const netProfit = totalRevenue - totalExpenses;
  const toUSD = (ars: number) => ars / dolarRate;

  // Task & Board Metrics (using currently loaded cards in active board)
  const allCards = cards;
  const totalTasks = allCards.length;
  const completedCols = boards.flatMap(b => b.columns.filter(c => c.name === 'Completado').map(c => c.id));
  const completed = allCards.filter(c => completedCols.includes(c.columnId)).length;
  const overdue = allCards.filter(c => c.dueDate && isOverdue(c.dueDate) && !completedCols.includes(c.columnId)).length;
  const upcomingEvents = events.filter(e => e.startDate > Date.now()).sort((a, b) => a.startDate - b.startDate).slice(0, 5);
  const completionRate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;
  const activeClients = clients.filter(c => c.status === 'active').length;

  const donutData = [
    { name: 'Completadas', value: completed, color: '#10b981' },
    { name: 'Pendientes', value: totalTasks - completed, color: '#334155' },
  ];

  const activeBoard = boards[0] as Board | undefined;
  const barData = useMemo(() => {
    if (!activeBoard) return [];
    return activeBoard.columns.sort((a, b) => a.order - b.order).map((col, i) => ({
      name: col.name,
      tareas: allCards.filter(c => c.columnId === col.id).length,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [activeBoard, allCards]);

  const priorityData = [
    { name: 'Urgente', value: allCards.filter(c => c.priority === 'urgent').length, color: '#ef4444' },
    { name: 'Alta', value: allCards.filter(c => c.priority === 'high').length, color: '#f59e0b' },
    { name: 'Media', value: allCards.filter(c => c.priority === 'medium').length, color: '#3b82f6' },
    { name: 'Baja', value: allCards.filter(c => c.priority === 'low').length, color: '#10b981' },
  ];

  const overdueTasks = allCards
    .filter(c => c.dueDate && isOverdue(c.dueDate) && !completedCols.includes(c.columnId))
    .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))
    .slice(0, 5);

  const handleAddExpense = () => {
    if (expForm.amount <= 0 || !expForm.description) return;
    addExpense(expForm);
    setShowExpModal(false);
    setExpForm({ amount: 0, description: '', category: 'General' });
  };

  const handleAddGoal = () => {
    if (goalForm.targetAmount <= 0 || !goalForm.name) return;
    addGoal({ ...goalForm, currentAmount: 0, deadline: null });
    setShowGoalModal(false);
    setGoalForm({ name: '', targetAmount: 0 });
  };

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Financial KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 28 }}>
        <FinanceKPI 
          icon={<TrendingUp size={20} />} 
          label="Ingresos Totales" 
          ars={totalRevenue} 
          usd={toUSD(totalRevenue)} 
          color="#10b981" 
          sub="Facturación acumulada"
        />
        <FinanceKPI 
          icon={<MinusCircle size={20} />} 
          label="Gastos Totales" 
          ars={totalExpenses} 
          usd={toUSD(totalExpenses)} 
          color="#ef4444" 
          sub={`${expenses.length} registros`}
          action={<button className="btn btn-ghost btn-sm" onClick={() => setShowExpModal(true)}><Plus size={14} /></button>}
        />
        <FinanceKPI 
          icon={netProfit >= 0 ? <Wallet size={20} /> : <TrendingDown size={20} />} 
          label="Balance Neto" 
          ars={netProfit} 
          usd={toUSD(netProfit)} 
          color={netProfit >= 0 ? '#3b82f6' : '#ef4444'} 
          sub="ARS vs USD Blue"
        />
        <KPI 
          icon={<Target size={20} />} 
          label="Cotización USD" 
          value={`$${dolarRate}`} 
          sub="Dólar Blue (Venta)" 
          color="#f59e0b" 
        />
      </div>

      {/* General KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <KPI icon={<CheckCircle2 size={20} />} label="Completadas" value={`${completed}/${totalTasks}`} sub={`${completionRate}%`} color="#10b981" />
        <KPI icon={<Clock size={20} />} label="En Proceso" value={String(totalTasks - completed)} sub="pendientes" color="#3b82f6" />
        <KPI icon={<AlertTriangle size={20} />} label="Atrasadas" value={String(overdue)} sub={overdue > 0 ? '⚠️ requieren atención' : 'todo al día'} color={overdue > 0 ? '#ef4444' : '#10b981'} />
        <KPI icon={<CalendarDays size={20} />} label="Próx. Eventos" value={String(upcomingEvents.length)} sub="esta semana" color="#6366f1" />
        <KPI icon={<Users size={20} />} label="Clientes Activos" value={String(activeClients)} sub={`de ${clients.length} total`} color="#f59e0b" />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* Completion Donut */}
        <div className="card card-3d" style={{ padding: 24 }}>
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
        <div className="card card-3d" style={{ padding: 24 }}>
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

      {/* Finance Goals & Expenses */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* Goals Section */}
        <div className="card card-3d" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Target size={18} color="var(--primary)" /> Objetivos Financieros
            </h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowGoalModal(true)}><Plus size={14} /> Nuevo Objetivo</button>
          </div>
          {goals.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No hay objetivos definidos.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {goals.map(g => {
                const percent = Math.min(Math.round((totalRevenue / g.targetAmount) * 100), 100);
                return (
                  <div key={g.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{g.name}</span>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtMoney(totalRevenue)} / {fmtMoney(g.targetAmount)}</span>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeGoal(g.id)}><Trash2 size={12} /></button>
                      </div>
                    </div>
                    <div style={{ height: 12, background: 'var(--bg-hover)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ 
                        width: `${percent}%`, height: '100%', 
                        background: 'linear-gradient(90deg, var(--primary), #10b981)', 
                        borderRadius: 6, transition: 'width 1s ease-out' 
                      }} />
                    </div>
                    <div style={{ fontSize: 12, marginTop: 6, textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{percent}%</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Expenses */}
        <div className="card card-3d" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt size={18} color="var(--danger)" /> Gastos Recientes
          </h3>
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            {expenses.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Sin gastos registrados.</p>
            ) : (
              expenses.sort((a,b) => b.date - a.date).map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{e.description}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(e.date)} · {e.category}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>-{fmtMoney(e.amount)}</span>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeExpense(e.id)}><Trash2 size={12} /></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Priority and Upcoming */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Priority breakdown */}
        <div className="card card-3d" style={{ padding: 24 }}>
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
        <div className="card card-3d" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            {overdueTasks.length > 0 ? (
              <><AlertTriangle size={18} color="var(--warning)" /> Tareas Atrasadas</>
            ) : (
              <><Calendar size={18} color="var(--info)" /> Próximos Eventos</>
            )}
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

      {/* Modals */}
      {showExpModal && (
        <div className="modal-overlay" onClick={() => setShowExpModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Registrar Gasto</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="input-group">
                <label>Monto (ARS)</label>
                <input className="input" type="number" value={expForm.amount} onChange={e => setExpForm(f => ({...f, amount: Number(e.target.value)}))} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>≈ {fmtUSD(toUSD(expForm.amount))} USD</div>
              </div>
              <div className="input-group">
                <label>Descripción</label>
                <input className="input" value={expForm.description} onChange={e => setExpForm(f => ({...f, description: e.target.value}))} placeholder="Ej: Publicidad Meta" />
              </div>
              <div className="input-group">
                <label>Categoría</label>
                <select className="select" value={expForm.category} onChange={e => setExpForm(f => ({...f, category: e.target.value}))}>
                  <option>Publicidad</option>
                  <option>Herramientas</option>
                  <option>Sueldos</option>
                  <option>Oficina</option>
                  <option>General</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowExpModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAddExpense}>Guardar Gasto</button>
            </div>
          </div>
        </div>
      )}

      {showGoalModal && (
        <div className="modal-overlay" onClick={() => setShowGoalModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Nuevo Objetivo</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="input-group">
                <label>Nombre del Objetivo</label>
                <input className="input" value={goalForm.name} onChange={e => setGoalForm(f => ({...f, name: e.target.value}))} placeholder="Ej: Meta Facturación Mayo" />
              </div>
              <div className="input-group">
                <label>Monto Objetivo (ARS)</label>
                <input className="input" type="number" value={goalForm.targetAmount} onChange={e => setGoalForm(f => ({...f, targetAmount: Number(e.target.value)}))} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>≈ {fmtUSD(toUSD(goalForm.targetAmount))} USD</div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowGoalModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAddGoal}>Crear Objetivo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FinanceKPI({ icon, label, ars, usd, color, sub, action }: any) {
  return (
    <div className="card card-3d" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ color }}>{icon}</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</span>
        </div>
        {action}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{fmtMoney(ars)}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-muted)', marginTop: 2 }}>{fmtUSD(usd)} <span style={{fontSize: 10, fontWeight: 400}}>USD Blue</span></div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{sub}</div>
    </div>
  );
}

function KPI({ icon, label, value, sub, color }: any) {
  return (
    <div className="card card-3d" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ color }}>{icon}</div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}
