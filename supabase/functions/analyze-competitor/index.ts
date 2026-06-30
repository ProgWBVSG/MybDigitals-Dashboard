// Edge Function: analiza un competidor con IA (Gemini) y devuelve un análisis estratégico
// estructurado. Basado SOLO en la info que carga MYB (no inventa datos duros).
// Secrets: GEMINI_API_KEY, GEMINI_MODEL (opcional)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';

const SYSTEM_PROMPT = `Sos estratega de marca y contenido en MYB Digitals (agencia de Córdoba, Argentina: páginas web, presencia digital y automatización con IA).

A partir de los datos de un COMPETIDOR (lo que observamos de su marca/redes), generá un análisis estratégico útil y accionable, pensado para que MYB o su cliente puedan diferenciarse y ganarle terreno.

Reglas:
- Basate en los datos provistos. Podés inferir con criterio profesional a partir del rubro y lo observado, pero NO inventes cifras, premios ni datos duros que no estén. Si algo no se sabe, hablá en términos de hipótesis ("probablemente", "se observa que").
- Concreto y aplicable, sin relleno ni clichés de marketing. Español rioplatense (tratar de "vos"/"ustedes").
- Enfocate en oportunidades REALES: huecos de contenido, ángulos sin explotar, debilidades aprovechables.

Devolvé ÚNICAMENTE un JSON válido con EXACTAMENTE esta forma:
{
  "posicionamiento": "2-3 frases: cómo se posiciona hoy el competidor y a quién le habla",
  "fortalezas": ["punto concreto", "..."],
  "debilidades": ["punto concreto", "..."],
  "oportunidades": ["hueco de contenido o ángulo sin explotar que se puede aprovechar", "..."],
  "recomendaciones": ["acción concreta para diferenciarse / ganarle", "..."]
}
- Cada lista: 3 a 5 ítems CORTOS (una línea, ~12 palabras máx, sin punto final).`;

const GEN_CONFIG = { temperature: 0.6, maxOutputTokens: 4096, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 1024 } };
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { competitor, contexto } = await req.json();
    if (!competitor || typeof competitor !== 'object') throw new Error('Faltan los datos del competidor');
    const datos = Object.entries(competitor)
      .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '' && String(v) !== '{}')
      .map(([k, v]) => `- ${k}: ${v}`).join('\n');
    const ctx = contexto ? `\n\n=== CONTEXTO (nuestra marca / cliente) ===\n${contexto}` : '';
    const prompt = `${SYSTEM_PROMPT}\n\n=== DATOS DEL COMPETIDOR ===\n${datos}${ctx}\n\n=== FIN ===\nGenerá el análisis en JSON.`;

    const data = await geminiGenerate(prompt);
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    if (!text) throw new Error('Gemini no devolvió texto');
    let analysis;
    try { analysis = JSON.parse(text); }
    catch { const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('No se pudo parsear el análisis'); analysis = JSON.parse(m[0]); }

    return new Response(JSON.stringify({ ok: true, analysis }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
