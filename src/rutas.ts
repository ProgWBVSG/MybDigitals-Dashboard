// Direcciones: #seccion/lo-que-sea. Recargar o volver atrás no te saca de donde estabas.
import { useSyncExternalStore } from 'react';

const read = () => window.location.hash.replace(/^#\/?/, '');
const listen = (f: () => void) => { window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); };
export const useHash = () => useSyncExternalStore(listen, read);
export function goTo(path: string) { if (read() !== path) window.location.hash = path; window.scrollTo(0, 0); }
/** Lo que sigue a la sección, y cómo cambiarlo. */
export function useSub(): [string, (sub: string) => void] {
  const [tab, ...rest] = useHash().split('/');
  return [rest.join('/'), sub => goTo(sub ? `${tab}/${sub}` : tab)];
}
