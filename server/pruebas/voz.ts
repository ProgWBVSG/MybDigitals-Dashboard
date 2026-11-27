// Pruebas de la voz: frases como se dicen. Correr: npm run test:voz
import { addDays, newPhase, ymd } from '../../src/negocio.ts';
import { corregir, entender, orden, separar, tieneSenal } from '../../src/voz/entender.ts';
import { deshacer, falta, guardar, nueva, avisos, type Datos } from '../../src/voz/accion.ts';
import { cantidades, fecha, plata } from '../../src/voz/numeros.ts';

let n = 0, bad = 0;
const eq = (a: unknown, b: unknown, m: string) => { n++; if (JSON.stringify(a) !== JSON.stringify(b)) { bad++; console.log('FALLA', m, '\n   dio', JSON.stringify(a), '\n   era', JSON.stringify(b)); } };
const now = new Date(2026, 10, 23, 10).getTime(); // lunes
const C = (id: string, name: string, whatsapp = '') => ({ id, name, contact: { whatsapp }, status: 'active' });
const ag = (id: string, client_id: string, title: string, o: object = {}) => ({ id, client_id, title, status: 'firmado', currency: 'ARS', start_at: addDays(now, -30), signed_at: addDays(now, -30), ended_at: null, phases: [], monthly: null, monthly_paid: [], client_data: {}, ...o });
const base = (): Datos => ({
  now, yo: 'benja', rate: 1500, cuenta: '', memoria: [], prospects: [], movements: [], items: [], bills: [],
  clients: [C('c1', 'Barbería Uno', '351 555 1234'), C('c2', 'Off Basic'), C('c3', 'Omi Okan'), C('c4', 'OG Barbershop'), C('c5', 'Juan Martínez'), C('c6', 'Juan Pereyra')] as any,
  agreements: [
    ag('a1', 'c1', 'Sistema de turnos', { client_data: { name: 'Ana Gómez' }, phases: [newPhase({ id: 's', kind: 'sena', name: 'Seña', amount: 150000 }), newPhase({ id: 'f1', name: 'Diseño', amount: 200000, due_at: addDays(now, 5) }), newPhase({ id: 'f2', name: 'Entrega final', amount: 150000, due_at: addDays(now, 20) })], monthly: { amount: 45000, day: 10, from: addDays(now, -20), cancel_days: 30, covers: '' } }),
    ag('a2', 'c2', 'Tarjeta de fidelización', { currency: 'USD', phases: [newPhase({ id: 'u', kind: 'sena', name: 'Seña', amount: 200 })] }),
  ] as any,
  funds: [{ id: 'fi', name: 'Reinvertir', kind: 'inversion', pct: 30, sort: 0 }, { id: 'fp', name: 'Desarrollar productos', kind: 'desarrollo', pct: 20, sort: 1 }, { id: 'fr', name: 'Reserva e impuestos', kind: 'reserva', pct: 20, sort: 2 }, { id: 'fb', name: 'Benjamín', kind: 'socio', pct: 15, sort: 3 }, { id: 'fm', name: 'Matías', kind: 'socio', pct: 15, sort: 4 }] as any,
  services: [{ id: 's1', name: 'Landing page', prices: [{ id: 'p', label: '', amount: 200, currency: 'USD', period: 'unico' }] }, { id: 's2', name: 'Web de presencia digital', prices: [] }, { id: 's3', name: 'Cartel de reseñas de Google', prices: [] }] as any,
});
const d = base();
d.bills = [{ id: 'b1', name: 'Hosting', amount: 20, currency: 'USD', due_at: addDays(now, 3), repeat: 'mes', fund_id: 'fp', active: true, notes: '' }] as any;
d.items = [{ id: 'i1', title: 'Llamar a Off Basic', date: ymd(now), owner: 'benja', done_at: null, top: false }, { id: 'i2', title: 'Escribir la propuesta del gimnasio', date: ymd(now), owner: 'benja', done_at: null, top: true }] as any;
d.movements = [{ id: 'm1', kind: 'gasto', amount: 3000, currency: 'ARS', date: addDays(now, -20), concept: 'Café con cliente', category: 'Otro', account: 'Efectivo', fund_id: 'fr', splits: [] }] as any;

// ─── Números ───
for (const [t, v] of [['14mil pesos', 14000], ['catorce mil', 14000], ['14 lucas', 14000], ['una luca y media', 1500], ['medio palo', 500000], ['un palo doscientos', 1200000], ['dos millones y medio de pesos', 2500000], ['treinta y cinco mil', 35000], ['1.500,50 pesos', 1500.5], ['una web', undefined], ['Barbería Uno', undefined], ['en 30 minutos', undefined], ['el 15 de diciembre', undefined]] as const) eq(plata(t)?.valor, v, t);
eq(plata('dos palos verdes'), { ...plata('dos palos verdes')!, valor: 2000000, moneda: 'USD' }, 'palos verdes');
eq(cantidades('50 % de seña').map(x => x.clase), ['pct'], 'porcentaje');
eq(ymd(fecha('el lunes que viene', now, 'antes')!.at), '2026-11-30', 'lunes que viene'); eq(ymd(fecha('el viernes', now, 'antes')!.at), '2026-11-20', 'viernes pasado'); eq(fecha('mañana a las 5 de la tarde', now, 'despues')!.hora, '17:00', 'hora');

// ─── Frases ───
const K = (t: string, ...claves: string[]) => entender(t, d).acciones.map(a => Object.fromEntries(claves.map(k => [k, k === 'fecha' ? ymd(a.fecha) : (a as any)[k]])));
const caso = (t: string, e: object | object[]) => { const l = Array.isArray(e) ? e : [e]; const r = entender(t, d).acciones.map((a, i) => Object.fromEntries(Object.keys(l[i] || { tipo: 1 }).map(k => [k, k === 'fecha' ? ymd(a.fecha) : (a as any)[k]]))); eq(r, l, t); };
void K;
caso('Entró 14mil pesos por el diseño del logo, de Juan Pérez', { tipo: 'plata', clase: 'ingreso', monto: 14000, moneda: 'ARS', cliente_nuevo: 'Juan Pérez', titulo: 'Diseño del logo' });
caso('Entraron 14 mil pesos de Omi Okan por la web', { tipo: 'plata', clase: 'ingreso', monto: 14000, cliente_id: 'c3', titulo: 'Web' });
caso('entraron catorce lucas de omi ocan por unas fotos a mercado pago ayer', { clase: 'ingreso', monto: 14000, cliente_id: 'c3', titulo: 'Fotos', cuenta: 'Mercado Pago', fecha: '2026-11-22' });
caso('Barbería Uno me pagó la seña', { clase: 'ingreso', monto: 150000, cliente_id: 'c1', ref: 'due:a1:sena:s' });
caso('me pagó Ana Gómez 45 mil del abono', { clase: 'ingreso', monto: 45000, cliente_id: 'c1', categoria: 'Abono mensual', ref: 'due:a1:mes:2026-11' });
caso('Off me transfirió 200 dólares', { clase: 'ingreso', monto: 200, moneda: 'USD', cliente_id: 'c2', ref: 'due:a2:sena:u' });
caso('cobré 300 verdes de og barber shop en efectivo', { clase: 'ingreso', monto: 300, moneda: 'USD', cliente_id: 'c4', cuenta: 'Dólares en efectivo' });
caso('Me pagó Juan 20 mil', { clase: 'ingreso', monto: 20000, cliente_id: null, opciones: ['c5', 'c6'] });
caso('gasté 5 lucas en nafta', { clase: 'gasto', monto: 5000, titulo: 'Nafta', categoria: 'Traslados' });
caso('Gasté cinco mil en nafta y 3 mil en comida', [{ clase: 'gasto', monto: 5000, titulo: 'Nafta' }, { clase: 'gasto', monto: 3000, titulo: 'Comida' }]);
caso('pagué el hosting', { clase: 'gasto', monto: 20, moneda: 'USD', ref: 'bill:b1', fondo: 'fp' });
caso('pagué 22 dólares de hosting', { clase: 'gasto', monto: 22, moneda: 'USD', ref: 'bill:b1' });
caso('pusimos 30 mil en publicidad de instagram', { clase: 'inversion', monto: 30000, categoria: 'Publicidad', fondo: 'fi' });
caso('compré un micrófono a 80 mil con la tarjeta', { clase: 'inversion', monto: 80000, categoria: 'Equipos', cuenta: 'Tarjeta', titulo: 'Micrófono' });
caso('me llevé 50 mil', { clase: 'retiro', monto: 50000, persona: 'benja', fondo: 'fb' });
caso('Matías se llevó 40 lucas', { clase: 'retiro', monto: 40000, persona: 'mati', fondo: 'fm' });
caso('puse 100 mil de mi bolsillo', { clase: 'aporte', monto: 100000, persona: 'benja' });
caso('pasé 20 mil del sobre reserva al sobre reinvertir', { clase: 'traspaso', monto: 20000, fondo: 'fr', fondo2: 'fi' });
caso('gasté 3500 en café con cliente', { clase: 'gasto', monto: 3500, titulo: 'Café con cliente', cuenta: 'Efectivo', fondo: 'fr' });
caso('hay que pagar 15 mil de monotributo el 20 de cada mes', { tipo: 'vencimiento', monto: 15000, titulo: 'Monotributo', repite: 'mes', fecha: '2026-12-20' });
caso('Mañana tengo que llamar a Pedro a las 10', { tipo: 'tarea', titulo: 'Llamar a Pedro', fecha: '2026-11-24', hora: '10:00', persona: 'benja' });
caso('el jueves Matías tiene que grabar el reel', { tipo: 'tarea', titulo: 'Grabar el reel', fecha: '2026-11-26', persona: 'mati' });
caso('recordame mandar el presupuesto a Off Basic, es urgente', { tipo: 'tarea', titulo: 'Mandar el presupuesto a Off Basic', top: true, cliente_id: 'c2' });
caso('ya llamé a Off Basic', { tipo: 'hecha', ref: 'item:i1' });
caso('terminé de escribir la propuesta del gimnasio', { tipo: 'hecha', ref: 'item:i2' });
caso('entregamos el diseño de Barbería Uno', { tipo: 'entrega', ref: 'fase:a1:f1', cliente_id: 'c1' });
caso('nuevo cliente Pizzería Don Luis, whatsapp 351 444 5566', { tipo: 'cliente', titulo: 'Pizzería Don Luis', telefono: '351 444 5566' });
caso('el whatsapp de Omi Okan es 351 777 8899', { tipo: 'cliente', cliente_id: 'c3', telefono: '351 777 8899' });
caso('me escribió Lucía de una veterinaria, quiere una web', { tipo: 'prospecto', titulo: 'Lucía', categoria: 'Veterinaria' });
caso('anotá que a Barbería Uno le gusta el verde', { tipo: 'nota', titulo: 'A Barbería Uno le gusta el verde', cliente_id: 'c1' });
caso('tengo una reunión con Omi Okan el viernes a las 5 de la tarde', { tipo: 'evento', cliente_id: 'c3', fecha: '2026-11-27', hora: '17:00', titulo: 'Reunión con Omi Okan' });
caso('mandale un mensaje a Barbería Uno que mañana le entrego el diseño', { tipo: 'mensaje', cliente_id: 'c1', detalle: 'Mañana le entrego el diseño' });
caso('cerré con Omi Okan una landing page en 400 dólares con 50 % de seña y 30 dólares por mes', { tipo: 'acuerdo', cliente_id: 'c3', monto: 400, moneda: 'USD', abono: 30, ref: 'serv:s1' });
caso('la landing page ahora sale 250 dólares', { tipo: 'precio', ref: 'serv:s1', monto: 250, moneda: 'USD' });
caso('¿Cuánto tenemos?', { tipo: 'consulta' }); caso('quién nos debe plata', { tipo: 'consulta' }); caso('abrí plata', { tipo: 'ir' }); caso('deshacé lo último', { tipo: 'deshacer' });
caso('Entraron 14 mil de Omi Okan por la web, gasté 5 lucas en nafta y mañana tengo que llamar a Off Basic', [{ clase: 'ingreso', monto: 14000, cliente_id: 'c3', titulo: 'Web' }, { clase: 'gasto', monto: 5000, titulo: 'Nafta' }, { tipo: 'tarea', titulo: 'Llamar a Off Basic', fecha: '2026-11-24' }]);
caso('ayer gasté 2 mil en el colectivo y hoy pagué 12 mil de canva', [{ clase: 'gasto', monto: 2000, fecha: '2026-11-22', categoria: 'Traslados' }, { clase: 'gasto', monto: 12000, fecha: '2026-11-23', categoria: 'Herramientas' }]);
caso('gasté 5 lucas en nafta y mañana a las 10 tengo que llamar a Norte', [{ monto: 5000 }, { tipo: 'tarea', titulo: 'Llamar a Norte', hora: '10:00' }]);
eq(separar('compré pan y queso por 3 mil').length, 1, 'no corta de más');

// ─── Charla ───
let l = entender('Entraron 14 mil de Omi Okan por la web', d).acciones;
const cor = (t: string) => { const r = corregir(t, l, d, falta(l[l.length - 1], d), l.length - 1); if (r) l = r; return !!r; };
eq([cor('no, eran 15 mil'), l[0].monto], [true, 15000], 'corrige monto'); eq([cor('eran 18'), l[0].monto], [true, 18000], 'eran 18'); eq([cor('fue ayer'), ymd(l[0].fecha)], [true, '2026-11-22'], 'corrige fecha');
eq([cor('ponelo en el banco'), l[0].cuenta], [true, 'Banco'], 'cuenta'); eq([cor('en realidad es de Off Basic'), l[0].cliente_id], [true, 'c2'], 'cliente'); eq([cor('en dólares no, perdón'), 0][1], 0, 'no rompe');
eq(corregir('gasté 5 lucas en nafta', l, d, null), null, 'pedido nuevo no es corrección');
l = entender('Me pagó Juan 20 mil', d).acciones; eq(falta(l[0], d)?.campo, 'cliente', 'pregunta cuál Juan'); eq([cor('Martínez'), l[0].cliente_id, falta(l[0], d)], [true, 'c5', null], 'responde cuál');
l = entender('gasté en nafta', d).acciones; eq(falta(l[0], d)?.campo, 'monto', 'pregunta cuánto'); eq([cor('ocho lucas'), l[0].monto], [true, 8000], 'responde cuánto');
l = entender('gasté 5 lucas en nafta, 3 mil en comida', d).acciones; eq(l.length, 2, 'dos'); eq([cor('borrá la primera'), l.length, l[0].titulo], [true, 1, 'Comida'], 'borra la primera');
l = entender('Entraron 14 mil de Omi Okan por un cartel, gasté 5 lucas en nafta', d).acciones; eq([cor('no, eran 15 mil'), l.map(a => a.monto)], [true, [15000, 5000]], 'corrige la parecida'); eq([cor('la nafta eran 6 mil'), l.map(a => a.monto)], [true, [15000, 6000]], 'corrige la nombrada');
for (const t of ['sí', 'dale, guardalo', 'listo', 'Perfecto.', 'guardá todo', 'sí, dale']) eq(orden(t), 'guardar', t);
for (const t of ['cancelá', 'no, nada', 'mejor no']) eq(orden(t), 'cancelar', t);
eq(orden('sí, entraron 14 mil'), null, 'sí con algo más');

for (const t of ['por eso un anillo se pierde una tarjeta de papel también la fecha', 'hola qué tal todo bien', 'sí mirá qué lindo que quedó']) eq(tieneSenal(t, d), false, t);
for (const t of ['los de Off Basic me tiraron algo por lo del menú', 'me tiraron treinta lucas', 'cuánto tenemos', 'tengo que comprar papel', 'mañana llamo a Omi Okan']) eq(tieneSenal(t, d), true, t);

// ─── Guardar y volver atrás ───
const aplica = (D: any, ops: any[]) => { for (const o of ops) { const t = D[o.table] ??= []; if (o.op === 'insert') t.push(o.body); else if (o.op === 'update') { const r = t.find((x: any) => x.id === o.filters[0][2]); Object.assign(r, o.body); } else D[o.table] = t.filter((x: any) => x.id !== o.filters[0][2]); } };
const D: any = { clients: structuredClone(d.clients), agreements: structuredClone(d.agreements), movements: [], bills: structuredClone(d.bills), plan_items: structuredClone(d.items), services: structuredClone(d.services) };
const vivo = (): Datos => ({ ...d, clients: D.clients, agreements: D.agreements, movements: D.movements, bills: D.bills, items: D.plan_items, services: D.services });
const antes = JSON.stringify([D.agreements.map((a: any) => [a.phases, a.monthly_paid]), D.bills.map((x: any) => [x.due_at, x.amount, x.active]), D.services.map((x: any) => x.prices), D.clients.length]);
const g = guardar(entender('Barbería Uno me pagó la seña. Barbería Uno me pagó 45 mil del abono. Pagué el hosting. La landing page ahora sale 250 dólares', vivo()).acciones, vivo());
aplica(D, g.ops);
eq(D.agreements[0].phases[0].payments.length, 1, 'seña marcada'); eq(D.agreements[0].monthly_paid.length, 1, 'abono marcado'); eq(D.movements.length, 3, 'tres movimientos'); eq(D.movements[0].splits.reduce((s: number, x: any) => s + x.amount, 0), 150000, 'repartido');
eq(ymd(D.bills[0].due_at), '2026-12-26', 'próximo hosting'); eq(D.services[0].prices[0].amount, 250, 'precio');
const v = deshacer(g.vuelta, (t, id) => D[t]?.find((x: any) => x.id === id)); aplica(D, v.ops);
eq(JSON.stringify([D.agreements.map((a: any) => [a.phases, a.monthly_paid]), D.bills.map((x: any) => [x.due_at, x.amount, x.active]), D.services.map((x: any) => x.prices), D.clients.length]), antes, 'todo como antes'); eq(D.movements.length, 0, 'sin movimientos');
const gc = guardar([nueva('cliente', vivo(), { titulo: 'Don Luis' }), nueva('plata', vivo(), { clase: 'ingreso', monto: 10, moneda: 'USD', cliente_nuevo: 'don luis' })], vivo());
eq([gc.ops.length, (gc.ops[1].body as any).client_id === (gc.ops[0].body as any).id], [2, true], 'el cliente nuevo sirve para lo que sigue');
const ac = guardar(entender('cerré con Omi Okan una landing page en 400 dólares con 50 % de seña y 30 dólares por mes', vivo()).acciones, vivo()).ops[0].body as any;
eq([ac.phases.map((p: any) => [p.kind, p.amount]), ac.monthly.amount, ac.status, ac.number], [[['sena', 200], ['fase', 200]], 30, 'borrador', 'MYB-2026-001'], 'acuerdo');
eq(avisos(nueva('plata', d, { clase: 'gasto', monto: 45, moneda: 'ARS' }), d).length, 1, 'avisa 45 pesos');
eq(avisos(nueva('plata', d, { clase: 'gasto', monto: 3000, fecha: addDays(now, -20) }), d).some(x => /igual/.test(x)), true, 'avisa repetido');
console.log(`${n - bad}/${n} bien`); if (bad) process.exit(1);
