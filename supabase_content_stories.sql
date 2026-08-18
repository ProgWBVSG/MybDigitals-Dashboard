-- ═══════════════════════════════════════════════════════════════════
-- IG CONTENT — secuencias de Historias
--
-- Una fila = una secuencia publicada (SE_0001, SE_0002…), no una historia
-- suelta. Lo que se mide es cuánta gente llegó del principio al final:
-- views_first vs views_last es la retención de la secuencia, que es la
-- métrica que dice si la secuencia aguantó o se cayó en el medio.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists content_stories (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid references content_accounts(id) on delete set null,
  published_at    bigint,
  code            text        not null default '',   -- SE_0001, SE_0002…
  kind            text        not null default '',   -- Personalidad, Nicho, Viaje + LM…
  has_cta         boolean     not null default false,
  story_count     integer     not null default 0,    -- cuántas historias tuvo
  views_first     integer     not null default 0,
  views_last      integer     not null default 0,
  has_lead_magnet boolean     not null default false,
  link            text        not null default '',
  replies         integer     not null default 0,
  votes           integer     not null default 0,
  notes           text        not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists content_stories_account_idx on content_stories(account_id);
create index if not exists content_stories_date_idx    on content_stories(published_at desc nulls last);

alter table content_stories enable row level security;

drop policy if exists "content_stories_all" on content_stories;
create policy "content_stories_all" on content_stories
  for all using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table content_stories;
exception when duplicate_object then null;
end $$;
