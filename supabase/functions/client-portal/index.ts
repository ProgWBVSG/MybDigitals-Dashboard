// Edge Function PÚBLICA: devuelve el "bundle" (JSON) del Portal del Cliente por token.
// Mismo criterio que share-proposal: devuelve SOLO datos curados y whitelisteados (nunca
// montos, notas internas ni otros clientes). El cliente no tiene sesión de Supabase; toda
// lectura pasa por acá con la service key, así el RLS del dashboard queda intacto.
// El visor vive en el dominio del dashboard: /?portal=TOKEN.

const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const rest = async (path: string) => {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
  return res.json();
};

interface StepRow { phase: number; phase_name: string; status: string; is_optional: boolean }

function buildPhases(steps: StepRow[]) {
  const byPhase = new Map<number, { name: string; total: number; done: number; anyProgress: boolean }>();
  for (const s of steps) {
    const p = byPhase.get(s.phase) || { name: s.phase_name, total: 0, done: 0, anyProgress: false };
    if (s.status === 'skipped') { byPhase.set(s.phase, p); continue; }
    p.total += 1;
    if (s.status === 'done') { p.done += 1; p.anyProgress = true; }
    else if (s.status === 'in_progress' || s.status === 'blocked') p.anyProgress = true;
    byPhase.set(s.phase, p);
  }
  const ordered = [...byPhase.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  // Narrativa clara para el cliente: UNA sola fase "actual" (la primera que no está
  // 100% terminada). Las anteriores quedan "listas", las siguientes "por venir".
  let activeSet = false;
  const phases = ordered.map(v => {
    const fullyDone = v.total > 0 && v.done === v.total;
    let status: 'done' | 'active' | 'pending';
    if (fullyDone) status = 'done';
    else if (!activeSet) { status = 'active'; activeSet = true; }
    else status = 'pending';
    return { name: v.name, status, total: v.total, done: v.done };
  });
  const totalSteps = phases.reduce((s, p) => s + p.total, 0);
  const doneSteps = phases.reduce((s, p) => s + p.done, 0);
  const progress = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;
  return { phases, progress };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = new URL(req.url);
    let token = url.searchParams.get('token');
    if (!token && req.method === 'POST') { try { token = (await req.json())?.token ?? null; } catch { /* noop */ } }
    if (!token) return json({ ok: false, error: 'Link inválido.' }, 400);

    const portals = await rest(`client_portals?token=eq.${encodeURIComponent(token)}&select=id,client_id,onboarding_id,enabled,config`);
    const portal = Array.isArray(portals) ? portals[0] : null;
    if (!portal) return json({ ok: false, error: 'Este portal no existe o fue dado de baja.' }, 404);
    if (!portal.enabled) return json({ ok: false, error: 'Este portal está pausado. Escribile a MYB Digitals.' }, 403);

    const config = portal.config || {};

    // Cliente (nombre)
    let clientName = config.title || 'Tu proyecto';
    if (portal.client_id) {
      const cs = await rest(`clients?id=eq.${portal.client_id}&select=name`);
      if (Array.isArray(cs) && cs[0]?.name) clientName = cs[0].name;
    }

    // Onboarding (tipo de servicio, drive, fases desde los pasos)
    let serviceType: string | null = null;
    let driveLink = '';
    let phases: ReturnType<typeof buildPhases>['phases'] = [];
    let progress = 0;
    if (portal.onboarding_id) {
      const obs = await rest(`onboardings?id=eq.${portal.onboarding_id}&select=service_type,drive_root_link`);
      const ob = Array.isArray(obs) ? obs[0] : null;
      if (ob) { serviceType = ob.service_type || null; driveLink = ob.drive_root_link || ''; }
      const steps = await rest(`onboarding_steps?onboarding_id=eq.${portal.onboarding_id}&select=phase,phase_name,status,is_optional&order=phase.asc`);
      if (Array.isArray(steps)) { const r = buildPhases(steps as StepRow[]); phases = r.phases; progress = r.progress; }
    }

    // Tareas curadas (visibles al cliente)
    let tasks: { title: string; done: boolean }[] = [];
    if (portal.client_id) {
      const ts = await rest(`tasks?client_id=eq.${portal.client_id}&portal_visible=eq.true&select=title,column_id&order=order.asc`);
      if (Array.isArray(ts)) tasks = ts.map((t: { title: string }) => ({ title: t.title, done: false }));
    }

    // Actualizaciones + tickets del propio portal
    const updatesRaw = await rest(`portal_updates?portal_id=eq.${portal.id}&select=title,body,created_at&order=created_at.desc`);
    const updates = Array.isArray(updatesRaw) ? updatesRaw : [];
    const ticketsRaw = await rest(`portal_tickets?portal_id=eq.${portal.id}&select=id,title,description,status,reply,created_at&order=created_at.desc`);
    const tickets = Array.isArray(ticketsRaw) ? ticketsRaw.map((t: Record<string, unknown>) => ({
      id: t.id, title: t.title, description: t.description, status: t.status, reply: t.reply, createdAt: Number(t.created_at),
    })) : [];

    return json({
      ok: true,
      bundle: {
        clientName, brand: config.brand || {}, serviceType, config,
        phases, progress, tasks,
        updates: updates.map((u: Record<string, unknown>) => ({ title: u.title, body: u.body, createdAt: Number(u.created_at) })),
        tickets, driveLink,
      },
    });
  } catch (e) {
    return json({ ok: false, error: 'No se pudo cargar el portal. ' + String((e as Error)?.message || '') }, 500);
  }
});
