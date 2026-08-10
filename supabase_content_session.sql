-- ═══════════════════════════════════════════════════════════════════
-- IG CONTENT — selección de piezas para la sesión de grabación/edición
--
-- Permite curar 5 piezas de entre 20 pendientes: las marcadas aparecen
-- primero en Producción y son las que el calendario muestra el día de grabar.
-- ═══════════════════════════════════════════════════════════════════

alter table content_posts add column if not exists in_session boolean not null default false;

-- Para levantar la sesión sin escanear toda la tabla.
create index if not exists content_posts_session_idx on content_posts(account_id)
  where in_session;
