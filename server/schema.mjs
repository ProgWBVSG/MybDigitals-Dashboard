// Qué valores pone la base sola en cada tabla y qué pasa al borrar (reemplaza lo que hacía Supabase).
import { randomBytes } from 'node:crypto';

const now = () => Date.now();
const text = (...k) => Object.fromEntries(k.map(x => [x, '']));
const zero = (...k) => Object.fromEntries(k.map(x => [x, 0]));
const nil = (...k) => Object.fromEntries(k.map(x => [x, null]));
const arr = (...k) => Object.fromEntries(k.map(x => [x, []]));
const obj = (...k) => Object.fromEntries(k.map(x => [x, {}]));
const no = (...k) => Object.fromEntries(k.map(x => [x, false]));

/** Valores por defecto. Es función para que cada fila tenga sus propias listas. */
export const DEFAULTS = {
  clients: () => ({ name: '', contact: { email: '', whatsapp: '', instagram: '' }, status: 'prospect', total_revenue: 0, content_game: '' }),
  client_projects: () => ({ ...text('name', 'description'), status: 'pending', value: 0, ...nil('start_date', 'end_date') }),
  client_notes: () => text('content'),
  skills: () => ({ ...text('name', 'category', 'description', 'color'), level: 1, ...arr('assigned_to', 'service_types') }),
  boards: () => ({ ...text('name', 'description'), ...arr('columns') }),
  tasks: () => ({ ...text('title', 'description'), priority: 'medium', ...arr('assigned_to', 'tags'), ...nil('due_date', 'client_id'), order: 0, portal_visible: false }),
  calendar_events: () => ({ ...text('title', 'description'), type: 'meeting', color: '#c3d809', ...arr('assigned_to'), related_task_id: null, all_day: false }),
  expenses: () => ({ amount: 0, description: '', category: 'General', date: new Date().toISOString(), ...nil('receipt_path', 'history_id') }),
  goals: () => ({ name: '', ...zero('target_amount', 'current_amount'), deadline: null }),
  onboardings: () => ({ ...nil('client_id', 'product_name', 'launched_at'), service_type: 'landing', status: 'active', current_phase: 0, ...text('title', 'drive_root_link', 'whatsapp_link', 'domain'), started_at: now(), ...obj('discovery') }),
  onboarding_steps: () => ({ phase: 0, ...text('phase_name', 'title', 'description', 'assigned_to', 'link'), owner: 'myb', status: 'pending', is_optional: false, order: 0, ...nil('due_date', 'completed_at') }),
  onboarding_payments: () => ({ label: '', amount: 0, currency: 'ARS', percentage: 0, paid: false, ...nil('paid_at', 'due_date') }),
  onboarding_documents: () => ({ ...text('doc_type', 'title', 'content', 'external_link'), status: 'pending' }),
  prospects: () => ({ ...text('name', 'business', 'source', 'notes'), stage: 'prospeccion', ...obj('contact', 'mint', 'prep', 'discovery', 'brand'), ...nil('meeting_at', 'proposal', 'share_token', 'share_expires', 'client_id', 'lat', 'lon') }),
  reminders: () => ({ title: '', due_at: null, done: false }),
  history: () => ({ ...nil('client_id', 'receipt_path'), kind: 'nota', ...text('title', 'detail'), amount: 0, currency: 'ARS', happened_at: now() }),
  guide_topics: () => ({ category: 'marca', ...text('title', 'emoji', 'summary', 'content'), ...arr('resources'), order: 0 }),
  services: () => ({ ...text('name', 'area', 'summary', 'delivery', 'notes'), status: 'en_venta', ...arr('includes', 'prices', 'links', 'price_history'), cost_monthly: null, sort: 0 }),
  content_accounts: () => ({ ...nil('client_id', 'ig_user_id', 'ig_connected_at', 'ig_synced_at'), ...text('name', 'handle', 'niche', 'notes'), color: '#f9587a', archived: false, rhythm: { 0: ['publicar'], 1: ['buscar'], 2: ['publicar'], 3: [], 4: ['publicar'], 5: [], 6: ['grabar', 'buscar'] } }),
  content_posts: () => ({ account_id: null, format: 'reel', objective: '', status: 'borrador', kind: 'organico', ...text('title', 'content', 'awareness', 'theme', 'how_to_record', 'ref_link', 'cta', 'caption', 'hashtags_ig', 'hashtags_tt', 'post_url'), angle: 'valor', edge_level: 4, score: 0, ...nil('scheduled_for', 'published_at', 'record_at', 'edit_at'), ...no('recorded', 'edited') }),
  content_sources: () => ({ type: 'nota', ...text('title', 'content', 'tags') }),
  content_ads: () => ({ ...nil('account_id', 'post_id', 'started_at', 'ended_at'), format: 'reel', status: 'activo', currency: 'ARS', ...text('objective', 'audience', 'placement', 'cta', 'copy', 'notes'), ...zero('budget', 'duration_days', 'spend', 'impressions', 'reach', 'results', 'ctr') }),
  content_metrics: () => ({ ...nil('account_id', 'post_id', 'published_at', 'media_id', 'synced_at'), ...text('title', 'notes'), source: 'manual', ...zero('views', 'reach', 'impressions', 'non_followers_pct', 'likes', 'saves', 'shares', 'comments', 'new_followers', 'retention_pct', 'avg_watch_sec', 'duration_sec') }),
  content_refs: () => ({ ...nil('account_id', 'analyzed_at'), platform: 'Instagram', ...text('url', 'creator', 'category', 'hook', 'hook_formula', 'narrative', 'why_works', 'how_to_adapt', 'notes'), saved: false }),
  content_stories: () => ({ ...nil('account_id', 'published_at'), ...text('code', 'kind', 'link', 'notes'), ...no('has_cta', 'has_lead_magnet'), ...zero('story_count', 'views_first', 'views_last', 'replies', 'votes') }),
  content_hooks: () => ({ account_id: null, ...text('text', 'note'), driver: 'curiosidad' }),
  content_ideas: () => ({ account_id: null, text: '' }),
  competitors: () => ({ ...nil('client_id', 'analysis', 'analyzed_at'), ...text('name', 'instagram', 'website', 'rubro', 'notes'), ...arr('ads') }),
  notes: () => ({ ...text('title', 'content', 'tags'), ...nil('follow_up_at', 'calendar_event_id', 'board_id'), repeat_rule: 'none', pinned: false }),
  whiteboards: () => ({ title: '', kind: 'idea', ...nil('client_id', 'note_id'), data: { nodes: [], edges: [], strokes: [] } }),
  node_events: () => ({ ...nil('client_id', 'webhook_url', 'response_summary'), action: 'webhook', status: 'success' }),
  strategy_docs: () => ({ title: '', doc_type: 'general', ...arr('blocks', 'tags'), client_id: null }),
  client_portals: () => ({ ...nil('client_id', 'onboarding_id', 'pin'), token: randomBytes(18).toString('base64url'), enabled: true, ...obj('config') }),
  portal_updates: () => ({ ...text('title', 'body'), image_path: null }),
  // Acuerdos, plata, planificación y mensajes
  agreements: () => ({ ...nil('client_id', 'service_id', 'monthly', 'signed_at', 'ended_at'), ...text('title', 'number', 'notes'), status: 'borrador', currency: 'ARS', start_at: now(), ...arr('phases', 'includes', 'excludes', 'client_duties', 'our_duties', 'monthly_paid'), ...obj('terms', 'client_data') }),
  movements: () => ({ kind: 'gasto', amount: 0, currency: 'ARS', date: now(), ...text('concept', 'category', 'account', 'person'), ...arr('splits'), ...nil('fund_id', 'to_fund_id', 'client_id', 'agreement_id', 'phase_id', 'bill_id', 'receipt_path') }),
  funds: () => ({ name: '', kind: 'otro', pct: 0, why: '', sort: 0, archived: false }),
  bills: () => ({ name: '', amount: 0, currency: 'ARS', due_at: now(), repeat: 'no', fund_id: null, active: true, notes: '' }),
  objectives: () => ({ ...text('title', 'why', 'what_for', 'obstacle', 'plan_b', 'unit'), owner: 'ambos', metric: 'manual', currency: 'ARS', current: 0, start: 0, target: 0, start_at: now(), due_at: null, status: 'activo', sort: 0 }),
  plan_items: () => ({ ...text('title', 'date', 'when_then', 'first_step', 'stuck'), owner: 'benja', ...nil('objective_id', 'client_id', 'agreement_id', 'done_at', 'started_at'), level: 'clave', top: false, minutes: 45, spent: 0, sort: 0, moved: 0 }),
  plan_days: () => ({ ...text('date', 'owner', 'proud', 'blocker'), closed_at: null, energy: null }),
  plan_weeks: () => ({ ...text('week', 'owner', 'success', 'wins', 'blockers', 'change'), objective_id: null, reviewed_at: null }),
  touches: () => ({ ...nil('client_id', 'prospect_id', 'agreement_id'), rule: '', key: '', channel: 'whatsapp', text: '', result: 'enviado', at: now(), by: '' }),
  message_rules: () => ({ ...text('name', 'template'), days: 0, enabled: true, sort: 0 }),
  voz_memoria: () => ({ oido: '', cliente_id: null }),
  voz_registro: () => ({ ...text('texto', 'by'), ...arr('resumen', 'vuelta', 'links'), at: now(), deshecho: false }),
  // Sistemas que les vendemos a los negocios (el estado y la llave los pone el servidor: ver sistemas.mjs)
  sistemas: () => ({ ...text('name', 'rubro', 'city', 'plan', 'notes', 'status_reason', 'status_msg', 'status_by'), client_id: null, owner: { name: '', whatsapp: '', email: '' }, price: 0, currency: 'ARS', bill_day: 10, bill_from: new Date().toISOString().slice(0, 7), grace_days: 5, status: 'activo', status_at: now(), ended_at: null, ...arr('links', 'fields', 'tags'), service_key: randomBytes(24).toString('base64url') }),
  sistema_pagos: () => ({ sistema_id: null, period: '', amount: 0, currency: 'ARS', paid_at: now(), ...text('method', 'note', 'by'), movement_id: null }),
  sistema_notas: () => ({ sistema_id: null, text: '', pinned: false, by: '' }),
  sistema_registro: () => ({ sistema_id: null, ...text('sistema', 'action', 'detail', 'by'), at: now() }),
  portal_tickets: () => ({ ...text('title', 'description'), ...nil('screenshot_path', 'reply', 'task_id'), status: 'open' }),
};

/** Tablas donde las fechas se guardan como número. En el resto, como texto. */
export const NUMERIC_DATES = new Set(['app_settings', 'sistemas', 'sistema_pagos', 'sistema_notas', 'sistema_registro', 'client_notes', 'reminders', 'history', 'guide_topics', 'competitors', 'notes', 'whiteboards', 'node_events', 'strategy_docs', 'client_portals', 'portal_updates', 'portal_tickets', 'portal_views', 'proposal_views', 'prospects', 'agreements', 'movements', 'funds', 'bills', 'objectives', 'plan_items', 'plan_days', 'plan_weeks', 'touches', 'message_rules', 'voz_memoria', 'voz_registro']);

/** Al borrar una fila: [tabla hija, columna, qué hacer]. */
export const ON_DELETE = {
  sistemas: [['sistema_pagos', 'sistema_id', 'borrar'], ['sistema_notas', 'sistema_id', 'borrar']], // el registro queda siempre
  clients: [['sistemas', 'client_id', 'vaciar'], ['client_projects', 'client_id', 'borrar'], ['client_notes', 'client_id', 'borrar'], ['onboardings', 'client_id', 'borrar'], ['client_portals', 'client_id', 'borrar'], ['history', 'client_id', 'vaciar'], ['prospects', 'client_id', 'vaciar'], ['tasks', 'client_id', 'vaciar'], ['content_accounts', 'client_id', 'vaciar'], ['competitors', 'client_id', 'vaciar'], ['whiteboards', 'client_id', 'vaciar'], ['strategy_docs', 'client_id', 'vaciar'], ['agreements', 'client_id', 'borrar'], ['touches', 'client_id', 'borrar'], ['voz_memoria', 'cliente_id', 'borrar'], ['movements', 'client_id', 'vaciar'], ['plan_items', 'client_id', 'vaciar']],
  agreements: [['movements', 'agreement_id', 'vaciar'], ['touches', 'agreement_id', 'vaciar'], ['plan_items', 'agreement_id', 'vaciar']],
  prospects: [['touches', 'prospect_id', 'borrar']],
  services: [['agreements', 'service_id', 'vaciar']],
  funds: [['movements', 'fund_id', 'vaciar'], ['bills', 'fund_id', 'vaciar']],
  bills: [['movements', 'bill_id', 'vaciar']],
  objectives: [['plan_items', 'objective_id', 'vaciar'], ['plan_weeks', 'objective_id', 'vaciar']],
  onboardings: [['onboarding_steps', 'onboarding_id', 'borrar'], ['onboarding_payments', 'onboarding_id', 'borrar'], ['onboarding_documents', 'onboarding_id', 'borrar'], ['client_portals', 'onboarding_id', 'vaciar']],
  boards: [['tasks', 'board_id', 'borrar']],
  client_portals: [['portal_updates', 'portal_id', 'borrar'], ['portal_tickets', 'portal_id', 'borrar'], ['portal_views', 'portal_id', 'borrar']],
  content_accounts: ['content_posts', 'content_ads', 'content_metrics', 'content_refs', 'content_stories', 'content_hooks', 'content_ideas'].map(t => [t, 'account_id', 'vaciar']),
  content_posts: [['content_ads', 'post_id', 'vaciar'], ['content_metrics', 'post_id', 'vaciar']],
  whiteboards: [['node_events', 'board_id', 'borrar'], ['notes', 'board_id', 'vaciar']],
  notes: [['whiteboards', 'note_id', 'vaciar']],
  calendar_events: [['notes', 'calendar_event_id', 'vaciar']],
};
