-- =============================================================================
-- Migration : création de la table « users »
-- -----------------------------------------------------------------------------
-- Identifiant métier = téléphone unique ; mot de passe bcrypt ; rôle + zone
-- typés par les enums créées dans les migrations précédentes.
-- Miroir : prisma/schema.prisma → model User (FEATURE-AUTH · ADR-004).
-- =============================================================================

create table if not exists public."users" (
  "id" text not null,
  "fullName" text not null,
  "phone" text not null,
  "passwordHash" text not null,
  "role" public."Role" not null default 'PATIENT',
  "zone" public."Zone" not null,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null,

  constraint "users_pkey" primary key ("id")
);

create unique index if not exists "users_phone_key" on public."users" ("phone");
