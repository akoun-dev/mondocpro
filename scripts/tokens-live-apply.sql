-- Application live FEATURE-TOKENS (ADR-007) — idempotent, même contenu que
-- les fichiers de migration (appointments enrichie + token_transactions).
-- NB : `db push` est bloqué par la dérive enum SensibilisationCategory
-- préexistante (hors périmètre) → application directe, comme Tasks 23/24.

-- 1) Type AppointmentTokenState (idempotent)
DO $$ BEGIN
    CREATE TYPE "AppointmentTokenState" AS ENUM
        ('NONE', 'RESERVED', 'CONSUMED', 'RELEASED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2) Colonnes appointments (règle ADR-003 : intégrées aussi dans la migration
--    de création 20261002232748 — ici : ajout live idempotent)
ALTER TABLE "appointments"
    ADD COLUMN IF NOT EXISTS "tokenState" "AppointmentTokenState" NOT NULL DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS "tokensReserved" INTEGER NOT NULL DEFAULT 0;

-- 3) Types du ledger
DO $$ BEGIN
    CREATE TYPE "TokenTransactionType" AS ENUM
        ('RECHARGE', 'RESERVATION', 'CONSUMPTION', 'RELEASE', 'REFUND', 'ADJUSTMENT');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "TokenTransactionStatus" AS ENUM
        ('PENDING', 'CONFIRMED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 4) Table ledger (append-only ; solde toujours recalculé)
CREATE TABLE IF NOT EXISTS "token_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TokenTransactionType" NOT NULL,
    "status" "TokenTransactionStatus" NOT NULL DEFAULT 'CONFIRMED',
    "tokens" INTEGER NOT NULL,
    "amountFcfa" INTEGER,
    "providerRef" TEXT,
    "appointmentId" TEXT,
    "relatedTransactionId" TEXT,
    "note" VARCHAR(300),
    "processedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "token_transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "token_transactions_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "token_transactions_appointmentId_fkey"
        FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "token_transactions_userId_createdAt_idx"
    ON "token_transactions"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "token_transactions_userId_type_status_idx"
    ON "token_transactions"("userId", "type", "status");
CREATE INDEX IF NOT EXISTS "token_transactions_appointmentId_idx"
    ON "token_transactions"("appointmentId");
