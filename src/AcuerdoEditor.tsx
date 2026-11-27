import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, Eye, FileText, PenLine, Plus, Trash2, Wand2 } from 'lucide-react';
import { useTable } from './base';
import { toast } from './hooks';
import { money, type Service } from './services';
import {
  addDays, AG_STATUS, fDate, newAgreement, newPhase, paidOf, plural, projectTotal,
  type Agreement, type Cur, type Phase, type Terms,
} from './negocio';
import { buildDoc, fileName, termsOf, toDocx, toHtml, toPaste } from './acuerdoDoc';
import { DateIn, download, Field, Group, Lines, Modal, Num, Seg } from './ui';

const STEPS = ['Cliente y trabajo', 'Fases y pagos', 'Qué incluye', 'Compromisos', 'Reglas'] as const;

export { newAgreement };

export default function AcuerdoEditor({ agreement, onClose }: { agreement: Agreement; onClose: () => void }) {
  const ags = useTable<Agreement>('agreements');
  const services = useTable<Service & { id: string }>('services');
  const [a, setA] = useState<Agreement>(agreement);
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(false);
  const [sign, setSign] = useState(false);
  const [docs, setDocs] = useState(false);
  const [peek, setPeek] = useState(false);
  const last = useRef(agreement);
  const set = (p: Partial<Agreement>) => { setA(x => ({ ...x, ...p })); setSaved(false); };
  const setTerms = (p: Partial<Terms>) => set({ terms: { ...a.terms, ...p } });
  const T = termsOf(a);
  const signed = a.status !== 'borrador';

  // Guarda solo, un segundo después de dejar de escribir
  const flush = async (x: Agreement) => {
    const { id, created_at: _c, updated_at: _u, ...patch } = x;
    last.current = x;
    const ok = await ags.update(id, patch);
    if (last.current === x) setSaved(ok);
  };
  useEffect(() => { if (saved) return; const t = setTimeout(() => flush(a), 900); return () => clearTimeout(t); }, [a, saved]);
  const leave = async () => { if (!saved) await flush(a); onClose(); };

  const shown = useDeferredValue(a);
  const doc = useMemo(() => buildDoc(shown), [shown]);
  const html = useMemo(() => toHtml(doc), [doc]);
  const frame = useRef<HTMLIFrameElement>(null);

  const pickService = (id: string) => {
    const s = services.rows.find(x => x.id === id);
    if (!s) { set({ service_id: null }); return; }
    const one = s.prices.filter(p => p.period === 'unico' && !p.optional && p.amount > 0), mon = s.prices.filter(p => p.period === 'mes' && !p.optional && p.amount > 0);
    const cur: Cur = (one[0] || mon[0])?.currency || a.currency;
    const total = one.find(p => p.currency === cur)?.amount || 0, month = mon.find(p => p.currency === cur);
    set({
      service_id: id, title: a.title || s.name, includes: a.includes.length ? a.includes : s.includes, currency: a.phases.length ? a.currency : cur,
      phases: a.phases.length || !total ? a.phases : makePhases(total, 3, 30, a.start_at, 4, cur),
      monthly: a.monthly || !month ? a.monthly : { amount: month.amount, day: 10, from: addDays(a.start_at, 30), cancel_days: 30, covers: '' },
    });
  };
  const setPhase = (id: string, p: Partial<Phase>) => set({ phases: a.phases.map(x => x.id === id ? { ...x, ...p } : x) });

  const pdf = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/pdf', { method: 'POST', headers: { 'x-myb': '1', 'content-type': 'application/json' }, body: JSON.stringify({ html }) });
      if (res.ok) { download(await res.blob(), fileName(doc) + '.pdf'); toast('PDF descargado'); }
      else if (res.status === 404 || res.status === 501) { frame.current?.contentWindow?.print(); }
      else toast((await res.json().catch(() => null))?.error || 'No se pudo armar el PDF', 'error');
    } catch { toast('No se pudo armar el PDF', 'error'); }
    setBusy(false);
  };
  const google = async () => {
    const p = toPaste(doc);
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([p.html], { type: 'text/html' }), 'text/plain': new Blob([p.text], { type: 'text/plain' }) })]);
      window.open('https://docs.new', '_blank', 'noopener');
      setDocs(false); toast('Copiado. En el documento nuevo, pegá con Ctrl V');
    } catch { toast('El navegador no dejó copiar. Usá Word.', 'error'); }
  };

  const total = projectTotal(a);
  const missing = [!a.client_data.business && !a.client_data.name && 'el nombre del cliente', !a.title && 'el trabajo', !a.phases.length && !a.monthly && 'las fases o el abono', a.phases.some(p => p.kind === 'fase' && !p.due_at) && 'fechas en las fases'].filter(Boolean) as string[];

  return (
    <div className="ae">
      <div className="ae-top">
        <button className="btn btn-ghost" onClick={leave}><ArrowLeft size={17} /> Volver</button>
        <div className="ae-t"><b>{a.title || 'Acuerdo sin título'}</b><span>{a.number}, {AG_STATUS[a.status].toLowerCase()}. {saved ? 'Guardado' : 'Guardando…'}</span></div>
        <div className="row">
          <button className="btn btn-ghost ae-peek" onClick={() => setPeek(v => !v)}><Eye size={16} /> {peek ? 'Editar' : 'Ver'}</button>
          <button className="btn btn-secondary" onClick={() => setDocs(true)}><FileText size={16} /> Google Docs</button>
          <button className={`btn ${signed ? 'btn-primary' : 'btn-secondary'}`} disabled={busy} onClick={pdf}><Download size={16} /> {busy ? 'Armando…' : 'PDF'}</button>
          {!signed && <button className="btn btn-primary" onClick={() => setSign(true)}><PenLine size={16} /> Marcar firmado</button>}
        </div>
      </div>
      <div className={`ae-cols${peek ? ' peek' : ''}`}>
        <div className="ae-form">
          <nav className="ae-steps">{STEPS.map((s, i) => <button key={s} className={i === step ? 'on' : ''} aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}>{s}</button>)}</nav>
          {signed && <p className="note">Este acuerdo ya está firmado. Si cambiás precios o fechas, mandale la versión nueva al cliente.</p>}

          {step === 0 && <div className="ff">
            <Field label="Servicio" help="Trae el nombre, lo que incluye y el precio"><select className="select" value={a.service_id || ''} onChange={e => pickService(e.target.value)}><option value="">Otro trabajo</option>{services.rows.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Nombre del trabajo"><input className="input" value={a.title} onChange={e => set({ title: e.target.value })} /></Field>
            <div className="g2">
              <Field label="Negocio"><input className="input" value={a.client_data.business || ''} onChange={e => set({ client_data: { ...a.client_data, business: e.target.value } })} /></Field>
              <Field label="Quién firma"><input className="input" value={a.client_data.name || ''} onChange={e => set({ client_data: { ...a.client_data, name: e.target.value } })} /></Field>
              <Field label="DNI o CUIT"><input className="input" value={a.client_data.dni || ''} onChange={e => set({ client_data: { ...a.client_data, dni: e.target.value } })} /></Field>
              <Field label="WhatsApp"><input className="input" inputMode="tel" value={a.client_data.whatsapp || ''} onChange={e => set({ client_data: { ...a.client_data, whatsapp: e.target.value } })} /></Field>
              <Field label="Email"><input className="input" type="email" value={a.client_data.email || ''} onChange={e => set({ client_data: { ...a.client_data, email: e.target.value } })} /></Field>
              <Field label="Dirección"><input className="input" value={a.client_data.address || ''} onChange={e => set({ client_data: { ...a.client_data, address: e.target.value } })} /></Field>
              <Field label="Empieza"><DateIn label="Empieza" value={a.start_at} onChange={t => t && set({ start_at: t })} /></Field>
              <Group label="Moneda"><Seg value={a.currency} options={[['ARS', 'Pesos'], ['USD', 'Dólares']]} onChange={c => set({ currency: c })} /></Group>
            </div>
          </div>}

          {step === 1 && <div className="ff">
            <div className="ae-sum"><div><span>Total del trabajo</span><b>{money(total, a.currency)}</b></div><button className="btn btn-secondary" onClick={() => setAuto(true)}><Wand2 size={16} /> Armar fases</button></div>
            {a.phases.map(p => (
              <div className="ph" key={p.id}>
                <div className="ph-1"><input className="input" value={p.name} placeholder={p.kind === 'sena' ? 'Seña' : 'Nombre de la fase'} aria-label="Nombre de la fase" onChange={e => setPhase(p.id, { name: e.target.value })} />
                  <button className="btn btn-ghost btn-icon" disabled={paidOf(p) > 0} title={paidOf(p) > 0 ? 'Ya tiene un pago' : undefined} onClick={() => set({ phases: a.phases.filter(x => x.id !== p.id) })} aria-label={`Quitar ${p.name}`}><Trash2 size={16} /></button></div>
                {p.kind === 'fase' && <input className="input" value={p.deliverable} placeholder="Qué se entrega" aria-label="Qué se entrega" onChange={e => setPhase(p.id, { deliverable: e.target.value })} />}
                <div className="ph-2">
                  {p.kind === 'fase' ? <Field label="La entregamos"><DateIn label="Fecha de entrega" value={p.due_at} onChange={t => setPhase(p.id, { due_at: t })} /></Field> : <div className="f"><span>Cuándo</span><p className="ph-x">Al firmar</p></div>}
                  <Field label="Se paga"><Num label="Monto" prefix={a.currency === 'USD' ? 'US$' : '$'} value={p.amount} onChange={n => setPhase(p.id, { amount: n })} /></Field>
                  <Field label="Días para pagar"><Num label="Días para pagar" value={p.pay_days} onChange={n => setPhase(p.id, { pay_days: Math.round(n) })} /></Field>
                </div>
              </div>
            ))}
            <div className="row">
              {!a.phases.some(p => p.kind === 'sena') && <button className="btn btn-secondary btn-sm" onClick={() => set({ phases: [newPhase({ kind: 'sena', name: 'Seña', pay_days: 2 }), ...a.phases] })}><Plus size={15} /> Seña</button>}
              <button className="btn btn-secondary btn-sm" onClick={() => set({ phases: [...a.phases, newPhase({ name: `Fase ${a.phases.filter(p => p.kind === 'fase').length + 1}` })] })}><Plus size={15} /> Fase</button>
              {!a.monthly && <button className="btn btn-secondary btn-sm" onClick={() => set({ monthly: { amount: 0, day: 10, from: addDays(a.start_at, 30), cancel_days: 30, covers: '' } })}><Plus size={15} /> Abono mensual</button>}
            </div>
            {a.monthly && <div className="ph">
              <div className="ph-1"><b>Abono mensual</b><button className="btn btn-ghost btn-icon" disabled={a.monthly_paid.length > 0} onClick={() => set({ monthly: null })} aria-label="Quitar abono"><Trash2 size={16} /></button></div>
              <div className="ph-2">
                <Field label="Por mes"><Num label="Abono por mes" prefix={a.currency === 'USD' ? 'US$' : '$'} value={a.monthly.amount} onChange={n => set({ monthly: { ...a.monthly!, amount: n } })} /></Field>
                <Field label="Día de pago"><Num label="Día de pago" value={a.monthly.day} onChange={n => set({ monthly: { ...a.monthly!, day: Math.max(1, Math.min(31, Math.round(n) || 1)) } })} /></Field>
                <Field label="Desde"><DateIn label="Desde" value={a.monthly.from} onChange={t => t && set({ monthly: { ...a.monthly!, from: t } })} /></Field>
              </div>
              <div className="ph-2 two"><Field label="Qué cubre"><input className="input" value={a.monthly.covers} placeholder="Servidor, soporte y mejoras" onChange={e => set({ monthly: { ...a.monthly!, covers: e.target.value } })} /></Field>
                <Field label="Aviso para la baja (días)"><Num label="Días de aviso" value={a.monthly.cancel_days} onChange={n => set({ monthly: { ...a.monthly!, cancel_days: Math.round(n) } })} /></Field></div>
            </div>}
          </div>}

          {step === 2 && <div className="ff">
            <Field label="Qué incluye, uno por renglón"><Lines label="Qué incluye" value={a.includes} onChange={v => set({ includes: v })} rows={8} /></Field>
            <Field label="Qué no incluye"><Lines label="Qué no incluye" value={a.excludes} onChange={v => set({ excludes: v })} /></Field>
          </div>}
          {step === 3 && <div className="ff">
            <Field label="Nosotros nos comprometemos a"><Lines label="Nuestros compromisos" value={a.our_duties} onChange={v => set({ our_duties: v })} rows={8} /></Field>
            <Field label="El cliente se compromete a"><Lines label="Compromisos del cliente" value={a.client_duties} onChange={v => set({ client_duties: v })} rows={7} /></Field>
          </div>}
          {step === 4 && <div className="ff">
            <div className="g2">
              <Field label="Días de atraso en el pago para pausar"><Num label="Días para pausar" value={T.pause_days} onChange={n => setTerms({ pause_days: Math.round(n) })} /></Field>
              <Field label="Recargo por semana de atraso (%)" help="0 = sin recargo"><Num label="Recargo" value={T.late_fee_pct} onChange={n => setTerms({ late_fee_pct: n })} /></Field>
              <Field label="Avisamos un atraso nuestro (días antes)"><Num label="Días de aviso" value={T.notice_days} onChange={n => setTerms({ notice_days: Math.round(n) })} /></Field>
              <Field label="Descuento por semana de atraso nuestro (%)" help="0 = sin descuento"><Num label="Descuento" value={T.our_discount_pct} onChange={n => setTerms({ our_discount_pct: n })} /></Field>
              <Field label="Días hábiles para revisar"><Num label="Días para revisar" value={T.feedback_days} onChange={n => setTerms({ feedback_days: Math.round(n) })} /></Field>
              <Field label="Rondas de ajustes por fase"><Num label="Rondas" value={T.revisions} onChange={n => setTerms({ revisions: Math.round(n) })} /></Field>
              <Field label="Garantía (días)"><Num label="Garantía" value={T.support_days} onChange={n => setTerms({ support_days: Math.round(n) })} /></Field>
              <Field label="Ciudad"><input className="input" value={T.city} onChange={e => setTerms({ city: e.target.value })} /></Field>
            </div>
            <Field label="Cancelación" help="Vacío usa el texto habitual"><textarea className="textarea" value={T.stop_refund} onChange={e => setTerms({ stop_refund: e.target.value })} /></Field>
            <Field label="Aclaraciones para este cliente"><textarea className="textarea" value={a.notes} onChange={e => set({ notes: e.target.value })} /></Field>
          </div>}
          <div className="ae-nav">{step > 0 && <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>Atrás</button>}<span />{step < STEPS.length - 1 && <button className="btn btn-secondary" onClick={() => setStep(step + 1)}>Seguir</button>}</div>
          {missing.length > 0 && <p className="note">Falta {missing.join(', ')}.</p>}
        </div>
        <div className="ae-prev"><iframe ref={frame} title="Vista del acuerdo" srcDoc={html} /></div>
      </div>

      {auto && <AutoPhases a={a} total={total} onClose={() => setAuto(false)} onDone={ph => { set({ phases: ph }); setAuto(false); }} />}
      {sign && <SignModal a={a} missing={missing} onClose={() => setSign(false)} onSign={async (t) => { const x = { ...a, status: 'firmado' as const, signed_at: t }; setA(x); setSign(false); await flush(x); toast('Acuerdo en marcha'); onClose(); }} />}
      {docs && <Modal title="Pasarlo a Google Docs" onClose={() => setDocs(false)}>
        <div className="opts">
          <button onClick={google}><b>Abrir un documento nuevo</b><span>Copia el acuerdo y abre Google Docs. Pegá con Ctrl V.</span></button>
          <button onClick={() => { download(toDocx(doc), fileName(doc) + '.docx'); setDocs(false); }}><b>Descargar en Word</b><span>Se abre en Word o subiéndolo a Google Drive.</span></button>
        </div>
      </Modal>}
    </div>
  );
}

export function makePhases(total: number, n: number, senaPct: number, start: number, weeks: number, cur: Cur, names: string[] = []): Phase[] {
  const unit = cur === 'USD' ? 1 : 100, r = (x: number) => Math.round(x / unit) * unit;
  const sena = r(total * senaPct / 100), rest = total - sena, each = r(rest / n);
  const DEF: Record<number, string[]> = { 1: ['Entrega'], 2: ['Diseño', 'Entrega final'], 3: ['Diseño', 'Desarrollo', 'Entrega final'], 4: ['Diseño', 'Desarrollo', 'Pruebas', 'Entrega final'] };
  return [
    ...(senaPct > 0 ? [newPhase({ kind: 'sena', name: 'Seña', amount: sena, pay_days: 2 })] : []),
    ...Array.from({ length: n }, (_, i) => newPhase({ name: names[i] || DEF[n]?.[i] || `Fase ${i + 1}`, amount: i === n - 1 ? rest - each * (n - 1) : each, due_at: addDays(start, Math.round(weeks * 7 * (i + 1) / n)) })),
  ];
}
function AutoPhases({ a, total, onClose, onDone }: { a: Agreement; total: number; onClose: () => void; onDone: (p: Phase[]) => void }) {
  const [sum, setSum] = useState(total), [n, setN] = useState(3), [s, setS] = useState(30), [w, setW] = useState(4);
  const paid = a.phases.some(p => p.payments.length || p.done_at);
  const ph = makePhases(sum, Math.max(1, n), s, a.start_at, w, a.currency);
  return <Modal title="Armar fases" onClose={onClose} actions={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={paid || sum <= 0} onClick={() => onDone(ph)}>Usar estas</button></>}>
    <div className="g2">
      <Field label="Total"><Num label="Total" prefix={a.currency === 'USD' ? 'US$' : '$'} value={sum} onChange={setSum} /></Field>
      <Field label="Seña (%)"><Num label="Seña" value={s} onChange={x => setS(Math.min(100, x))} /></Field>
      <Field label="Cantidad de fases"><Num label="Fases" value={n} onChange={x => setN(Math.min(12, Math.round(x)))} /></Field>
      <Field label="Semanas en total"><Num label="Semanas" value={w} onChange={setW} /></Field>
    </div>
    <div className="lst">{ph.map(p => <div key={p.id}><b>{p.name}</b><span>{p.due_at ? fDate(p.due_at) : 'al firmar'}</span><em>{money(p.amount, a.currency)}</em></div>)}</div>
    {paid ? <p className="note">Ya hay fases entregadas o pagadas: cambialas una por una.</p> : a.phases.length > 0 && <p className="note">Reemplaza las {plural(a.phases.length, 'fase cargada', 'fases cargadas')}.</p>}
  </Modal>;
}
function SignModal({ a, missing, onClose, onSign }: { a: Agreement; missing: string[]; onClose: () => void; onSign: (t: number) => void }) {
  const [t, setT] = useState<number>(Date.now());
  return <Modal title="Marcar como firmado" onClose={onClose} actions={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={() => onSign(t)}>Firmado</button></>}>
    <Field label="Fecha de la firma"><DateIn label="Fecha de la firma" value={t} onChange={x => x && setT(x)} /></Field>
    <p className="help">Desde ahí empiezan a contar las fases, los cobros de {a.client_data.business || 'este cliente'} y los mensajes.</p>
    {missing.length > 0 && <p className="note">Todavía falta {missing.join(', ')}.</p>}
  </Modal>;
}
