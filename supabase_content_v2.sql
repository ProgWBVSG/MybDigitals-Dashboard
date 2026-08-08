-- ═══════════════════════════════════════════════════════════════════
-- IG CONTENT v2 — guionismo, métricas y referentes
-- Correr completo en el SQL Editor de Supabase. Es idempotente.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Campos de guionismo en content_posts ───
-- Equivalen a las filas de la planilla de reels (ángulo, tema, cómo grabarlo,
-- referencia, CTA, copy, hashtags) más el estado de producción.
alter table content_posts add column if not exists angle          text    default 'valor';
alter table content_posts add column if not exists awareness      text    default '';
alter table content_posts add column if not exists theme          text    default '';
alter table content_posts add column if not exists how_to_record  text    default '';
alter table content_posts add column if not exists ref_link       text    default '';
alter table content_posts add column if not exists cta            text    default '';
alter table content_posts add column if not exists caption        text    default '';
alter table content_posts add column if not exists hashtags_ig    text    default '';
alter table content_posts add column if not exists hashtags_tt    text    default '';
alter table content_posts add column if not exists recorded       boolean default false;
alter table content_posts add column if not exists edited         boolean default false;

-- ─── 2. Métricas de rendimiento ───
-- Solo números crudos de Instagram Insights. Todo lo derivado (share rate,
-- engagement, score) se calcula en el front, así los umbrales se ajustan sin migrar.
create table if not exists content_metrics (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid references content_posts(id) on delete set null,
  title             text        not null default '',
  published_at      bigint,
  views             integer     not null default 0,
  reach             integer     not null default 0,
  impressions       integer     not null default 0,
  non_followers_pct numeric     not null default 0,
  likes             integer     not null default 0,
  saves             integer     not null default 0,
  shares            integer     not null default 0,
  comments          integer     not null default 0,
  new_followers     integer     not null default 0,
  retention_pct     numeric     not null default 0,
  avg_watch_sec     numeric     not null default 0,
  duration_sec      numeric     not null default 0,
  notes             text        not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists content_metrics_post_idx      on content_metrics(post_id);
create index if not exists content_metrics_published_idx on content_metrics(published_at desc nulls last);

-- ─── 3. Referentes (swipe file) ───
create table if not exists content_refs (
  id           uuid primary key default gen_random_uuid(),
  url          text        not null default '',
  creator      text        not null default '',
  platform     text        not null default 'Instagram',
  category     text        not null default '',
  hook         text        not null default '',
  hook_formula text        not null default '',
  narrative    text        not null default '',
  why_works    text        not null default '',
  how_to_adapt text        not null default '',
  notes        text        not null default '',
  saved        boolean     not null default false,
  analyzed_at  bigint,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists content_refs_category_idx on content_refs(category);
create index if not exists content_refs_saved_idx    on content_refs(saved) where saved;

-- ─── 4. RLS (mismo criterio que el resto del dashboard: acceso autenticado) ───
alter table content_metrics enable row level security;
alter table content_refs    enable row level security;

drop policy if exists "content_metrics_all" on content_metrics;
create policy "content_metrics_all" on content_metrics
  for all using (true) with check (true);

drop policy if exists "content_refs_all" on content_refs;
create policy "content_refs_all" on content_refs
  for all using (true) with check (true);

-- ─── 5. Realtime (para que el dashboard se actualice solo) ───
do $$
begin
  alter publication supabase_realtime add table content_metrics;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table content_refs;
exception when duplicate_object then null;
end $$;
