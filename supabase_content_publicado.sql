-- ═══════════════════════════════════════════════════════════════════
-- IG CONTENT — estado "Publicado" + link del reel subido
--
-- Cierra el circuito Pipeline → Métricas: al mover una pieza a "Publicado"
-- se sella la fecha de salida y se guarda el link del reel. La pestaña
-- Métricas la levanta como pendiente de cargar los números.
-- ═══════════════════════════════════════════════════════════════════

-- Cuándo salió (epoch ms) y dónde quedó subida.
alter table content_posts add column if not exists published_at bigint;
alter table content_posts add column if not exists post_url     text not null default '';

-- Las piezas que estaban en "listo" NO se migran a "publicado": no hay forma
-- de saber cuáles salieron de verdad. Se mueven a mano desde el Pipeline.

-- Para la cola de pendientes de Métricas (publicadas sin métricas cargadas).
create index if not exists content_posts_status_pub_idx
  on content_posts(status, published_at desc nulls last)
  where status = 'publicado';
