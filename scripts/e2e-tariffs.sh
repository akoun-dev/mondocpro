#!/bin/bash
# E2E — Task 28 : Grille tarifaire configurable par le Médecin Chef
# (FEATURE-TOKENS, ADR-007 — demande PO 2026-10-03).
# Les tarifs ne sont plus codés en dur : table tariff_configs (clé → Tokens),
# éditée dans la vue « Tarifs » du dashboard Médecin Chef. Le coût d'un RDV
# est FIGÉ à la réservation — une modification ne vaut que pour les demandes
# à venir.
# Suites :
#   0. Boot serveur (DATABASE_URL exportée — piège plateforme) + pré-flight
#      AUTO-RÉPARANT (DDL tokens + tarifs + seeds) + patient E2E DÉDIÉ.
#   1. API tarifs — GET 401/200 · PATCH 401/403/400 (négatif, non entier,
#      >100) /404 (clé inconnue) /200 (valeur persistée + audit Dr Kadjane).
#   2. API impact financier — RDV CABINET au tarif modifié (2) → 402 si
#      solde 1 · DOMICILE inchangé (1) → 201 · restauration tarif → 201.
#   3. Navigateur — vue Médecin Chef « Tarifs » (raccourci accueil, édition
#      inline 1→2, toast, audit) ; wizard patient affiche le NOUVEAU coût
#      (2 Tokens · 5 000 FCFA) + blocage solde insuffisant.
#   4. Mobile 390×844 — vue tarifs rendue, zéro débordement horizontal.
#   5. Restauration tarif CABINET=1 (API) + erreurs page + nettoyage fixture.
set -u
cd /home/z/my-project
AB="agent-browser"
SHOT=/home/z/my-project/tool-results
JAR=/tmp/tf-cookies.txt
JAR_ADMIN=/tmp/tf-cookies-admin.txt
PASS=0; FAIL=0

check() {
  if [ "$2" = "$3" ]; then echo "PASS: $1"; PASS=$((PASS+1)); else echo "FAIL: $1 — attendu [$2] obtenu [$3]"; FAIL=$((FAIL+1)); fi
}
strip() { echo "$1" | tr -d '"'; }
nav_labels() { strip "$($AB eval "Array.from(document.querySelectorAll('nav[aria-label=\"Navigation principale\"] button')).map(b=>b.textContent.trim()).join(' | ')" 2>/dev/null | tail -1)"; }
body_has() { strip "$($AB eval "document.body.textContent.includes('$1') ? 'yes' : 'no'" 2>/dev/null | tail -1)"; }
wait_body() {
  for i in $(seq 1 $((${2:-10}))); do
    [ "$(body_has "$1")" = "yes" ] && return 0
    sleep 1
  done
  return 1
}
nav_click() { $AB find first "nav[aria-label=\"Navigation principale\"] li:nth-child($1) button" click; }
logout() {
  nav_click 3 >/dev/null 2>&1; sleep 2
  $AB eval "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Se déconnecter')?.click(); 'ok'" >/dev/null 2>&1
  sleep 4
}
login() {
  $AB reload >/dev/null; sleep 5
  local SNAP REFS PHONE_REF PWD_REF BTN_REF i attempt
  # Retry — le snapshot peut tomber pendant l'hydratation de /login
  # (fiabilisation du 3e re-login observée au run 1).
  for attempt in 1 2 3; do
    SNAP=$($AB snapshot -i 2>/dev/null)
    REFS=$(echo "$SNAP" | grep 'textbox' | sed -n 's/.*ref=\(e[0-9]*\)\].*/\1/p')
    PHONE_REF=$(echo "$REFS" | sed -n 1p); PWD_REF=$(echo "$REFS" | sed -n 2p)
    BTN_REF=$(echo "$SNAP" | grep 'button "Se connecter"' | sed -n 's/.*ref=\(e[0-9]*\)\].*/\1/p' | head -1)
    [ -n "$PHONE_REF" ] && [ -n "$PWD_REF" ] && [ -n "$BTN_REF" ] && break
    sleep 3
    $AB reload >/dev/null
    sleep 4
  done
  echo "  [login] refs phone=$PHONE_REF pwd=$PWD_REF btn=$BTN_REF"
  [ -z "$PHONE_REF" ] || [ -z "$PWD_REF" ] || [ -z "$BTN_REF" ] && { echo "  [login] formulaire introuvable"; return 1; }
  $AB fill "@$PHONE_REF" "$1" >/dev/null
  $AB fill "@$PWD_REF" "$2" >/dev/null
  $AB click "@$BTN_REF" >/dev/null
  for i in $(seq 1 12); do
    sleep 1
    [ -n "$(nav_labels)" ] && break
  done
  sleep 5   # laisser expirer le toast d'accueil (piège body_has)
  nav_labels
}
# Extrait le prix d'une clé de la grille renvoyée par GET (jq non requis).
tariff_tokens() { # $1=json $2=key → tokens
  grep -o "\"key\":\"$2\"[^}]*" "$1" | sed -n 's/.*"tokens":\([0-9]*\).*/\1/p' | head -1
}

# ── 0. Boot serveur + pré-flight auto-réparant + patient E2E dédié ──────────
pkill -f "next dev" 2>/dev/null; sleep 1
export DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')
rm -f /tmp/dev-e2e.log
node_modules/.bin/prisma db execute --file scripts/tokens-live-apply.sql --schema supabase/schema.prisma > /dev/null 2>&1 || true
node_modules/.bin/prisma db execute --file scripts/tariffs-live-apply.sql --schema supabase/schema.prisma > /dev/null 2>&1 || true
printf 'ALTER TYPE "Role" RENAME VALUE '''INFIRMIER''' TO '''NURSE''';' | node_modules/.bin/prisma db execute --schema supabase/schema.prisma --stdin > /dev/null 2>&1 || true
bun scripts/seed-specialties.ts > /dev/null 2>&1 || true
bun scripts/seed-test-accounts.ts > /dev/null 2>&1 || true
nohup bun run dev > /tmp/dev-e2e.log 2>&1 &
OK=0
for i in $(seq 1 75); do
  sleep 2
  if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then OK=1; echo "HEALTH OK (${i}x2s)"; break; fi
done
[ $OK -eq 1 ] || { echo "SERVER DOWN"; tail -20 /tmp/dev-e2e.log; exit 1; }

FIXTURE=$(bun scripts/tokens-fixture.ts create)
E2E_PHONE=$(echo "$FIXTURE" | sed -n 's/^PHONE=//p')
E2E_PWD=$(echo "$FIXTURE" | sed -n 's/^PASSWORD=//p')
E2E_PHONE_LOCAL=${E2E_PHONE#+225}
E2E_PHONE_LOCAL=$(echo "$E2E_PHONE_LOCAL" | cut -c1-10)
echo "  [fixture] patient E2E = $E2E_PHONE (local $E2E_PHONE_LOCAL)"
[ -n "$E2E_PHONE" ] || { echo "FIXTURE KO"; exit 1; }

# ── 1. Suite API — routes tarifs ────────────────────────────────────────────
BASE=http://localhost:3000/api
rm -f $JAR $JAR_ADMIN
CODE=$(curl -s -o /tmp/tf-t0.json -w "%{http_code}" $BASE/tariffs)
check "API — tarifs sans session → 401" "401" "$CODE"
CODE=$(curl -s -o /tmp/tf-login.json -w "%{http_code}" -c $JAR -X POST $BASE/auth/login -H "Content-Type: application/json" -d "{\"phone\":\"$E2E_PHONE\",\"password\":\"$E2E_PWD\"}")
check "API — login patient E2E" "200" "$CODE"
CODE=$(curl -s -o /tmp/tf-t1.json -w "%{http_code}" -b $JAR $BASE/tariffs)
check "API — tarifs patient → 200" "200" "$CODE"
check "API — grille : cabinet seedé à 1" "1" "$(tariff_tokens /tmp/tf-t1.json CONSULTATION_CABINET)"
check "API — grille : domicile seedé à 1" "1" "$(tariff_tokens /tmp/tf-t1.json CONSULTATION_DOMICILE)"

CODE=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR -X PATCH $BASE/admin/tariffs/CONSULTATION_CABINET -H "Content-Type: application/json" -d '{"tokens":2}')
check "API — PATCH tarifs vue par patient → 403" "403" "$CODE"
CODE=$(curl -s -o /tmp/tf-alogin.json -w "%{http_code}" -c $JAR_ADMIN -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"phone":"+2250700000001","password":"Admin#MonDocPro2026"}')
check "API — login Médecin Chef" "200" "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH $BASE/admin/tariffs/CONSULTATION_CABINET -H "Content-Type: application/json" -d '{"tokens":2}')
check "API — PATCH tarifs sans session → 401" "401" "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR_ADMIN -X PATCH $BASE/admin/tariffs/CONSULTATION_CABINET -H "Content-Type: application/json" -d '{"tokens":-1}')
check "API — PATCH prix négatif → 400" "400" "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR_ADMIN -X PATCH $BASE/admin/tariffs/CONSULTATION_CABINET -H "Content-Type: application/json" -d '{"tokens":2.5}')
check "API — PATCH prix non entier → 400" "400" "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR_ADMIN -X PATCH $BASE/admin/tariffs/CONSULTATION_CABINET -H "Content-Type: application/json" -d '{"tokens":101}')
check "API — PATCH prix > 100 Tokens → 400" "400" "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR_ADMIN -X PATCH $BASE/admin/tariffs/POSTE_INCONNU -H "Content-Type: application/json" -d '{"tokens":2}')
check "API — PATCH clé inconnue → 404" "404" "$CODE"
CODE=$(curl -s -o /tmp/tf-p1.json -w "%{http_code}" -b $JAR_ADMIN -X PATCH $BASE/admin/tariffs/CONSULTATION_CABINET -H "Content-Type: application/json" -d '{"tokens":2}')
check "API — PATCH cabinet = 2 Tokens → 200" "200" "$CODE"
check "API — réponse : nouvelle valeur 2" "2" "$(tariff_tokens /tmp/tf-p1.json CONSULTATION_CABINET)"
check "API — audit : modifié par Dr Kadjane" "yes" "$(grep -q '"updatedByName":"Dr Kadjane"' /tmp/tf-p1.json && echo yes || echo no)"
curl -s -b $JAR_ADMIN $BASE/admin/tariffs > /tmp/tf-a1.json
check "API — vue admin : grille complète (2 postes)" "2" "$(grep -o '"key":"CONSULTATION_' /tmp/tf-a1.json | wc -l | tr -d ' ')"
curl -s -b $JAR $BASE/tariffs > /tmp/tf-t2.json
check "API — patient voit immédiatement le nouveau tarif" "2" "$(tariff_tokens /tmp/tf-t2.json CONSULTATION_CABINET)"

# ── 2. Suite API — impact financier sur les RDV ─────────────────────────────
# Crédit d'1 Token (recharge → confirmation Médecin Chef).
CODE=$(curl -s -o /tmp/tf-r1.json -w "%{http_code}" -b $JAR -X POST $BASE/wallet/recharges -H "Content-Type: application/json" -d '{"amountFcfa":2500}')
check "API — recharge 2 500 → 201" "201" "$CODE"
RECHARGE_ID=$(sed -n 's/.*"recharge":{"id":"\([^"]*\)".*/\1/p' /tmp/tf-r1.json)
curl -s -o /dev/null -b $JAR_ADMIN -X PATCH $BASE/admin/recharges/$RECHARGE_ID -H "Content-Type: application/json" -d '{"decision":"CONFIRM"}'
curl -s -b $JAR $BASE/wallet > /tmp/tf-w1.json
check "API — solde crédité : 1 Token" "1" "$(sed -n 's/.*"balanceTokens":\([0-9]*\).*/\1/p' /tmp/tf-w1.json | head -1)"

# Créneaux ouvrés valides (lundi–vendredi, 14:00 / 14:30).
SLOT1=""; SLOT2=""
for i in 1 2 3 4 5 6 7; do
  D=$(date -d "+$i day" +%Y-%m-%d)
  [ "$(date -d "$D" +%u)" -le 5 ] && SLOT1="$D" && break
done
for i in 1 2 3 4 5; do
  D=$(date -d "$SLOT1 +$i day" +%Y-%m-%d)
  [ "$(date -d "$D" +%u)" -le 5 ] && SLOT2="$D" && break
done
SPEC_ID=$(curl -s -b $JAR $BASE/specialties | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//')
[ -n "$SPEC_ID" ] || { echo "AUCUNE SPECIALITE"; bun scripts/tokens-fixture.ts clean "$E2E_PHONE"; exit 1; }

BOOK() { # $1=type $2=date $3=time → code
  curl -s -o /tmp/tf-book.json -w "%{http_code}" -b $JAR -X POST $BASE/appointments -H "Content-Type: application/json" -d "{\"type\":\"$1\",\"specialtyId\":\"$SPEC_ID\",\"zone\":\"YOPOUGON\",\"date\":\"$2\",\"time\":\"$3\"}"
}
CODE=$(BOOK CABINET "$SLOT1" "14:00")
check "API — RDV cabinet (coûte 2, solde 1) → 402" "402" "$CODE"
check "API — 402 explique le manque (il vous manque 1 Token)" "yes" "$(grep -q 'il vous manque' /tmp/tf-book.json && echo yes || echo no)"
CODE=$(BOOK DOMICILE "$SLOT1" "14:00")
check "API — RDV domicile (tarif inchangé 1) → 201" "201" "$CODE"
check "API — domicile tokensReserved=1" "1" "$(sed -n 's/.*"tokensReserved":\([0-9]*\).*/\1/p' /tmp/tf-book.json | head -1)"
APPT1=$(sed -n 's/.*"appointment":{"id":"\([^"]*\)".*/\1/p' /tmp/tf-book.json)
curl -s -o /dev/null -b $JAR -X PATCH $BASE/appointments/$APPT1 -H "Content-Type: application/json" -d '{"action":"CANCEL"}'
curl -s -b $JAR $BASE/wallet > /tmp/tf-w2.json
check "API — annulation : solde restauré 1" "1" "$(sed -n 's/.*"balanceTokens":\([0-9]*\).*/\1/p' /tmp/tf-w2.json | head -1)"

# Restauration du tarif provisionnel — les demandes suivantes repassent à 1.
CODE=$(curl -s -o /tmp/tf-p2.json -w "%{http_code}" -b $JAR_ADMIN -X PATCH $BASE/admin/tariffs/CONSULTATION_CABINET -H "Content-Type: application/json" -d '{"tokens":1}')
check "API — restauration cabinet = 1 → 200" "200" "$CODE"
CODE=$(BOOK CABINET "$SLOT2" "14:00")
check "API — RDV cabinet au tarif restauré → 201" "201" "$CODE"
check "API — cabinet tokensReserved=1" "1" "$(sed -n 's/.*"tokensReserved":\([0-9]*\).*/\1/p' /tmp/tf-book.json | head -1)"
APPT2=$(sed -n 's/.*"appointment":{"id":"\([^"]*\)".*/\1/p' /tmp/tf-book.json)
curl -s -o /dev/null -b $JAR -X PATCH $BASE/appointments/$APPT2 -H "Content-Type: application/json" -d '{"action":"CANCEL"}'

# ── 3. Navigateur — Médecin Chef (édition) puis patient (wizard) ────────────
$AB close >/dev/null 2>&1
$AB set viewport 1440 900 >/dev/null
$AB open http://localhost:3000 >/dev/null
sleep 3
$AB eval "localStorage.clear(); sessionStorage.clear(); 'ok'" >/dev/null
echo "== login Médecin Chef: $(login "+2250700000001" "Admin#MonDocPro2026")"
check "Admin — raccourci Tarifs sur l'accueil" "yes" "$(body_has 'Tarifs des consultations')"
$AB eval "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Tarifs des consultations'))?.click(); 'ok'" >/dev/null 2>&1
sleep 3
check "Admin — vue tarifs : titre" "yes" "$(body_has 'Tarifs des consultations')"
check "Admin — vue tarifs : mention 1 Token = 2 500 FCFA" "yes" "$(body_has '500 FCFA')"
check "Admin — grille : ligne cabinet visible" "yes" "$(body_has 'Consultation au cabinet')"
check "Admin — grille : ligne domicile visible" "yes" "$(body_has 'Consultation à domicile')"
$AB screenshot $SHOT/tariffs-admin-view.png >/dev/null

# Édition inline du tarif cabinet : Modifier → 2 → Enregistrer.
$AB eval "(function(){var li=Array.from(document.querySelectorAll('li')).find(function(x){return x.textContent.indexOf('Consultation au cabinet')>=0});if(!li)return 'no-li';var b=Array.from(li.querySelectorAll('button')).find(function(x){return x.textContent.trim()==='Modifier'});if(!b)return 'no-btn';b.click();return 'ok';})()" >/dev/null 2>&1
sleep 1
$AB fill 'input[type="number"]' "2" >/dev/null 2>&1
sleep 1
$AB eval "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Enregistrer')?.click(); 'ok'" >/dev/null 2>&1
check "Admin — toast « Tarif mis à jour »" "yes" "$(wait_body 'Tarif mis à jour' 8 && echo yes || echo no)"
check "Admin — ligne cabinet affiche 2 Tokens" "yes" "$(wait_body '2 Tokens' 6 && echo yes || echo no)"
check "Admin — équivalent 5 000 FCFA affiché" "yes" "$(body_has '000 FCFA')"
$AB screenshot $SHOT/tariffs-admin-edited.png >/dev/null

# ── 4. Mobile 390×844 — vue admin tarifs (MÊME session admin, zéro re-login) ─
$AB set viewport 390 844 >/dev/null
sleep 2
check "Mobile admin — vue tarifs rendue" "yes" "$(body_has 'Grille tarifaire')"
check "Mobile admin — aucun débordement horizontal" "ok" "$($AB eval "document.documentElement.scrollWidth<=392?'ok':'overflow:'+document.documentElement.scrollWidth" 2>/dev/null | tail -1 | tr -d '"')"
$AB screenshot $SHOT/tariffs-mobile.png >/dev/null

# ── 5. Patient desktop — wizard au NOUVEAU tarif, puis restauration ─────────
logout
$AB set viewport 1440 900 >/dev/null
echo "== re-login patient: $(login "$E2E_PHONE_LOCAL" "$E2E_PWD")"
nav_click 2 >/dev/null; sleep 2   # Rendez-vous
$AB eval "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Nouveau RDV')?.click(); 'ok'" >/dev/null 2>&1
sleep 2
$AB eval "Array.from(document.querySelectorAll('[role=\"dialog\"] button')).find(b=>b.textContent.indexOf(' cabinet')>=0)?.click(); 'ok'" >/dev/null 2>&1
sleep 1
$AB eval "Array.from(document.querySelectorAll('[role=\"dialog\"] button')).find(b=>b.textContent.trim()==='Continuer')?.click(); 'ok'" >/dev/null 2>&1
sleep 1
$AB eval "document.querySelector('[role=\"dialog\"] [role=\"radio\"]')?.click(); 'ok'" >/dev/null 2>&1
sleep 1
$AB eval "Array.from(document.querySelectorAll('[role=\"dialog\"] button')).find(b=>b.textContent.trim()==='Continuer')?.click(); 'ok'" >/dev/null 2>&1
sleep 1
$AB eval "document.querySelector('[role=\"dialog\"] [role=\"radiogroup\"][aria-label*=\"jour\"] [role=\"radio\"]:not([disabled])')?.click(); 'ok'" >/dev/null 2>&1
sleep 1
$AB eval "document.querySelector('[role=\"dialog\"] [role=\"radiogroup\"][aria-label*=\"heure\"] [role=\"radio\"]:not([disabled])')?.click(); 'ok'" >/dev/null 2>&1
sleep 1
$AB eval "Array.from(document.querySelectorAll('[role=\"dialog\"] button')).find(b=>b.textContent.trim()==='Continuer')?.click(); 'ok'" >/dev/null 2>&1
sleep 2
check "Patient — wizard étape 4 : coût au NOUVEAU tarif (2 Tokens)" "yes" "$(body_has '2 Tokens')"
check "Patient — wizard étape 4 : équivalent 5 000 FCFA" "yes" "$(body_has '000 FCFA')"
check "Patient — blocage solde insuffisant affiché (solde 1 < 2)" "yes" "$(body_has 'Solde insuffisant')"
$AB screenshot $SHOT/tariffs-patient-wizard.png >/dev/null
$AB eval "document.querySelector('[role=\"dialog\"] button[aria-label=\"Close\"]')?.click(); 'ok'" >/dev/null 2>&1; sleep 2
$AB eval "document.querySelector('[role=\"dialog\"] button[aria-label=\"Close\"]')?.click(); 'ok'" >/dev/null 2>&1; sleep 2

# ── 6. Restauration tarif + erreurs page + nettoyage ────────────────────────
CODE=$(curl -s -o /tmp/tf-restore.json -w "%{http_code}" -b $JAR_ADMIN -X PATCH $BASE/admin/tariffs/CONSULTATION_CABINET -H "Content-Type: application/json" -d '{"tokens":1}')
check "Restauration finale — cabinet = 1 → 200" "200" "$CODE"
curl -s -b $JAR $BASE/tariffs > /tmp/tf-t3.json
check "Restauration finale — vérité serveur" "1" "$(tariff_tokens /tmp/tf-t3.json CONSULTATION_CABINET)"
ERRS=$($AB errors 2>/dev/null | grep -c -i "error" || true)
bun scripts/tokens-fixture.ts clean "$E2E_PHONE" > /tmp/tf-clean.txt
check "Nettoyage — patient E2E supprimé (cascade)" "yes" "$(grep -q '1 utilisateur' /tmp/tf-clean.txt && echo yes || echo no)"
echo "PAGE_ERRORS=$ERRS"
echo "==============================="
echo "RESULT: PASS=$PASS FAIL=$FAIL"
$AB close >/dev/null 2>&1
[ $FAIL -eq 0 ] && echo "E2E GLOBAL: PASS" || echo "E2E GLOBAL: FAIL"
