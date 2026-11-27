import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Download, RotateCcw, Upload } from 'lucide-react';
import { api, isCloud, post } from './base';
import { toast } from './hooks';

type State = { counts: Record<string, number>; files: number; lastCopy: number | null; copyError: string; data: string; copies: string; list: string[] };
type Trash = { group: string; table: string; at: number; extra: number; name: string };
const NAMES: Record<string, string> = { clients: 'Cliente', client_projects: 'Proyecto', services: 'Servicio', tasks: 'Tarea', boards: 'Tablero', expenses: 'Gasto', goals: 'Objetivo', history: 'Historial', notes: 'Idea', whiteboards: 'Pizarra', strategy_docs: 'Documento', prospects: 'Prospecto', onboardings: 'Onboarding', calendar_events: 'Evento', guide_topics: 'Guía', skills: 'Skill', client_portals: 'Portal', content_posts: 'Guion', content_accounts: 'Cuenta', competitors: 'Competidor', agreements: 'Acuerdo', movements: 'Movimiento', bills: 'Pago', funds: 'Sobre', objectives: 'Objetivo', plan_items: 'Tarea del día', touches: 'Mensaje' };
const when = (n: number) => new Date(n).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const send = post;

// Dónde están guardados los datos, copias y papelera.
export default function Datos() {
  const [st, setSt] = useState<State | null>(null);
  const [trash, setTrash] = useState<Trash[]>([]);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([api<State>('estado'), api<Trash[]>('papelera')]);
    if (a.data) setSt(a.data); if (b.data) setTrash(b.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true); const { error } = await fn(); setBusy(false);
    if (error) toast(error.message, 'error'); else { toast(ok); load(); }
  };
  const download = async () => {
    const { data, error } = await api('copia');
    if (error) return toast(error.message, 'error');
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `MYB Dashboard ${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const ask = (name: string) => confirm(`¿Volver a la copia "${name}"? Lo de ahora se reemplaza. Antes guardo una copia de cómo está hoy.`);
  const pick = async (f?: File) => {
    if (!f || !ask(f.name)) return;
    try { const dump = JSON.parse(await f.text()); await act(() => send('restaurar', { dump }), 'Copia restaurada'); }
    catch { toast('Ese archivo no es una copia de MYB Dashboard', 'error'); }
  };
  const total = st ? Object.values(st.counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="sl">
      <section className="cfg-card">
        <div className="cfg-card-title">Tus datos</div>
        {st && <>
          <p className="sl-p">{total} registros y {st.files} {st.files === 1 ? 'archivo' : 'archivos'} en {isCloud() ? 'Postgres, en la nube' : 'esta compu'}.</p>
          {!isCloud() && <p className={`sl-p${st.copyError ? ' bad' : ''}`}>{st.copyError ? `La última copia falló: ${st.copyError}` : st.lastCopy ? `Se copia sola después de cada cambio. Última: ${when(st.lastCopy)}` : 'Todavía no hay copias.'}</p>}
          {!isCloud() && <><p className="sl-path">Base: {st.data}</p><p className="sl-path">Copias: {st.copies}</p></>}
        </>}
        <div className="sl-row">
          {!isCloud() && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(() => send('copiar'), 'Copia guardada')}><Copy size={15} /> Copiar ahora</button>}
          <button className="btn btn-secondary btn-sm" onClick={download}><Download size={15} /> Descargar</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => file.current?.click()}><Upload size={15} /> Restaurar archivo</button>
          <input ref={file} type="file" accept=".json" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {st && st.list.length > 0 && <div className="sl-list">{st.list.map(f => <div key={f}><span>{f.replace('.json', '')}</span><button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { if (ask(f)) act(() => send('restaurar', { file: f }), 'Copia restaurada'); }}>Volver a esta</button></div>)}</div>}
      </section>
      <section className="cfg-card">
        <div className="cfg-card-title">Papelera</div>
        {trash.length === 0 ? <p className="sl-p">No borraste nada.</p> : <div className="sl-list">{trash.map(t => (
          <div key={t.group}><span><b>{t.name}</b><em>{NAMES[t.table] || t.table}{t.extra ? ` y ${t.extra} más` : ''}, {when(t.at)}</em></span>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(() => send('deshacer', { group: t.group }), 'Recuperado')}><RotateCcw size={14} /> Recuperar</button></div>))}</div>}
      </section>
      <style>{`.sl{max-width:720px;margin-top:20px;display:flex;flex-direction:column;gap:16px}.sl-p{font-size:14.5px;color:var(--text-secondary);line-height:1.5;margin-top:6px}.sl-p.bad{color:var(--text-primary);font-weight:600}.sl-path{font-size:13px;color:var(--text-muted);overflow-wrap:anywhere;margin-top:4px}.sl-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.sl-list{margin-top:14px;max-height:300px;overflow:auto}.sl-list>div{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;border-top:1px solid var(--border);font-size:14px}.sl-list span{min-width:0}.sl-list b{display:block;font-weight:600}.sl-list em{font-style:normal;font-size:13px;color:var(--text-muted)}.sl-list button{flex:0 0 auto}`}</style>
    </div>
  );
}
