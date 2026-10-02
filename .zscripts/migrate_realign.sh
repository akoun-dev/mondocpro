#!/usr/bin/env bash
# =============================================================================
# Réalignement one-shot de l'historique des migrations Supabase (OPS-T06)
# -----------------------------------------------------------------------------
# Contexte : la baseline unique « 20260930153154_init » (marquée appliquée via
# `migration repair` lors d'OPS-T05) a été remplacée par 4 migrations
# unitaires « une entité par fichier » (docs officielles Supabase) :
#   20261002150808  create_enum_role
#   20261002150810  create_enum_zone
#   20261002150812  create_users_table
#   20261002150814  create_sessions_table
#
# Le schéma distant est IDENTIQUE (aucun DDL n'est ré-exécuté) : seul le
# registre `supabase_migrations.schema_migrations` est réaligné :
#   1. la baseline 20260930153154 est retirée de l'historique (reverted) ;
#   2. les 4 migrations unitaires sont marquées « applied » sans exécution ;
#   3. `db push` vérifie que local = distant (aucune migration à appliquer).
#
# Docs : https://supabase.com/docs/guides/deployment/database-migrations
#        (§ Diagnosing and fixing sync errors → supabase migration repair)
#
# Usage : bun run db:migrate:sync   (idempotent — relançable sans risque)
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

# Même blindage que les scripts db:* de package.json : l'export shell plateforme
# (DATABASE_URL=file:…) prime sur .env → on réexporte depuis .env (ADR-003 §4).
DATABASE_URL_VALUE="$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '\"' || true)"
if [ -z "$DATABASE_URL_VALUE" ]; then
  echo "[realign] ❌ DATABASE_URL absente de .env — configurer Supabase d'abord (cf. .env.example)"
  exit 1
fi
export DATABASE_URL="$DATABASE_URL_VALUE"

BASELINE="20260930153154"
UNIT_MIGRATIONS=(
  "20261002150808" # create_enum_role
  "20261002150810" # create_enum_zone
  "20261002150812" # create_users_table
  "20261002150814" # create_sessions_table
)

echo "[realign] 1/4 — retrait de l'ancienne baseline $BASELINE de l'historique distant"
supabase migration repair --status reverted "$BASELINE" --db-url "$DATABASE_URL" \
  || echo "[realign]    (baseline déjà retirée — ignoré)"

echo "[realign] 2/4 — marquage « applied » des migrations unitaires (sans exécution SQL)"
for ts in "${UNIT_MIGRATIONS[@]}"; do
  supabase migration repair --status applied "$ts" --db-url "$DATABASE_URL" \
    || echo "[realign]    ($ts déjà marquée — ignoré)"
done

echo "[realign] 3/4 — vérification db push (aucune migration ne doit s'appliquer)"
supabase db push --db-url "$DATABASE_URL"

echo "[realign] 4/4 — état final local ↔ distant"
supabase migration list --db-url "$DATABASE_URL"

echo "[realign] ✅ Historique aligné avec supabase/migrations/ — workflow normal : bun run db:migrate"
