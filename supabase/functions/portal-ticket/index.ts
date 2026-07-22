// Edge Function PÚBLICA: crea un ticket de corrección desde el Portal del Cliente, con
// captura opcional. El cliente no tiene sesión de Supabase, así que la subida a Storage y
// el insert se hacen acá con la service key (el navegador nunca toca el bucket directo).
// Body: { token, title, description, screenshot?: { base64, mime } }

const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAX_BYTES = 5 * 1024 * 1024;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const rest = async (path: string, init: RequestInit = {}) => {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  return { res, data: await res.json().catch(() => null) };
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json();
    const token = String(body?.token || '');
    const title = String(body?.title || '').trim();
    const description = String(body?.description || '').trim();
    const screenshot = body?.screenshot as { base64?: string; mime?: string } | undefined;
    if (!token) return json({ ok: false, error: 'Link inválido.' }, 400);
    if (!title) return json({ ok: false, error: 'Contanos brevemente qué encontraste.' }, 400);

    const portalsRes = await fetch(`${SUPA_URL}/rest/v1/client_portals?token=eq.${encodeURIComponent(token)}&select=id,enabled`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const portals = await portalsRes.json();
    const portal = Array.isArray(portals) ? portals[0] : null;
    if (!portal) return json({ ok: false, error: 'Este portal no existe o fue dado de baja.' }, 404);
    if (!portal.enabled) return json({ ok: false, error: 'Este portal está pausado.' }, 403);

    let screenshotPath: string | null = null;
    if (screenshot?.base64) {
      const mime = screenshot.mime || 'image/png';
      if (!mime.startsWith('image/')) return json({ ok: false, error: 'Solo se puede adjuntar una imagen.' }, 400);
      const bytes = base64ToBytes(screenshot.base64);
      if (bytes.byteLength > MAX_BYTES) return json({ ok: false, error: 'La imagen supera los 5 MB.' }, 400);
      const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
      screenshotPath = `${portal.id}/${crypto.randomUUID()}.${ext}`;
      const up = await fetch(`${SUPA_URL}/storage/v1/object/portal-uploads/${screenshotPath}`, {
        method: 'POST',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': mime },
        body: bytes,
      });
      if (!up.ok) return json({ ok: false, error: 'No se pudo subir la captura.' }, 500);
    }

    const { res, data } = await rest('portal_tickets', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        portal_id: portal.id, title, description, screenshot_path: screenshotPath,
        status: 'open', created_at: Date.now(),
      }),
    });
    if (!res.ok) return json({ ok: false, error: 'No se pudo enviar tu mensaje. Probá de nuevo.' }, 500);

    return json({ ok: true, ticket: Array.isArray(data) ? data[0] : data });
  } catch (e) {
    return json({ ok: false, error: 'No se pudo enviar. ' + String((e as Error)?.message || '') }, 500);
  }
});
