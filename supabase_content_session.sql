-- ═══════════════════════════════════════════════════════════════════
-- IG CONTENT — agenda de producción por pieza
--
-- Tres fechas distintas sobre la misma pieza: cuándo se graba, cuándo se
-- edita y cuándo se publica (scheduled_for, que ya existía). El trabajo se
-- reparte en días distintos, así que no alcanzaba con una sola.
-- ═══════════════════════════════════════════════════════════════════

alter table content_posts add column if not exists record_at bigint;
alter table content_posts add column if not exists edit_at   bigint;

create index if not exists content_posts_record_idx on content_posts(record_at)
  where record_at is not null;
create index if not exists content_posts_edit_idx on content_posts(edit_at)
  where edit_at is not null;
