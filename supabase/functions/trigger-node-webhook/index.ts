// Edge Function: dispara (server-side) el webhook de n8n configurado en un nodo de la
// pizarra de Estrategia. El cliente NUNCA llama a n8n directo (evita exponer el token del
// webhook en el navegador y problemas de CORS); solo llama a esta función, que hace el POST
// y devuelve un resumen. El cliente después inserta el log en `node_events`.
// Sin secrets propios: el webhook URL viene del nodo (lo carga el usuario en el panel).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TIMEOUT_MS = 10000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { webhookUrl, payload } = await req.json();
    if (!webhookUrl || typeof webhookUrl !== 'string') throw new Error('Falta la URL del webhook');
    let parsed: URL;
    try { parsed = new URL(webhookUrl); } catch { throw new Error('URL de webhook inválida'); }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('El webhook debe ser http(s)');

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(parsed.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload ?? {}),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(t);
    }

    const bodyText = await res.text().catch(() => '');
    const bodyPreview = bodyText.slice(0, 500);

    return new Response(JSON.stringify({ ok: res.ok, status: res.status, bodyPreview }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error && e.name === 'AbortError' ? `Timeout: el webhook no respondió en ${TIMEOUT_MS / 1000}s` : String((e as Error)?.message || e);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
