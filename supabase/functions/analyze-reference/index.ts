// Edge Function: clasificación de videos de referencia (swipe file).
//
// Recibe el link de un video que funcionó y, sobre todo, el GANCHO transcrito
// (Gemini no puede ver el video: el análisis vale lo que vale el texto que se le pase).
// Devuelve: categoría (venta/tendencia/viral/educativo), fórmula de hook usada,
// formato narrativo, por qué funciona y cómo adaptarlo al rubro de MYB.
// Secrets: GEMINI_API_KEY

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';

const SYSTEM_PROMPT = `Sos analista de contenido viral en MYB Digitals (Córdoba, Argentina), especializado en video corto (Reels/TikTok/Shorts) con la metodología de Kallaway.

Te paso un video de referencia que alguien guardó porque funcionó. Tu trabajo es DESARMARLO: identificar el mecanismo que lo hace funcionar para poder replicar el patrón (nunca copiar el contenido).

=== CÓMO CLASIFICAR LA CATEGORÍA ===
Elegí exactamente UNA:
- "venta": empuja hacia una oferta concreta. Hay producto, servicio, precio, o un CTA de compra/consulta. Alcance menor pero intención alta.
- "tendencia": monta una ola que ya existe (audio del momento, formato replicado, tema caliente). Su fuerza viene de la ola, no del contenido propio.
- "viral": diseñado para compartirse por emoción (risa, shock, indignación, ternura). No enseña nada accionable, se comparte por lo que hace SENTIR.
- "educativo": enseña algo concreto e implementable. Se guarda más de lo que se comparte. Construye autoridad.
Si duda entre "viral" y "educativo": si el que lo ve puede APLICAR algo mañana, es educativo. Si solo puede sentir algo, es viral.

=== FÓRMULAS DE HOOK VERBAL (elegí la que más se acerque) ===
Secreto / Revelación · Contrarian · Error / Advertencia · Costo oculto · Case study · Lista / Listicle · Comparación · Pregunta directa · Escenario / Hipotético · Ranking · Autoridad / Prueba · Experiencia personal · Negativo / Prohibición

=== FORMATOS NARRATIVOS (elegí el que más se acerque) ===
Educativos: Error común · Lista numerada · Cómo hacer X · Mito vs realidad · Comparación A vs B · Desglose de un caso
Storytelling: Antes / Después · Fracaso y aprendizaje · Un día en la vida · Confesión

=== QUÉ MIRAR EN "POR QUÉ FUNCIONA" ===
Nombrá el mecanismo concreto, no generalidades. Buscá:
- Si las 3 capas del hook (lo que dice / lo que se ve / lo que se lee) dicen lo mismo.
- Si hay re-hook entre el segundo 3 y el 7 (el puente que evita la caída de retención).
- Si el valor llega antes del segundo 12.
- Si toma una posición clara en vez de quedarse neutral (eso genera comentarios).
- Cuál de las dos razones de compartir activa: hacer SENTIR o hacer APRENDER.
- Si hay loop (el final conecta con el inicio).

=== REGLAS ===
- Español rioplatense, concreto, sin relleno.
- NO inventes datos del video que no estén en lo que te paso. Si el gancho no vino transcrito, basate en el link/plataforma y en las notas, y sé explícito en que es una inferencia.
- "comoAdaptarlo" tiene que ser accionable para MYB: consultoría de marketing digital, automatización con IA y contenido para pymes. Nombrá el ángulo específico, no "usar este formato".

Devolvé ÚNICAMENTE un JSON válido con EXACTAMENTE esta forma:
{
  "categoria": "venta | tendencia | viral | educativo",
  "gancho": "el hook transcrito o reconstruido en una frase",
  "formulaHook": "una de las fórmulas de la lista",
  "formatoNarrativo": "uno de los formatos de la lista",
  "porQueFunciona": "2-3 razones concretas nombrando el mecanismo (share rate, capas del hook, re-hook, posición, loop)",
  "comoAdaptarlo": "1-2 frases con el ángulo específico para MYB, accionable"
}`;

const GEN_CONFIG = {
  temperature: 0.6, maxOutputTokens: 2048,
  responseMimeType: 'application/json',
  thinkingConfig: { thinkingBudget: 1024 },
};
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

// Plataforma inferida del link, para dar contexto de formato al modelo.
const platformOf = (url: string): string => {
  const u = url.toLowerCase();
  if (u.includes('tiktok')) return 'TikTok';
  if (u.includes('youtube') || u.includes('youtu.be')) return 'YouTube Shorts';
  if (u.includes('instagram')) return 'Instagram Reels';
  return 'desconocida';
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { url, hook, notas, rubro } = await req.json();
    if (!url || !String(url).trim()) throw new Error('Falta el link del video');

    const ctx = [
      `Link: ${url}`,
      `Plataforma: ${platformOf(String(url))}`,
      hook && `Gancho transcrito (primeros 3 segundos): "${hook}"`,
      notas && `Notas de quien lo guardó: ${notas}`,
      rubro && `Rubro del video: ${rubro}`,
      !hook && !notas && 'AVISO: no vino el gancho transcrito ni notas. Marcá tus conclusiones como inferencia y pedí en "porQueFunciona" que se transcriba el gancho para un análisis preciso.',
    ].filter(Boolean).join('\n');

    const prompt = `${SYSTEM_PROMPT}\n\n=== VIDEO DE REFERENCIA ===\n${ctx}\n\n=== FIN ===\nAnalizá y devolvé el JSON.`;

    const data = await geminiGenerate(prompt);
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    if (!text) throw new Error('Gemini no devolvió texto');

    let analysis;
    try { analysis = JSON.parse(text); }
    catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('No se pudo parsear la respuesta');
      analysis = JSON.parse(m[0]);
    }

    return new Response(JSON.stringify({ ok: true, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
