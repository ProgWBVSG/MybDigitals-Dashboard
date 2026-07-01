// Edge Function: genera una pieza de contenido para Instagram con IA (Gemini).
// Devuelve título, hook, guion, caption, hashtags y CTA, adaptado al formato y objetivo.
// Secrets: GEMINI_API_KEY, GEMINI_MODEL (opcional)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';

const SYSTEM_PROMPT = `Sos estratega de contenido para Instagram en MYB Digitals (Córdoba, Argentina). Escribís contenido que frena el scroll y convierte, sin sonar a IA ni a plantilla.

Te dan formato, objetivo y tema. Generá UNA pieza lista para producir.

Reglas:
- Español rioplatense, tono humano y directo (tratar de "vos"). Nada de clichés de marketing ("¡No te lo pierdas!", "en el mundo de hoy...").
- El HOOK tiene que ganar los primeros 2 segundos (o la placa 1). Que genere curiosidad o toque un dolor real.
- Adaptá el guion al formato: si es Reel o Story → líneas habladas / escenas cortas; si es Carrusel → una idea por placa (placa 1, placa 2...); si es Ad → ángulo + oferta clara.
- Concreto y accionable. El CTA tiene que empujar al objetivo indicado.

Devolvé ÚNICAMENTE un JSON válido con EXACTAMENTE esta forma:
{
  "titulo": "título corto y descriptivo de la pieza (interno)",
  "hook": "la frase/placa de apertura",
  "guion": ["línea o placa 1", "línea o placa 2", "..."],
  "caption": "texto del posteo (2-4 frases, con la voz de la marca)",
  "hashtags": ["#etiqueta", "..."],
  "cta": "llamado a la acción alineado al objetivo"
}
- "guion": 4 a 7 ítems. "hashtags": 5 a 8, relevantes al rubro (sin genéricos tipo #love).`;

const GEN_CONFIG = { temperature: 0.85, maxOutputTokens: 4096, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 1024 } };
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
    const { format, objective, tema, notas, marca } = await req.json();
    if (!tema || !String(tema).trim()) throw new Error('Falta el tema');
    const partes = [
      `Formato: ${format || 'Reel'}`,
      `Objetivo: ${objective || 'Alcance'}`,
      `Tema: ${tema}`,
      notas ? `Notas / idea previa: ${notas}` : '',
      marca ? `Marca / contexto: ${marca}` : '',
    ].filter(Boolean).join('\n');
    const prompt = `${SYSTEM_PROMPT}\n\n=== BRIEF ===\n${partes}\n=== FIN ===\nGenerá la pieza en JSON.`;

    const data = await geminiGenerate(prompt);
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    if (!text) throw new Error('Gemini no devolvió texto');
    let content;
    try { content = JSON.parse(text); }
    catch { const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('No se pudo parsear la pieza'); content = JSON.parse(m[0]); }

    return new Response(JSON.stringify({ ok: true, content }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
