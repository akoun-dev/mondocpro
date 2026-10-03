-- =============================================================================
-- Migration : création de la table « sensibilisations »
-- -----------------------------------------------------------------------------
-- Sensibilisations santé avec zones ciblées (tableau d'enums).
-- Miroir : prisma/schema.prisma → model Sensibilisation (FEATURE-SENSO).
-- =============================================================================

create table if not exists public."sensibilisations" (
  "id" text not null,
  "title" varchar(120) not null,
  "body" text not null,
  "category" public."SensibilisationCategory" not null default 'ADVICE',
  "zones" public."Zone"[],
  "publishedAt" timestamp(3) not null default current_timestamp,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null,

  constraint "sensibilisations_pkey" primary key ("id")
);

create index if not exists "sensibilisations_publishedAt_idx" on public."sensibilisations" ("publishedAt");
