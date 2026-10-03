-- =============================================================================
-- Migration : création de l'enum « SensibilisationCategory »
-- -----------------------------------------------------------------------------
-- Un changement logique par fichier (bonne pratique Supabase).
-- =============================================================================

CREATE TYPE "SensibilisationCategory" AS ENUM ('ADVICE', 'ALERT');
