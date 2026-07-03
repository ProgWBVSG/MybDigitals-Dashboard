// Edge Function: agente de investigación + generación de ideas de contenido (Gemini).
// Cruza patrones de contenido viral, anuncios efectivos y tendencias tech para proponer
// ideas por nicho. Marca qué es dato conocido y qué es inferencia. Secrets: GEMINI_API_KEY.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';

const SYSTEM_PROMPT = `Sos un agente de investigación y generación de ideas para contenido de Instagram y anuncios, para MYB Digitals (Córdoba, Argentina).

Tu objetivo: cruzar patrones de contenido viral + anuncios efectivos + tendencias recientes de tecnología/IA/marketing, y MEZCLARLOS para proponer ideas nuevas por nicho, accionables y creativas (no listas genéricas).

Reglas:
- Español rioplatense, claro y práctico.
- NO inventes datos como si fueran verificados. NO reproduzcas copys largos de anuncios reales.
- No tenés acceso en vivo a Meta Ads Library ni a noticias en tiempo real: trabajá con patrones y tendencias que conocés, y sé honesto. Cuando algo sea una hipótesis/propuesta creativa y no un dato, decilo con naturalidad dentro del texto ("probablemente", "patrón habitual", "hipótesis").
- Priorizá lo accionable y fácil de producir. Ideas inteligentes y COMBINADAS.

Devolvé ÚNICAMENTE un JSON válido con EXACTAMENTE esta forma:
{
  "nota": "1 frase aclarando que las ideas se basan en patrones conocidos (no en fuentes en vivo)",
  "resumen": "2-4 frases: qué oportunidades hay y qué tipo de contenido/anuncios parecen más prometedores",
  "ideasInstagram": [ { "titulo": "", "formato": "Reel|Carrusel|Story|Ad", "gancho": "hook inicial", "idea": "idea central en 1-2 frases", "cta": "" } ],
  "anuncios": [ { "nicho": "", "formato": "", "gancho": "", "oferta": "", "porQue": "por qué funciona (patrón)", "adaptar": "qué se puede adaptar" } ],
  "tendencias": [ { "titulo": "tendencia/novedad tech-IA-marketing", "detalle": "", "uso": "cómo usarla en reel/carrusel/anuncio" } ],
  "cruzadas": [ { "nicho": "", "ideas": ["idea que mezcla tendencia+anuncio+novedad", "", ""] } ],
  "acciones": { "producir": ["qué contenido producir primero"], "testear": ["qué anuncios testear"], "conversion": ["qué ideas tienen más potencial de conversión"] }
}
Cantidades: ideasInstagram 10 a 15; anuncios 5 a 8; tendencias 5; cruzadas 3 nichos (con 3 ideas c/u); cada lista de "acciones" 2 a 3 ítems. Ítems cortos y filosos.`;

const GEN_CONFIG = { temperature: 0.9, maxOutputTokens: 8192, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 2048 } };
const MODELS = [MODEL, 'gemini-2.0-flash'];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function geminiGenerate(prompt: string): Promise<any> {
  let last: unknown = null;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: GEN_CONFIG }),
      });
      const data = await res.json();
      if (res.ok) return data;
      last = data;
      const code = (data as { error?: { code?: number } })?.error?.code;
      if (code === 503 || code === 429 || code === 500) { await sleep(900 * (attempt + 1)); continue; }
      break;
    }
  }
  throw new Error('Gemini sigue saturado, probá de nuevo en un minuto. ' + JSON.stringify(last));
}

// Búsqueda web REAL con grounding de Google Search. Si no está disponible, devuelve ''.
async function geminiGrounded(prompt: string): Promise<string> {
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.4, maxOutputTokens: 1024 } }),
      });
      const data = await res.json();
      if (res.ok) {
        const t = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
        if (t.trim()) return t;
      }
    } catch { /* probá el siguiente modelo */ }
  }
  return '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { nichos, foco } = await req.json();
    const n = (nichos || '').toString().trim() || 'agencias digitales, estética, gastronomía';

    // Paso 1: tendencias REALES por búsqueda web (si el grounding está disponible)
    const realTrends = await geminiGrounded(
      `Buscá en la web y listá 5 tendencias o novedades RECIENTES (últimas semanas) de tecnología, IA y marketing digital que sirvan para contenido de Instagram/anuncios en estos nichos: ${n}. Formato: lista corta, cada ítem "Título — 1 frase". Solo lo que encuentres real y reciente.`
    ).catch(() => '');

    const trendsBlock = realTrends
      ? `\n=== TENDENCIAS REALES (de búsqueda web reciente — usalas en "tendencias" y para las "cruzadas") ===\n${realTrends}\n`
      : '';
    const prompt = `${SYSTEM_PROMPT}\n\n=== NICHOS ===\n${n}\n${foco ? `\n=== FOCO / OBJETIVO ===\n${foco}\n` : ''}${trendsBlock}\n=== FIN ===\nGenerá las ideas en JSON.${realTrends ? ' En "nota" aclaró que las tendencias vienen de búsqueda web reciente.' : ''}`;

    const data = await geminiGenerate(prompt);
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    if (!text) throw new Error('Gemini no devolvió texto');
    let ideas;
    try { ideas = JSON.parse(text); }
    catch { const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('No se pudo parsear'); ideas = JSON.parse(m[0]); }

    return new Response(JSON.stringify({ ok: true, ideas }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
