-- =============================================================================
-- Migration : création de l'enum « AppointmentStatus »
-- -----------------------------------------------------------------------------
-- Un changement logique par fichier (bonne pratique Supabase).
-- =============================================================================

CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'DONE');
