import { uuid, type DocBlock } from './utils';

// Plantillas de Documentos Estratégicos: arrancan con la estructura de bloques ya armada
// (con texto guía para completar), no con el documento vacío.

const B = (b: Omit<DocBlock, 'id'>): DocBlock => ({ id: uuid(), ...b });

export interface DocTemplate { key: string; label: string; description: string; emoji: string; docType: string; build: () => DocBlock[] }

export const DOC_TEMPLATES: DocTemplate[] = [
  {
    key: 'fuente_externa', emoji: '🎓', label: 'Estrategia de una fuente externa',
    description: 'Para anotar lo que dice un referente (ej. un video de Kallaway) y cómo aplicarlo.',
    docType: 'fuente',
    build: () => [
      B({ type: 'heading', level: 2, text: 'Título de la estrategia' }),
      B({ type: 'quote', text: 'Pegá acá la idea o cita textual que te llamó la atención.', author: 'Nombre del referente (ej. Kallaway)', sourceUrl: '' }),
      B({ type: 'heading', level: 3, text: 'Resumen de la estrategia' }),
      B({ type: 'bullets', items: ['Punto clave 1', 'Punto clave 2', 'Punto clave 3'] }),
      B({ type: 'heading', level: 3, text: 'Cómo lo aplicamos en MYB' }),
      B({ type: 'paragraph', text: 'Escribí acá cómo adaptarías esto a nuestros clientes o a nuestro propio contenido.' }),
      B({ type: 'callout', color: '#a78bfa', text: 'Próximo paso concreto: …' }),
      B({ type: 'divider' }),
      B({ type: 'connection', connType: 'tab', connTab: 'content', connLabel: 'Ir a IG Content' }),
    ],
  },
  {
    key: 'estrategia_general', emoji: '🧭', label: 'Documento de estrategia general',
    description: 'Objetivo, contexto, plan de acción y métricas de éxito.',
    docType: 'estrategia',
    build: () => [
      B({ type: 'heading', level: 2, text: 'Nombre de la estrategia' }),
      B({ type: 'paragraph', text: 'Objetivo: ¿qué querés lograr con esto?' }),
      B({ type: 'heading', level: 3, text: 'Contexto' }),
      B({ type: 'paragraph', text: 'Situación actual, por qué hace falta esta estrategia.' }),
      B({ type: 'heading', level: 3, text: 'Plan de acción' }),
      B({ type: 'bullets', items: ['Paso 1', 'Paso 2', 'Paso 3'] }),
      B({ type: 'heading', level: 3, text: 'Cómo medimos que funcionó' }),
      B({ type: 'paragraph', text: 'Métrica objetivo, plazo.' }),
    ],
  },
  {
    key: 'analisis_contenido', emoji: '📱', label: 'Análisis de contenido / red social',
    description: 'Qué funciona, ejemplos, y próximos pasos para el contenido.',
    docType: 'contenido',
    build: () => [
      B({ type: 'heading', level: 2, text: 'Plataforma / formato' }),
      B({ type: 'paragraph', text: 'Qué estás analizando (ej. Reels de la competencia, un video viral, etc.)' }),
      B({ type: 'heading', level: 3, text: 'Qué funciona' }),
      B({ type: 'bullets', items: ['Observación 1', 'Observación 2'] }),
      B({ type: 'heading', level: 3, text: 'Próximos pasos' }),
      B({ type: 'bullets', items: ['Acción 1', 'Acción 2'] }),
      B({ type: 'connection', connType: 'tab', connTab: 'content', connLabel: 'Ir a IG Content' }),
    ],
  },
  {
    key: 'blank', emoji: '📄', label: 'Documento en blanco',
    description: 'Arrancar de cero.',
    docType: 'general',
    build: () => [B({ type: 'heading', level: 2, text: 'Título' }), B({ type: 'paragraph', text: '' })],
  },
];
