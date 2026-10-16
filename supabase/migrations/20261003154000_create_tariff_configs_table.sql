-- =============================================================================
-- Migration : création de la table « tariff_configs » (FEATURE-TOKENS, ADR-007)
-- -----------------------------------------------------------------------------
-- Grille tarifaire CONFIGURABLE PAR LE MÉDECIN CHEF (demande PO 2026-10-03) :
-- les tarifs ne sont plus codés en dur (PROVISIONAL_TARIFFS) mais stockés en
-- base, une ligne par poste tarifaire (clé métier → prix en Tokens).
-- Design extensible : une future ligne (frais patient absent, majoration
-- nuit/week-end, frais de déplacement…) = un INSERT de clé, SANS migration.
--
-- Tarifs v1 (provisionnels ADR-007 — exemple du document de présentation) :
--   CONSULTATION_CABINET  = 1 Token
--   CONSULTATION_DOMICILE = 1 Token
-- Le prix est FIGÉ à la création du RDV (appointments.tokensReserved) :
-- modifier un tarif n'affecte que les DEMANDES À VENIR, jamais les
-- réservations déjà engagées (invariant financier du ledger).
-- =============================================================================

CREATE TABLE "tariff_configs" (
    "id" TEXT NOT NULL,
    -- Clé métier stable (ex: CONSULTATION_CABINET) — consommée par le code
    -- (tariffKeyForType) et affichée avec un libellé FR dans l'admin.
    "key" TEXT NOT NULL,
    -- Prix en Tokens (entier ≥ 0 — 0 = consultation gratuite, choix ADMIN).
    -- Garde-fou applicatif : 0..100 Tokens (250 000 FCFA).
    "tokens" INTEGER NOT NULL,
    -- Traçabilité : dernier ADMIN ayant modifié le tarif (SetNull — la ligne
    -- de tarif survit à une suppression éventuelle du compte).
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tariff_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tariff_configs_updatedById_fkey"
        FOREIGN KEY ("updatedById") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- Clé métier unique : une seule ligne par poste tarifaire.
CREATE UNIQUE INDEX "tariff_configs_key_key" ON "tariff_configs"("key");

-- Audit : qui a fixé le tarif en vigueur.
CREATE INDEX "tariff_configs_updatedById_idx" ON "tariff_configs"("updatedById");

-- Seeds des tarifs v1 (idempotent — un reprovision plateforme + re-run du
-- pré-flight E2E rétablit exactement ces valeurs par défaut).
INSERT INTO "tariff_configs" ("id", "key", "tokens", "createdAt", "updatedAt")
VALUES
    (gen_random_uuid()::text, 'CONSULTATION_CABINET', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'CONSULTATION_DOMICILE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
