// Hablar: decís lo que pasó y se completa solo. Nada se guarda hasta que lo confirmás.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Check, MessageCircle, Mic, MicOff, Settings2, Trash2, Undo2, X } from 'lucide-react';
import { insertOp, post, saveAll, updateOp, usePerson, useTable, type Row } from './base';
import { toast, useExchangeRate } from './hooks';
import { sendWhats } from './Mensajes';
import { CATEGORIES, fDate, MOVE, splitIncome, when, type Agreement, type Bill, type ClientRow, type Fund, type MoveKind, type Movement, type PlanItem } from './negocio';
import { ACCOUNTS, fundSplitText } from './plataTxt';
import { goTo } from './rutas';
import { money } from './services';
import { ALL_TABS } from './Shell';
import { DateIn, Num, Seg } from './ui';
import { avisos, clienteDe, cobrables, despues, deshacer, dueDe, falta, faseDe, guardar, itemDe, servDe, TIPOS, type Accion, type Datos, type Falta, type Guardado, type Servicio, type Vuelta } from './voz/accion';
import { pregunta, responder, type Respuesta } from './voz/consultas';
import { corregir, enganchar, entender, mejorTexto, orden, tieneSenal } from './voz/entender';
import { contexto, desdeIA, preguntaIA, type Salida } from './voz/ia';
import { plano } from './voz/numeros';
import { decir, escuchar, hayDictado, type Oido } from './voz/oido';

interface Prefs { ok: boolean; ia: 'auto' | 'claude' | 'chatgpt' | 'no'; oido: 'navegador' | 'local'; auto: boolean; hablar: boolean }
const PREFS: Prefs = { ok: false, ia: 'auto', oido: 'navegador', auto: false, hablar: false };
const leer = (): Prefs => { try { return { ...PREFS, ...JSON.parse(localStorage.getItem('myb_voz') || '{}') }; } catch { return PREFS; } };
interface Registro extends Row { texto: string; resumen: string[]; vuelta: Vuelta[]; links: Guardado['links']; at: number; by: string; deshecho: boolean }
interface Motores { motores: { claude: boolean; chatgpt: boolean }; oido?: boolean }
const EJEMPLOS = ['Entraron 14 mil pesos de Ana por la seña de la web, a Mercado Pago', 'Gasté 5 lucas en nafta y 3 mil en comida', 'Mañana a las 10 tengo que llamar a Off Basic', '¿Quién nos debe plata?'];

export default function Voz({ onClose }: { onClose: () => void }) {
  const [prefs, setPrefs] = useState(leer);
  const [cap, setCap] = useState<Motores | null>(null);
  const [ver, setVer] = useState(false);
  const guardarPrefs = (p: Partial<Prefs>) => setPrefs(x => { const n = { ...x, ...p }; localStorage.setItem('myb_voz', JSON.stringify(n)); return n; });
  useEffect(() => { post<Motores>('voz', { estado: true }).then(r => setCap(r.data || { motores: { claude: false, chatgpt: false } })); }, []);
  if (!cap) return <Marco onClose={onClose}><div className="view-load"><div className="spinner-lg" /></div></Marco>;
  if (!prefs.ok) return <Marco onClose={onClose}><Ajustes prefs={prefs} cap={cap} primera onDone={p => { guardarPrefs({ ...p, ok: true }); }} /></Marco>;
  return <><Panel prefs={prefs} cap={cap} onClose={onClose} onAjustes={() => setVer(true)} />{ver && <Marco onClose={() => setVer(false)}><Ajustes prefs={prefs} cap={cap} primera={false} onDone={p => { guardarPrefs(p); setVer(false); }} /></Marco>}</>;
}

function Marco({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const prev = document.activeElement as HTMLElement | null; box.current?.focus(); return () => prev?.focus?.(); }, []);
  return <div className="vz-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="vz" role="dialog" aria-modal="true" aria-label="Hablar" tabIndex={-1} ref={box} onKeyDown={e => { if (e.key === 'Escape' && !e.defaultPrevented) onClose(); }}>{children}</div></div>;
}

// ─── Qué sale de la compu y qué no ───
function Ajustes({ prefs, cap, primera, onDone }: { prefs: Prefs; cap: Motores; primera: boolean; onDone: (p: Partial<Prefs>) => void }) {
  const ias = [cap.motores.claude && ['claude', 'Claude'], cap.motores.chatgpt && ['chatgpt', 'ChatGPT']].filter(Boolean) as ['claude' | 'chatgpt', string][];
  const [p, setP] = useState<Prefs>({ ...prefs, ia: prefs.ia === 'auto' ? ias[0]?.[0] || 'no' : prefs.ia, oido: prefs.oido === 'navegador' && !hayDictado() && cap.oido ? 'local' : prefs.oido });
  return <div className="vz-cfg">
    <div className="vz-h"><h2>{primera ? 'Antes de empezar a hablar' : 'Ajustes de la voz'}</h2></div>
    <div className="vz-opt"><div><b>Quién escribe lo que decís</b><p>{p.oido === 'navegador' ? 'El dictado del navegador. Escribe mientras hablás. El audio va a Google (Chrome) o a Microsoft (Edge).' : 'Whisper, en esta compu. El audio no sale. Tarda unos segundos más y usa memoria.'}</p></div>
      <Seg value={p.oido} label="Quién escribe" options={[...(hayDictado() ? [['navegador', 'Navegador'] as ['navegador', string]] : []), ...(cap.oido ? [['local', 'Esta compu'] as ['local', string]] : [])]} onChange={oido => setP({ ...p, oido })} /></div>
    <div className="vz-opt"><div><b>Quién entiende lo difícil</b><p>{p.ia === 'no' ? 'Sólo las reglas del dashboard. Entiende lo común y no sale nada de acá.' : `Lo simple se resuelve acá. Lo demás va a ${p.ia === 'claude' ? 'Claude' : 'ChatGPT'}: lo que dijiste, los nombres de clientes, tareas, cobros y, si preguntás algo, los números de la plata. De lo que está cargado no se mandan teléfonos, mails ni documentos.`}</p></div>
      <Seg value={p.ia} label="Quién entiende" options={[...ias, ['no', 'Sin IA']]} onChange={ia => setP({ ...p, ia })} /></div>
    <div className="vz-opt"><div><b>Guardar solo</b><p>{p.auto ? 'Si está todo completo y no hay nada raro, guarda a los 5 segundos. Se puede frenar o deshacer.' : 'Esperás a decir "guardalo" o tocar Guardar.'}</p></div>
      <Seg value={p.auto ? 'si' : 'no'} label="Guardar solo" options={[['no', 'Con mi OK'], ['si', 'Solo']]} onChange={v => setP({ ...p, auto: v === 'si' })} /></div>
    <div className="vz-opt"><div><b>Que me conteste en voz alta</b><p>Lee las preguntas y las respuestas.</p></div>
      <Seg value={p.hablar ? 'si' : 'no'} label="Contestar en voz alta" options={[['no', 'No'], ['si', 'Sí']]} onChange={v => setP({ ...p, hablar: v === 'si' })} /></div>
    {!ias.length && <p className="help">No hay ninguna IA conectada: se usan las reglas del dashboard.</p>}
    <div className="vz-f"><span /><button className="btn btn-primary" onClick={() => onDone(p)}>{primera ? 'Empezar' : 'Listo'}</button></div>
  </div>;
}

// ─── Panel ───
function Panel({ prefs, cap, onClose, onAjustes }: { prefs: Prefs; cap: Motores; onClose: () => void; onAjustes: () => void }) {
  const clients = useTable<ClientRow>('clients'), ags = useTable<Agreement>('agreements'), moves = useTable<Movement>('movements'), funds = useTable<Fund>('funds'), bills = useTable<Bill>('bills');
  const items = useTable<PlanItem>('plan_items'), servs = useTable<Servicio>('services'), pros = useTable<Row & { name: string }>('prospects'), mem = useTable<Row & { oido: string; cliente_id: string }>('voz_memoria'), reg = useTable<Registro>('voz_registro');
  const rate = useExchangeRate(), yo = usePerson();
  const listo = clients.ready && ags.ready && moves.ready && funds.ready && bills.ready && items.ready && servs.ready;
  const datos = useMemo<Datos>(() => ({ clients: clients.rows, agreements: ags.rows, movements: moves.rows, funds: funds.rows, bills: bills.rows, items: items.rows, services: servs.rows, prospects: pros.rows, memoria: mem.rows as any, rate, yo, now: Date.now(), cuenta: localStorage.getItem('myb_cuenta') || '' }), [clients.rows, ags.rows, moves.rows, funds.rows, bills.rows, items.rows, servs.rows, pros.rows, mem.rows, rate, yo]);

  const [lista, setLista] = useState<Accion[]>([]);
  const [dicho, setDicho] = useState<string[]>([]);
  const [vivo, setVivo] = useState('');
  const [pistas, setPistas] = useState<string[]>([]);
  const [oyendo, setOyendo] = useState<'abriendo' | 'oyendo' | 'escribiendo' | 'apagado'>('apagado');
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState('');
  const [resp, setResp] = useState<{ q: string; r: Respuesta; ia?: boolean } | null>(null);
  const [preg, setPreg] = useState('');
  const [hecho, setHecho] = useState<{ g: Guardado; id: string } | null>(null);
  const [cuenta, setCuenta] = useState(0);
  const [busy, setBusy] = useState(false);
  const [escrito, setEscrito] = useState('');
  const ref = useRef({ datos, lista, preg, pensando, hecho }); ref.current = { datos, lista, preg, pensando, hecho };
  const oido = useRef<Oido | null>(null), barras = useRef<HTMLDivElement>(null), fin = useRef<HTMLDivElement>(null);
  const ia = useRef<{ n: number; frase: string; base: Accion[] }>({ n: 0, frase: '', base: [] });
  const motor = prefs.ia === 'no' ? '' : prefs.ia !== 'auto' && cap.motores[prefs.ia] ? prefs.ia : cap.motores.claude ? 'claude' : cap.motores.chatgpt ? 'chatgpt' : '';

  const primera = useMemo(() => { for (let i = 0; i < lista.length; i++) { const f = falta(lista[i], datos); if (f) return { f, i }; } return null; }, [lista, datos]);
  const alertas = useMemo(() => lista.map(a => avisos(a, datos, lista)), [lista, datos]);
  const completa = lista.length > 0 && !primera && !preg;
  const pedir = primera?.f.pregunta || preg;

  // ─── Micrófono ───
  const niveles = useRef<number[]>(Array(32).fill(0));
  const pintar = useCallback((n: number) => { const l = niveles.current; l.push(Math.min(1, Math.sqrt(n) * 2.6)); l.shift(); const k = barras.current?.children; if (k) for (let i = 0; i < k.length; i++) (k[i] as HTMLElement).style.transform = `scaleY(${Math.max(0.06, l[i])})`; }, []);
  const prender = useCallback((modo: Prefs['oido'] = prefs.oido) => {
    oido.current?.parar(); setError('');
    const d = ref.current.datos;
    oido.current = escuchar({
      parcial: t => { setVivo(t); setCuenta(0); if (t !== '…') setPistas(entender(t, ref.current.datos).pistas); },
      frase: t => { setVivo(''); setPistas([]); procesar.current(t); },
      nivel: pintar, estado: setOyendo,
      error: (m, local, sigue) => { if (sigue) setError(m); else if (local && cap.oido) { toast('Sigo con Whisper, en esta compu'); prender('local'); } else { setError(m); oido.current?.parar(); oido.current = null; } },
    }, modo, 'MYB Digitals, pesos, lucas, palos, dólares, seña, abono, Mercado Pago, ' + d.clients.slice(0, 40).map(c => c.name).join(', '));
  }, [prefs.oido, cap.oido]);
  const apagar = useCallback(() => { oido.current?.parar(); oido.current = null; setOyendo('apagado'); setVivo(''); }, []);
  useEffect(() => { if (listo) prender(prefs.oido); return () => { oido.current?.parar(); oido.current = null; window.speechSynthesis?.cancel(); }; }, [listo, prefs.oido]);
  // Si nadie habla por un rato, el micrófono se apaga
  useEffect(() => { if (oyendo !== 'oyendo' || vivo) return; const t = setTimeout(apagar, lista.length ? 90000 : hecho ? 15000 : 45000); return () => clearTimeout(t); }, [oyendo, vivo, lista, dicho, resp, hecho]);
  const hablar = useCallback((t: string) => { if (prefs.hablar) decir(t, on => oido.current?.pausa(on)); }, [prefs.hablar]);
  useEffect(() => { if (pedir && !pensando) hablar(pedir); }, [pedir, pensando]);
  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }); }, [dicho, vivo]);

  // ─── Entender ───
  const aprender = (antes: Accion[], despues: Accion[]) => {
    for (const a of despues) {
      const b = antes.find(x => x.id === a.id);
      if (b?.cliente_nuevo && b.cliente_nuevo.length > 2 && a.cliente_id && !a.cliente_nuevo && !ref.current.datos.memoria.some(m => plano(m.oido) === plano(b.cliente_nuevo))) mem.add({ oido: b.cliente_nuevo, cliente_id: a.cliente_id } as any);
    }
  };
  const poner = (l: Accion[]) => { ref.current.lista = l; setLista(l); };
  const abrirSeccion = (t: string): boolean => {
    const id = mejorTexto(t, ALL_TABS.map(x => ({ id: x.key, n: `${x.label}` }))) || mejorTexto(t, ALL_TABS.map(x => ({ id: x.key, n: `${x.label} ${x.words || ''}` })));
    if (!id) return false; goTo(id); onClose(); return true;
  };
  const soltar = () => { ia.current.n++; setPensando(false); poner([]); setPreg(''); setCuenta(0); };

  const preguntar = async (frase: string, base: Accion[], hecha: Falta | null) => {
    if (!motor) return;
    const n = ++ia.current.n;
    // Si seguís hablando mientras piensa, se manda todo junto
    if (ref.current.pensando) frase = ia.current.frase + '. ' + frase; else ia.current.base = base;
    ia.current.frase = frase; ref.current.pensando = true; setPensando(true);
    const { ctx, cod } = contexto(frase, ref.current.datos, ia.current.base, hecha || (ref.current.preg ? { campo: 'titulo', pregunta: ref.current.preg } : null));
    const { data, error: er } = await post<{ salida: Salida }>('voz', { motor, ctx });
    if (n !== ia.current.n) return;
    ref.current.pensando = false; setPensando(false);
    const d = ref.current.datos;
    if (er || !data?.salida) { setError(`${er?.message || 'La IA no respondió'}. Quedó lo que entendí sin ella.`); if (!ref.current.lista.length) setPreg('No lo entendí. ¿Lo decís de otra forma?'); return; }
    const q = preguntaIA(data.salida, cod, d), antes = ref.current.lista;
    const nueva = desdeIA(data.salida, cod, d, antes, [...ia.current.base.map(a => a.texto), frase].join('. '));
    const ir = nueva.find(a => a.tipo === 'ir'); if (ir && abrirSeccion(ir.titulo)) return;
    if (nueva.some(a => a.tipo === 'deshacer')) { deshacerUltimo(); return; }
    const l = nueva.filter(a => a.tipo !== 'ir');
    if (q) { poner(ia.current.base); const r = responder(q, d) || (q.respuesta ? { texto: q.respuesta, filas: [], to: '' } : null); if (r) { setResp({ q: frase, r, ia: !responder(q, d) }); hablar(r.texto); } else setPreg('No tengo con qué responder eso.'); return; }
    if (l.length) poner(l); else if (!antes.length) setPreg('No lo entendí. ¿Lo decís de otra forma?');
    setPreg(data.salida.pregunta && l.every(a => !falta(a, d)) ? data.salida.pregunta.slice(0, 160) : '');
  };

  const ajenas = useRef(0);
  const procesar = useRef<(t: string) => void>(() => {});
  procesar.current = (t: string) => {
    const d = { ...ref.current.datos, now: Date.now() }, l = ref.current.lista;
    t = t.trim(); if (!t) return;
    setError(''); setCuenta(0);
    const o = orden(t);
    if (o === 'parar') { apagar(); return; }
    if (l.length && o === 'guardar') { confirmar(); return; }
    if (o === 'cancelar' && (l.length || ref.current.preg)) { soltar(); setDicho([]); return; }
    if (o) return;
    // Lo que suena de fondo no toca nada ni se manda a la IA. Si pasa tres veces seguidas, se apaga el micrófono
    if (!l.length && !ref.current.preg && !ref.current.pensando && !tieneSenal(t, d)) {
      setError(`Escuché "${t.slice(0, 90)}" y no encontré nada para cargar.`);
      if (++ajenas.current >= 3) { ajenas.current = 0; apagar(); }
      return;
    }
    ajenas.current = 0;
    setDicho(x => [...x.slice(-7), t]); setResp(null); setHecho(null);
    const pf = l.map((a, i) => ({ f: falta(a, d), i })).find(x => x.f) || null;
    if (!ref.current.pensando && !ref.current.preg) {
      const c = corregir(t, l, d, pf?.f || null, pf?.i);
      if (c) { aprender(l, c); poner(c); return; }
    }
    const e = entender(t, d), uno = e.acciones.length === 1 ? e.acciones[0] : null;
    if (uno?.tipo === 'ir' && abrirSeccion(uno.titulo)) return;
    if (uno?.tipo === 'deshacer') { deshacerUltimo(); return; }
    if (uno?.tipo === 'consulta') {
      const r = responder(pregunta(t, d), d);
      if (r) { setResp({ q: t, r }); hablar(r.texto); } else if (motor) preguntar(t, l, null); else setPreg('Eso no lo sé responder sin la IA.');
      return;
    }
    setPreg('');
    const suma = e.acciones.filter(a => a.tipo !== 'ir' && a.tipo !== 'consulta' && a.tipo !== 'deshacer');
    if (suma.length) poner([...l, ...suma]);
    if (motor && (!e.seguro || ref.current.pensando)) preguntar(t, l, pf?.f || null);
    else if (!suma.length) setPreg('No lo entendí. ¿Lo decís de otra forma?');
  };

  // ─── Guardar y deshacer ───
  const confirmar = async () => {
    const d = ref.current.datos, l = ref.current.lista;
    if (!l.length || busy) return;
    if (ref.current.pensando) { setError('Espero a que termine de entender y guardo.'); esperando.current = true; return; }
    const f = l.map(a => falta(a, d)).find(Boolean); if (f) { setError('Falta un dato: ' + f.pregunta); hablar(f.pregunta); return; }
    setBusy(true); setCuenta(0);
    const g = guardar(l, { ...d, now: Date.now() }), id = crypto.randomUUID();
    const ultima = [...l].reverse().find(a => a.tipo === 'plata' && a.cuenta)?.cuenta; if (ultima) localStorage.setItem('myb_cuenta', ultima);
    const err = await saveAll([...g.ops, insertOp('voz_registro', { id, texto: dicho.join('. ').slice(0, 1500), resumen: g.resumen, vuelta: g.vuelta, links: g.links, at: Date.now(), by: yo })]);
    setBusy(false);
    if (err) { setError('No se pudo guardar: ' + err); return; }
    soltar(); setDicho([]); setHecho({ g, id }); hablar('Guardado');
  };
  const esperando = useRef(false);
  useEffect(() => { if (!pensando && esperando.current) { esperando.current = false; setError(''); confirmar(); } }, [pensando]);
  const deshacerUno = async (r: Registro | undefined) => {
    if (!r) { toast('No hay nada para deshacer', 'error'); return; }
    const t: Record<string, { rows: Row[] }> = { clients, agreements: ags, movements: moves, bills, plan_items: items, services: servs, prospects: pros };
    const otras = [...new Set(r.vuelta.filter(v => v.que === 'borrar' && !t[v.tabla]).map(v => (v as { tabla: string }).tabla))];
    const extra = Object.fromEntries(await Promise.all(otras.map(async x => [x, (await post<{ rows: Row[] }>('db', { table: x, op: 'select' })).data?.rows || []] as const)));
    const { ops, quedo } = deshacer(r.vuelta, (tabla, id) => (t[tabla]?.rows || extra[tabla] || []).find(x => x.id === id));
    const err = await saveAll([...ops, updateOp('voz_registro', r.id, { deshecho: true })]);
    if (err) setError('No se pudo deshacer: ' + err); else { toast(quedo.length ? `Deshecho. No toqué ${quedo.join(', ')} porque cambió después` : 'Deshecho'); setHecho(null); }
  };
  const ultimos = useMemo(() => [...reg.rows].filter(r => !r.deshecho).sort((a, b) => b.at - a.at), [reg.rows]);
  const deshacerUltimo = () => { const l = ultimos.filter(r => r.vuelta.length); return deshacerUno(l.find(r => r.by === yo) || l[0]); };

  // Guardar solo, con cuenta regresiva que se puede frenar
  const sinRaros = alertas.every(a => !a.length);
  useEffect(() => { if (prefs.auto && completa && sinRaros && !pensando && !vivo && !busy) { setCuenta(5); } else setCuenta(0); }, [prefs.auto, lista, completa, sinRaros, pensando, busy]);
  useEffect(() => { if (!cuenta) return; const t = setTimeout(() => { if (cuenta === 1) confirmar(); else setCuenta(c => c && c - 1); }, 1000); return () => clearTimeout(t); }, [cuenta]);

  const cerrar = () => { if (lista.length && !confirm('Hay cosas sin guardar. ¿Las descarto?')) return; onClose(); };
  const editar = (i: number, p: Partial<Accion>, campo: string) => {
    const a = { ...lista[i], ...p, duda: campo === 'monto' ? false : lista[i].duda, fijo: lista[i].fijo.includes(campo) ? lista[i].fijo : [...lista[i].fijo, campo] };
    if (campo === 'cliente' || campo === 'clase') { if (!a.fijo.includes('ref')) a.ref = ''; enganchar(a, datos); }
    const n = lista.map((x, k) => k === i ? a : x); if (campo === 'cliente') aprender(lista, n); poner(n); setPreg('');
  };
  const tecla = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
    if (e.key === 'Enter' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test((e.target as HTMLElement).tagName) && completa) { e.preventDefault(); confirmar(); }
  };
  const on = oyendo === 'oyendo' || oyendo === 'escribiendo';
  const estado = pensando ? 'Entendiendo' : oyendo === 'abriendo' ? 'Abriendo el micrófono' : oyendo === 'escribiendo' ? 'Escribiendo lo que dijiste' : on ? (vivo ? 'Te escucho' : lista.length ? 'Decí "guardalo", corregí o agregá algo' : 'Te escucho') : 'Micrófono apagado';

  return <div className="vz-bg" onMouseDown={e => { if (e.target === e.currentTarget) cerrar(); }}>
    <div className={`vz vz-p${lista.length || resp || hecho ? ' con' : ''}`} role="dialog" aria-modal="true" aria-label="Hablar" tabIndex={-1} ref={el => { if (el && !el.dataset.f) { el.dataset.f = '1'; el.focus(); } }} onKeyDown={tecla}>
      <section className="vz-izq">
        <div className="vz-h"><h2>Hablar</h2><div className="row"><button className="btn btn-ghost btn-icon" onClick={onAjustes} aria-label="Ajustes de la voz"><Settings2 size={18} /></button><button className="btn btn-ghost btn-icon" onClick={cerrar} aria-label="Cerrar"><X size={19} /></button></div></div>
        <div className="vz-txt">
          {!dicho.length && !vivo && <p className="vz-ph">Contá qué pasó con tus palabras.</p>}
          {dicho.map((t, i) => <p key={i} className={i === dicho.length - 1 && !vivo ? 'ult' : ''}>{t}</p>)}
          {vivo && <p className="ult vivo">{marcar(vivo, pistas)}</p>}
          <div ref={fin} />
        </div>
        {!dicho.length && !vivo && !lista.length && !resp && !hecho && <div className="vz-ej">{EJEMPLOS.map(x => <button key={x} onClick={() => procesar.current(x)}>{x}</button>)}</div>}
        <div className="vz-pie">
          {pedir && !pensando && <p className="vz-preg" role="status">{pedir}</p>}
          {error && <p className="vz-err" role="alert">{error}</p>}
          <div className="vz-mic">
            <button className={`vz-b${on ? ' on' : ''}`} onClick={() => on || oyendo === 'abriendo' ? (vivo ? oido.current?.cerrarFrase() : apagar()) : prender()} aria-label={on ? 'Apagar el micrófono' : 'Prender el micrófono'}>{on ? <Mic size={24} /> : <MicOff size={24} />}</button>
            <div className={`vz-on${on ? ' on' : ''}`} ref={barras} aria-hidden="true">{niveles.current.map((_, i) => <i key={i} />)}</div>
            <span className={pensando ? 'pensando' : ''} role="status">{estado}</span>
          </div>
          <form className="vz-esc" onSubmit={e => { e.preventDefault(); const t = escrito; setEscrito(''); procesar.current(t); }}>
            <input className="input" value={escrito} onChange={e => setEscrito(e.target.value)} placeholder="O escribilo" aria-label="Escribirlo" /><button className="btn btn-secondary btn-icon" disabled={!escrito.trim()} aria-label="Enviar"><ArrowUp size={18} /></button>
          </form>
        </div>
      </section>

      <section className="vz-der">
        {resp && <div className="vz-resp"><h3>{resp.r.texto}</h3>{resp.r.filas.length > 0 && <div className="lst">{resp.r.filas.map((f, i) => <div key={i}><b>{f.a}</b>{f.c && <span>{f.c}</span>}<em>{f.b}</em></div>)}</div>}
          {resp.ia && <p className="help">Lo respondió la IA con los números del dashboard. Revisalo antes de decidir.</p>}
          {resp.r.to && <button className="btn btn-secondary" onClick={() => { goTo(resp.r.to); onClose(); }}>Ver el detalle</button>}</div>}
        {hecho && !lista.length && !resp && <div className="vz-resp"><h3>{hecho.g.ops.length ? 'Guardado' : 'Listo para mandar'}</h3><ul className="vz-ok">{hecho.g.resumen.map((r, i) => <li key={i}><Check size={17} /> {r}</li>)}</ul>
          {hecho.g.mensajes.map((m, i) => <div className="vz-wa" key={i}><p>{m.text}</p><button className="btn btn-primary" onClick={() => sendWhats({ phone: m.phone, text: m.text, client_id: m.client_id })}><MessageCircle size={17} /> Enviar a {m.nombre}</button></div>)}
          <div className="row">{hecho.g.links.map(l => <button key={l.to} className="btn btn-secondary" onClick={() => { goTo(l.to); onClose(); }}>{l.label}</button>)}{hecho.g.ops.length > 0 && <button className="btn btn-ghost" onClick={() => deshacerUno(reg.rows.find(r => r.id === hecho.id))}><Undo2 size={16} /> Deshacer</button>}</div></div>}
        {!lista.length && !resp && !hecho && <div className="vz-ult"><h3>Lo último que cargaste hablando</h3>{!ultimos.length ? <p className="help">Todavía nada.</p> : ultimos.slice(0, 6).map(r => <div className="li" key={r.id}><div><b>{r.resumen.join('. ') || r.texto}</b><span>{when(r.at)}</span></div>{r.vuelta.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => deshacerUno(r)}><Undo2 size={15} /> Deshacer</button>}</div>)}</div>}
        {lista.length > 0 && <>
          <div className="vz-l">{lista.map((a, i) => <Ficha key={a.id} a={a} d={datos} alertas={alertas[i]} pide={primera?.i === i ? primera.f : null} set={(p, c) => editar(i, p, c)} quitar={() => poner(lista.filter((_, k) => k !== i))} />)}</div>
          <div className="vz-f"><p>{despues(lista, datos)}</p><div className="row">
            <button className="btn btn-ghost" onClick={() => { soltar(); setDicho([]); }}>Descartar</button>
            {cuenta > 0 && <button className="btn btn-secondary" onClick={() => setCuenta(0)}>Frenar</button>}
            <button className="btn btn-primary" disabled={!completa || busy} onClick={confirmar}>{busy ? 'Guardando' : cuenta ? `Guardando en ${cuenta}` : lista.length > 1 ? `Guardar las ${lista.length}` : 'Guardar'}</button></div></div>
        </>}
      </section>
    </div>
  </div>;
}

/** Subraya lo que ya reconoció mientras hablás. */
function marcar(t: string, pistas: string[]) {
  const l = [...new Set(pistas.filter(x => x.trim().length > 1))].sort((a, b) => b.length - a.length);
  if (!l.length) return t;
  const re = new RegExp(`(${l.map(x => x.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return t.split(re).map((x, i) => i % 2 ? <mark key={i}>{x}</mark> : x);
}

// ─── Una ficha por cada cosa dicha ───
function Celda({ label, v, children, falta: f, ancho }: { label: string; v: unknown; children: React.ReactNode; falta?: boolean; ancho?: boolean }) {
  return <label className={`vz-c${f ? ' falta' : ''}${ancho ? ' ancho' : ''}`}><span>{label}</span><div key={String(v)} className={v ? 'lleno' : ''}>{children}</div></label>;
}
function Ficha({ a, d, alertas, pide, set, quitar }: { a: Accion; d: Datos; alertas: string[]; pide: Falta | null; set: (p: Partial<Accion>, campo: string) => void; quitar: () => void }) {
  const f = (c: Falta['campo']) => pide?.campo === c;
  const cli = <Celda label="Cliente" v={a.cliente_id || a.cliente_nuevo} falta={f('cliente')}><select className="select" value={a.cliente_id || (a.cliente_nuevo ? '+' : '')} onChange={e => e.target.value !== '+' && set({ cliente_id: e.target.value || null, cliente_nuevo: e.target.value ? '' : '', opciones: [] }, 'cliente')}>
    <option value="">Ninguno</option>{a.cliente_nuevo && <option value="+">{a.cliente_nuevo} (no está cargado)</option>}{[...d.clients].sort((x, y) => Number(a.opciones.includes(y.id)) - Number(a.opciones.includes(x.id)) || x.name.localeCompare(y.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Celda>;
  const cuando = <Celda label="Cuándo" v={a.fecha}><DateIn label="Cuándo" value={a.fecha} onChange={t => t && set({ fecha: t }, 'fecha')} /></Celda>;
  const monto = (label: string) => <Celda label={label} v={a.monto} falta={f('monto')}><div className="vz-m"><Num label={label} prefix={a.moneda === 'USD' ? 'US$' : '$'} value={a.monto} onChange={n => set({ monto: n }, 'monto')} /><Seg value={a.moneda} label="Moneda" options={[['ARS', 'Pesos'], ['USD', 'Dólares']]} onChange={m => set({ moneda: m }, 'moneda')} /></div></Celda>;
  const texto = (label: string, campo: 'titulo' | 'detalle' | 'categoria' | 'cuenta' | 'telefono', ancho = false, lista?: string[]) => <Celda label={label} v="" ancho={ancho} falta={f('titulo') && campo === (a.tipo === 'mensaje' ? 'detalle' : 'titulo') || (f('telefono') && campo === 'telefono')}>{campo === 'detalle' ? <textarea className="textarea" rows={a.tipo === 'mensaje' ? 3 : 2} value={a[campo]} onChange={e => set({ [campo]: e.target.value }, campo)} /> : <><input className="input" list={lista ? `vz-${campo}` : undefined} value={a[campo]} onChange={e => set({ [campo]: e.target.value }, campo)} />{lista && <datalist id={`vz-${campo}`}>{lista.map(x => <option key={x} value={x} />)}</datalist>}</>}</Celda>;
  const hora = <Celda label="Hora" v={a.hora}><input className="input" type="time" value={a.hora} onChange={e => set({ hora: e.target.value }, 'hora')} /></Celda>;
  const fondo = (label: string, campo: 'fondo' | 'fondo2') => <Celda label={label} v={a[campo]} falta={campo === 'fondo2' && f('fondo2')}><select className="select" value={a[campo] || ''} onChange={e => set({ [campo]: e.target.value || null }, campo)}><option value="">Sin asignar</option>{d.funds.filter(x => !x.archived).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Celda>;
  const quien = (label: string) => <Celda label={label} v={a.persona}><Seg value={a.persona || d.yo} label={label} options={[['benja', 'Benjamín'], ['mati', 'Matías']]} onChange={p => set({ persona: p }, 'persona')} /></Celda>;
  const elegir = (label: string, l: { id: string; n: string }[]) => <Celda label={label} v={a.ref} falta={f('ref')} ancho><select className="select" value={a.ref} onChange={e => set({ ref: e.target.value }, 'ref')}><option value="">Elegir</option>{l.map(x => <option key={x.id} value={x.id}>{x.n}</option>)}</select></Celda>;
  const repite = <Celda label="Se repite" v={a.repite}><Seg value={a.repite} label="Se repite" options={[['no', 'No'], ['mes', 'Por mes'], ['anio', 'Por año']]} onChange={r => set({ repite: r }, 'repite')} /></Celda>;
  const deudas = a.tipo === 'plata' && a.clase === 'ingreso' && a.cliente_id ? cobrables(d, a.cliente_id) : [], due = dueDe(d, a.ref);
  const sp = a.tipo === 'plata' && a.clase === 'ingreso' ? splitIncome(a.monto, a.moneda, d.funds) : [];

  let cuerpo: React.ReactNode = null;
  switch (a.tipo) {
    case 'plata': cuerpo = <>
      {monto('Cuánto')}
      {a.clase !== 'traspaso' && <Celda label="Por qué" v="" ancho={false}><input className="input" value={due ? `${due.label}, ${due.agreement.title}` : a.titulo} disabled={!!due} onChange={e => set({ titulo: e.target.value }, 'titulo')} /></Celda>}
      {a.clase === 'ingreso' && cli}
      {deudas.length > 0 && <Celda label="Paga" v={a.ref}><select className="select" value={a.ref} onChange={e => set({ ref: e.target.value }, 'ref')}><option value="">Otra cosa</option>{deudas.map(x => <option key={x.key} value={'due:' + x.key}>{x.label}, {money(x.left, x.agreement.currency)}</option>)}</select></Celda>}
      {cuando}
      {(a.clase === 'gasto' || a.clase === 'inversion' || (a.clase === 'ingreso' && !due)) && <Celda label="Rubro" v={a.categoria}><select className="select" value={a.categoria} onChange={e => set({ categoria: e.target.value }, 'categoria')}>{[...new Set([a.categoria, ...CATEGORIES[a.clase]])].filter(Boolean).map(c => <option key={c}>{c}</option>)}</select></Celda>}
      {(a.clase === 'retiro' || a.clase === 'aporte') && quien(a.clase === 'retiro' ? 'Quién se lo llevó' : 'Quién puso')}
      {a.clase === 'traspaso' ? <>{fondo('Del sobre', 'fondo')}{fondo('Al sobre', 'fondo2')}</> : texto(a.clase === 'ingreso' || a.clase === 'aporte' ? 'Dónde entró' : 'De dónde salió', 'cuenta', false, [...new Set([...ACCOUNTS, 'Tarjeta'])])}
      {d.funds.length > 0 && (a.clase === 'gasto' || a.clase === 'inversion' || a.clase === 'retiro') && fondo('Sale del sobre', 'fondo')}
    </>; break;
    case 'vencimiento': cuerpo = <>{texto('Qué', 'titulo')}{monto('Cuánto')}{cuando}{repite}</>; break;
    case 'tarea': cuerpo = <>{texto('Qué', 'titulo', true)}{cuando}{hora}{quien('Quién')}{cli}<Celda label="La más importante" v={a.top}><Seg value={a.top ? 'si' : 'no'} label="La más importante" options={[['no', 'No'], ['si', 'Sí']]} onChange={v => set({ top: v === 'si' }, 'top')} /></Celda></>; break;
    case 'hecha': cuerpo = elegir('Cuál', d.items.filter(x => !x.done_at || x.id === itemDe(d, a.ref)?.id).map(x => ({ id: 'item:' + x.id, n: `${x.title}, ${when(new Date(x.date + 'T12:00').getTime(), d.now)}` }))); break;
    case 'entrega': { const x = faseDe(d, a.ref); cuerpo = <>{elegir('Qué fase', d.agreements.filter(g => g.status === 'firmado').flatMap(g => g.phases.filter(p => p.kind === 'fase' && (!p.done_at || p.id === x?.ph.id)).map(p => ({ id: `fase:${g.id}:${p.id}`, n: `${p.name}, ${clienteDe(d, g.client_id)?.name || g.title}` }))))}{cuando}</>; break; }
    case 'cliente': cuerpo = a.cliente_id ? <>{cli}{texto('WhatsApp', 'telefono')}{texto('Anotar', 'detalle', true)}</> : <>{texto('Nombre', 'titulo')}{texto('WhatsApp', 'telefono')}{texto('Anotar', 'detalle', true)}</>; break;
    case 'prospecto': cuerpo = <>{texto('Nombre', 'titulo')}{texto('Negocio', 'categoria')}{texto('WhatsApp', 'telefono')}{texto('Qué quiere', 'detalle', true)}</>; break;
    case 'nota': cuerpo = <>{texto('Nota', 'titulo', true)}{cli}{a.detalle && texto('Más', 'detalle', true)}</>; break;
    case 'evento': cuerpo = <>{texto('Qué', 'titulo', true)}{cuando}{hora}</>; break;
    case 'mensaje': cuerpo = <>{cli}{(!clienteDe(d, a.cliente_id)?.contact?.whatsapp || a.telefono) && texto('WhatsApp', 'telefono')}{texto('Mensaje', 'detalle', true)}</>; break;
    case 'acuerdo': cuerpo = <>{cli}{texto('Trabajo', 'titulo')}{monto('Total')}<Celda label="Por mes" v={a.abono}><Num label="Por mes" prefix={a.moneda === 'USD' ? 'US$' : '$'} value={a.abono} onChange={n => set({ abono: n }, 'abono')} /></Celda>
      {a.fases.length > 0 && <div className="vz-fases ancho">{a.fases.map((x, i) => <div key={i}><b>{x.nombre}</b><span>{x.fecha ? fDate(x.fecha) : ''}</span><em>{money(x.monto, a.moneda)}</em></div>)}</div>}<p className="help ancho">Queda en borrador para revisar y firmar.</p></>; break;
    case 'precio': cuerpo = <>{elegir('Servicio', d.services.map(x => ({ id: 'serv:' + x.id, n: x.name })))}{monto('Precio nuevo')}{repite}{servDe(d, a.ref) && <p className="help ancho">Hoy: {servDe(d, a.ref)!.prices.filter(p => p.amount > 0).map(p => money(p.amount, p.currency)).join(', ') || 'sin precio'}</p>}</>; break;
    default: break;
  }
  return <article className="vz-k">
    <header>{a.tipo === 'plata' ? <select className="vz-tipo" aria-label="Tipo" value={a.clase} onChange={e => set({ clase: e.target.value as MoveKind, categoria: '', fondo: null }, 'clase')}>{(Object.keys(MOVE) as MoveKind[]).map(k => <option key={k} value={k}>{MOVE[k].label}</option>)}</select> : <h3>{TIPOS[a.tipo]}</h3>}
      <button className="btn btn-ghost btn-icon" onClick={quitar} aria-label="Quitar"><Trash2 size={16} /></button></header>
    <div className="vz-g">{cuerpo}</div>
    {a.cliente_nuevo && !a.cliente_id && a.tipo !== 'acuerdo' && a.tipo !== 'mensaje' && <label className="vz-chk"><input type="checkbox" checked={a.agregar} onChange={e => set({ agregar: e.target.checked }, 'agregar')} /> Agregar a {a.cliente_nuevo} a clientes</label>}
    {sp.length > 0 && <p className="help">Se reparte: {fundSplitText(sp, d.funds, a.moneda)}.</p>}
    {alertas.map(x => <p className="vz-av" key={x}>{x}</p>)}
  </article>;
}
