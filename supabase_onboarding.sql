-- ============================================================
-- MYB Digitals Dashboard — Onboarding + Seguridad (RLS)
-- Correr en Supabase → SQL Editor.
--
-- ORDEN RECOMENDADO:
--   1) Crear los usuarios (vos + socio) en Authentication → Users.
--   2) Tener desplegado el login en el dashboard (Login.tsx).
--   3) Recién entonces correr este script (al activar RLS, la app
--      deja de funcionar sin sesión iniciada — es lo esperado).
-- ============================================================

-- ─────────────────────────────────────────────
-- 1) TABLAS DE ONBOARDING
-- ─────────────────────────────────────────────

create table if not exists public.onboardings (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid references public.clients(id) on delete cascade,
  service_type    text not null default 'landing',
  title           text not null default '',
  status          text not null default 'active',   -- active | paused | launched | archived
  current_phase   int  not null default 0,
  drive_root_link text not null default '',
  whatsapp_link   text not null default '',
  domain          text not null default '',
  started_at      bigint,
  launched_at     bigint,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.onboarding_steps (
  id            uuid primary key default gen_random_uuid(),
  onboarding_id uuid references public.onboardings(id) on delete cascade,
  phase         int  not null default 0,
  phase_name    text not null default '',
  title         text not null default '',
  description   text not null default '',
  owner         text not null default 'myb',     -- myb | client | both
  assigned_to   text not null default '',
  status        text not null default 'pending', -- pending | in_progress | done | blocked | skipped
  is_optional   boolean not null default false,
  link          text not null default '',
  due_date      bigint,
  "order"       int  not null default 0,
  completed_at  bigint
);

create table if not exists public.onboarding_payments (
  id            uuid primary key default gen_random_uuid(),
  onboarding_id uuid references public.onboardings(id) on delete cascade,
  label         text not null default '',
  amount        numeric not null default 0,
  currency      text not null default 'ARS',     -- ARS | USD
  percentage    int  not null default 0,
  paid          boolean not null default false,
  paid_at       bigint
);

create table if not exists public.onboarding_documents (
  id            uuid primary key default gen_random_uuid(),
  onboarding_id uuid references public.onboardings(id) on delete cascade,
  doc_type      text not null default '',
  title         text not null default '',
  content       text not null default '',
  external_link text not null default '',
  status        text not null default 'pending', -- pending | in_progress | done
  updated_at    timestamptz not null default now()
);

-- Índices para acelerar la carga por onboarding
create index if not exists idx_steps_onboarding    on public.onboarding_steps(onboarding_id);
create index if not exists idx_payments_onboarding  on public.onboarding_payments(onboarding_id);
create index if not exists idx_documents_onboarding on public.onboarding_documents(onboarding_id);
create index if not exists idx_onboardings_client   on public.onboardings(client_id);

-- ─────────────────────────────────────────────
-- 2) ROW LEVEL SECURITY
-- Política simple: solo usuarios autenticados pueden leer/escribir.
-- (Más adelante se puede afinar por usuario/rol.)
-- ─────────────────────────────────────────────

do $$
declare
  t text;
  tables text[] := array[
    -- nuevas
    'onboardings','onboarding_steps','onboarding_payments','onboarding_documents',
    -- existentes
    'skills','boards','tasks','calendar_events',
    'clients','client_projects','client_notes','expenses','goals'
  ];
begin
  foreach t in array tables loop
    -- Activar RLS
    execute format('alter table public.%I enable row level security;', t);
    -- Borrar política previa si existe (idempotente)
    execute format('drop policy if exists "auth_all_%s" on public.%I;', t, t);
    -- Permitir todo a usuarios autenticados
    execute format(
      'create policy "auth_all_%s" on public.%I for all to authenticated using (true) with check (true);',
      t, t
    );
  end loop;
end $$;

-- ─────────────────────────────────────────────
-- 3) REALTIME
-- Asegurar que las tablas nuevas emitan cambios en tiempo real.
-- Cada add va en su propio bloque tolerante: si ya está agregada
-- (o la publicación es FOR ALL TABLES), se ignora sin abortar el script.
-- ─────────────────────────────────────────────

do $$
begin
  begin alter publication supabase_realtime add table public.onboardings;          exception when others then null; end;
  begin alter publication supabase_realtime add table public.onboarding_steps;      exception when others then null; end;
  begin alter publication supabase_realtime add table public.onboarding_payments;   exception when others then null; end;
  begin alter publication supabase_realtime add table public.onboarding_documents;  exception when others then null; end;
end $$;
