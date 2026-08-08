-- ═══════════════════════════════════════════════════════════════════
-- IG CONTENT — múltiples cuentas de Instagram
--
-- Separa el contenido por cuenta (la de la agencia, la personal, las de
-- clientes) para que no se mezclen guiones, métricas ni referentes.
--
-- Las filas que ya existían quedan con account_id en null a propósito: el
-- dashboard avisa cuántas hay sueltas y deja adoptarlas a la cuenta elegida,
-- así la asignación la decide el usuario y no la adivina la migración.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Tabla de cuentas ───
create table if not exists content_accounts (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references clients(id) on delete set null,
  name       text        not null default '',
  handle     text        not null default '',
  niche      text        not null default '',
  color      text        not null default '#f9587a',
  notes      text        not null default '',
  archived   boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_accounts_client_idx on content_accounts(client_id);

-- ─── 2. account_id en las 4 tablas de contenido ───
-- on delete set null: borrar una cuenta NO borra su contenido, queda suelto
-- y se puede reasignar desde el aviso del dashboard.
alter table content_posts   add column if not exists account_id uuid references content_accounts(id) on delete set null;
alter table content_metrics add column if not exists account_id uuid references content_accounts(id) on delete set null;
alter table content_refs    add column if not exists account_id uuid references content_accounts(id) on delete set null;
alter table content_ads     add column if not exists account_id uuid references content_accounts(id) on delete set null;

create index if not exists content_posts_account_idx   on content_posts(account_id);
create index if not exists content_metrics_account_idx on content_metrics(account_id);
create index if not exists content_refs_account_idx    on content_refs(account_id);
create index if not exists content_ads_account_idx     on content_ads(account_id);

-- ─── 3. RLS ───
alter table content_accounts enable row level security;

drop policy if exists "content_accounts_all" on content_accounts;
create policy "content_accounts_all" on content_accounts
  for all using (true) with check (true);

-- ─── 4. Realtime ───
do $$
begin
  alter publication supabase_realtime add table content_accounts;
exception when duplicate_object then null;
end $$;
