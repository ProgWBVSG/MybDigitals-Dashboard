import { useMemo, useState } from 'react';
import { Check, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react';
import { deleteOp, insertOp, saveAll, updateOp, useTable, usePerson, PEOPLE } from './base';
import { receiptSignedUrl, toast, uploadReceipt, useExchangeRate } from './hooks';
import { money } from './services';
import Cobro from './Cobro';
import { ACCOUNTS, FUND_START, fundSplitText } from './plataTxt';
import {
  both, cash, CATEGORIES, daysTo, duesOf, fDate, fMonth, inArs, MOVE, nextDue, plural, purse, splitIncome, sumMoves, viewFunds, when, ymd,
  type Agreement, type Bill, type ClientRow, type Cur, type Due, type Fund, type MoveKind, type Movement, type Purse,
} from './negocio';
import { Bar, DateIn, Empty, Field, Group, Modal, Num, Seg } from './ui';

type Tab = 'resumen' | 'movimientos';
const SIGN = (c: Cur) => c === 'USD' ? 'US$' : '$';

export default function Plata() {
  const moves = useTable<Movement>('movements'), funds = useTable<Fund>('funds'), bills = useTable<Bill>('bills');
  const ags = useTable<Agreement>('agreements'), clients = useTable<ClientRow>('clients');
  const rate = useExchangeRate();
  const [tab, setTab] = useState<Tab>('resumen');
  const [move, setMove] = useState<Partial<Movement> | null>(null);
  const [bill, setBill] = useState<Partial<Bill> | null>(null);
  const [pay, setPay] = useState<Bill | null>(null);
  const [due, setDue] = useState<Due | null>(null);
  const [edit, setEdit] = useState(false);

  const list = useMemo(() => [...moves.rows].sort((a, b) => b.date - a.date), [moves.rows]);
  const dues = useMemo(() => ags.rows.flatMap(a => duesOf(a)).filter(d => d.state !== 'pagado' && d.state !== 'futuro').sort((a, b) => (a.due_at ?? 0) - (b.due_at ?? 0)), [ags.rows]);
  const promised = useMemo(() => ags.rows.flatMap(a => duesOf(a)).filter(d => d.state === 'futuro' && d.kind !== 'mes'), [ags.rows]);
  const toPay = useMemo(() => bills.rows.filter(b => b.active).sort((a, b) => a.due_at - b.due_at), [bills.rows]);
  const soon = toPay.filter(b => daysTo(b.due_at) <= 30);
  const env = useMemo(() => viewFunds(funds.rows, moves.rows), [funds.rows, moves.rows]);
  const clientOf = (id: string | null) => clients.rows.find(c => c.id === id)?.name || '';
  if (!moves.ready || !funds.ready) return <div className="view-load"><div className="spinner-lg" /></div>;

  const now = cash(list), inAll = sumMoves(list, m => m.kind === 'ingreso'), own = sumMoves(list, m => m.kind === 'aporte');
  const inv = sumMoves(list, m => m.kind === 'inversion'), spent = sumMoves(list, m => m.kind === 'gasto'), took = sumMoves(list, m => m.kind === 'retiro');
  const add = (xs: { left: number; agreement: Agreement }[]): Purse => xs.reduce((p, d) => { p[d.agreement.currency] += d.left; return p; }, purse());
  const owed = add(dues), billsSum = soon.reduce((p, b) => { p[b.currency] += b.amount; return p; }, purse());
  const ars = (p: Purse) => inArs(p, rate);
  const everIn = ars(inAll) + ars(own);
  const parts: [string, Purse, string, string][] = [
    ['Sin usar', now, 'Lo que tenemos hoy', 'a'], ['Invertido', inv, 'Puesto en crecer o desarrollar', 'b'], ['Gastado', spent, 'Se fue en funcionar', 'c'], ['Retirado', took, 'Nos lo llevamos', 'd'],
  ];

  const startFunds = async () => { const e = await saveAll(FUND_START.map((f, i) => insertOp('funds', { ...f, sort: i }))); if (e) toast('No se pudo: ' + e, 'error'); else toast('Sobres creados'); };
  const removeMove = async (m: Movement) => {
    const a = ags.rows.find(x => x.id === m.agreement_id);
    if (!confirm(`¿Borrar "${m.concept}" de ${money(m.amount, m.currency)}?${a && m.kind === 'ingreso' ? ' También se desmarca el pago en el acuerdo.' : ''}`)) return;
    const ops = [deleteOp('movements', m.id)];
    if (a) ops.push(updateOp('agreements', a.id, { phases: a.phases.map(p => ({ ...p, payments: p.payments.filter(x => x.movement_id !== m.id) })), monthly_paid: a.monthly_paid.filter(x => x.movement_id !== m.id) }));
    const e = await saveAll(ops); if (e) toast('No se pudo: ' + e, 'error'); else toast('Borrado. Está en la papelera, en Configuración');
  };

  return (
    <div>
      <div className="page-head">
        <div><h1>Plata</h1><p>Dólar blue a {money(rate, 'ARS')}</p></div>
        <div className="row"><button className="btn btn-secondary" onClick={() => setMove({ kind: 'gasto' })}>Salió plata</button><button className="btn btn-primary" onClick={() => setMove({ kind: 'ingreso' })}><Plus size={17} /> Entró plata</button></div>
      </div>

      <div className="pl-top">
        <div className="pl-now"><span>Tenemos hoy</span><b>{both(now)}</b>{now.USD !== 0 && <small>{money(Math.round(ars(now)), 'ARS')} en total</small>}</div>
        <div><span>Juntamos en toda la historia</span><b>{both(inAll)}</b>{inAll.USD !== 0 && <small>{money(Math.round(ars(inAll)), 'ARS')} en total</small>}</div>
        <div><span>Nos deben ahora</span><b>{both(owed)}</b><small>{dues.length ? plural(dues.length, 'pago para cobrar', 'pagos para cobrar') : 'Nada pendiente'}</small></div>
        <div><span>Hay que pagar, 30 días</span><b>{both(billsSum)}</b><small>{soon.length ? plural(soon.length, 'pago', 'pagos') : 'Nada cargado'}</small></div>
      </div>

      <Seg value={tab} onChange={setTab} options={[['resumen', 'En qué está'], ['movimientos', `Movimientos${list.length ? ` (${list.length})` : ''}`]]} label="Vista" />

      {tab === 'resumen' ? <div className="pl-grid">
        <section className="pn pl-where">
          <h2>Dónde está cada peso que entró</h2>
          {everIn <= 0 ? <p className="help">Cargá lo que entró y lo que salió para verlo. Podés empezar por lo que tienen hoy, como un ingreso o un aporte.</p> : <>
            <div className="stack" role="img" aria-label={parts.map(([n, p]) => `${n} ${both(p)}`).join(', ')}>{parts.map(([n, p, , k]) => ars(p) > 0 && <i key={k} className={k} style={{ flexGrow: ars(p) }} title={`${n}: ${both(p)}`} />)}</div>
            <div className="stack-l">{parts.map(([n, p, h, k]) => <div key={k}><i className={k} /><span>{n}<small>{h}</small></span><b>{both(p)}<small>{Math.round(Math.max(0, ars(p)) / everIn * 100)} %</small></b></div>)}</div>
          </>}
        </section>

        <section className="pn">
          <div className="pn-h"><h2>Sobres</h2>{funds.rows.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setEdit(true)}><Pencil size={15} /> Cambiar</button>}</div>
          {funds.rows.length === 0 ? <><p className="help">Cada pago que entra se reparte solo. Así se ve qué parte está para invertir, cuál se usó y cuál no.</p>
            <div className="lst">{FUND_START.map(f => <div key={f.name}><b>{f.name}</b><span>{f.why}</span><em>{f.pct} %</em></div>)}</div>
            <button className="btn btn-primary" onClick={startFunds}>Empezar con estos</button></>
            : <div className="envs">{env.map(v => {
              const g = ars(v.got), u = ars(v.used);
              return <div key={v.fund?.id || '-'} className="env">
                <div><b>{v.fund?.name || 'Sin asignar'}</b><em>{both(v.left)}</em></div>
                <Bar pct={g > 0 ? u / g * 100 : 0} label={`Usado ${both(v.used)} de ${both(v.got)}`} />
                <small>{v.fund ? `${v.fund.pct} % de lo que entra. ` : 'Entró sin repartir. '}Usado {both(v.used)} de {both(v.got)}</small>
              </div>;
            })}<button className="btn btn-ghost btn-sm" onClick={() => setMove({ kind: 'traspaso' })}>Mover entre sobres</button></div>}
        </section>

        <section className="pn">
          <div className="pn-h"><h2>Para cobrar</h2><p>{promised.length > 0 && `${both(add(promised))} más cuando entreguemos`}</p></div>
          {dues.length === 0 ? <p className="help">Nadie debe nada. Los cobros salen de los acuerdos firmados.</p> : dues.map(d => <div className="li" key={d.key}>
            <div><b>{clientOf(d.agreement.client_id)}</b><span>{d.label}. {d.state === 'vencido' ? `Venció ${when(d.due_at!)}` : `Vence ${when(d.due_at!)}`}</span></div>
            <em>{money(d.left, d.agreement.currency)}</em><button className={`btn btn-sm ${d.state === 'vencido' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDue(d)}>Cobré</button></div>)}
        </section>

        <section className="pn">
          <div className="pn-h"><h2>Para pagar</h2><button className="btn btn-ghost btn-sm" onClick={() => setBill({ repeat: 'mes' })}><Plus size={15} /> Agregar</button></div>
          {toPay.length === 0 ? <p className="help">Cargá servidores, dominios, herramientas o cualquier pago fijo.</p> : toPay.map(b => { const n = daysTo(b.due_at); return <div className="li" key={b.id}>
            <button className="li-t" onClick={() => setBill(b)}><b>{b.name}</b><span>{n < 0 ? 'Venció' : 'Vence'} {when(b.due_at)}{b.repeat !== 'no' ? `, todos los ${b.repeat === 'mes' ? 'meses' : 'años'}` : ''}</span></button>
            <em>{money(b.amount, b.currency)}</em><button className={`btn btn-sm ${n < 0 ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPay(b)}>Pagué</button></div>; })}
        </section>

        <Months list={list} rate={rate} />
      </div> : <Moves list={list} funds={funds.rows} clientOf={clientOf} onAdd={() => setMove({ kind: 'gasto' })} onEdit={setMove} onRemove={removeMove} />}

      {move && <MoveModal value={move} funds={funds.rows} clients={clients.rows} onClose={() => setMove(null)} />}
      {bill && <BillModal value={bill} funds={funds.rows} onClose={() => setBill(null)} onSave={async b => { if (b.id ? await bills.update(b.id, b) : await bills.add(b)) setBill(null); }} onDelete={async b => { if (confirm(`¿Borrar "${b.name}"? Los pagos ya hechos quedan.`) && await bills.remove(b.id!)) setBill(null); }} />}
      {pay && <PayModal bill={pay} funds={funds.rows} onClose={() => setPay(null)} />}
      {due && <Cobro due={due} onClose={() => setDue(null)} />}
      {edit && <FundsModal rows={funds.rows} onClose={() => setEdit(false)} />}
    </div>
  );
}

// ─── Mes a mes ───
function Months({ list, rate }: { list: Movement[]; rate: number }) {
  const rows = useMemo(() => {
    const t = new Date(); const out: { key: string; at: number; inn: number; out: number; inv: number }[] = [];
    for (let i = 11; i >= 0; i--) { const d = new Date(t.getFullYear(), t.getMonth() - i, 1, 12).getTime(); out.push({ key: ymd(d).slice(0, 7), at: d, inn: 0, out: 0, inv: 0 }); }
    for (const m of list) { const r = out.find(x => x.key === ymd(m.date).slice(0, 7)); if (!r) continue; const v = m.currency === 'USD' ? m.amount * rate : m.amount; if (m.kind === 'ingreso') r.inn += v; else if (m.kind === 'gasto' || m.kind === 'retiro') r.out += v; else if (m.kind === 'inversion') r.inv += v; }
    const first = out.findIndex(r => r.inn || r.out || r.inv);
    return first < 0 ? [] : out.slice(Math.min(first, 9));
  }, [list, rate]);
  const [on, setOn] = useState<number | null>(null);
  if (!rows.length) return null;
  const max = Math.max(1, ...rows.map(r => Math.max(r.inn, r.out + r.inv)));
  const shown = rows[on ?? rows.length - 1], m = (n: number) => money(Math.round(n), 'ARS');
  return <section className="pn pl-months">
    <div className="pn-h"><h2>Mes a mes</h2><p>{fMonth(shown.at)}: entró {m(shown.inn)}, invertimos {m(shown.inv)}, salió {m(shown.out)}</p></div>
    <div className="months" onMouseLeave={() => setOn(null)}>{rows.map((r, i) => <button key={r.key} className={on === i || (on === null && i === rows.length - 1) ? 'on' : ''} onMouseEnter={() => setOn(i)} onFocus={() => setOn(i)} aria-label={`${fMonth(r.at)}: entró ${m(r.inn)}, invertimos ${m(r.inv)}, salió ${m(r.out)}`}>
      <span><i className="b-in" style={{ height: `${r.inn / max * 100}%` }} /><span className="b-st" style={{ height: `${(r.out + r.inv) / max * 100}%` }}><i className="b-inv" style={{ flexGrow: r.inv }} /><i className="b-out" style={{ flexGrow: r.out }} /></span></span>
      <em>{new Date(r.at).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}</em></button>)}</div>
    <div className="legend"><span><i className="b-in" />Entró</span><span><i className="b-inv" />Invertimos</span><span><i className="b-out" />Salió</span></div>
  </section>;
}

// ─── Movimientos ───
function Moves({ list, funds, clientOf, onAdd, onEdit, onRemove }: { list: Movement[]; funds: Fund[]; clientOf: (id: string | null) => string; onAdd: () => void; onEdit: (m: Movement) => void; onRemove: (m: Movement) => void }) {
  const [kind, setKind] = useState<MoveKind | ''>(''); const [q, setQ] = useState(''); const [n, setN] = useState(60);
  const t = q.trim().toLowerCase();
  const rows = list.filter(m => (!kind || m.kind === kind) && (!t || [m.concept, m.category, m.account, clientOf(m.client_id)].join(' ').toLowerCase().includes(t)));
  if (!list.length) return <Empty title="Todavía no hay movimientos" text="Cargá lo que entra y lo que sale. Los cobros de los acuerdos aparecen solos."><button className="btn btn-primary" onClick={onAdd}>Cargar el primero</button></Empty>;
  const total = rows.reduce((p, m) => { p[m.currency] += m.amount * (kind === 'traspaso' ? 1 : MOVE[m.kind].sign); return p; }, purse());
  let month = '';
  return <section className="pn pl-moves">
    <div className="pl-f"><input className="input" placeholder="Buscar" aria-label="Buscar movimiento" value={q} onChange={e => setQ(e.target.value)} />
      <select className="select" aria-label="Tipo" value={kind} onChange={e => setKind(e.target.value as MoveKind | '')}><option value="">Todo</option>{(Object.keys(MOVE) as MoveKind[]).map(k => <option key={k} value={k}>{MOVE[k].label}</option>)}</select>
      <p>{plural(rows.length, 'movimiento', 'movimientos')}, {both(total)}</p></div>
    {rows.slice(0, n).map(m => {
      const head = fMonth(m.date), sep = head !== month; month = head;
      const fund = funds.find(f => f.id === m.fund_id)?.name, to = funds.find(f => f.id === m.to_fund_id)?.name, s = MOVE[m.kind].sign;
      return <div key={m.id}>{sep && <h3 className="pl-m">{head}</h3>}<div className="li">
        <div><b>{m.concept || MOVE[m.kind].label}</b><span>{[fDate(m.date), MOVE[m.kind].label, m.category !== m.concept && m.category, clientOf(m.client_id), m.kind === 'traspaso' ? `${fund || 'Sin asignar'} a ${to || 'Sin asignar'}` : fund && `de ${fund}`, m.person && PEOPLE[m.person as 'benja'], m.account].filter(Boolean).join(', ')}</span></div>
        {m.receipt_path && <Receipt path={m.receipt_path} />}
        <em>{s > 0 ? '+' : s < 0 ? '−' : ''}{money(m.amount, m.currency)}</em>
        {!(m.kind === 'ingreso' && m.agreement_id) && <button className="btn btn-ghost btn-icon" onClick={() => onEdit(m)} aria-label={`Cambiar ${m.concept}`}><Pencil size={15} /></button>}
        <button className="btn btn-ghost btn-icon" onClick={() => onRemove(m)} aria-label={`Borrar ${m.concept}`}><Trash2 size={15} /></button>
      </div></div>;
    })}
    {rows.length > n && <button className="btn btn-ghost" onClick={() => setN(n + 100)}>Ver más</button>}
  </section>;
}
function Receipt({ path }: { path: string }) {
  return <button className="btn btn-ghost btn-icon" title="Ver comprobante" aria-label="Ver comprobante" onClick={async () => { const u = await receiptSignedUrl(path); if (u) window.open(u, '_blank', 'noopener'); }}><Paperclip size={15} /></button>;
}

// ─── Cargar ───
function MoveModal({ value, funds, clients, onClose }: { value: Partial<Movement>; funds: Fund[]; clients: ClientRow[]; onClose: () => void }) {
  const moves = useTable<Movement>('movements'); const me = usePerson();
  const [f, setF] = useState<Partial<Movement>>({ currency: 'ARS', date: Date.now(), amount: 0, concept: '', category: '', account: localStorage.getItem('myb_cuenta') || '', person: '', fund_id: null, to_fund_id: null, client_id: null, receipt_path: null, ...value });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Movement>) => setF(x => ({ ...x, ...p }));
  const kind = f.kind || 'gasto', sign = MOVE[kind].sign, live = funds.filter(x => !x.archived);
  const splits = kind === 'ingreso' ? splitIncome(f.amount || 0, f.currency as Cur, funds) : [];
  const setKind = (k: MoveKind) => set({ kind: k, category: CATEGORIES[k].includes(f.category || '') ? f.category : '', person: k === 'retiro' || k === 'aporte' ? f.person || me : '', fund_id: k === 'inversion' ? live.find(x => x.kind === 'inversion')?.id ?? f.fund_id : k === 'retiro' ? live.find(x => x.name === PEOPLE[me])?.id ?? f.fund_id : f.fund_id });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(f.amount! > 0)) { toast('Poné el monto', 'error'); return; }
    if (kind === 'traspaso' && (f.fund_id || null) === (f.to_fund_id || null)) { toast('Elegí dos sobres distintos', 'error'); return; }
    setBusy(true);
    if (f.account) localStorage.setItem('myb_cuenta', f.account);
    const row = { ...f, kind, concept: f.concept?.trim() || f.category || MOVE[kind].label, splits, fund_id: kind === 'ingreso' ? null : f.fund_id || null, to_fund_id: kind === 'traspaso' ? f.to_fund_id || null : null };
    const ok = f.id ? await moves.update(f.id, row) : await moves.add(row);
    setBusy(false); if (ok) { toast('Guardado'); onClose(); }
  };
  return <Modal title={f.id ? 'Cambiar movimiento' : 'Cargar movimiento'} onClose={onClose}>
    <form className="ff" onSubmit={save}>
      <div className="kinds">{(Object.keys(MOVE) as MoveKind[]).map(k => <button type="button" key={k} className={k === kind ? 'on' : ''} aria-pressed={k === kind} onClick={() => setKind(k)}><b>{MOVE[k].label}</b><span>{MOVE[k].help}</span></button>)}</div>
      <div className="g2">
        <Field label="Cuánto"><Num label="Cuánto" prefix={SIGN(f.currency as Cur)} value={f.amount || 0} onChange={n => set({ amount: n })} /></Field>
        <Group label="Moneda"><Seg value={f.currency as Cur} options={[['ARS', 'Pesos'], ['USD', 'Dólares']]} onChange={c => set({ currency: c })} /></Group>
        {kind !== 'traspaso' && <Field label="En qué"><input className="input" list="cats" value={f.category || ''} onChange={e => set({ category: e.target.value })} /><datalist id="cats">{CATEGORIES[kind].map(c => <option key={c} value={c} />)}</datalist></Field>}
        <Field label="Cuándo"><DateIn label="Cuándo" value={f.date!} onChange={t => t && set({ date: t })} /></Field>
        {kind !== 'traspaso' && <Field label="Detalle"><input className="input" value={f.concept || ''} onChange={e => set({ concept: e.target.value })} /></Field>}
        {(sign < 0 || kind === 'traspaso' || kind === 'aporte') && <Field label={kind === 'aporte' ? 'Va al sobre' : 'Sale del sobre'}><select className="select" value={f.fund_id || ''} onChange={e => set({ fund_id: e.target.value || null })}><option value="">Sin asignar</option>{live.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>}
        {kind === 'traspaso' && <Field label="Va al sobre"><select className="select" value={f.to_fund_id || ''} onChange={e => set({ to_fund_id: e.target.value || null })}><option value="">Sin asignar</option>{live.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>}
        {(kind === 'retiro' || kind === 'aporte') && <Group label="Quién"><Seg value={(f.person || me) as 'benja' | 'mati'} options={[['benja', 'Benjamín'], ['mati', 'Matías']]} onChange={p => set({ person: p })} /></Group>}
        {kind === 'ingreso' && <Field label="Cliente"><select className="select" value={f.client_id || ''} onChange={e => set({ client_id: e.target.value || null })}><option value="">Ninguno</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
        {kind !== 'traspaso' && <Field label="Cuenta"><input className="input" list="cuentas2" value={f.account || ''} onChange={e => set({ account: e.target.value })} /><datalist id="cuentas2">{ACCOUNTS.map(x => <option key={x} value={x} />)}</datalist></Field>}
      </div>
      {splits.length > 0 && <p className="help">Se reparte: {fundSplitText(splits, funds, f.currency as Cur)}.</p>}
      {kind === 'ingreso' && <p className="help">Si es un pago de un acuerdo, registralo desde el cliente o desde "Para cobrar": así queda marcada la fase.</p>}
      <label className="btn btn-ghost btn-sm file"><Paperclip size={15} /> {f.receipt_path ? 'Cambiar comprobante' : 'Adjuntar comprobante'}<input type="file" accept="image/*,.pdf" hidden onChange={async e => { const x = e.target.files?.[0]; e.target.value = ''; if (x) { const p = await uploadReceipt(x); if (p) { set({ receipt_path: p }); toast('Comprobante adjunto'); } } }} /></label>
      <div className="x-modal-f in"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button></div>
    </form>
  </Modal>;
}
function BillModal({ value, funds, onClose, onSave, onDelete }: { value: Partial<Bill>; funds: Fund[]; onClose: () => void; onSave: (b: Partial<Bill>) => void; onDelete: (b: Partial<Bill>) => void }) {
  const [f, setF] = useState<Partial<Bill>>({ name: '', amount: 0, currency: 'ARS', due_at: Date.now(), fund_id: funds.find(x => x.kind === 'desarrollo')?.id || null, active: true, ...value });
  const set = (p: Partial<Bill>) => setF(x => ({ ...x, ...p }));
  return <Modal title={f.id ? 'Cambiar pago' : 'Agregar pago'} onClose={onClose}>
    <form className="ff" onSubmit={e => { e.preventDefault(); onSave({ ...f, name: f.name!.trim() }); }}>
      <Field label="Qué hay que pagar"><input className="input" required value={f.name} onChange={e => set({ name: e.target.value })} placeholder="Servidor, dominio, herramienta" /></Field>
      <div className="g2">
        <Field label="Cuánto"><Num label="Cuánto" prefix={SIGN(f.currency as Cur)} value={f.amount!} onChange={n => set({ amount: n })} /></Field>
        <Group label="Moneda"><Seg value={f.currency as Cur} options={[['ARS', 'Pesos'], ['USD', 'Dólares']]} onChange={c => set({ currency: c })} /></Group>
        <Field label="Vence"><DateIn label="Vence" value={f.due_at!} onChange={t => t && set({ due_at: t })} /></Field>
        <Field label="Se repite"><select className="select" value={f.repeat} onChange={e => set({ repeat: e.target.value as Bill['repeat'] })}><option value="no">Una sola vez</option><option value="mes">Todos los meses</option><option value="anio">Todos los años</option></select></Field>
        <Field label="Sale del sobre"><select className="select" value={f.fund_id || ''} onChange={e => set({ fund_id: e.target.value || null })}><option value="">Sin asignar</option>{funds.filter(x => !x.archived).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      </div>
      <div className="x-modal-f in">{f.id && <button type="button" className="btn btn-ghost" onClick={() => onDelete(f)}><Trash2 size={15} /> Borrar</button>}<span /><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={!(f.amount! > 0)}>Guardar</button></div>
    </form>
  </Modal>;
}
function PayModal({ bill, funds, onClose }: { bill: Bill; funds: Fund[]; onClose: () => void }) {
  const [amount, setAmount] = useState(bill.amount), [at, setAt] = useState(Date.now()), [kind, setKind] = useState<'gasto' | 'inversion'>('gasto'), [fund, setFund] = useState(bill.fund_id || '');
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const ops = [insertOp('movements', { kind, amount, currency: bill.currency, date: at, concept: bill.name, category: bill.name, fund_id: fund || null, bill_id: bill.id, splits: [] })];
    ops.push(updateOp('bills', bill.id, bill.repeat === 'no' ? { active: false } : { due_at: nextDue(bill), amount }));
    const err = await saveAll(ops); if (err) toast('No se pudo: ' + err, 'error'); else { toast('Pago registrado'); onClose(); }
  };
  return <Modal title={`Pagar ${bill.name}`} onClose={onClose}><form className="ff" onSubmit={save}>
    <div className="g2"><Field label="Cuánto"><Num label="Cuánto" prefix={SIGN(bill.currency)} value={amount} onChange={setAmount} /></Field><Field label="Cuándo"><DateIn label="Cuándo" value={at} onChange={t => t && setAt(t)} /></Field>
      <Field label="Sale del sobre"><select className="select" value={fund} onChange={e => setFund(e.target.value)}><option value="">Sin asignar</option>{funds.filter(x => !x.archived).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      <Group label="Cuenta como"><Seg value={kind} options={[['gasto', 'Gasto'], ['inversion', 'Inversión']]} onChange={setKind} /></Group></div>
    {bill.repeat !== 'no' && <p className="help">El próximo queda para el {fDate(nextDue(bill))}.</p>}
    <div className="x-modal-f in"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={amount <= 0}><Check size={16} /> Pagado</button></div>
  </form></Modal>;
}
function FundsModal({ rows, onClose }: { rows: Fund[]; onClose: () => void }) {
  const [l, setL] = useState(rows.filter(f => !f.archived).sort((a, b) => a.sort - b.sort).map(f => ({ ...f })));
  const total = l.reduce((s, f) => s + f.pct, 0);
  const set = (id: string, p: Partial<Fund>) => setL(x => x.map(f => f.id === id ? { ...f, ...p } : f));
  const save = async () => {
    const gone = rows.filter(f => !f.archived && !l.some(x => x.id === f.id));
    const e = await saveAll([
      ...l.map((f, i) => ({ table: 'funds', op: 'upsert' as const, body: { id: f.id, name: f.name.trim() || 'Sobre', pct: f.pct, why: f.why, kind: f.kind, sort: i, archived: false } })),
      ...gone.map(f => updateOp('funds', f.id, { archived: true, pct: 0 })),
    ]);
    if (e) toast('No se pudo: ' + e, 'error'); else { toast('Sobres guardados'); onClose(); }
  };
  return <Modal title="Cómo se reparte lo que entra" onClose={onClose} actions={<><span className={total > 100 ? 'bad' : ''}>{total > 100 ? `Suman ${total} %: tiene que ser 100 o menos` : `Suman ${total} %${total < 100 ? `. Queda ${100 - total} % sin asignar` : ''}`}</span><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={total > 100} onClick={save}>Guardar</button></>}>
    {l.map(f => <div className="fund" key={f.id}><input className="input" value={f.name} aria-label="Nombre" onChange={e => set(f.id, { name: e.target.value })} /><Num label={`Porcentaje de ${f.name}`} className="pct" prefix="%" value={f.pct} onChange={n => set(f.id, { pct: n })} /><button className="btn btn-ghost btn-icon" onClick={() => setL(x => x.filter(y => y.id !== f.id))} aria-label={`Quitar ${f.name}`}><Trash2 size={16} /></button><input className="input why" value={f.why} placeholder="Para qué" aria-label="Para qué" onChange={e => set(f.id, { why: e.target.value })} /></div>)}
    <button className="btn btn-secondary btn-sm" onClick={() => setL(x => [...x, { id: crypto.randomUUID(), name: '', kind: 'otro', pct: 0, why: '', sort: x.length, archived: false }])}><Plus size={15} /> Otro sobre</button>
    <p className="help">El cambio vale para lo que entre de ahora en más. Un sobre quitado sigue a la vista hasta que no le quede plata.</p>
  </Modal>;
}
