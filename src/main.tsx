import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Red de seguridad: si algo crashea, mostramos el error en vez de pantalla en blanco.
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1e', color: '#cbd5e1', fontFamily: 'Inter, system-ui, sans-serif', padding: 24, textAlign: 'center' }}>
          <div style={{ maxWidth: 460 }}>
            <h1 style={{ color: '#f8fafc', fontSize: 20 }}>Se produjo un error</h1>
            <p style={{ fontSize: 14, opacity: 0.8 }}>Recargá la página. Si sigue, pasale esta info a soporte:</p>
            <pre style={{ textAlign: 'left', fontSize: 12, background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8, overflow: 'auto', maxHeight: 200 }}>{String(this.state.error?.message || this.state.error)}</pre>
            <button onClick={() => window.location.reload()} style={{ marginTop: 14, padding: '10px 20px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Recargar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
