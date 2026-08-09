-- ═══════════════════════════════════════════════════════════════════
-- IG CONTENT — sincronización automática de métricas con Instagram
--
-- Las credenciales van en una tabla APARTE sin acceso desde el navegador:
-- el token de Instagram no tiene por qué llegar nunca al cliente. Solo la
-- Edge Function (service key) lo lee; el dashboard únicamente ve si la cuenta
-- está conectada o no.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Datos NO sensibles de la conexión (el dashboard sí los ve) ───
alter table content_accounts add column if not exists ig_user_id      text;
alter table content_accounts add column if not exists ig_connected_at bigint;
alter table content_accounts add column if not exists ig_synced_at    bigint;

-- ─── 2. Credenciales: solo service_role ───
create table if not exists content_account_secrets (
  account_id uuid primary key references content_accounts(id) on delete cascade,
  ig_token   text        not null,
  expires_at bigint,
  updated_at timestamptz not null default now()
);

alter table content_account_secrets enable row level security;

-- Sin policies para authenticated/anon: nadie con la anon key puede leer ni
-- escribir esta tabla. service_role la bypassa por diseño (es lo que usa la
-- Edge Function). Si más adelante hace falta escribir el token desde el
-- dashboard, se hace vía una Edge Function, no relajando esto.
drop policy if exists "secrets_no_client" on content_account_secrets;

-- ─── 3. Dedupe de sincronizaciones ───
-- media_id es el id del reel en Instagram: con esto una re-sincronización
-- ACTUALIZA la fila en vez de crear una nueva cada vez que se toca el botón.
alter table content_metrics add column if not exists media_id  text;
alter table content_metrics add column if not exists synced_at bigint;
alter table content_metrics add column if not exists source    text not null default 'manual';

create unique index if not exists content_metrics_media_uniq
  on content_metrics(account_id, media_id)
  where media_id is not null;

-- ─── 4. Permalink normalizado para matchear pieza ↔ reel ───
-- El shortcode del link (instagram.com/reel/ABC123 → ABC123) es la llave que
-- une la pieza del Pipeline con el reel real. Se calcula en la app, acá solo
-- se indexa para poder buscar por él.
create index if not exists content_posts_url_idx on content_posts(post_url)
  where post_url <> '';
