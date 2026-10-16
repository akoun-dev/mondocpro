-- Application live FEATURE-TOKENS « tarifs configurables » (Task 28) —
-- idempotent, même contenu que la migration
-- 20261003154000_create_tariff_configs_table.sql.
-- NB : application directe via `prisma db execute` (même approche que
-- Tasks 23/24/27) ; le pré-flight E2E rejoue ce fichier à chaque run
-- (auto-réparation après un reprovision plateforme).

-- 1) Table de configuration des tarifs (une ligne par poste tarifaire)
CREATE TABLE IF NOT EXISTS "tariff_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tariff_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tariff_configs_updatedById_fkey"
        FOREIGN KEY ("updatedById") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "tariff_configs_key_key"
    ON "tariff_configs"("key");
CREATE INDEX IF NOT EXISTS "tariff_configs_updatedById_idx"
    ON "tariff_configs"("updatedById");

-- 2) Seeds des tarifs v1 (provisionnels ADR-007 : 1 Token par consultation)
INSERT INTO "tariff_configs" ("id", "key", "tokens", "createdAt", "updatedAt")
VALUES
    (gen_random_uuid()::text, 'CONSULTATION_CABINET', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'CONSULTATION_DOMICILE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
