#!/usr/bin/env bash
# =============================================================================
# Réalignement de l'historique des migrations Supabase (OPS-T06)
# -----------------------------------------------------------------------------
# Cas d'usage : le registre `supabase_migrations.schema_migrations` désynchronisé
# du dossier `supabase/migrations/` (baseline remplacée, migrations manquantes ou
# fantômes après une opération d'infrastructure — cf. INC-001).
#
# Le script marque des migrations « applied » SANS exécuter leur SQL. Il ne
# corrige donc QUE l'historique, jamais le schéma : ne l'utiliser que si le DDL
# est réellement présent en base (vérifier avec `bun scripts/inspect-schema.ts`).
#
# Docs : https://supabase.com/docs/guides/deployment/database-migrations
#        (§ Diagnosing and fixing sync errors → supabase migration repair)
#
# Usage :
#   bash .zscripts/migrate_realign.sh --baseline <version> [--mark-applied <v1> <v2> …]
#   bash .zscripts/migrate_realign.sh --list
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

BASELINE=""
MARK_APPLIED=()
ACTION=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --baseline)      BASELINE="${2:-}"; shift 2 ;;
    --mark-applied)  shift; while [ "$#" -gt 0 ] && [[ "$1" != --* ]]; do MARK_APPLIED+=("$1"); shift; done ;;
    --list)          ACTION="list"; shift ;;
    *) echo "[realign] option inconnue : $1" >&2; exit 2 ;;
  esac
done

if [ "$ACTION" = "list" ]; then
  echo "[realign] migrations locales (supabase/migrations/) :"
  ls -1 supabase/migrations/*.sql 2>/dev/null \
    | sed -E 's#.*/([0-9]+)_(.*)\.sql#  \1  \2#' \
    || echo "  (aucune)"
  exit 0
fi

if [ -z "$BASELINE" ] && [ "${#MARK_APPLIED[@]}" -eq 0 ]; then
  echo "[realign]usage : --baseline <version> | --mark-applied <version…> | --list" >&2
  echo "[realign] ex.  : bash .zscripts/migrate_realign.sh --mark-applied \$(ls supabase/migrations | head -1 | cut -d_ -f1)" >&2
  exit 2
fi

# L'export shell plateforme (DATABASE_URL=file:…) prime sur .env → on réexporte
# explicitement depuis .env avant tout appel CLI (ADR-003 §4).
DATABASE_URL_VALUE="$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '\"' || true)"
if [ -z "$DATABASE_URL_VALUE" ]; then
  echo "[realign] ❌ DATABASE_URL absente de .env — configurer Supabase d'abord (cf. .env.example)"
  exit 1
fi
export DATABASE_URL="$DATABASE_URL_VALUE"

if [ -n "$BASELINE" ]; then
  echo "[realign] 1/3 — retrait de la baseline $BASELINE de l'historique distant"
  npx supabase migration repair --status reverted "$BASELINE" --db-url "$DATABASE_URL" \
    || echo "[realign]    (baseline déjà retirée — ignoré)"
fi

if [ "${#MARK_APPLIED[@]}" -gt 0 ]; then
  echo "[realign] 2/3 — marquage « applied » sans exécuter le SQL : ${MARK_APPLIED[*]}"
  for ts in "${MARK_APPLIED[@]}"; do
    npx supabase migration repair --status applied "$ts" --db-url "$DATABASE_URL" \
      || echo "[realign]    ($ts déjà marquée — ignoré)"
  done
fi

echo "[realign] 3/3 — vérification : aucune migration ne doit s'appliquer"
npx supabase db push --db-url "$DATABASE_URL" --include-all

echo "[realign] état final local ↔ distant"
npx supabase migration list --db-url "$DATABASE_URL"

echo "[realign] ✅ Historique aligné — workflow normal : bun run db:migrate-deploy"
echo "[realign] ⚠️  DDL non exécuté pour les migrations marquées : contrôler avec bun scripts/inspect-schema.ts"