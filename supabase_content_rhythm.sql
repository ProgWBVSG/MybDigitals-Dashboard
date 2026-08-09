-- ═══════════════════════════════════════════════════════════════════
-- IG CONTENT — ritmo de producción por cuenta
--
-- Qué se hace cada día de la semana (publicar / grabar / buscar contenido).
-- Índice 0 = lunes. Un día puede tener más de un rol.
-- ═══════════════════════════════════════════════════════════════════

alter table content_accounts
  add column if not exists rhythm jsonb not null
  default '{"0":["publicar"],"1":["buscar"],"2":["publicar"],"3":[],"4":["publicar"],"5":[],"6":["grabar","buscar"]}'::jsonb;

-- Las cuentas que ya existían toman el ritmo por defecto (3 salidas semanales,
-- tanda de grabación el domingo, un día fijo para juntar referencias).
update content_accounts
set rhythm = '{"0":["publicar"],"1":["buscar"],"2":["publicar"],"3":[],"4":["publicar"],"5":[],"6":["grabar","buscar"]}'::jsonb
where rhythm is null or rhythm = '{}'::jsonb;
