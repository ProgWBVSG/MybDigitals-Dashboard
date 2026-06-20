// Edge Function: genera un BRIEF ESTRATÉGICO DE MARCA en prosa, a partir de los
// datos crudos de la reunión con el cliente, usando Gemini (free tier de Google).
//
// Secrets:
//   GEMINI_API_KEY   -> API key gratis de Google AI Studio
//   GEMINI_MODEL     -> opcional, default 'gemini-2.5-flash'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';

// Estructura + voz de MYB, destilada de los briefs reales del cliente.
const SYSTEM_PROMPT = `Sos estratega de marca senior de la agencia MYB Digitals (Córdoba, Argentina).
Tu tarea: a partir de los datos crudos de una reunión con un cliente, redactar un BRIEF ESTRATÉGICO DE MARCA completo, profesional y EN PROSA (no en bullets sueltos sin desarrollar), siguiendo EXACTAMENTE la estructura de abajo. Este brief lo va a leer una IA (Claude Code) para construir la web del cliente, así que debe ser claro, factual y accionable.

REGLAS DE REDACCIÓN (voz MYB):
- Tono experto, claro, estratégico y cercano. Hablás como socio estratégico, no como proveedor técnico.
- PROHIBIDO: clichés de marketing y autoayuda ("desata tu potencial", "lleva tu negocio al siguiente nivel", "en el mundo digital de hoy"), promesas mágicas, lenguaje técnico innecesario, frases vacías.
- Usá datos REALES provistos por el cliente. Si falta un dato, dejá un placeholder claro entre corchetes (ej: [confirmar cifra]) en vez de inventar.
- Frases concretas, con jerarquía. Cada afirmación de autoridad apoyada en una prueba real.
- Español rioplatense (vos), profesional.

ESTRUCTURA OBLIGATORIA (en Markdown, respetando los títulos):
# BRIEF ESTRATÉGICO DE MARCA
## Arquitectura de Inteligencia de Marca
### [Nombre del cliente] — [bajada]
(línea con Preparado por: MYB Digitals · Fecha · Entregable)

> Instrucciones de uso (1 párrafo: para qué sirve este brief).

## ⚡ Resumen para la IA (leer primero)
(bloque denso y factual: marca, qué hace en 1 frase, para quién, objetivo de la web, USP, tono, paleta, qué evitar, pruebas de autoridad)

## 1. Información General
## 2. Brand Heart — El Corazón de la Marca (Propósito, Visión, Misión, Valores, líneas rojas)
## 3. Historia y Contexto
## 4. Servicios y Oferta
## 5. Público Objetivo (segmentos, dolores en primera persona, deseos, objeciones y su respuesta)
## 6. Análisis Competitivo (terreno, competidores, oportunidades, USP, razones para creer)
## 7. Identidad y Personalidad de Marca (si fuera persona, adjetivos, paleta con HEX, estética, emociones)
## 8. Tono y Estilo de Comunicación (cómo habla, lo que NO hace, frases que SÍ/NO usaría, palabras SÍ/NO)
## 9. Autoridad y Credenciales (prueba social de mayor a menor peso)
## 10. Objetivos Estratégicos y Métricas (objetivo de la web, de marketing, primeros 90 días SMART, KPIs)
## 11. Especificaciones de la Web (función, arquitectura de contenido por secciones, criterios de diseño, CTAs exactos)
## 12. Brief para Inteligencia Artificial (IA-Ready)
  ### 12.1 Rol de la IA
  ### 12.2 Framework COSTAR (presentalo como LISTA, NUNCA como tabla; una línea por cada ítem: **Contexto:** … **Objetivo:** … **Estilo:** … **Tono:** … **Audiencia:** … **Restricciones:** …)
  ### 12.3 Prompt base para Claude Code (un párrafo directivo, listo para copiar, que resuma todo para construir la web)
## 13. Próximos Pasos (checklist)

EXTENSIÓN Y COMPLETITUD (REGLA MÁS IMPORTANTE):
- Sé CONCISO. Cada sección: 1 a 3 párrafos cortos o una lista breve. Total objetivo: 1800-2500 palabras. NUNCA superes las 3000 palabras.
- Es OBLIGATORIO terminar el documento COMPLETO. Las dos últimas piezas son las MÁS importantes y NO se pueden omitir nunca:
  · Sección 12.3 "Prompt base para Claude Code" (un párrafo directivo listo para copiar).
  · Sección 13 "Próximos Pasos" (checklist).
- Si ves que te estás quedando largo, RECORTÁ las secciones del medio (3 a 11), pero JAMÁS omitas ni recortes la Sección 12 completa ni la 13. Mejor breve y completo que extenso y cortado.

Devolvé ÚNICAMENTE el Markdown del brief, sin texto adicional antes ni después.`;

async function generateBrief(discovery: Record<string, unknown>): Promise<string> {
  const datos = Object.entries(discovery)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const hoy = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  const prompt = `${SYSTEM_PROMPT}\n\nFecha de hoy (usala tal cual en el encabezado, no inventes otra): ${hoy}.\n\n=== DATOS DE LA REUNIÓN CON EL CLIENTE ===\n${datos}\n\n=== FIN DE LOS DATOS ===\nRedactá ahora el brief completo.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 32768,            // techo alto: garantiza que complete aunque se extienda
          thinkingConfig: { thinkingBudget: 2048 },
        },
      }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error('Gemini error: ' + JSON.stringify(data));
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
  if (!text) throw new Error('Gemini no devolvió texto: ' + JSON.stringify(data));
  return clean(text);
}

// Limpia rarezas de la IA: ráfagas de espacios y líneas en blanco de más.
function clean(md: string): string {
  return md
    .replace(/[ \t]{6,}/g, ' ')   // colapsa runs largos de espacios/tabs (glitch), respeta indentación normal
    .replace(/-{4,}/g, '---')     // colapsa separadores de tabla absurdamente largos
    .replace(/[ \t]+\n/g, '\n')   // saca espacios sobrantes al final de línea
    .replace(/\n{4,}/g, '\n\n\n') // máximo 2 líneas en blanco seguidas
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { discovery } = await req.json();
    if (!discovery || typeof discovery !== 'object') throw new Error('Faltan los datos de discovery');
    const brief = await generateBrief(discovery);
    return new Response(JSON.stringify({ ok: true, brief }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
