-- =============================================================================
-- Migration : création de l'enum « Role » (rôles applicatifs)
-- -----------------------------------------------------------------------------
-- Bonne pratique Supabase (docs « Managing Enums » / « Database Migrations ») :
--   • une migration = UN changement → une enum par fichier ;
--   • les enums sont créées AVANT les tables qui les référencent ;
--   • ajouter une valeur = nouvelle migration `alter type … add value ;`
--     (supprimer une valeur est IMPOSSIBLE sans risque — ne jamais le faire).
-- Miroir : prisma/schema.prisma → enum Role (ADR-004 · SYS-010).
-- =============================================================================

create type public."Role" as enum (
  'PATIENT',
  'NURSE',
  'ADMIN'
);
