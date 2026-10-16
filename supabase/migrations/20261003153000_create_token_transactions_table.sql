-- =============================================================================
-- Migration : création de la table « token_transactions » (ADR-007 — Task 26)
-- -----------------------------------------------------------------------------
-- Un changement logique par fichier (bonne pratique Supabase). Nouvelle TABLE
-- (la règle ADR-003 concerne les colonnes des tables existantes) : fichier
-- dédié, appliqué via `prisma db execute` (cf. dérive enum préexistante qui
-- bloque `db push` — hors périmètre), puis `prisma generate`.
-- Portefeuille de Tokens (crédits prépayés) : ledger APPEND-ONLY — chaque
-- mouvement financier est une ligne immuable, le solde est TOUJOURS
-- recalculé. Seule mutation autorisée : le statut d'une recharge PENDING
-- (PENDING → CONFIRMED/REJECTED, garde updateMany anti double-crédit).
-- =============================================================================

CREATE TYPE "TokenTransactionType" AS ENUM
    ('RECHARGE', 'RESERVATION', 'CONSUMPTION', 'RELEASE', 'REFUND', 'ADJUSTMENT');

CREATE TYPE "TokenTransactionStatus" AS ENUM
    ('PENDING', 'CONFIRMED', 'REJECTED');

CREATE TABLE "token_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TokenTransactionType" NOT NULL,
    "status" "TokenTransactionStatus" NOT NULL DEFAULT 'CONFIRMED',
    -- Nombre de Tokens du mouvement (positif ; ADJUSTMENT peut être négatif).
    "tokens" INTEGER NOT NULL,
    -- Équivalent FCFA (recharges, consommations, remboursements).
    "amountFcfa" INTEGER,
    -- Référence prestataire de paiement (ADR-005 Mobile Money, décision ouverte).
    "providerRef" TEXT,
    -- RDV lié : SetNull — le ledger survit à une purge éventuelle du RDV.
    "appointmentId" TEXT,
    -- Réservation source d'une CONSUMPTION / RELEASE (chaînage auditable).
    "relatedTransactionId" TEXT,
    -- Note libre (motif de refus, libellé d'ajustement…).
    "note" VARCHAR(300),
    -- ADMIN ayant traité la recharge ou clôturé le RDV.
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

-- Historique du portefeuille : fil par user, plus récents d'abord.
CREATE INDEX "token_transactions_userId_createdAt_idx"
    ON "token_transactions"("userId", "createdAt");

-- Calcul du solde / recharges en attente (agrégats par type et statut).
CREATE INDEX "token_transactions_userId_type_status_idx"
    ON "token_transactions"("userId", "type", "status");

-- Mouvements d'un RDV (réservation, consommation, libération).
CREATE INDEX "token_transactions_appointmentId_idx"
    ON "token_transactions"("appointmentId");
