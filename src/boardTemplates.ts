import { uuid, type BoardNode, type BoardEdge, type BoardShape } from './utils';

// Plantillas "inteligentes" para la pizarra: estructuras ya armadas y conectadas, listas
// para insertar en cualquier tablero (Estrategia o Ideas). Cada plantilla define sus nodos
// en coordenadas RELATIVAS (arrancan cerca de 0,0) — placeTemplate() las reubica debajo de
// lo que ya haya en la pizarra y les asigna ids reales, así nunca pisan contenido existente.

interface TplNode { key: string; x: number; y: number; w: number; h: number; text: string; color: string; shape: BoardShape; fontSize?: number }
interface TplEdge { from: string; to: string }
export interface BoardTemplate {
  key: string; label: string; description: string; emoji: string;
  build: () => { nodes: TplNode[]; edges: TplEdge[] };
}

const CHAIN = (keys: string[]): TplEdge[] => keys.slice(1).map((k, i) => ({ from: keys[i], to: k }));

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    key: 'aida', emoji: '🎯', label: 'Embudo de ventas (AIDA)',
    description: 'Atracción → Interés → Decisión → Acción, el clásico.',
    build: () => ({
      nodes: [
        { key: 'a', x: 0, y: 0, w: 200, h: 120, text: 'Atracción\n\nContenido, ads, SEO — que te encuentren', color: '#60a5fa', shape: 'box' },
        { key: 'i', x: 230, y: 0, w: 200, h: 120, text: 'Interés\n\nContenido de valor, casos reales', color: '#a78bfa', shape: 'box' },
        { key: 'd', x: 460, y: 0, w: 200, h: 120, text: 'Decisión\n\nPropuesta a medida, objeciones', color: '#fb923c', shape: 'box' },
        { key: 'c', x: 690, y: 0, w: 200, h: 120, text: 'Acción\n\nCierre, onboarding, primer pago', color: '#4ade80', shape: 'box' },
      ],
      edges: CHAIN(['a', 'i', 'd', 'c']),
    }),
  },
  {
    key: 'myb_circle', emoji: '🧲', label: 'Embudo círculo de ventas MYB',
    description: 'Atracción → Contacto → Reunión → Propuesta → Cierre & Seguimiento.',
    build: () => ({
      nodes: [
        { key: 'a', x: 0, y: 0, w: 190, h: 120, text: 'Atracción\n\nMaps/OSM, contenido, referidos', color: '#60a5fa', shape: 'box' },
        { key: 'c', x: 215, y: 0, w: 190, h: 120, text: 'Contacto\n\nPrimer mensaje, corto y personal', color: '#a78bfa', shape: 'box' },
        { key: 'r', x: 430, y: 0, w: 190, h: 120, text: 'Reunión\n\nDiscovery, calificación MINT', color: '#f472b6', shape: 'box' },
        { key: 'p', x: 645, y: 0, w: 190, h: 120, text: 'Propuesta\n\nA medida, con lo que dijo', color: '#fb923c', shape: 'box' },
        { key: 's', x: 860, y: 0, w: 190, h: 120, text: 'Cierre & Seguimiento\n\nNo dejar que se enfríe', color: '#4ade80', shape: 'box' },
      ],
      edges: CHAIN(['a', 'c', 'r', 'p', 's']),
    }),
  },
  {
    key: 'yt_script', emoji: '🎬', label: 'Guion para video de YouTube',
    description: 'Gancho → Problema → Solución → Demo → Cierre/CTA. Para explicar una idea en cámara.',
    build: () => ({
      nodes: [
        { key: 'h', x: 0, y: 0, w: 280, h: 140, text: 'Gancho (0-5 seg)\n\n¿Por qué debería seguir viendo esto?', color: '#facc15', shape: 'sticky' },
        { key: 'p', x: 0, y: 170, w: 280, h: 140, text: 'Problema\n\n¿Qué le duele a mi audiencia con esto?', color: '#fb923c', shape: 'sticky' },
        { key: 's', x: 0, y: 340, w: 280, h: 140, text: 'Solución\n\nCómo lo resuelvo — mi ángulo/opinión', color: '#f472b6', shape: 'sticky' },
        { key: 'd', x: 0, y: 510, w: 280, h: 140, text: 'Demo / Ejemplo\n\nMostrar, no solo contar', color: '#a78bfa', shape: 'sticky' },
        { key: 'c', x: 0, y: 680, w: 280, h: 140, text: 'Cierre + CTA\n\n¿Qué quiero que hagan después?', color: '#60a5fa', shape: 'sticky' },
      ],
      edges: CHAIN(['h', 'p', 's', 'd', 'c']),
    }),
  },
  {
    key: 'weekly_content', emoji: '🗓️', label: 'Calendario de contenido semanal',
    description: 'Una nota por día para planificar qué publicás.',
    build: () => {
      const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      const colors = ['#facc15', '#fb923c', '#f472b6', '#a78bfa', '#60a5fa', '#4ade80', '#f8fafc'];
      return {
        nodes: days.map((d, i) => ({ key: `d${i}`, x: i * 190, y: 0, w: 170, h: 150, text: `${d}\n\n—`, color: colors[i], shape: 'sticky' as BoardShape })),
        edges: [],
      };
    },
  },
  {
    key: 'launch_plan', emoji: '🚀', label: 'Plan de lanzamiento',
    description: 'Pre-lanzamiento → Lanzamiento → Post-lanzamiento, con sub-tareas.',
    build: () => ({
      nodes: [
        { key: 'p1', x: 0, y: 0, w: 280, h: 70, text: 'Pre-lanzamiento', color: '#a78bfa', shape: 'box', fontSize: 19 },
        { key: 'p1a', x: 0, y: 110, w: 130, h: 100, text: 'Teaser en redes', color: '#facc15', shape: 'sticky' },
        { key: 'p1b', x: 150, y: 110, w: 130, h: 100, text: 'Lista de espera / early access', color: '#facc15', shape: 'sticky' },
        { key: 'p2', x: 320, y: 0, w: 280, h: 70, text: 'Lanzamiento', color: '#a78bfa', shape: 'box', fontSize: 19 },
        { key: 'p2a', x: 320, y: 110, w: 130, h: 100, text: 'Publicación oficial', color: '#fb923c', shape: 'sticky' },
        { key: 'p2b', x: 470, y: 110, w: 130, h: 100, text: 'Contenido del día D', color: '#fb923c', shape: 'sticky' },
        { key: 'p3', x: 640, y: 0, w: 280, h: 70, text: 'Post-lanzamiento', color: '#a78bfa', shape: 'box', fontSize: 19 },
        { key: 'p3a', x: 640, y: 110, w: 130, h: 100, text: 'Testimonios / casos de uso', color: '#4ade80', shape: 'sticky' },
        { key: 'p3b', x: 790, y: 110, w: 130, h: 100, text: 'Optimizar según feedback', color: '#4ade80', shape: 'sticky' },
      ],
      edges: CHAIN(['p1', 'p2', 'p3']),
    }),
  },
];

// Reubica una plantilla debajo de lo que ya haya en la pizarra (o cerca del origen si
// está vacía) y le asigna ids reales, resolviendo las conexiones por la key relativa.
export function placeTemplate(tpl: BoardTemplate, existing: BoardNode[]): { nodes: BoardNode[]; edges: BoardEdge[] } {
  const { nodes: bp, edges: ebp } = tpl.build();
  const offsetX = existing.length ? Math.min(...existing.map(n => n.x)) : 40;
  const offsetY = existing.length ? Math.max(...existing.map(n => n.y + n.h)) + 60 : 40;
  const idMap = new Map<string, string>();
  const nodes: BoardNode[] = bp.map(b => {
    const id = uuid();
    idMap.set(b.key, id);
    return { id, x: b.x + offsetX, y: b.y + offsetY, w: b.w, h: b.h, text: b.text, color: b.color, shape: b.shape, fontSize: b.fontSize ?? 15 };
  });
  const edges: BoardEdge[] = ebp.map(e => ({ id: uuid(), from: idMap.get(e.from)!, to: idMap.get(e.to)! }));
  return { nodes, edges };
}
