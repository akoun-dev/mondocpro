#!/bin/bash
# E2E — Task 26 : Portefeuille de Tokens (FEATURE-TOKENS, ADR-007).
# 1 Token = 2 500 FCFA · réservation à la demande · débit définitif en fin de
# visite (clôture Médecin Chef) · libération à l'annulation · recharges
# déclarées PENDING → rapprochement Médecin Chef (garde anti double-crédit).
# Suites :
#   0. Boot serveur (DATABASE_URL exportée — piège plateforme) + patient E2E
#      DÉDIÉ (compte neuf à chaque run → assertions déterministes, zéro
#      résidu : suppression en cascade en fin de run).
#   1. API — wallet 401/403 · recharge 400 (non multiple) / 201 PENDING ·
#      décision Médecin Chef CONFIRM/anti double-crédit 409 · solde crédité ·
#      POST RDV 201 tokenState=RESERVED (solde −1, réservé +1) · 402 solde
#      insuffisant · PATCH DONE patient → 403 · CANCEL → RELEASED (+1) ·
#      re-book → DONE admin → CONSUMED (dépense définitive, spent=1).
#   2. Navigateur patient desktop — section Portefeuille (solde, consommés,
#      historique), dialog Recharger (presets) → PENDING, connexion Médecin
#      Chef : nav « Recharges » + vue (file, confirmer, toast), retour
#      patient : solde crédité, wizard RDV étape 4 (Coût + Solde après
#      réservation), réservation via UI, solde 0 / 1 en réservation.
#   3. Mobile 390×844 — portefeuille rendu, zéro débordement horizontal.
#   4. Régression INFIRMIER — nav 2 onglets inchangée.
#   5. Erreurs page + nettoyage (cascade du patient E2E).
set -u
cd /home/z/my-project
AB="agent-browser"
SHOT=/home/z/my-project/tool-results
JAR=/tmp/tokens-cookies.txt
JAR_ADMIN=/tmp/tokens-cookies-admin.txt
PASS=0; FAIL=0

check() {
  if [ "$2" = "$3" ]; then echo "PASS: $1"; PASS=$((PASS+1)); else echo "FAIL: $1 — attendu [$2] obtenu [$3]"; FAIL=$((FAIL+1)); fi
}
strip() { echo "$1" | tr -d '"'; }
nav_labels() { strip "$($AB eval "Array.from(document.querySelectorAll('nav[aria-label=\"Navigation principale\"] button')).map(b=>b.textContent.trim()).join(' | ')" 2>/dev/null | tail -1)"; }
body_has() { strip "$($AB eval "document.body.textContent.includes('$1') ? 'yes' : 'no'" 2>/dev/null | tail -1)"; }
# Polling — attend qu'un texte apparaisse (latence POST/GET Supabase + toasts).
wait_body() { # $1=texte $2=secondes max
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
  local SNAP REFS PHONE_REF PWD_REF BTN_REF i
  SNAP=$($AB snapshot -i 2>/dev/null)
  REFS=$(echo "$SNAP" | grep 'textbox' | sed -n 's/.*ref=\(e[0-9]*\)\].*/\1/p')
  PHONE_REF=$(echo "$REFS" | sed -n 1p); PWD_REF=$(echo "$REFS" | sed -n 2p)
  BTN_REF=$(echo "$SNAP" | grep 'button "Se connecter"' | sed -n 's/.*ref=\(e[0-9]*\)\].*/\1/p' | head -1)
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
# Ouvre le dialog Recharger et déclare le preset 2 500 FCFA
recharge_ui() {
  $AB eval "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Recharger')?.click(); 'ok'" >/dev/null 2>&1
  sleep 2
  # NB : Intl fr-FR sépare les milliers par U+202F — matcher « 500 FCFA »
  # (ne correspond qu'au preset 2 500 parmi 2500/5000/10000/25000).
  $AB eval "(function(){var b=Array.from(document.querySelectorAll('[role=\"dialog\"] button')).find(function(x){return x.textContent.indexOf('500 FCFA')>=0});if(!b)return 'no-preset';b.click();return 'ok';})()" >/dev/null 2>&1
  sleep 1
  $AB eval "Array.from(document.querySelectorAll('[role=\"dialog\"] button')).find(b=>b.textContent.trim()==='Déclarer le paiement')?.click(); 'ok'" >/dev/null 2>&1
  sleep 4
}

# ── 0. Boot serveur + patient E2E dédié ─────────────────────────────────────
pkill -f "next dev" 2>/dev/null; sleep 1
export DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')
rm -f /tmp/dev-e2e.log
# Pré-flight AUTO-RÉPARANT — la plateforme peut reprovisionner la base entre
# deux runs (Task 26 : reprovision Supabase ayant perdu DDL + données) :
# DDL Tokens idempotent + seed spécialités + seed comptes de test.
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
E2E_PHONE_LOCAL=${E2E_PHONE#+225}   # formulaire login : format local normalisé
# purger un éventuel résidu du même numéro (improbable : aléatoire 8 chiffres)
E2E_PHONE_LOCAL=$(echo "$E2E_PHONE_LOCAL" | cut -c1-10)
echo "  [fixture] patient E2E = $E2E_PHONE (local $E2E_PHONE_LOCAL)"
[ -n "$E2E_PHONE" ] || { echo "FIXTURE KO"; exit 1; }

# ── 1. Suite API ────────────────────────────────────────────────────────────
BASE=http://localhost:3000/api
rm -f $JAR $JAR_ADMIN
CODE=$(curl -s -o /tmp/tk-login.json -w "%{http_code}" -c $JAR -X POST $BASE/auth/login -H "Content-Type: application/json" -d "{\"phone\":\"$E2E_PHONE\",\"password\":\"$E2E_PWD\"}")
check "API — login patient E2E" "200" "$CODE"
CODE=$(curl -s -o /tmp/tk-w0.json -w "%{http_code}" $BASE/wallet)
check "API — wallet sans session → 401" "401" "$CODE"
CODE=$(curl -s -o /tmp/tk-w1.json -w "%{http_code}" -b $JAR $BASE/wallet)
check "API — wallet patient → 200" "200" "$CODE"
check "API — compte neuf : solde 0" "0" "$(sed -n 's/.*"balanceTokens":\([0-9]*\).*/\1/p' /tmp/tk-w1.json | head -1)"
check "API — compte neuf : 0 mouvement" "0" "$(grep -o '"transactions":\[\]' /tmp/tk-w1.json >/dev/null && echo 0 || echo 1)"
BAL_NUX=$(grep -o '"transactions":\[[^]]*\]' /tmp/tk-w1.json | grep -o ',"type"' | wc -l)
check "API — ledger vide à la création" "0" "$BAL_NUX"

CODE=$(curl -s -o /tmp/tk-r0.json -w "%{http_code}" -b $JAR -X POST $BASE/wallet/recharges -H "Content-Type: application/json" -d '{"amountFcfa":3000}')
check "API — recharge non multiple (3 000) → 400" "400" "$CODE"
CODE=$(curl -s -o /tmp/tk-r1.json -w "%{http_code}" -b $JAR -X POST $BASE/wallet/recharges -H "Content-Type: application/json" -d '{"amountFcfa":2500}')
check "API — recharge 2 500 → 201 PENDING" "201" "$CODE"
check "API — recharge statut PENDING" "yes" "$(grep -q '"status":"PENDING"' /tmp/tk-r1.json && echo yes || echo no)"
RECHARGE_ID=$(sed -n 's/.*"recharge":{"id":"\([^"]*\)".*/\1/p' /tmp/tk-r1.json)
echo "  [api] recharge id = $RECHARGE_ID"
[ -n "$RECHARGE_ID" ] || { echo "RECHARGE ID MANQUANT — stop"; tail -5 /tmp/dev-e2e.log; bun scripts/tokens-fixture.ts clean "$E2E_PHONE"; exit 1; }
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR $BASE/admin/recharges)
check "API — file recharges vue par patient → 403" "403" "$CODE"

CODE=$(curl -s -o /tmp/tk-alogin.json -w "%{http_code}" -c $JAR_ADMIN -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"phone":"+2250700000001","password":"Admin#MonDocPro2026"}')
check "API — login Médecin Chef" "200" "$CODE"
curl -s -b $JAR_ADMIN $BASE/admin/recharges > /tmp/tk-adm0.json
check "API — file contient la recharge PENDING" "yes" "$(grep -q "$RECHARGE_ID" /tmp/tk-adm0.json && echo yes || echo no)"
check "API — file nomme le patient" "yes" "$(grep -q 'Patient Tokens E2E' /tmp/tk-adm0.json && echo yes || echo no)"
CODE=$(curl -s -o /tmp/tk-dec1.json -w "%{http_code}" -b $JAR_ADMIN -X PATCH $BASE/admin/recharges/$RECHARGE_ID -H "Content-Type: application/json" -d '{"decision":"CONFIRM"}')
check "API — CONFIRM → 200 CONFIRMED" "200" "$CODE"
check "API — décision = CONFIRMED" "yes" "$(grep -q '"status":"CONFIRMED"' /tmp/tk-dec1.json && echo yes || echo no)"
CODE=$(curl -s -o /tmp/tk-dec2.json -w "%{http_code}" -b $JAR_ADMIN -X PATCH $BASE/admin/recharges/$RECHARGE_ID -H "Content-Type: application/json" -d '{"decision":"CONFIRM"}')
check "API — ANTI DOUBLE-CRÉDIT : re-confirm → 409" "409" "$CODE"
curl -s -b $JAR $BASE/wallet > /tmp/tk-w2.json
check "API — solde crédité : 1 Token" "1" "$(sed -n 's/.*"balanceTokens":\([0-9]*\).*/\1/p' /tmp/tk-w2.json | head -1)"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR_ADMIN $BASE/wallet)
check "API — wallet vue par Médecin Chef → 403" "403" "$CODE"

# Créneau ouvré valide (≥ 2 h à l'avance, lundi–vendredi, 14:00/14:30)
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
echo "  [api] slots $SLOT1/$SLOT2 · spécialité $SPEC_ID"
[ -n "$SPEC_ID" ] || { echo "AUCUNE SPECIALITE"; bun scripts/tokens-fixture.ts clean "$E2E_PHONE"; exit 1; }

BOOK() { # $1=date $2=time $3=jar → écho code
  curl -s -o /tmp/tk-book.json -w "%{http_code}" -b "$3" -X POST $BASE/appointments -H "Content-Type: application/json" -d "{\"type\":\"DOMICILE\",\"specialtyId\":\"$SPEC_ID\",\"zone\":\"YOPOUGON\",\"date\":\"$1\",\"time\":\"$2\"}"
}
CODE=$(BOOK "$SLOT1" "14:00" $JAR)
check "API — RDV domicile → 201" "201" "$CODE"
check "API — RDV tokenState=RESERVED" "yes" "$(grep -q '"tokenState":"RESERVED"' /tmp/tk-book.json && echo yes || echo no)"
check "API — RDV tokensReserved=1 (tarif provisionnel)" "1" "$(sed -n 's/.*"tokensReserved":\([0-9]*\).*/\1/p' /tmp/tk-book.json | head -1)"
APPT1=$(sed -n 's/.*"appointment":{"id":"\([^"]*\)".*/\1/p' /tmp/tk-book.json)
curl -s -b $JAR $BASE/wallet > /tmp/tk-w3.json
check "API — après réservation : solde 0" "0" "$(sed -n 's/.*"balanceTokens":\([0-9]*\).*/\1/p' /tmp/tk-w3.json | head -1)"
check "API — après réservation : 1 réservé" "1" "$(sed -n 's/.*"reservedTokens":\([0-9]*\).*/\1/p' /tmp/tk-w3.json | head -1)"
CODE=$(BOOK "$SLOT2" "14:30" $JAR)
check "API — 2e RDV sans solde → 402" "402" "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR -X PATCH $BASE/appointments/$APPT1 -H "Content-Type: application/json" -d '{"action":"DONE"}')
check "API — patient tente DONE → 403" "403" "$CODE"
CODE=$(curl -s -o /tmp/tk-canc.json -w "%{http_code}" -b $JAR -X PATCH $BASE/appointments/$APPT1 -H "Content-Type: application/json" -d '{"action":"CANCEL"}')
check "API — CANCEL patient → 200 RELEASED" "200" "$CODE"
check "API — RDV annulé tokenState=RELEASED" "yes" "$(grep -q '"tokenState":"RELEASED"' /tmp/tk-canc.json && echo yes || echo no)"
curl -s -b $JAR $BASE/wallet > /tmp/tk-w4.json
check "API — après libération : solde 1" "1" "$(sed -n 's/.*"balanceTokens":\([0-9]*\).*/\1/p' /tmp/tk-w4.json | head -1)"
check "API — après libération : 0 réservé" "0" "$(sed -n 's/.*"reservedTokens":\([0-9]*\).*/\1/p' /tmp/tk-w4.json | head -1)"

CODE=$(BOOK "$SLOT1" "14:00" $JAR)
check "API — re-book même créneau (RDV terminal) → 201" "201" "$CODE"
APPT2=$(sed -n 's/.*"appointment":{"id":"\([^"]*\)".*/\1/p' /tmp/tk-book.json)
CODE=$(curl -s -o /tmp/tk-done.json -w "%{http_code}" -b $JAR_ADMIN -X PATCH $BASE/appointments/$APPT2 -H "Content-Type: application/json" -d '{"action":"DONE"}')
check "API — Médecin Chef DONE → 200" "200" "$CODE"
check "API — RDV clôturé tokenState=CONSUMED" "yes" "$(grep -q '"tokenState":"CONSUMED"' /tmp/tk-done.json && echo yes || echo no)"
curl -s -b $JAR $BASE/wallet > /tmp/tk-w5.json
check "API — dépense définitive : solde 0" "0" "$(sed -n 's/.*"balanceTokens":\([0-9]*\).*/\1/p' /tmp/tk-w5.json | head -1)"
check "API — dépense définitive : 1 consommé" "1" "$(sed -n 's/.*"spentTokens":\([0-9]*\).*/\1/p' /tmp/tk-w5.json | head -1)"
check "API — dépense : 2 500 FCFA" "2500" "$(sed -n 's/.*"spentFcfa":\([0-9]*\).*/\1/p' /tmp/tk-w5.json | head -1)"

# ── 2. Navigateur — PATIENT desktop 1440×900 ────────────────────────────────
$AB close >/dev/null 2>&1
$AB set viewport 1440 900 >/dev/null
$AB open http://localhost:3000 >/dev/null
sleep 3
$AB eval "localStorage.clear(); sessionStorage.clear(); 'ok'" >/dev/null
echo "== login patient E2E: $(login "$E2E_PHONE_LOCAL" "$E2E_PWD")"
nav_click 3 >/dev/null; sleep 2   # Profil

check "Profil — section Portefeuille de Tokens" "yes" "$(body_has 'Portefeuille de Tokens')"
check "Profil — solde affiché (0 Token)" "yes" "$(body_has 'Tokens disponibles')"
check "Profil — dépense visible (2 500 FCFA)" "yes" "$(body_has '500 FCFA')"
check "Profil — historique : Consommation RDV" "yes" "$(body_has 'Consommation RDV')"
$AB screenshot $SHOT/tokens-wallet.png >/dev/null

recharge_ui
check "Recharge UI — toast de déclaration" "yes" "$(body_has 'Recharge déclarée')"
check "Recharge UI — mention en attente" "yes" "$(body_has 'recharge en attente')"
$AB screenshot $SHOT/tokens-recharge-dialog.png >/dev/null

logout
echo "== login Médecin Chef: $(login "+2250700000001" "Admin#MonDocPro2026")"
check "Admin — nav 3 onglets (Accueil/Recharges/Profil)" "Accueil | Recharges | Profil" "$(nav_labels)"
check "Admin — raccourci Recharges sur l'accueil" "yes" "$(body_has 'Recharges de Tokens')"
$AB screenshot $SHOT/tokens-admin-home.png >/dev/null
nav_click 2 >/dev/null; sleep 3   # Recharges (laisser le fetch aboutir)
check "Admin — vue recharges : file PENDING" "yes" "$(body_has 'À valider')"
check "Admin — recharge patient visible" "yes" "$(body_has 'Patient Tokens E2E')"
$AB screenshot $SHOT/tokens-admin-pending.png >/dev/null
$AB eval "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Confirmer le paiement'))?.click(); 'ok'" >/dev/null 2>&1
check "Admin — toast confirmation" "yes" "$(wait_body 'Recharge confirmée' 8 && echo yes || echo no)"
check "Admin — file vide après traitement" "yes" "$(wait_body 'Aucune recharge en attente' 12 && echo yes || echo no)"
$AB screenshot $SHOT/tokens-admin-processed.png >/dev/null

logout
echo "== re-login patient: $(login "$E2E_PHONE_LOCAL" "$E2E_PWD")"
nav_click 3 >/dev/null; sleep 2
check "Patient — solde crédité après confirmation admin (1)" "yes" "$(body_has 'Recharge')"
curl -s -b $JAR $BASE/wallet > /tmp/tk-w6.json
check "Patient — vérité serveur : solde 1" "1" "$(sed -n 's/.*"balanceTokens":\([0-9]*\).*/\1/p' /tmp/tk-w6.json | head -1)"

# Wizard RDV — étape 4 doit afficher Coût + Solde après réservation.
# Jour et créneau ciblés PAR GROUPE (radiogroup aria-label) : sans scoping,
# le 2e clic re-clique la puce du jour et l'étape 4 n'est jamais atteinte.
nav_click 2 >/dev/null; sleep 2   # Rendez-vous
$AB eval "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Nouveau RDV')?.click(); 'ok'" >/dev/null 2>&1
sleep 2
$AB eval "Array.from(document.querySelectorAll('[role=\"dialog\"] button')).find(b=>b.textContent.indexOf(' domicile')>=0)?.click(); 'ok'" >/dev/null 2>&1
sleep 1
$AB eval "Array.from(document.querySelectorAll('[role=\"dialog\"] button')).find(b=>b.textContent.trim()==='Continuer')?.click(); 'ok'" >/dev/null 2>&1
sleep 1
$AB eval "document.querySelector('[role=\"dialog\"] [role=\"radio\"]')?.click(); 'ok'" >/dev/null 2>&1   # 1re spécialité
sleep 1
$AB eval "Array.from(document.querySelectorAll('[role=\"dialog\"] button')).find(b=>b.textContent.trim()==='Continuer')?.click(); 'ok'" >/dev/null 2>&1
sleep 1
$AB eval "document.querySelector('[role=\"dialog\"] [role=\"radiogroup\"][aria-label*=\"jour\"] [role=\"radio\"]:not([disabled])')?.click(); 'ok'" >/dev/null 2>&1   # 1er jour ouvré
sleep 1
$AB eval "document.querySelector('[role=\"dialog\"] [role=\"radiogroup\"][aria-label*=\"heure\"] [role=\"radio\"]:not([disabled])')?.click(); 'ok'" >/dev/null 2>&1   # 1er créneau libre
sleep 1
$AB eval "Array.from(document.querySelectorAll('[role=\"dialog\"] button')).find(b=>b.textContent.trim()==='Continuer')?.click(); 'ok'" >/dev/null 2>&1
sleep 2
check "Wizard étape 4 — ligne Coût (1 Token · 2 500 FCFA)" "yes" "$(body_has '1 Token')"
check "Wizard étape 4 — ligne Solde après réservation" "yes" "$(body_has 'Solde après réservation')"
$AB screenshot $SHOT/tokens-cost-step.png >/dev/null
$AB eval "Array.from(document.querySelectorAll('[role=\"dialog\"] button')).find(b=>b.textContent.includes('Confirmer le rendez-vous'))?.click(); 'ok'" >/dev/null 2>&1
check "Wizard — RDV enregistré (toast)" "yes" "$(wait_body 'Rendez-vous enregistré' 14 && echo yes || echo no)"
$AB eval "document.querySelector('[role=\"dialog\"] button[aria-label=\"Close\"]')?.click(); 'ok'" >/dev/null 2>&1; sleep 2
$AB eval "document.querySelector('[role=\"dialog\"] button[aria-label=\"Close\"]')?.click(); 'ok'" >/dev/null 2>&1; sleep 2
curl -s -b $JAR $BASE/wallet > /tmp/tk-w7.json
check "Patient — après RDV UI : solde 0 (réservé)" "0" "$(sed -n 's/.*"balanceTokens":\([0-9]*\).*/\1/p' /tmp/tk-w7.json | head -1)"
check "Patient — après RDV UI : 1 en réservation" "1" "$(sed -n 's/.*"reservedTokens":\([0-9]*\).*/\1/p' /tmp/tk-w7.json | head -1)"

# ── 3. Mobile 390×844 ───────────────────────────────────────────────────────
$AB set viewport 390 844 >/dev/null
sleep 2
nav_click 3 >/dev/null; sleep 2
check "Mobile — portefeuille rendu" "yes" "$(body_has 'Portefeuille de Tokens')"
check "Mobile — aucun débordement horizontal" "ok" "$($AB eval "document.documentElement.scrollWidth<=392?'ok':'overflow:'+document.documentElement.scrollWidth" 2>/dev/null | tail -1 | tr -d '"')"
$AB screenshot $SHOT/tokens-mobile.png >/dev/null

# ── 4. Régression INFIRMIER ─────────────────────────────────────────────────
$AB set viewport 1440 900 >/dev/null; sleep 1
logout
echo "== login infirmier: $(login "0755666777" "TestInfirmier2026!")"
check "Infirmier — nav inchangée (2 onglets)" "Accueil | Profil" "$(nav_labels)"
nav_click 2 >/dev/null; sleep 2
check "Infirmier — profil simple conservé (pas de portefeuille)" "no" "$(body_has 'Portefeuille de Tokens')"
$AB screenshot $SHOT/tokens-infirmier.png >/dev/null

# ── 5. Erreurs page + nettoyage ─────────────────────────────────────────────
ERRS=$($AB errors 2>/dev/null | grep -c -i "error" || true)
bun scripts/tokens-fixture.ts clean "$E2E_PHONE" > /tmp/tk-clean.txt
check "Nettoyage — patient E2E supprimé (cascade)" "yes" "$(grep -q '1 utilisateur' /tmp/tk-clean.txt && echo yes || echo no)"
echo "PAGE_ERRORS=$ERRS"
echo "==============================="
echo "RESULT: PASS=$PASS FAIL=$FAIL"
$AB close >/dev/null 2>&1
[ $FAIL -eq 0 ] && echo "E2E GLOBAL: PASS" || echo "E2E GLOBAL: FAIL"
