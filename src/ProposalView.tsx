import { useState, useEffect } from 'react';
import ProposalDeck from './ProposalDeck';
import type { Proposal } from './utils';
import './index.css';

// Visor PÚBLICO de una propuesta (link que se le manda al prospecto): /?p=TOKEN
// Pide el JSON a la función pública share-proposal y dibuja el deck a pantalla
// completa. No tiene ningún acceso ni link al dashboard.
export default function ProposalView({ token }: { token: string }) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const base = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    fetch(`${base}/functions/v1/share-proposal?token=${encodeURIComponent(token)}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
      .then(async r => {
        const d = await r.json().catch(() => ({ ok: false, error: 'Respuesta inválida' }));
        if (d?.ok && d.proposal) setProposal({ ...d.proposal, cliente: d.proposal.cliente || d.cliente });
        else setError(d?.error || 'No se pudo cargar la propuesta.');
      })
      .catch(() => setError('No se pudo cargar la propuesta. Revisá tu conexión.'));
  }, [token]);

  if (proposal) return <ProposalDeck proposal={proposal} />;

  return (
    <div style={{ margin: 0, fontFamily: 'Inter, system-ui, sans-serif', background: '#0a0f1e', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: 24 }}>
      <div>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(145deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: '#fff', margin: '0 auto 18px' }}>M</div>
        {error ? (
          <>
            <h1 style={{ color: '#f8fafc' }}>Propuesta no disponible</h1>
            <p style={{ fontSize: 16 }}>{error}</p>
          </>
        ) : (
          <p style={{ fontSize: 16, opacity: 0.7 }}>Cargando propuesta…</p>
        )}
      </div>
    </div>
  );
}
