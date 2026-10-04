#!/usr/bin/env bash
# Audit E2E — FEATURE-NURSE-PROFIL (Task 34) : POST /api/auth/change-password
# + PATCH profil NURSE + source des stats missions.
# Sémantique vérifiée : session courante PRÉSERVÉE, autres sessions RÉVOQUÉES.
# Le mot de passe du compte de test est restauré en fin de script (les autres
# audits E2E s'appuient sur TestInfirmier2026!).
set -uo pipefail
cd "$(dirname "$0")/.."

BASE="http://localhost:3000/api"
JP=$(mktemp) ; JN=$(mktemp) ; JN2=$(mktemp) ; JN3=$(mktemp)
PASS=0 ; FAIL=0

check() { # check <libellé> <attendu> <obtenu>
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  ✓ $1 ($3)"
  else FAIL=$((FAIL+1)); echo "  ✗ $1 (attendu $2, obtenu $3)"; fi
}

echo "== Boot / santé =="
BODY=$(curl -s --max-time 3 $BASE/health || true)
echo "$BODY" | grep -q '"up"' || bash scripts/dev-boot.sh >/dev/null 2>&1 || { echo "serveur indisponible" >&2; exit 1; }
check "GET /health" 200 "$(curl -s -o /dev/null -w '%{http_code}' $BASE/health --max-time 10)"

echo "== Sessions initiales (2 appareils) =="
check "login NURSE (appareil A)" 200 "$(curl -s -o /dev/null -w '%{http_code}' -c $JN -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"phone":"+2250755666777","password":"TestInfirmier2026!"}' --max-time 15)"
check "login NURSE (appareil B)" 200 "$(curl -s -o /dev/null -w '%{http_code}' -c $JN2 -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"phone":"+2250755666777","password":"TestInfirmier2026!"}' --max-time 15)"
check "me appareil A" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN $BASE/auth/me --max-time 10)"
check "me appareil B" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN2 $BASE/auth/me --max-time 10)"

echo "== change-password : gardes et validations =="
check "sans session → 401" 401 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/auth/change-password -H 'Content-Type: application/json' -d '{"currentPassword":"x","password":"NouveauMot1","confirmPassword":"NouveauMot1"}' --max-time 10)"
check "mot de passe actuel faux → 400" 400 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN -X POST $BASE/auth/change-password -H 'Content-Type: application/json' -d '{"currentPassword":"Faux1234!","password":"NouveauMot1","confirmPassword":"NouveauMot1"}' --max-time 10)"
DETAILS=$(curl -s -b $JN -X POST $BASE/auth/change-password -H 'Content-Type: application/json' -d '{"currentPassword":"Faux1234!","password":"NouveauMot1","confirmPassword":"NouveauMot1"}' --max-time 10)
echo "$DETAILS" | grep -q '"currentPassword"' && check "champ fautif = currentPassword" yes yes || check "champ fautif = currentPassword" yes no
check "confirmation divergente → 400" 400 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN -X POST $BASE/auth/change-password -H 'Content-Type: application/json' -d '{"currentPassword":"TestInfirmier2026!","password":"NouveauMot1","confirmPassword":"AutreMot1"}' --max-time 10)"
check "nouveau = actuel → 400" 400 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN -X POST $BASE/auth/change-password -H 'Content-Type: application/json' -d '{"currentPassword":"TestInfirmier2026!","password":"TestInfirmier2026!","confirmPassword":"TestInfirmier2026!"}' --max-time 10)"
check "mot de passe court (7) → 400" 400 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN -X POST $BASE/auth/change-password -H 'Content-Type: application/json' -d '{"currentPassword":"TestInfirmier2026!","password":"Court7","confirmPassword":"Court7"}' --max-time 10)"

echo "== changement effectif + sémantique de sessions =="
check "changement (appareil A) → 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN -X POST $BASE/auth/change-password -H 'Content-Type: application/json' -d '{"currentPassword":"TestInfirmier2026!","password":"NouveauNurse2026","confirmPassword":"NouveauNurse2026"}' --max-time 15)"
check "session courante A préservée" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN $BASE/auth/me --max-time 10)"
check "session appareil B révoquée" 401 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN2 $BASE/auth/me --max-time 10)"
check "ancien mot de passe refusé" 401 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"phone":"+2250755666777","password":"TestInfirmier2026!"}' --max-time 15)"
check "nouveau mot de passe accepté" 200 "$(curl -s -o /dev/null -w '%{http_code}' -c $JN3 -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"phone":"+2250755666777","password":"NouveauNurse2026"}' --max-time 15)"

echo "== restauration du compte de test (scripts E2E dépendants) =="
check "retour au mot de passe d'origine → 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN -X POST $BASE/auth/change-password -H 'Content-Type: application/json' -d '{"currentPassword":"NouveauNurse2026","password":"TestInfirmier2026!","confirmPassword":"TestInfirmier2026!"}' --max-time 15)"
check "login mot de passe d'origine" 200 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"phone":"+2250755666777","password":"TestInfirmier2026!"}' --max-time 15)"

echo "== profil NURSE (PATCH) + source des stats =="
check "PATCH profil NURSE (birthDate)" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN -X PATCH $BASE/auth/profile -H 'Content-Type: application/json' -d '{"birthDate":"1990-06-15"}' --max-time 15)"
BIRTH=$(curl -s -b $JN $BASE/auth/me --max-time 10 | grep -o '"birthDate":"[^"]*"' | head -1)
echo "$BIRTH" | grep -q "1990-06-15" && check "birthDate persistée" yes yes || check "birthDate persistée (obtenu: $BIRTH)" yes no
check "PATCH birthDate null (effacer)" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN -X PATCH $BASE/auth/profile -H 'Content-Type: application/json' -d '{"birthDate":null}' --max-time 15)"
check "GET /nurse/missions (stats)" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN $BASE/nurse/missions --max-time 10)"
check "PATCH profil sans session → 401" 401 "$(curl -s -o /dev/null -w '%{http_code}' -X PATCH $BASE/auth/profile -H 'Content-Type: application/json' -d '{"zone":"SONGON"}' --max-time 10)"

echo ""
echo "RÉSULTAT: $PASS réussis / $FAIL échoués"
rm -f $JP $JN $JN2 $JN3
[ "$FAIL" = "0" ]
