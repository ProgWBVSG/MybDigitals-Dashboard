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

const signReceipt = async (bucket: string, path: string): Promise<string | null> => {
  try {
    const res = await fetch(`${SUPA_URL}/storage/v1/object/sign/${bucket}/${path}`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 3600 }),
    });
    const d = await res.json();
    return d?.signedURL ? `${SUPA_URL}/storage/v1${d.signedURL}` : null;
  } catch { return null; }
};

interface StepRow { phase: number; phase_name: string; status: string; is_optional: boolean; owner: string; title: string }
type PhaseLabels = Record<string, { label?: string; hidden?: boolean }>;

function buildPhases(steps: StepRow[], phaseLabels: PhaseLabels = {}) {
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
  // El progreso global (anillo %) cuenta TODOS los pasos, incluidas las fases ocultas al
  // cliente (es el avance real, no lo que se decide mostrarle).
  const totalSteps = ordered.reduce((s, p) => s + p.total, 0);
  const doneSteps = ordered.reduce((s, p) => s + p.done, 0);
  const progress = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

  // La lista que VE el cliente: sin las fases ocultas (ej. "Cierre & Pago"), renombradas
  // si se configuró un nombre, y con UNA sola fase "actual" (la primera visible no
  // terminada) — la detección de "actual" se hace DESPUÉS de sacar las ocultas, para que
  // no quede "trabada" en algo que el cliente ni ve.
  const visible = ordered.filter(v => !phaseLabels[v.name]?.hidden);
  let activeSet = false;
  const phases = visible.map(v => {
    const fullyDone = v.total > 0 && v.done === v.total;
    let status: 'done' | 'active' | 'pending';
    if (fullyDone) status = 'done';
    else if (!activeSet) { status = 'active'; activeSet = true; }
    else status = 'pending';
    return { name: phaseLabels[v.name]?.label || v.name, status, total: v.total, done: v.done };
  });
  return { phases, progress };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = new URL(req.url);
    let token = url.searchParams.get('token');
    let pin = url.searchParams.get('pin') || '';
    let logView = false;
    if (req.method === 'POST') {
      try { const b = await req.json(); token = token || b?.token || null; pin = b?.pin || pin; logView = !!b?.logView; } catch { /* noop */ }
    }
    if (!token) return json({ ok: false, error: 'Link inválido.' }, 400);

    const portals = await rest(`client_portals?token=eq.${encodeURIComponent(token)}&select=id,client_id,onboarding_id,enabled,pin,config`);
    const portal = Array.isArray(portals) ? portals[0] : null;
    if (!portal) return json({ ok: false, error: 'Este portal no existe o fue dado de baja.' }, 404);
    if (!portal.enabled) return json({ ok: false, error: 'Este portal está pausado. Escribile a MYB Digitals.' }, 403);
    if (portal.pin && portal.pin !== pin) return json({ ok: false, needsPin: true, error: pin ? 'PIN incorrecto.' : 'Este portal pide un PIN.' }, 401);

    if (logView) {
      fetch(`${SUPA_URL}/rest/v1/portal_views`, {
        method: 'POST',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ portal_id: portal.id, viewed_at: Date.now() }),
      }).catch(() => {});
    }

    const config = portal.config || {};

    // Cliente (nombre)
    let clientName = config.title || 'Tu proyecto';
    if (portal.client_id) {
      const cs = await rest(`clients?id=eq.${portal.client_id}&select=name`);
      if (Array.isArray(cs) && cs[0]?.name) clientName = cs[0].name;
    }

    // Onboarding: tipo de servicio, drive, fases + setup steps + fechas reales
    let serviceType: string | null = null;
    let driveLink = '';
    let phases: ReturnType<typeof buildPhases>['phases'] = [];
    let progress = 0;
    let setupSteps: { title: string; done: boolean }[] = [];
    const keyDates: { label: string; date: number }[] = [];
    if (portal.onboarding_id) {
      const obs = await rest(`onboardings?id=eq.${portal.onboarding_id}&select=service_type,drive_root_link,started_at,launched_at`);
      const ob = Array.isArray(obs) ? obs[0] : null;
      if (ob) {
        serviceType = ob.service_type || null;
        driveLink = ob.drive_root_link || '';
        if (ob.started_at) keyDates.push({ label: 'Arrancamos', date: Number(ob.started_at) });
        if (ob.launched_at) keyDates.push({ label: 'Lanzamiento', date: Number(ob.launched_at) });
      }
      const steps = await rest(`onboarding_steps?onboarding_id=eq.${portal.onboarding_id}&select=phase,phase_name,status,is_optional,owner,title&order=order.asc`);
      if (Array.isArray(steps)) {
        const r = buildPhases(steps as StepRow[], config.phaseLabels || {}); phases = r.phases; progress = r.progress;
        // "Primeros pasos": lo que depende del cliente (owner='client'), primeros 5
        setupSteps = (steps as StepRow[])
          .filter(s => s.owner === 'client' && s.status !== 'skipped')
          .slice(0, 5)
          .map(s => ({ title: s.title, done: s.status === 'done' }));
      }
    }

    // Tareas curadas (visibles al cliente) — con estado real (columna del tablero)
    let tasks: { title: string; done: boolean; dueDate: number | null }[] = [];
    if (portal.client_id) {
      const ts = await rest(`tasks?client_id=eq.${portal.client_id}&portal_visible=eq.true&select=title,column_id,board_id,due_date&order=order.asc`);
      if (Array.isArray(ts) && ts.length > 0) {
        const boardIds = [...new Set(ts.map((t: { board_id: string }) => t.board_id))];
        const doneColIds = new Set<string>();
        for (const bId of boardIds) {
          const boards = await rest(`boards?id=eq.${bId}&select=columns`);
          const cols = Array.isArray(boards) && boards[0]?.columns ? boards[0].columns : [];
          for (const c of cols) if (String(c.name).toLowerCase().includes('completado')) doneColIds.add(c.id);
        }
        tasks = ts.map((t: { title: string; column_id: string; due_date: number | null }) => ({
          title: t.title, done: doneColIds.has(t.column_id), dueDate: t.due_date ? Number(t.due_date) : null,
        }));
      }
    }

    // Actualizaciones — con URL firmada de la imagen si tiene
    const updatesRaw = await rest(`portal_updates?portal_id=eq.${portal.id}&select=title,body,image_path,created_at&order=created_at.desc`);
    const updatesList = Array.isArray(updatesRaw) ? updatesRaw : [];
    const updates = await Promise.all(updatesList.map(async (u: Record<string, unknown>) => ({
      title: u.title, body: u.body,
      imageUrl: u.image_path ? await signReceipt('portal-uploads', String(u.image_path)) : null,
      createdAt: Number(u.created_at),
    })));

    // Tickets (correcciones) — con URL firmada de la captura si tiene
    const ticketsRaw = await rest(`portal_tickets?portal_id=eq.${portal.id}&select=id,title,description,status,reply,screenshot_path,created_at&order=created_at.desc`);
    const ticketsList = Array.isArray(ticketsRaw) ? ticketsRaw : [];
    const tickets = await Promise.all(ticketsList.map(async (t: Record<string, unknown>) => ({
      id: t.id, title: t.title, description: t.description, status: t.status, reply: t.reply,
      screenshotUrl: t.screenshot_path ? await signReceipt('portal-uploads', String(t.screenshot_path)) : null,
      createdAt: Number(t.created_at),
    })));

    return json({
      ok: true,
      bundle: {
        clientName, brand: config.brand || {}, serviceType, config,
        phases, progress, tasks, setupSteps,
        updates, tickets, driveLink, keyDates,
      },
    });
  } catch (e) {
    return json({ ok: false, error: 'No se pudo cargar el portal. ' + String((e as Error)?.message || '') }, 500);
  }
});
