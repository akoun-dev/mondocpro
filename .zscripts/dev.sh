#!/bin/bash
# Flux de démarrage custom (exécuté par /start.sh de la plateforme au boot conteneur).
# Corrige deux pièges plateforme :
#  1) /start.sh écrase .env avec DATABASE_URL=file:... (héritage scaffold SQLite)
#     → on restaure l'env Supabase depuis .zscripts/.env.supabase (non versionné, .gitignore: .env*)
#  2) l'environnement shell peut primer sur .env pour Prisma
#     → les scripts db:* de package.json réexportent DATABASE_URL depuis .env
set -e
cd /home/z/my-project
cat .zscripts/.env.supabase > .env
chown z:z .env 2>/dev/null || true
echo "[dev.sh] .env restauré (Supabase PostgreSQL, pooler Supavisor — ADR-003)"
# Piège 2 (corrigé à la racine — cf. Task 5/7) : l'export shell plateforme
# DATABASE_URL=file:... PRIME sur .env (dotenv ne surcharge jamais l'env existant).
# → on exporte explicitement la valeur du .env pour le process Next.js.
export DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')
if [ -n "$DATABASE_URL" ]; then
  echo "[dev.sh] DATABASE_URL exportée depuis .env (postgresql://…pooler.supabase.com)"
  bun install
  bun run db:push
else
  echo "[dev.sh] ⚠️ DATABASE_URL absente de .env — db:push ignoré, le serveur démarre sans base de données"
  bun install
fi
echo "[dev.sh] Démarrage du serveur Next.js..."
exec bun run dev
