-- =============================================================================
-- Migration : création de la table « specialties »
-- -----------------------------------------------------------------------------
-- Catalogue des spécialités de consultation (configurables ADMIN).
-- Miroir : prisma/schema.prisma → model Specialty (FEATURE-RDV).
-- =============================================================================

create table if not exists public."specialties" (
  "id" text not null,
  "name" varchar(80) not null,
  "isActive" boolean not null default true,
  "sortOrder" integer not null default 0,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null,

  constraint "specialties_pkey" primary key ("id")
);

create unique index if not exists "specialties_name_key" on public."specialties" ("name");
