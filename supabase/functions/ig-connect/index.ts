// Edge Function: conecta una cuenta del dashboard con Instagram.
//
// El token nunca se guarda desde el navegador: `content_account_secrets` no
// tiene policies para authenticated, así que solo esta función (service key)
// puede escribirlo. Antes de guardarlo lo valida contra la Graph API para no
// dejar credenciales muertas, y descubre el ig_user_id solo.
//
// Acciones:
//   check      → valida el token y devuelve las cuentas de IG disponibles
//   connect    → guarda token + ig_user_id en la cuenta indicada
//   disconnect → borra las credenciales
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (los inyecta Supabase)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GRAPH = 'https://graph.facebook.com/v23.0';

const sb = async (path: string, init?: RequestInit) => {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

// Recorre las Páginas de Facebook del usuario y junta las cuentas de IG
// vinculadas: es el camino que expone ig_user_id sin pedírselo a mano.
async function discoverAccounts(token: string) {
  const url = `${GRAPH}/me/accounts?fields=name,instagram_business_account{id,username,followers_count,profile_picture_url}&limit=50&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    const code = data?.error?.code;
    if (code === 190) throw new Error('El token no es válido o ya expiró.');
    if (code === 200 || code === 3) throw new Error('El token no tiene los permisos necesarios (instagram_basic, instagram_manage_insights, pages_show_list).');
    throw new Error(data?.error?.message || 'No se pudo validar el token');
  }

  const out: { igUserId: string; username: string; followers: number; page: string; avatar: string }[] = [];
  for (const page of (data.data || []) as Record<string, any>[]) {
    const ig = page.instagram_business_account;
    if (ig?.id) out.push({
      igUserId: String(ig.id),
      username: String(ig.username || ''),
      followers: Number(ig.followers_count || 0),
      page: String(page.name || ''),
      avatar: String(ig.profile_picture_url || ''),
    });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { action, accountId, token, igUserId } = await req.json();

    if (action === 'check') {
      if (!token) throw new Error('Falta el token');
      const accounts = await discoverAccounts(String(token));
      if (!accounts.length) {
        throw new Error('El token es válido pero no encontré ninguna cuenta de Instagram profesional vinculada a tus Páginas de Facebook. Revisá que la cuenta sea Business o Creator y esté vinculada a una Página.');
      }
      return new Response(JSON.stringify({ ok: true, accounts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'connect') {
      if (!accountId || !token || !igUserId) throw new Error('Faltan datos para conectar');
      // Revalidar: el token pudo cambiar entre el check y el connect.
      const accounts = await discoverAccounts(String(token));
      const match = accounts.find(a => a.igUserId === String(igUserId));
      if (!match) throw new Error('Esa cuenta de Instagram no aparece con este token');

      await sb('content_account_secrets', {
        method: 'POST',
        body: JSON.stringify({ account_id: accountId, ig_token: token, updated_at: new Date().toISOString() }),
      });
      await sb(`content_accounts?id=eq.${accountId}`, {
        method: 'PATCH',
        body: JSON.stringify({ ig_user_id: match.igUserId, ig_connected_at: Date.now() }),
      });

      return new Response(JSON.stringify({ ok: true, connected: match }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'disconnect') {
      if (!accountId) throw new Error('Falta accountId');
      await sb(`content_account_secrets?account_id=eq.${accountId}`, { method: 'DELETE' });
      await sb(`content_accounts?id=eq.${accountId}`, {
        method: 'PATCH',
        body: JSON.stringify({ ig_user_id: null, ig_connected_at: null }),
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Acción no reconocida');
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
