// Edge Function: analiza el copy de un anuncio (que MYB vio en Meta Ads Library) y extrae
// gancho, oferta, formato, por qué funciona y cómo adaptarlo. Gemini + reintentos.
// Secrets: GEMINI_API_KEY

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';

const SYSTEM_PROMPT = `Sos experto en Meta Ads y copywriting de respuesta directa, en MYB Digitals (Córdoba, Argentina).

Te paso el TEXTO/copy de un anuncio real que observamos de un competidor. Analizalo y extraé el patrón para que MYB pueda aprender y adaptarlo (no copiar).

Reglas: español rioplatense, concreto. NO reproduzcas el copy largo tal cual: resumí/parafrasea. Basate en lo provisto; si algo no está, inferí con criterio y decilo.

Devolvé ÚNICAMENTE un JSON válido con EXACTAMENTE esta forma:
{
  "gancho": "el hook/apertura y por qué frena el scroll (1 frase)",
  "oferta": "qué ofrece / promesa / incentivo",
  "formato": "Imagen | Video | Reel | Carrusel (inferí por el texto)",
  "porQue": "por qué funciona este anuncio (2-3 razones cortas)",
  "adaptar": "cómo adaptar este ángulo para un cliente de MYB, en 1-2 frases accionables"
}`;

const GEN_CONFIG = { temperature: 0.6, maxOutputTokens: 2048, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 1024 } };
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
    const { texto, rubro, competidor } = await req.json();
    if (!texto || !String(texto).trim()) throw new Error('Falta el texto del anuncio');
    const ctx = [rubro && `Rubro: ${rubro}`, competidor && `Competidor: ${competidor}`].filter(Boolean).join('\n');
    const prompt = `${SYSTEM_PROMPT}\n\n${ctx ? `=== CONTEXTO ===\n${ctx}\n\n` : ''}=== ANUNCIO OBSERVADO ===\n${texto}\n\n=== FIN ===\nAnalizá en JSON.`;

    const data = await geminiGenerate(prompt);
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    if (!text) throw new Error('Gemini no devolvió texto');
    let analysis;
    try { analysis = JSON.parse(text); }
    catch { const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('No se pudo parsear'); analysis = JSON.parse(m[0]); }

    return new Response(JSON.stringify({ ok: true, analysis }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
