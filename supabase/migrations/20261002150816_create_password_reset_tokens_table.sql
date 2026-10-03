-- =============================================================================
-- Migration : création de la table « password_reset_tokens »
-- -----------------------------------------------------------------------------
-- Jetons de réinitialisation de mot de passe : token hashé SHA-256,
-- expiration 15 min, usage unique (usedAt), suppression en cascade avec
-- l'utilisateur.
-- Miroir : prisma/schema.prisma → model PasswordResetToken (FEATURE-AUTH).
-- =============================================================================

create table if not exists public."password_reset_tokens" (
  "id" text not null,
  "userId" text not null,
  "tokenHash" text not null,
  "expiresAt" timestamp(3) not null,
  "usedAt" timestamp(3),
  "createdAt" timestamp(3) not null default current_timestamp,

  constraint "password_reset_tokens_pkey" primary key ("id"),
  constraint "password_reset_tokens_userId_fkey"
    foreign key ("userId") references public."users" ("id")
    on delete cascade on update cascade
);

create unique index if not exists "password_reset_tokens_tokenHash_key"
  on public."password_reset_tokens" ("tokenHash");

create index if not exists "password_reset_tokens_userId_idx"
  on public."password_reset_tokens" ("userId");
