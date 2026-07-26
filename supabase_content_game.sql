-- Ejecutar UNA vez en Supabase → SQL Editor → New query → pegar → Run.
-- Agrega el campo "juego de contenido" (framework de los 5 juegos de Kallaway) a clientes.

alter table clients add column if not exists content_game text not null default '';
