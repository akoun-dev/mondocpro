-- =============================================================================
-- Migration : création de la table « appointments »
-- -----------------------------------------------------------------------------
-- Un changement logique par fichier (bonne pratique Supabase).
-- =============================================================================

-- Cycle de vie des Tokens d'un RDV (ADR-007 — FEATURE-TOKENS) : type intégré
-- ici (ADR-003 : pas de migration add_* pré-PROD).
DO $$ BEGIN
    CREATE TYPE "AppointmentTokenState" AS ENUM
        ('NONE', 'RESERVED', 'CONSUMED', 'RELEASED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "specialtyId" TEXT,
    "type" "AppointmentType" NOT NULL,
    "zone" "Zone" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "reason" VARCHAR(500),
    "notes" VARCHAR(1000),
    "cancelledAt" TIMESTAMP(3),
    -- Rappel 24 h déjà envoyé (anti-doublon du scheduler — FEATURE-RDV) ;
    -- colonne intégrée ici (ADR-003 : pas de migration add_* pré-PROD).
    "reminderSentAt" TIMESTAMP(3),
    -- FEATURE-TOKENS (ADR-007) : état de la réservation de Tokens + volume
    -- bloqué à la création (colonnes intégrées ici — règle ADR-003).
    "tokenState" "AppointmentTokenState" NOT NULL DEFAULT 'NONE',
    "tokensReserved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "appointments_patientId_fkey"
        FOREIGN KEY ("patientId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "appointments_specialtyId_fkey"
        FOREIGN KEY ("specialtyId") REFERENCES "specialties"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "appointments_patientId_idx" ON "appointments"("patientId");
CREATE INDEX "appointments_scheduledAt_idx" ON "appointments"("scheduledAt");
CREATE INDEX "appointments_specialtyId_idx" ON "appointments"("specialtyId");
