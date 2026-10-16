-- =============================================================================
-- Migration : création de la table « users »
-- -----------------------------------------------------------------------------
-- Un changement logique par fichier (bonne pratique Supabase).
-- =============================================================================

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PATIENT',
    "zone" "Zone" NOT NULL,
    "birthDate" TIMESTAMP(3),
    "appointmentReminders" BOOLEAN NOT NULL DEFAULT true,
    "healthAlerts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
