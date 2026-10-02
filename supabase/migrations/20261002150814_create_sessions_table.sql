-- =============================================================================
-- Migration : création de la table « sessions »
-- -----------------------------------------------------------------------------
-- Sessions serveur en DB (traçabilité médicale exigée) : token hashé SHA-256,
-- expiration 30 jours, suppression en cascade avec l'utilisateur.
-- Miroir : prisma/schema.prisma → model Session (FEATURE-AUTH · ADR-004).
-- =============================================================================

create table if not exists public."sessions" (
  "id" text not null,
  "tokenHash" text not null,
  "userId" text not null,
  "expiresAt" timestamp(3) not null,
  "createdAt" timestamp(3) not null default current_timestamp,

  constraint "sessions_pkey" primary key ("id")
);

create unique index if not exists "sessions_tokenHash_key" on public."sessions" ("tokenHash");

create index if not exists "sessions_userId_idx" on public."sessions" ("userId");

alter table public."sessions"
  add constraint "sessions_userId_fkey"
  foreign key ("userId") references public."users" ("id")
  on delete cascade on update cascade;
