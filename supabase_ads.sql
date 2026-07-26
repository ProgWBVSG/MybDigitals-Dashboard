-- Ejecutar UNA vez en Supabase → SQL Editor → New query → pegar → Run.
-- Agrega: (1) content_posts.kind (Orgánico/Anuncio) y (2) tabla content_ads
-- (seguimiento de campañas de Meta Ads: formato, configuración y resultados).

alter table content_posts add column if not exists kind text not null default 'organico';

create table if not exists content_ads (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references content_posts(id) on delete set null,
  format text not null default 'reel',
  objective text not null default '',
  status text not null default 'activo',
  budget numeric not null default 0,
  currency text not null default 'ARS',
  duration_days integer not null default 0,
  audience text not null default '',
  placement text not null default '',
  cta text not null default '',
  copy text not null default '',
  notes text not null default '',
  started_at bigint,
  ended_at bigint,
  spend numeric not null default 0,
  impressions integer not null default 0,
  reach integer not null default 0,
  results integer not null default 0,
  ctr numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table content_ads enable row level security;
alter table content_ads force row level security;
create policy myb_owner on content_ads for all to authenticated
  using ((auth.jwt()->>'email') = 'digitalmatiybenja@gmail.com')
  with check ((auth.jwt()->>'email') = 'digitalmatiybenja@gmail.com');
