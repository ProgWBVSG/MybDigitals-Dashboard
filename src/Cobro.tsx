import { useState } from 'react';
import { insertOp, saveAll, updateOp, useTable } from './base';
import { toast } from './hooks';
import { money } from './services';
import { ACCOUNTS, fundSplitText } from './plataTxt';
import { splitIncome, type Agreement, type Due, type Fund, type Movement } from './negocio';
import { DateIn, Field, Modal, Num } from './ui';

/** Registra un pago: entra a la plata, se reparte en los sobres y queda marcado en el acuerdo. Todo junto. */
export default function Cobro({ due, onClose }: { due: Due; onClose: () => void }) {
  const funds = useTable<Fund>('funds').rows;
  const a = due.agreement;
  const [amount, setAmount] = useState(due.left);
  const [at, setAt] = useState(Date.now());
  const [account, setAccount] = useState(localStorage.getItem('myb_cuenta') || '');
  const [busy, setBusy] = useState(false);
  const splits = splitIncome(amount, a.currency, funds);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(amount > 0)) return;
    setBusy(true);
    const id = crypto.randomUUID(), pay = { id: crypto.randomUUID(), at, amount, movement_id: id };
    if (account) localStorage.setItem('myb_cuenta', account);
    const mv: Partial<Movement> = { id, kind: 'ingreso', amount, currency: a.currency, date: at, concept: `${due.label}, ${a.title}`, category: due.kind === 'mes' ? 'Abono mensual' : 'Proyecto', account, splits, client_id: a.client_id, agreement_id: a.id, phase_id: due.ref };
    const patch: Partial<Agreement> = due.kind === 'mes' ? { monthly_paid: [...a.monthly_paid, { ...pay, period: due.ref }] } : { phases: a.phases.map(p => p.id === due.ref ? { ...p, payments: [...p.payments, pay] } : p) };
    const err = await saveAll([insertOp('movements', mv), updateOp('agreements', a.id, patch)]);
    setBusy(false);
    if (err) toast('No se pudo guardar: ' + err, 'error'); else { toast(`Cobrado: ${money(amount, a.currency)}`); onClose(); }
  };
  return (
    <Modal title={`Cobrar ${due.label}`} onClose={onClose}>
      <form className="ff" onSubmit={save}>
        <div className="g2">
          <Field label="Cuánto pagó" help={amount < due.left ? `Queda debiendo ${money(due.left - amount, a.currency)}` : undefined}><Num label="Cuánto pagó" prefix={a.currency === 'USD' ? 'US$' : '$'} value={amount} onChange={setAmount} /></Field>
          <Field label="Cuándo"><DateIn label="Cuándo" value={at} onChange={t => t && setAt(t)} /></Field>
        </div>
        <Field label="Dónde entró"><input className="input" list="cuentas" value={account} onChange={e => setAccount(e.target.value)} placeholder="Mercado Pago" /><datalist id="cuentas">{ACCOUNTS.map(x => <option key={x} value={x} />)}</datalist></Field>
        {splits.length > 0 && <p className="help">Se reparte: {fundSplitText(splits, funds, a.currency)}.</p>}
        <div className="x-modal-f in"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={busy || amount <= 0}>{busy ? 'Guardando…' : 'Registrar cobro'}</button></div>
      </form>
    </Modal>
  );
}
