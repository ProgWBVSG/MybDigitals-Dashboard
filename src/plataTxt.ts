import type { Cur, Fund } from './negocio';
import { money } from './services';

export const ACCOUNTS = ['Mercado Pago', 'Banco', 'Efectivo', 'Dólares en efectivo'];
/** Punto de partida propuesto para los sobres. Se cambia desde la pantalla. */
export const FUND_START = [
  { name: 'Reinvertir', kind: 'inversion', pct: 30, why: 'Publicidad, equipos y lo que nos haga crecer' },
  { name: 'Desarrollar productos', kind: 'desarrollo', pct: 20, why: 'Servidores, herramientas y versiones nuevas' },
  { name: 'Reserva e impuestos', kind: 'reserva', pct: 20, why: 'Para no quedarnos sin aire un mes flojo' },
  { name: 'Benjamín', kind: 'socio', pct: 15, why: 'Lo que se lleva' },
  { name: 'Matías', kind: 'socio', pct: 15, why: 'Lo que se lleva' },
];
export const fundSplitText = (s: { fund_id: string; amount: number }[], funds: Fund[], c: Cur) => s.map(x => `${funds.find(f => f.id === x.fund_id)?.name || 'Sobre'} ${money(x.amount, c)}`).join(', ');
