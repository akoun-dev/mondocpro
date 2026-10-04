#!/bin/bash
# Flux de démarrage custom (exécuté par /start.sh de la plateforme au boot conteneur).
# Corrige trois pièges plateforme :
#  1) /start.sh écrase .env avec DATABASE_URL=file:... (héritage scaffold SQLite)
#     → on restaure l'env Supabase depuis .zscripts/.env.supabase (non versionné, .gitignore: .env*)
#  2) l'environnement shell peut primer sur .env (piège 2)
#     → DATABASE_URL est explicitement réexportée depuis .env pour le process Next.js
#  3) SYS-010 : les rebuilds conteneur restaurent UNIQUEMENT les fichiers versionnés
#     (git) → .zscripts/.env.supabase disparaît et le boot échouait sur `cat` (set -e).
#     → auto-réparation : reconstruction via scripts/find-pooler-region.mjs
#       (redécouvre la région du pooler par auth Prisma réelle — la flotte
#       Supabase peut migrer, aws-1 → aws-0 constaté le 2026-10-03).
set -e
cd /home/z/my-project

# Dépendances d'abord (le fallback SYS-010 a besoin de bun/bunx prisma).
bun install

# Piège 1 : restauration de l'env Supabase (+ auto-réparation si perdue).
if [ ! -s .zscripts/.env.supabase ]; then
  echo "[dev.sh] ⚠️  .zscripts/.env.supabase absent (rebuild conteneur ?) — auto-réparation SYS-010…"
  bun scripts/find-pooler-region.mjs --write-env || echo "[dev.sh] ⚠️ auto-réparation échouée (voir logs ci-dessus)"
fi
if [ -s .zscripts/.env.supabase ]; then
  cat .zscripts/.env.supabase > .env
  chown z:z .env 2>/dev/null || true
  echo "[dev.sh] .env restauré (Supabase PostgreSQL, pooler Supavisor — ADR-003)"
else
  echo "[dev.sh] ⚠️ aucune DATABASE_URL disponible — le serveur démarre sans base de données"
  : > .env
fi

# Piège 2 (corrigé à la racine — cf. Task 5/7) : l'export shell plateforme
# DATABASE_URL=file:... PRIME sur .env (dotenv ne surcharge jamais l'env existant).
# → on exporte explicitement la valeur du .env pour le process Next.js.
export DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')
if [ -n "$DATABASE_URL" ]; then
  echo "[dev.sh] DATABASE_URL exportée depuis .env (postgresql://…pooler.supabase.com)"
  # SYS-009 : schéma piloté par les migrations versionnées Supabase
  # (supabase/migrations — source unique, cf. ADR-003).
  # Le mode --linked passe par l'API Management (token + état de lien
  # supabase/.temp — tous deux perdus lors d'un rebuild/reboot conteneur,
  # incident 2026-10-03 : « Cannot find project ref »)
  # → fallback direct sur la base : mêmes migrations versionnées, sans token.
  # Dernier recours non fatal : la base est déjà migrée, le serveur doit
  # toujours démarrer (même philosophie que le else ci-dessous).
  if ! npx supabase db push --linked; then
    echo "[dev.sh] ⚠️ db push --linked indisponible (lien/token absent) — bascule --db-url directe"
    npx supabase db push --db-url "$DATABASE_URL" \
      || echo "[dev.sh] ⚠️ migrations non appliquées via --db-url (base déjà à jour ?) — démarrage quand même"
  fi
else
  echo "[dev.sh] ⚠️ DATABASE_URL absente de .env — migrations ignorées, le serveur démarre sans base de données"
fi

echo "[dev.sh] Démarrage du serveur Next.js..."
exec bun run dev
