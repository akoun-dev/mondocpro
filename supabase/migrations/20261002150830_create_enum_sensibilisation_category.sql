-- =============================================================================
-- Migration : création de l'enum « SensibilisationCategory »
-- -----------------------------------------------------------------------------
-- Catégories de sensibilisations santé.
-- Miroir : prisma/schema.prisma → enum SensibilisationCategory (FEATURE-SENSO).
-- =============================================================================

create type public."SensibilisationCategory" as enum ('ADVICE', 'ALERT');
