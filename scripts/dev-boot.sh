#!/usr/bin/env bash
# Boot éphémère pour les vérifications : relance le serveur s'il est arrêté
# (la sandbox tue les process en fin de tool-call), attend qu'il soit prêt.
set -euo pipefail
cd /home/z/my-project

BODY=$(curl -s --max-time 3 http://localhost:3000/api/health 2>/dev/null || true)
if ! echo "$BODY" | grep -q '"up"'; then
    setsid nohup bash -c 'bun run dev' < /dev/null > /dev/null 2>&1 &
    for i in $(seq 1 25); do
        BODY=$(curl -s --max-time 3 http://localhost:3000/api/health 2>/dev/null || true)
        echo "$BODY" | grep -q '"up"' && break
        sleep 2
    done
fi
echo "$BODY" | grep -q '"up"' || { echo "ERREUR: serveur non prêt" >&2; exit 1; }
echo "OK: $(echo "$BODY" | head -c 60)"
