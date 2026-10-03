-- =============================================================================
-- Migration : création de la table « appointments »
-- -----------------------------------------------------------------------------
-- Un changement logique par fichier (bonne pratique Supabase).
-- =============================================================================

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
