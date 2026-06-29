-- ============================================================
-- MYB Digitals Dashboard — Content Command Center
-- Correr en Supabase → SQL Editor.
-- ============================================================

-- ─────────────────────────────────────────────
-- 1) TABLAS DE CONTENT
-- ─────────────────────────────────────────────

create table if not exists public.content_posts (
  id              uuid primary key default gen_random_uuid(),
  format          text not null default 'Reel',      -- Reel | Carrusel | Stories | Ad
  objective       text not null default 'DM',        -- DM | Agenda | Registro | Venta | Tráfico a perfil
  status          text not null default 'draft',     -- draft | ready | published
  title           text not null default '',
  content         text not null default '',
  edge_level      int not null default 4,
  score           int not null default 0,
  scheduled_for   bigint,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.content_sources (
  id              uuid primary key default gen_random_uuid(),
  type            text not null default 'transcript', -- transcript | call | message
  title           text not null default '',
  content         text not null default '',
  tags            text not null default '',           -- JSON string or comma-separated
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.content_metrics (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid references public.content_posts(id) on delete cascade,
  views           int not null default 0,
  reach           int not null default 0,
  saves           int not null default 0,
  shares          int not null default 0,
  comments        int not null default 0,
  retention       numeric not null default 0,
  ctr             numeric not null default 0,
  recorded_at     timestamptz not null default now()
);

-- Índices
create index if not exists idx_metrics_post on public.content_metrics(post_id);
create index if not exists idx_posts_status on public.content_posts(status);

-- ─────────────────────────────────────────────
-- 2) ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

do $$
declare
  t text;
  tables text[] := array['content_posts', 'content_sources', 'content_metrics'];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "auth_all_%s" on public.%I;', t, t);
    execute format(
      'create policy "auth_all_%s" on public.%I for all to authenticated using (true) with check (true);',
      t, t
    );
  end loop;
end $$;

-- ─────────────────────────────────────────────
-- 3) REALTIME
-- ─────────────────────────────────────────────

do $$
begin
  begin alter publication supabase_realtime add table public.content_posts;      exception when others then null; end;
  begin alter publication supabase_realtime add table public.content_sources;    exception when others then null; end;
  begin alter publication supabase_realtime add table public.content_metrics;    exception when others then null; end;
end $$;
