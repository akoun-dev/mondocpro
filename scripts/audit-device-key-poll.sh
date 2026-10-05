#!/usr/bin/env bash
# Task 40 / ADR-010 — Audit E2E du canal « app fermée » sans Firebase.
# Vérifie : émission de clé (session), poll Bearer (auth, curseur, bornes),
# révocation (logout), purge au reset de mot de passe, exclusions de types.
# Usage : bash scripts/audit-device-key-poll.sh
set -u
BASE="http://localhost:3000"
PASS=0; FAIL=0
check() { # check <nom> <attendu> <obtenu>
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "PASS  $1 ($3)";
  else FAIL=$((FAIL+1)); echo "FAIL  $1 (attendu=$2 obtenu=$3)"; fi
}
JAR_NURSE=/tmp/mdcp_nurse.jar; JAR_ADMIN=/tmp/mdcp_admin.jar
rm -f "$JAR_NURSE" "$JAR_ADMIN"

# ——— 1. Login infirmier (session cookie) ———
CODE=$(curl -s -o /dev/null -w "%{http_code}" -c "$JAR_NURSE" -H "Content-Type: application/json" \
  -d '{"phone":"+2250755666777","password":"TestInfirmier2026!","rememberMe":true}' \
  "$BASE/api/auth/login")
check "login infirmier" 200 "$CODE"

# ——— 2. Sans session → 401 sur /api/native/device-key ———
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" \
  -d '{"platform":"android"}' "$BASE/api/native/device-key")
check "device-key sans session = 401" 401 "$CODE"

# ——— 3. Émission de clé (session valide) ———
RESP=$(curl -s -b "$JAR_NURSE" -H "Content-Type: application/json" \
  -d '{"platform":"android","deviceName":"Samsung test","appVersion":"1.0.2"}' \
  "$BASE/api/native/device-key")
KEY=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('key',''))" 2>/dev/null)
EXP=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('expiresAt',''))" 2>/dev/null)
check "clé émise (64 hex)" 64 "${#KEY}"
[ -n "$EXP" ] && check "expiresAt présent" oui oui || check "expiresAt présent" oui non

# ——— 4. Poll sans clé → 401 ———
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/notifications/poll")
check "poll sans clé = 401" 401 "$CODE"

# ——— 5. Poll avec clé invalide → 401 ———
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer deadbeefdeadbeefdeadbeefdeadbeef" \
  "$BASE/api/notifications/poll")
check "poll clé inconnue = 401" 401 "$CODE"

# ——— 6. Poll sans curseur → 0 notification (jamais de rattrapage) ———
COUNT=$(curl -s -H "Authorization: Bearer $KEY" "$BASE/api/notifications/poll" | \
  python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('notifications',[])),d.get('serverTime','')!='')" 2>/dev/null)
check "poll sans since = 0 notif + serverTime" "0 True" "$COUNT"

# ——— 7. Poll avec since = -3 jours → notifications (hors rappels RDV) ———
SINCE=$(python3 -c "from datetime import datetime,timedelta,timezone;print((datetime.now(timezone.utc)-timedelta(days=3)).isoformat())")
POLL=$(curl -s -H "Authorization: Bearer $KEY" "$BASE/api/notifications/poll?since=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$SINCE")")
COUNT=$(echo "$POLL" | python3 -c "import sys,json;print(len(json.load(sys.stdin).get('notifications',[])))" 2>/dev/null)
REMINDERS=$(echo "$POLL" | python3 -c "import sys,json;print(sum(1 for n in json.load(sys.stdin).get('notifications',[]) if n['type']=='APPOINTMENT_REMINDER'))" 2>/dev/null)
URLS=$(echo "$POLL" | python3 -c "import sys,json;d=json.load(sys.stdin).get('notifications',[]);print(all(('url' in n and 'critical' in n) for n in d) if d else 'vide')" 2>/dev/null)
check "poll 3 jours non vide" "non-vide" "$([ "$COUNT" -gt 0 ] 2>/dev/null && echo non-vide || echo vide)"
check "aucun APPOINTMENT_REMINDER dans le poll" 0 "$REMINDERS"
check "url+critical présents sur chaque item" "True" "$([ "$COUNT" = 0 ] && echo True || echo "$URLS")"

# ——— 8. Corps invalide → 400 ———
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR_NURSE" -H "Content-Type: application/json" \
  -d '{"platform":"linux"}' "$BASE/api/native/device-key")
check "platform invalide = 400" 400 "$CODE"

# ——— 9. Révocation (logout device) : /api/push/unregister { token } ———
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR_NURSE" -H "Content-Type: application/json" \
  -d "{\"token\":\"$KEY\"}" "$BASE/api/push/unregister")
check "révocation = 200" 200 "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $KEY" "$BASE/api/notifications/poll")
check "poll après révocation = 401" 401 "$CODE"

# ——— 10. Admin : émission + poll + purge via unregister { all: true } ———
CODE=$(curl -s -o /dev/null -w "%{http_code}" -c "$JAR_ADMIN" -H "Content-Type: application/json" \
  -d '{"phone":"+2250700000001","password":"Admin#MonDocPro2026","rememberMe":true}' \
  "$BASE/api/auth/login")
check "login admin" 200 "$CODE"
KEY2=$(curl -s -b "$JAR_ADMIN" -H "Content-Type: application/json" \
  -d '{"platform":"android"}' "$BASE/api/native/device-key" | \
  python3 -c "import sys,json;print(json.load(sys.stdin).get('key',''))" 2>/dev/null)
check "clé admin émise" 64 "${#KEY2}"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR_ADMIN" -H "Content-Type: application/json" \
  -d '{"all":true}' "$BASE/api/push/unregister")
check "purge all = 200" 200 "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $KEY2" "$BASE/api/notifications/poll")
check "poll après purge all = 401" 401 "$CODE"

echo "—————"
echo "RÉSULTAT : $PASS PASS / $FAIL FAIL"
[ "$FAIL" = 0 ]
