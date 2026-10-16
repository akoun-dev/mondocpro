-- =============================================================================
-- Migration : création de l'enum « AppointmentType »
-- -----------------------------------------------------------------------------
-- Un changement logique par fichier (bonne pratique Supabase).
-- =============================================================================

CREATE TYPE "AppointmentType" AS ENUM ('CABINET', 'DOMICILE');
