-- Task 37 — FEATURE-DARK-MODE : préférence de thème par utilisateur
-- Ajoute l'enum ThemeMode (SYSTEM/LIGHT/DARK) et la colonne User.theme,
-- éditable via PATCH /api/auth/profile et appliquée par ThemeInit côté client.
-- Idempotent (guard duplicate_object / IF NOT EXISTS) pour re-exécution sûre.

DO $$ BEGIN
  CREATE TYPE "ThemeMode" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- NB : le modèle User est mappé sur la table `users` (@@map, snake_case).
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme "ThemeMode" NOT NULL DEFAULT 'SYSTEM';
