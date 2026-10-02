-- =============================================================================
-- Migration : création de l'enum « Zone » (zones de couverture)
-- -----------------------------------------------------------------------------
-- Liste fermée définie par le PO (cahier des charges v3.0 — SPEC-PRODUCT) :
-- Yopougon · Songon · PK22 · N'Dotré.
-- Bonne pratique Supabase (docs « Managing Enums ») : une enum par fichier ;
-- toute nouvelle zone passe par une migration dédiée `alter type … add value`.
-- Miroir : prisma/schema.prisma → enum Zone.
-- =============================================================================

create type public."Zone" as enum (
  'YOPOUGON',
  'SONGON',
  'PK22',
  'NDOTRE'
);
