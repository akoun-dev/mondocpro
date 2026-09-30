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
bun install
bun run db:push
echo "[dev.sh] Démarrage du serveur Next.js..."
exec bun run dev
