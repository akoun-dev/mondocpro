-- =============================================================================
-- Migration : création de la table « sensibilisations »
-- -----------------------------------------------------------------------------
-- Un changement logique par fichier (bonne pratique Supabase).
-- =============================================================================

CREATE TABLE "sensibilisations" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" TEXT NOT NULL,
    "category" "SensibilisationCategory" NOT NULL DEFAULT 'ADVICE',
    "zones" "Zone"[],
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sensibilisations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sensibilisations_publishedAt_idx" ON "sensibilisations"("publishedAt");
