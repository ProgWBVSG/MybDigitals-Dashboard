// Pruebas de las reglas. Correr: npm run test:reglas
import { addDays, addMonths, cash, daysTo, duesOf, inArs, monday, newPhase, pace, scoreOf, splitIncome, viewClient, viewFunds, waNumber, worksOf, ymd } from '../../src/negocio.ts';
import { buildQueue } from '../../src/cola.ts';
import { adivinarVia, armarGrafo, nivelDeEtapa, ubicar } from '../../src/redReglas.ts';
let n = 0, bad = 0; const eq = (a: unknown, b: unknown, m: string) => { n++; if (JSON.stringify(a) !== JSON.stringify(b)) { bad++; console.log('FALLA', m, JSON.stringify(a), '≠', JSON.stringify(b)); } };
const now = new Date(2026, 10, 23, 10).getTime(); const d = (k: number) => addDays(now, k);
eq(waNumber('351 555-1234'), '5493515551234', 'wa 10'); eq(waNumber('0351 15 555 1234'), '5493515551234', 'wa 0/15'); eq(waNumber('+54 9 351 555 1234'), '5493515551234', 'wa +549'); eq(waNumber('54 351 5551234'), '5493515551234', 'wa 54'); eq(waNumber('351 15 5551234'), '5493515551234', 'wa 15'); eq(waNumber('+34 612 345 678'), '34612345678', 'wa España'); eq(waNumber('123'), '', 'wa corto'); eq(waNumber('3543 15 412345'), '5493543412345', 'wa pueblo'); eq(waNumber(''), '', 'wa vacio');
eq(ymd(addMonths(new Date(2026, 0, 31, 12).getTime(), 1)), '2026-02-28', 'fin de mes'); eq(ymd(monday(new Date(2026, 10, 22).getTime())), '2026-11-16', 'lunes de un domingo'); eq(daysTo(new Date(2026, 10, 24, 0, 1).getTime(), new Date(2026, 10, 23, 23, 59).getTime()), 1, 'mañana');
const pay = (amount: number, at: number) => ({ id: 'p', at, amount, movement_id: 'm' });
const A: any = { id: 'a', client_id: 'c', status: 'firmado', currency: 'ARS', title: 'App', start_at: d(-20), signed_at: d(-20), ended_at: null, monthly: { amount: 45000, day: 10, from: d(-40), cancel_days: 30, covers: '' }, monthly_paid: [{ ...pay(45000, new Date(2026, 10, 9).getTime()), period: '2026-11' }], terms: {}, client_data: {}, created_at: d(-21),
  phases: [newPhase({ id: 's', kind: 'sena', name: 'Seña', amount: 100, pay_days: 2, payments: [pay(100, d(-19))] }), newPhase({ id: 'f1', name: 'Diseño', amount: 200, due_at: d(-10), done_at: d(-11), pay_days: 3, payments: [pay(50, d(-9))] }), newPhase({ id: 'f2', name: 'Desarrollo', amount: 300, due_at: d(-2) }), newPhase({ id: 'f3', name: 'Entrega', amount: 400, due_at: d(8) })] };
const du = Object.fromEntries(duesOf(A, now).map(x => [x.ref, x]));
eq([du.s.state, du.f1.state, du.f1.left, du.f1.late, du.f2.state, du.f3.state], ['pagado', 'vencido', 150, 8, 'futuro', 'futuro'], 'cobros');
eq([du['2026-11'].state, du['2026-12']?.state, du['2026-10']?.state], ['pagado', 'futuro', undefined], 'abonos');
eq(worksOf(A, now).map(w => [w.state, w.late]), [['a_tiempo', 0], ['atrasada', 2], ['en_curso', 0]], 'fases');
eq(scoreOf([A], now), { us: { ok: 1, late: 1, pending: 0 }, them: { ok: 2, late: 1, pending: 0 } }, 'cumplimiento');
eq(duesOf({ ...A, status: 'borrador' }, now).length, 0, 'borrador no cobra');
const C: any = { id: 'c', name: 'Local Uno', contact: { whatsapp: '3515551234' } };
const v = viewClient(C, [A], [], 1000, now); eq([v.health, v.paid, v.total, v.done, v.phases], ['debemos', 150, 1000, 1, 3], 'cliente');
const funds: any = [{ id: 'x', pct: 33, sort: 0 }, { id: 'y', pct: 33, sort: 1 }, { id: 'z', pct: 34, sort: 2 }];
eq(splitIncome(100001, 'ARS', funds).reduce((s, p) => s + p.amount, 0), 100001, 'reparto exacto'); eq(splitIncome(10.01, 'USD', funds).reduce((s, p) => s + Math.round(p.amount * 100), 0), 1001, 'reparto usd'); eq(splitIncome(1000, 'ARS', [funds[0]]).map(p => p.amount), [330], 'reparto parcial'); eq(splitIncome(1000, 'ARS', [{ id: 'q', pct: 80 }, { id: 'w', pct: 80 }] as any).reduce((s, p) => s + p.amount, 0), 1000, 'más de 100');
const M = (o: object): any => ({ currency: 'ARS', splits: [], fund_id: null, to_fund_id: null, ...o });
const mv = [M({ kind: 'ingreso', amount: 1000, splits: [{ fund_id: 'x', amount: 300 }, { fund_id: 'y', amount: 200 }] }), M({ kind: 'gasto', amount: 100, fund_id: 'x' }), M({ kind: 'inversion', amount: 50, fund_id: 'y' }), M({ kind: 'aporte', amount: 500, fund_id: 'z' }), M({ kind: 'traspaso', amount: 40, fund_id: 'x', to_fund_id: 'y' }), M({ kind: 'retiro', amount: 10, currency: 'USD', fund_id: 'x' })];
const fv = viewFunds(funds, mv); eq(fv.map(f => [f.fund?.id ?? '-', f.left.ARS]), [['x', 160], ['y', 190], ['z', 500], ['-', 500]], 'sobres');
eq(fv.reduce((s, f) => s + inArs(f.left, 1000), 0), inArs(cash(mv), 1000), 'sobres = caja');
eq(pace({ start: 0, target: 100, start_at: d(-50), due_at: d(50) } as any, 20, now), { pct: .2, expected: .5, behind: true, perWeek: 80 / (50 / 7), weeks: 50 / 7 }, 'ritmo');
const Q = (o: object = {}) => buildQueue({ clients: [C], agreements: [A], services: [], touches: [], prospects: [], rules: [], now, ...o });
eq(Q().map(q => q.rule), ['vencido'], 'cola'); eq(Q()[0].text.includes('$150') && Q()[0].phone === '5493515551234', true, 'texto');
eq(Q({ touches: [{ key: Q()[0].key, at: d(-1), client_id: 'c', result: 'enviado' }] }).length, 0, 'no repite al día siguiente'); eq(Q({ touches: [{ key: Q()[0].key, at: d(-3), client_id: 'c', result: 'enviado' }] }).length, 1, 'repite a los tres días');
eq(Q({ agreements: [{ ...A, status: 'cancelado' }] }).length, 0, 'cancelado'); eq(Q({ agreements: [{ ...A, status: 'borrador' }] }).map(q => q.rule), ['sin_firmar'], 'sin firmar');
eq(Q({ agreements: [], prospects: [{ id: 'p', name: 'Ana Paz', business: 'Bar', stage: 'contacto', contact: { whatsapp: '3515550000' }, updated_at: d(-5) }] }).map(q => [q.rule, q.text.startsWith('Hola Ana,')]), [['prospecto', true]], 'prospecto');
// Red de contactos
{ const pr: any[] = [{ id: 'a', name: 'Ana', business: 'Bar', source: 'Instagram', stage: 'contacto', updated_at: d(-9) }, { id: 'b', name: 'Beto', business: '', source: '', stage: 'reunion', red: { via: 'referido', por: 'c:c', empresa: 'e1' } }, { id: 'x', name: 'Ex', business: '', source: '', stage: 'ganado', client_id: 'c' }, { id: 'l1', name: 'L1', business: '', source: '', stage: 'perdido', red: { via: 'referido', por: 'p:l2' } }, { id: 'l2', name: 'L2', business: '', source: '', stage: 'perdido', red: { via: 'referido', por: 'p:l1' } }];
  const g = armarGrafo(pr, [C], new Map([['c', v]]), [{ id: 'e1', name: 'Bar Uno' }, { id: 'e2', name: 'Sola' }] as any, now);
  eq(g.nodos.map(n => n.id), ['yo', 'c:c', 'p:a', 'p:b', 'p:l1', 'p:l2', 'e:e1', 'e:e2'], 'red: prospecto convertido va como cliente');
  eq([g.byId.get('c:c')!.nivel, g.byId.get('p:a')!.nivel, g.byId.get('p:a')!.via, !!g.byId.get('p:a')!.hot, g.byId.get('p:b')!.por], ['activo', 'hablado', 'instagram', true, 'c:c'], 'red: niveles, origen y seguimiento');
  eq(g.lineas.filter(l => l.b === 'p:b').map(l => l.kind + l.a), ['refc:c', 'empe:e1'], 'red: recomendado cuelga de quien lo trajo');
  eq([g.byId.get('p:l1')!.por === '' || g.byId.get('p:l2')!.por === '', g.lineas.some(l => l.a === 'yo' && l.b === 'e:e2')], [true, true], 'red: ciclo cortado y empresa sola al centro');
  const pos = ubicar(g); eq([pos.get('yo'), [...pos.values()].every(p => Number.isFinite(p.x) && Number.isFinite(p.y)), Math.hypot(pos.get('c:c')!.x, pos.get('c:c')!.y) < Math.hypot(pos.get('p:l1')!.x, pos.get('p:l1')!.y)], [{ x: 0, y: 0 }, true, true], 'red: ubicación');
  eq([adivinarVia('me lo recomendó Juan'), adivinarVia('IG'), adivinarVia(''), nivelDeEtapa('propuesta')], ['referido', 'instagram', '', 'seguimiento'], 'red: textos'); }
console.log(`${n - bad}/${n} bien`); process.exit(bad ? 1 : 0);
