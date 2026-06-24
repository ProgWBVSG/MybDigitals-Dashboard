// Edge Function PÚBLICA: devuelve los DATOS (JSON) de UNA propuesta por token,
// validando el vencimiento (30 días). El JSON no se renderiza como página, así que
// el gateway de Supabase no lo sandboxea (a diferencia del HTML). El visor que vive
// en el dominio del dashboard (/?p=token) toma este JSON y dibuja el deck.
// No expone el dashboard ni ningún otro dato: solo la propuesta de ese token.

const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = new URL(req.url);
    let token = url.searchParams.get('token');
    if (!token && req.method === 'POST') {
      try { token = (await req.json())?.token ?? null; } catch { /* noop */ }
    }
    if (!token) return json({ ok: false, error: 'Link inválido.' }, 400);

    const res = await fetch(
      `${SUPA_URL}/rest/v1/prospects?share_token=eq.${encodeURIComponent(token)}&select=name,proposal,brand,share_expires`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || !row.proposal) return json({ ok: false, error: 'Este link no existe o fue revocado.' }, 404);
    if (row.share_expires && Number(row.share_expires) < Date.now()) {
      return json({ ok: false, error: 'Este link expiró. Pedile a MYB Digitals uno nuevo.' }, 410);
    }
    // Registrar la apertura (tracking). No bloquea la respuesta.
    fetch(`${SUPA_URL}/rest/v1/proposal_views`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ token }),
    }).catch(() => {});
    return json({ ok: true, proposal: row.proposal, brand: row.brand || {}, cliente: row.name });
  } catch (e) {
    return json({ ok: false, error: 'No se pudo cargar la propuesta. ' + String((e as Error)?.message || '') }, 500);
  }
});
