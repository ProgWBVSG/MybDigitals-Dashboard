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
- Cada sección: 4 a 6 bullets concretos.
- Si no hay monto, dejá "inversion.items" vacío y un texto general.`;

async function generateProposal(prospect: Record<string, unknown>): Promise<unknown> {
  const datos = Object.entries(prospect)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '' && String(v) !== '{}')
    .map(([k, v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('\n');

  const prompt = `${SYSTEM_PROMPT}\n\n=== DATOS DEL PROSPECTO ===\n${datos}\n\n=== FIN ===\nGenerá la propuesta en JSON.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 6144,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 1024 },
        },
      }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error('Gemini error: ' + JSON.stringify(data));
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
