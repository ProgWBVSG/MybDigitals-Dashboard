// Edge Function: genera una PROPUESTA DE VALOR a medida del prospecto, en el estilo
// de MYB (portada -> diagnóstico/pilares -> sección por pilar -> próximos pasos).
// Devuelve JSON estructurado para renderizar como presentación. Usa Gemini (free tier).
//
// Secrets: GEMINI_API_KEY, GEMINI_MODEL (opcional)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';

const SYSTEM_PROMPT = `Sos consultor senior de MYB Digitals, una agencia de Córdoba (Argentina) que hace páginas web profesionales, presencia digital y automatización con IA.

A partir de los datos de un prospecto (lo que sabemos tras la reunión de discovery), generá una PROPUESTA DE VALOR a medida, con la estructura y el estilo de MYB.

Estilo MYB de propuesta:
- Una portada, un diagnóstico que nombra los PILARES de la solución, y luego UNA sección por cada pilar (con puntos concretos + un párrafo que lo explica), y un cierre.
- Los pilares y secciones son SIEMPRE a medida del negocio y sus dolores (ej: "Página web como vendedor", "Panel de control", "Automatizaciones de procesos", "Optimización SEO/AEO", etc.).
- Tono experto, claro y cercano; sin clichés de marketing ni promesas mágicas. Español rioplatense (tratar de "ustedes"). Beneficios concretos y reales.
- Basate ESTRICTAMENTE en los datos provistos del prospecto (qué hace, dolor, objetivo, servicio, etc.). NO inventes datos, cifras ni servicios que no estén. Si algo no se aclaró, omitilo en vez de inventar. La propuesta debe sentirse hecha a medida de ESTE cliente.

Devolvé ÚNICAMENTE un JSON válido con EXACTAMENTE esta forma:
{
  "cliente": "nombre del cliente/negocio",
  "subtitulo": "ej: Propuesta de Presencia Digital",
  "diagnostico": {
    "texto": "2-4 frases: entendemos su situación, su dolor y qué se propone resolver",
    "pilares": ["Pilar 1", "Pilar 2", "Pilar 3"]
  },
  "secciones": [
    { "titulo": "Nombre del pilar (igual que en pilares)", "bullets": ["punto concreto", "..."], "descripcion": "un párrafo que explica el pilar y su beneficio" }
  ],
  "inversion": { "texto": "1-2 frases sobre la inversión y modalidad (50/50)", "items": [] },
  "proximosPasos": "cierre cálido invitando a avanzar (por WhatsApp)"
}
- "secciones" debe tener una entrada por cada pilar de "diagnostico.pilares".
- Cada sección: 3 a 4 bullets concretos y CORTOS (una sola línea, máximo ~10 palabras cada uno; sin punto final).
- "descripcion": 2 a 3 frases, no más (va a leerse en pantalla, tiene que respirar).
- "diagnostico.texto": 2 a 3 frases.
- "proximosPasos": 1 sola frase corta y cálida invitando a avanzar (máximo ~20 palabras). NO repitas el nombre del cliente, NO armes un párrafo largo (ya hay un titular arriba).
- Si no hay monto, dejá "inversion.items" vacío y un texto general.`;

const GEN_CONFIG = { temperature: 0.6, maxOutputTokens: 6144, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 1024 } };
const MODELS = [MODEL, 'gemini-2.0-flash'];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Llama a Gemini con reintentos (503/429/500 = saturación temporal) y modelo de respaldo.
async function geminiGenerate(prompt: string): Promise<any> {
  let last: unknown = null;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: GEN_CONFIG }) },
      );
      const data = await res.json();
      if (res.ok) return data;
      last = data;
      const code = (data as { error?: { code?: number } })?.error?.code;
      if (code === 503 || code === 429 || code === 500) { await sleep(900 * (attempt + 1)); continue; }
      break; // error no recuperable -> probar el siguiente modelo
    }
  }
  throw new Error('Gemini sigue saturado, probá de nuevo en un minuto. ' + JSON.stringify(last));
}

async function generateProposal(prospect: Record<string, unknown>): Promise<unknown> {
  const datos = Object.entries(prospect)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '' && String(v) !== '{}')
    .map(([k, v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('\n');

  const prompt = `${SYSTEM_PROMPT}\n\n=== DATOS DEL PROSPECTO ===\n${datos}\n\n=== FIN ===\nGenerá la propuesta en JSON.`;

  const data = await geminiGenerate(prompt);
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
  if (!text) throw new Error('Gemini no devolvió texto: ' + JSON.stringify(data));
  try {
    return JSON.parse(text);
  } catch {
    // por si viene envuelto en ```json
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('No se pudo parsear el JSON de la propuesta');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { prospect } = await req.json();
    if (!prospect || typeof prospect !== 'object') throw new Error('Faltan los datos del prospecto');
    const proposal = await generateProposal(prospect);
    return new Response(JSON.stringify({ ok: true, proposal }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
