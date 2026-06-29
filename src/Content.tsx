import { useState } from 'react';
import './Content.css';

type ContentTab = 'overview' | 'pipeline' | 'calendar' | 'generator' | 'sources' | 'settings';

export default function Content() {
  const [activeTab, setActiveTab] = useState<ContentTab>('overview');

  return (
    <div className="content-module">
      <div className="content-module-body app">
        <aside className="rail">
          <div className="brand">
            <div className="mark">IG</div>
            <div>
              <strong>Command Center</strong>
              <span>Content OS MVP</span>
            </div>
          </div>

          <nav className="nav" aria-label="Vistas">
            <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')} title="Control">
              <i>C</i><b>Control</b>
            </button>
            <button className={activeTab === 'pipeline' ? 'active' : ''} onClick={() => setActiveTab('pipeline')} title="Pipeline">
              <i>P</i><b>Pipeline</b>
            </button>
            <button className={activeTab === 'calendar' ? 'active' : ''} onClick={() => setActiveTab('calendar')} title="Calendario">
              <i>7</i><b>Calendario</b>
            </button>
            <button className={activeTab === 'generator' ? 'active' : ''} onClick={() => setActiveTab('generator')} title="Generador">
              <i>AI</i><b>Generador</b>
            </button>
            <button className={activeTab === 'sources' ? 'active' : ''} onClick={() => setActiveTab('sources')} title="Fuentes">
              <i>F</i><b>Fuentes</b>
            </button>
            <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')} title="IG Ready">
              <i>IG</i><b>IG Ready</b>
            </button>
          </nav>

          <div className="mini-card">
            <div className="signal">OFFLINE SAFE</div>
            <strong>Data mock local</strong>
            <span>Sin Meta API, preparado para conexión futura.</span>
          </div>
        </aside>

        <main className="main">
          {activeTab === 'overview' && <OverviewView onNavigate={setActiveTab} />}
          {activeTab === 'pipeline' && <PipelineView />}
          {activeTab === 'calendar' && <CalendarView />}
          {activeTab === 'generator' && <GeneratorView />}
          {activeTab === 'sources' && <SourcesView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  );
}

function OverviewView({ onNavigate }: { onNavigate: (tab: ContentTab) => void }) {
  return (
    <section className="view active">
      <section className="hero">
        <div className="hero-inner">
          <div>
            <p className="eyebrow">SYK Content Command Center</p>
            <h1>IG Performance Command Center.</h1>
            <p className="hero-copy">
              Tablero principal con métricas mock de Instagram, gráficos, señales de contenido
              y las otras pestañas operativas listas sin tocar Meta ni consultar APIs reales.
            </p>
            <div className="hero-actions">
              <button className="button primary" onClick={() => onNavigate('generator')}>Crear pieza mock</button>
              <button className="button" onClick={() => onNavigate('pipeline')}>Ver pipeline</button>
              <button className="button" onClick={() => onNavigate('settings')}>IG offline</button>
            </div>
          </div>
          <div className="command-strip">
            <div className="command-card">
              <div className="row"><strong>Quality gate</strong><span>87%</span></div>
              <div className="pulse-bar"><span style={{ width: '87%' }}></span></div>
            </div>
            <div className="command-card">
              <div className="row"><strong>Publicables hoy</strong><span>9 piezas</span></div>
              <div className="pulse-bar"><span style={{ width: '68%' }}></span></div>
            </div>
          </div>
        </div>
      </section>

      <div className="top-row">
        <div className="filters">
          <button className="chip active">Todo</button>
          <button className="chip">Reels</button>
          <button className="chip">Carruseles</button>
          <button className="chip">Stories</button>
          <button className="chip">Ads</button>
        </div>
      </div>

      <div className="ig-dashboard">
        {/* Mock Content para el Dashboard */}
        <div className="metric-grid">
          <MetricCard title="Seguidores" value="12,4K" delta="+120" />
          <MetricCard title="Alcance" value="1.4M" delta="+5.2%" />
          <MetricCard title="Visitas Perfil" value="8.9K" delta="+12%" />
          <MetricCard title="Engagement" value="4.2%" delta="-0.1%" />
        </div>
        
        <div className="analytics-grid">
          <section className="chart-card tall">
            <div className="chart-top">
              <div>
                <p className="eyebrow">Operación de contenido</p>
                <h2>Lo que hay que mirar hoy</h2>
              </div>
              <button className="button" onClick={() => onNavigate('pipeline')}>Abrir board</button>
            </div>
            <div style={{ padding: 20, color: 'var(--muted)' }}>[Gráficos y data en Supabase Fase 2]</div>
          </section>
        </div>
      </div>
    </section>
  );
}

function MetricCard({ title, value, delta }: { title: string, value: string, delta: string }) {
  return (
    <div className="metric-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <div className="delta">{delta}</div>
    </div>
  );
}

function PipelineView() {
  return (
    <section className="view active">
      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Workflow editorial</p>
            <h2>Pipeline de producción</h2>
          </div>
        </div>
        <div className="board">
          <div className="lane">
            <strong>Borrador</strong>
            <div className="post-card">
              <div className="thumb"></div>
              <div className="card-body">
                <h3>Idea: 3 errores en IG</h3>
                <p>Carrusel para romper creencias sobre los reels.</p>
                <div className="meta">
                  <span className="badge carrusel">Carrusel</span>
                  <span>Venta</span>
                </div>
              </div>
            </div>
          </div>
          <div className="lane">
            <strong>Aprobado</strong>
          </div>
          <div className="lane">
            <strong>Listo para publicar</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

function CalendarView() {
  return (
    <section className="view active">
      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Semana mock</p>
            <h2>Calendario editorial</h2>
          </div>
        </div>
        <div className="calendar">
          {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => (
            <div key={d} className="day">
              <strong>{d}</strong>
              {d === 'Lunes' && (
                <div className="calendar-item">
                  <span>10:00 AM</span>
                  <p>Reel: Romper creencias sobre el nicho.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GeneratorView() {
  return (
    <section className="view active">
      <div className="generator">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Mock IA</p>
              <h2>Crear pieza</h2>
            </div>
          </div>
          <form className="form-grid" onSubmit={e => e.preventDefault()}>
            <label>Formato
              <select><option>Reel</option><option>Carrusel</option></select>
            </label>
            <label>Objetivo
              <select><option>DM</option><option>Venta</option></select>
            </label>
            <label>Nivel de filo
              <input type="range" min="1" max="5" defaultValue="4" />
            </label>
            <button className="button primary" type="submit">Generar mock</button>
          </form>
        </section>

        <section className="panel output">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Salida</p>
              <h2>Guion listo para revisar</h2>
            </div>
          </div>
          <div className="script-card">
            [Output del generador aparecerá aquí]
          </div>
        </section>
      </div>
    </section>
  );
}

function SourcesView() {
  return (
    <section className="view active">
      <div className="source-grid">
        <div className="source-card">
          <strong>Llamada de ventas - Cliente X</strong>
          <p>"Me da miedo vender agresivo y no sé si mi nicho paga..."</p>
          <div className="tags"><span>Ventas</span><span>Objeciones</span></div>
        </div>
      </div>
    </section>
  );
}

function SettingsView() {
  return (
    <section className="view active">
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Instagram connector</p>
              <h2>Preparado, no conectado</h2>
            </div>
          </div>
          <div className="locked">
            <strong>OFFLINE MOCK</strong>
            <p>Esta versión no consulta Meta. Preparado para conexión futura.</p>
          </div>
          <div className="form-grid">
            <label>IG Business Account ID <input disabled value="mock_ig_business_account_id" /></label>
            <label>Meta App ID <input disabled value="mock_meta_app_id" /></label>
            <button className="button" disabled>Conectar IG más adelante</button>
          </div>
        </section>
      </div>
    </section>
  );
}
