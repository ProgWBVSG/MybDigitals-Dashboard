// Edge Function: trae las métricas reales de cada reel desde Instagram.
//
// El token vive en `content_account_secrets`, tabla sin acceso desde el navegador
// (RLS sin policies para authenticated) — se lee acá con la service key y nunca
// se devuelve al cliente.
//
// Dos pasos: listar los medios recientes de la cuenta, y pedir insights de cada
// uno. La lista ya trae likes y comentarios, así que solo se piden a insights
// las métricas que no vienen en el objeto media.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (ambos los inyecta Supabase)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GRAPH = 'https://graph.facebook.com/v23.0';

// Métricas de insights por tipo de medio. `views` reemplazó a `plays`
// (deprecado); `impressions` ya no está disponible para reels.
const REEL_METRICS = ['views', 'reach', 'saved', 'shares', 'total_interactions', 'ig_reels_avg_watch_time'];
const POST_METRICS = ['views', 'reach', 'saved', 'shares', 'total_interactions'];

interface MediaRow {
  mediaId: string; permalink: string; shortcode: string; caption: string;
  mediaType: string; productType: string; timestamp: number;
  views: number; reach: number; likes: number; comments: number;
  saves: number; shares: number; interactions: number;
  avgWatchSec: number | null;
  insightsError?: string;
}

// instagram.com/reel/ABC123/ → ABC123. Es la llave para unir la pieza del
// Pipeline (donde se pegó el link a mano) con el reel real de la API.
const shortcodeOf = (url: string): string => {
  const m = String(url || '').match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : '';
};

const sb = async (path: string, init?: RequestInit) => {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json', ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

// Corre las promesas en tandas para no pasarse del rate limit de la Graph API
// (cada reel es una request de insights aparte).
async function inBatches<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...await Promise.all(items.slice(i, i + size).map(fn)));
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { accountId, limit } = await req.json();
    if (!accountId) throw new Error('Falta accountId');

    // 1. Credenciales (server-side, nunca vuelven al cliente)
    const accs = await sb(`content_accounts?id=eq.${accountId}&select=id,name,ig_user_id`);
    const acc = accs?.[0];
    if (!acc) throw new Error('La cuenta no existe');
    if (!acc.ig_user_id) throw new Error('Esta cuenta todavía no está conectada a Instagram');

    const secrets = await sb(`content_account_secrets?account_id=eq.${accountId}&select=ig_token`);
    const token = secrets?.[0]?.ig_token;
    if (!token) throw new Error('No hay token guardado para esta cuenta');

    // 2. Medios recientes. like_count/comments_count vienen acá, no en insights.
    const fields = 'id,permalink,caption,media_type,media_product_type,timestamp,like_count,comments_count';
    const listUrl = `${GRAPH}/${acc.ig_user_id}/media?fields=${fields}&limit=${Math.min(Number(limit) || 25, 50)}&access_token=${token}`;
    const listRes = await fetch(listUrl);
    const list = await listRes.json();
    if (!listRes.ok) {
      const msg = list?.error?.message || 'Error al listar los medios';
      // Los dos errores que más aparecen, traducidos a algo accionable.
      if (list?.error?.code === 190) throw new Error('El token de Instagram expiró o se revocó. Reconectá la cuenta.');
      if (list?.error?.code === 200) throw new Error('Faltan permisos: la app necesita instagram_manage_insights sobre esta cuenta.');
      throw new Error(msg);
    }

    const media = (list.data || []) as Record<string, unknown>[];

    // 3. Insights de cada medio (en tandas de 5)
    const rows = await inBatches(media, 5, async (m): Promise<MediaRow> => {
      const id = String(m.id);
      const productType = String(m.media_product_type || '');
      const isReel = productType === 'REELS';
      const metrics = (isReel ? REEL_METRICS : POST_METRICS).join(',');

      const base: MediaRow = {
        mediaId: id,
        permalink: String(m.permalink || ''),
        shortcode: shortcodeOf(String(m.permalink || '')),
        caption: String(m.caption || '').slice(0, 300),
        mediaType: String(m.media_type || ''),
        productType,
        timestamp: m.timestamp ? new Date(String(m.timestamp)).getTime() : 0,
        views: 0, reach: 0,
        likes: Number(m.like_count || 0),
        comments: Number(m.comments_count || 0),
        saves: 0, shares: 0, interactions: 0, avgWatchSec: null,
      };

      const res = await fetch(`${GRAPH}/${id}/insights?metric=${metrics}&access_token=${token}`);
      const data = await res.json();
      if (!res.ok) {
        // Un medio sin insights (muy viejo, o carrusel sin datos) no debe
        // tumbar toda la sincronización: se devuelve con el error anotado.
        base.insightsError = data?.error?.message || `HTTP ${res.status}`;
        return base;
      }

      for (const item of (data.data || []) as Record<string, unknown>[]) {
        const name = String(item.name);
        const values = item.values as { value?: number }[] | undefined;
        const v = Number(values?.[0]?.value ?? 0);
        if (name === 'views') base.views = v;
        else if (name === 'reach') base.reach = v;
        else if (name === 'saved') base.saves = v;
        else if (name === 'shares') base.shares = v;
        else if (name === 'total_interactions') base.interactions = v;
        // OJO: la API devuelve milisegundos. Sin dividir, la retención sale 1000x.
        else if (name === 'ig_reels_avg_watch_time') base.avgWatchSec = Math.round((v / 1000) * 10) / 10;
      }
      return base;
    });

    await sb(`content_accounts?id=eq.${accountId}`, {
      method: 'PATCH', body: JSON.stringify({ ig_synced_at: Date.now() }),
    });

    return new Response(JSON.stringify({ ok: true, account: acc.name, rows }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
