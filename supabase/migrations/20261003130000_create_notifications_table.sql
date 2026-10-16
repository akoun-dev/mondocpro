-- =============================================================================
-- Migration : création de la table « notifications » (Task 24 — InApp)
-- -----------------------------------------------------------------------------
-- Un changement logique par fichier (bonne pratique Supabase). Nouvelle TABLE
-- (la règle ADR-003 concerne les colonnes des tables existantes) : fichier
-- dédié, appliqué via `prisma db execute` (cf. dérive enum préexistante qui
-- bloque `db push` — hors périmètre), puis `prisma generate`.
-- Premier producteur : scheduler des rappels de RDV (src/lib/reminders.ts) —
-- canal InApp actif dès aujourd'hui, SMS en attente de la décision A10.
-- =============================================================================

CREATE TYPE "NotificationType" AS ENUM ('APPOINTMENT_REMINDER');

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    -- Entité source optionnelle (ex: appointmentId) : anti-doublon structurel
    -- + contexte de navigation. NB Postgres : NULL distincts dans un index
    -- unique → dédoublonnage effectif pour les types portant une entityId.
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notifications_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- Anti-doublon structurel : un même RDV ne produit jamais 2 rappels InApp
-- (même en cas de retentement SMS après échec).
CREATE UNIQUE INDEX "notifications_userId_type_entityId_key"
    ON "notifications"("userId", "type", "entityId");

-- Liste du centre de notifications : fil par user, plus récents d'abord.
CREATE INDEX "notifications_userId_createdAt_idx"
    ON "notifications"("userId", "createdAt");
