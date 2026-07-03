// Edge Function: estudio de guiones virales para Reels/Shorts/TikTok y ventas (Gemini).
// Usa frameworks probados: Hook(0-3s) → Valor → Payoff → CTA, PAS/BAB/AIDA y loop.
// Secrets: GEMINI_API_KEY

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';

const SYSTEM_PROMPT = `Sos guionista experto en video corto viral (Instagram Reels, YouTube Shorts, TikTok) y en video de ventas, para MYB Digitals.

Escribís guiones LISTOS PARA GRABAR usando frameworks que funcionan (probados en cientos de miles de videos):
- El HOOK (primeros 3 segundos) es lo más importante: gana o pierde el video. Curiosidad, dolor, dato fuerte, contradicción o pattern interrupt. Corto y punzante.
- Estructura: Hook (0-3s) → Valor/Problema (4-15s) → Payoff/Solución (16-45s) → CTA (últimos 5s). Para ventas usá PAS (Problema-Agitación-Solución) o BAB (Antes-Después-Puente).
- Retención: sin relleno, cada segundo tiene que ganar el siguiente. Tono humano y auténtico (lo crudo/real convierte más que lo súper producido). NO suene a IA ni a plantilla.
- Loop: cerrá de forma que enganche con el inicio para que se repita (más views).
- Español rioplatense (tratar de "vos"). Ajustá el ritmo a la plataforma y duración.

Devolvé ÚNICAMENTE un JSON válido con EXACTAMENTE esta forma:
{
  "framework": "framework usado (ej: Hook-Valor-CTA / PAS / BAB)",
  "hooks": ["3 variantes de hook para los primeros 3s"],
  "guion": [ { "tiempo": "0-3s", "voz": "lo que se dice/narra", "pantalla": "texto en pantalla (corto)", "visual": "toma o b-roll sugerido" } ],
  "caption": "texto del posteo (2-4 frases, voz de marca)",
  "hashtags": ["#etiqueta"],
  "loop": "cómo cerrar para que enganche con el inicio (replay)",
  "porQue": "por qué puede funcionar (2-3 razones cortas)"
}
- "hooks": exactamente 3. "guion": 4 a 7 beats con tiempos que sumen la duración pedida. "hashtags": 5 a 8 del rubro.`;

const GEN_CONFIG = { temperature: 0.9, maxOutputTokens: 4096, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 1024 } };
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
    const { plataforma, objetivo, duracion, tema, publico } = await req.json();
    if (!tema || !String(tema).trim()) throw new Error('Falta el tema');
    const brief = [
      `Plataforma: ${plataforma || 'Reel de Instagram'}`,
      `Objetivo: ${objetivo || 'Viral / alcance'}`,
      `Duración objetivo: ${duracion || '20-30s'}`,
      `Tema: ${tema}`,
      publico ? `Público / marca: ${publico}` : '',
    ].filter(Boolean).join('\n');
    const prompt = `${SYSTEM_PROMPT}\n\n=== BRIEF ===\n${brief}\n=== FIN ===\nEscribí el guion en JSON.`;

    const data = await geminiGenerate(prompt);
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    if (!text) throw new Error('Gemini no devolvió texto');
    let script;
    try { script = JSON.parse(text); }
    catch { const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('No se pudo parsear'); script = JSON.parse(m[0]); }

    return new Response(JSON.stringify({ ok: true, script }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
