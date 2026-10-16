#!/usr/bin/env bash
# Boot du serveur dev avec le DATABASE_URL du .env du projet — SYS-011.
#
# Pourquoi ce script existe : l'environnement de la sandbox exporte parfois
# DATABASE_URL=file:.../custom.db (vestige de template) dans le shell. Next.js
# ne surcharge JAMAIS une variable déjà présente dans l'environnement, donc un
# `bun run dev` nu hérite du file:... et Prisma échoue au premier appel
# (« the URL must start with the protocol postgresql:// » — incident 2026-10-03,
# « Impossible de contacter le serveur » côté patient).
#
# Ce script force DATABASE_URL depuis .env AVANT de démarrer, quel que soit
# l'environnement hérité. Toute relance du serveur doit passer par ici.
set -euo pipefail
cd "$(dirname "$0")/.."

# Piège corrigé (2026-10-16) : sans ancrage de fin de ligne ni exclusion du
# retour à la ligne, `[^"]+` avalait TOUT le reste du .env (URL + suivantes
# dans une seule variable) et Prisma rejetait ensuite l'URL
# (« The provided arguments are not supported in database URL »).
export DATABASE_URL="$(node -e "const m=require('fs').readFileSync('.env','utf8').match(/^DATABASE_URL=\"?([^\"\n]+)\"?$/m);if(!m)throw new Error('DATABASE_URL introuvable dans .env');process.stdout.write(m[1])")"

# Le client Prisma doit suivre le schéma avant que Next charge les routes API.
./node_modules/.bin/prisma generate

./node_modules/.bin/next dev -p 3000 2>&1 | tee dev.log
