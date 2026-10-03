#!/bin/bash
# E2E — Task 23 : édition du secteur d'habitation (même modèle PATCH que
# nom/naissance) + « Rappels de rendez-vous » (uniquement AVANT les RDV, canal
# SMS — passerelle au stade stub console tant que la décision A10 est ouverte).
# Suites :
#   1. API — PATCH zone (valide, invalide, restauration) ;
#      scheduler /api/cron/reminders : 401 sans/mauvais secret, résumé 200,
#      envoi stub 1 RDV CONFIRMÉ dû (23 h), ANTI-DOUBLON au 2e tick,
#      PENDING jamais rappelé, patient opt-out jamais rappelé, nettoyage.
#   2. Navigateur patient desktop — dialog « Modifier mon secteur » (Select 4
#      options), PATCH via UI, héro + ligne mis à jour, PERSISTANCE après reload,
#      copy rappels « envoi bientôt actif », restauration via API.
#   3. Mobile 390×844 — rendu + zéro débordement + dialog utilisable.
#   4. Régression INFIRMIER — nav 2 onglets inchangée.
# Pièges plateforme intégrés : DATABASE_URL exportée avant boot (sinon login
# 500), CRON_SECRET exporté avant boot (sinon scheduler 503), serveur + parcours
# en un seul appel, login par refs snapshot, evals strip des quotes.
set -u
cd /home/z/my-project
AB="agent-browser"
SHOT=/home/z/my-project/tool-results
JAR=/tmp/sector-e2e-cookies.txt
PASS=0; FAIL=0

check() {
  if [ "$2" = "$3" ]; then echo "PASS: $1"; PASS=$((PASS+1)); else echo "FAIL: $1 — attendu [$2] obtenu [$3]"; FAIL=$((FAIL+1)); fi
}
strip() { echo "$1" | tr -d '"'; }
nav_labels() { strip "$($AB eval "Array.from(document.querySelectorAll('nav[aria-label=\"Navigation principale\"] button')).map(b=>b.textContent.trim()).join(' | ')" 2>/dev/null | tail -1)"; }
body_has() { strip "$($AB eval "document.body.textContent.includes('$1') ? 'yes' : 'no'" 2>/dev/null | tail -1)"; }
nav_click() { $AB find first "nav[aria-label=\"Navigation principale\"] li:nth-child($1) button" click; }
# Ligne « Secteur d'habitation » : bouton dont l'aria-label contient "secteur"
# (apostrophe du libellé → pas de littéral dans le sélecteur CSS).
sector_click() {
  $AB eval "Array.from(document.querySelectorAll('button')).find(function(b){return (b.getAttribute('aria-label')||'').indexOf('secteur')>=0})?.click(); 'ok'" >/dev/null 2>&1
  sleep 2
}
# Radix Select : ouverture sur pointerdown (el.click() seul ne suffit pas).
select_open() {
  $AB eval "(function(){var el=document.getElementById('profile-zone');if(!el)return 'no-el';el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,button:0}));el.click();return 'ok';})()" >/dev/null 2>&1
  sleep 2
}
select_pick() {
  $AB eval "(function(){var o=Array.from(document.querySelectorAll('[role=\"option\"]')).find(function(x){return x.textContent.indexOf('$1')>=0});if(!o)return 'no-opt';o.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1,button:0}));o.click();return 'ok';})()" >/dev/null 2>&1
  sleep 1
}
submit_edit() {
  $AB eval "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Enregistrer')?.click(); 'ok'" >/dev/null 2>&1
  sleep 3
}

login() {
  $AB reload >/dev/null
  sleep 5
  local SNAP REFS PHONE_REF PWD_REF BTN_REF i
  SNAP=$($AB snapshot -i 2>/dev/null)
  REFS=$(echo "$SNAP" | grep 'textbox' | sed -n 's/.*ref=\(e[0-9]*\)\].*/\1/p')
  PHONE_REF=$(echo "$REFS" | sed -n 1p); PWD_REF=$(echo "$REFS" | sed -n 2p)
  BTN_REF=$(echo "$SNAP" | grep 'button "Se connecter"' | sed -n 's/.*ref=\(e[0-9]*\)\].*/\1/p' | head -1)
  echo "  [login $1] refs phone=$PHONE_REF pwd=$PWD_REF btn=$BTN_REF"
  [ -z "$PHONE_REF" ] || [ -z "$PWD_REF" ] || [ -z "$BTN_REF" ] && { echo "  [login] formulaire introuvable"; return 1; }
  $AB fill "@$PHONE_REF" "$1" >/dev/null
  $AB fill "@$PWD_REF" "$2" >/dev/null
  $AB click "@$BTN_REF" >/dev/null
  for i in $(seq 1 12); do
    sleep 1
    [ -n "$(nav_labels)" ] && break
  done
  nav_labels
}

# ── 0. Boot serveur (DATABASE_URL + CRON_SECRET exportées — pièges 2/3) ──────
pkill -f "next dev" 2>/dev/null; sleep 1
export DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')
export CRON_SECRET=e2e-cron-secret-2026
rm -f /tmp/dev-e2e.log
nohup bun run dev > /tmp/dev-e2e.log 2>&1 &
OK=0
for i in $(seq 1 75); do
  sleep 2
  if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then OK=1; echo "HEALTH OK (${i}x2s)"; break; fi
done
[ $OK -eq 1 ] || { echo "SERVER DOWN"; tail -20 /tmp/dev-e2e.log; exit 1; }
echo "health: $(curl -s http://localhost:3000/api/health)"

# ── 1. Suite API — zone + scheduler de rappels ───────────────────────────────
BASE=http://localhost:3000/api
rm -f $JAR
# NB : téléphones stockés au format international (+225…) — corps API en +225.
CODE=$(curl -s -o /tmp/api-login.json -w "%{http_code}" -c $JAR -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"phone":"+2250709229992","password":"TestPatient2026!"}')
check "API — login patient" "200" "$CODE"
curl -s -b $JAR $BASE/auth/me > /tmp/api-me0.json
ZONE_ORIG=$(sed -n 's/.*"zone":"\([A-Z0-9_]*\)".*/\1/p' /tmp/api-me0.json | head -1)
check "API — zone courante lue" "yes" "$([ -n "$ZONE_ORIG" ] && echo yes || echo no)"
case "$ZONE_ORIG" in
  YOPOUGON) ZONE_ORIG_CHECK="Yopougon" ;;
  SONGON)   ZONE_ORIG_CHECK="Songon" ;;
  PK22)     ZONE_ORIG_CHECK="PK22" ;;
  *)        ZONE_ORIG_CHECK="Dotr" ;;
esac
echo "  [fixture] zone origine = $ZONE_ORIG"

CODE=$(curl -s -o /tmp/api-z0.json -w "%{http_code}" -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{"zone":"SONGON"}')
check "API — PATCH zone sans session → 401" "401" "$CODE"
CODE=$(curl -s -o /tmp/api-z1.json -w "%{http_code}" -b $JAR -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{"zone":"SONGON"}')
check "API — PATCH zone valide → 200" "200" "$CODE"
check "API — zone renvoyée = SONGON" "yes" "$(grep -q '"zone":"SONGON"' /tmp/api-z1.json && echo yes || echo no)"
CODE=$(curl -s -o /tmp/api-z2.json -w "%{http_code}" -b $JAR -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{"zone":"ABIDJAN"}')
check "API — zone hors liste fermée → 400" "400" "$CODE"
# role/phone restent hors contrat → stripped → 400 « Aucune modification ».
CODE=$(curl -s -o /tmp/api-z3.json -w "%{http_code}" -b $JAR -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{"role":"ADMIN","phone":"+2250700000000"}')
check "API — injection role/phone → 400" "400" "$CODE"

# — Scheduler des rappels (stub console — A10 ouverte) —
CODE=$(curl -s -o /tmp/api-c0.json -w "%{http_code}" $BASE/cron/reminders)
check "Cron — sans secret → 401" "401" "$CODE"
CODE=$(curl -s -o /tmp/api-c1.json -w "%{http_code}" -H "Authorization: Bearer mauvais-secret" $BASE/cron/reminders)
check "Cron — mauvais secret → 401" "401" "$CODE"
CODE=$(curl -s -o /tmp/api-c2.json -w "%{http_code}" -H "Authorization: Bearer $CRON_SECRET" $BASE/cron/reminders)
check "Cron — bon secret → 200" "200" "$CODE"
check "Cron — aucun RDV dû (base saine)" "0/0" "$(grep -o '"sent":[0-9]*' /tmp/api-c2.json | cut -d: -f2)/$(grep -o '"due":[0-9]*' /tmp/api-c2.json | cut -d: -f2)"

# Opt-in explicite (état connu) — le fixture est neutre sur la préférence.
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{"appointmentReminders":true}')
check "API — opt-in explicite avant fixtures → 200" "200" "$CODE"

bun scripts/reminder-fixture.ts create > /tmp/fixture1.txt
check "Fixture — RDV CONFIRMED dû créé" "yes" "$(grep -q 'status=CONFIRMED' /tmp/fixture1.txt && echo yes || echo no)"
curl -s -o /tmp/api-c3.json -H "Authorization: Bearer $CRON_SECRET" $BASE/cron/reminders
check "Cron — 1 RDV dû → 1 envoi" "1/1" "$(grep -o '"sent":[0-9]*' /tmp/api-c3.json | cut -d: -f2)/$(grep -o '"due":[0-9]*' /tmp/api-c3.json | cut -d: -f2)"
check "Cron — passerelle = stub (A10)" "yes" "$(grep -q 'console-stub' /tmp/api-c3.json && echo yes || echo no)"
check "Stub SMS — message journalisé serveur" "yes" "$(grep -q 'SMS:stub' /tmp/dev-e2e.log && echo yes || echo no)"
curl -s -o /tmp/api-c4.json -H "Authorization: Bearer $CRON_SECRET" $BASE/cron/reminders
check "Cron — ANTI-DOUBLON (2e tick → 0 dû)" "0/0" "$(grep -o '"sent":[0-9]*' /tmp/api-c4.json | cut -d: -f2)/$(grep -o '"due":[0-9]*' /tmp/api-c4.json | cut -d: -f2)"

bun scripts/reminder-fixture.ts create-pending > /tmp/fixture2.txt
curl -s -o /tmp/api-c5.json -H "Authorization: Bearer $CRON_SECRET" $BASE/cron/reminders
check "Cron — RDV PENDING jamais rappelé" "0/0" "$(grep -o '"sent":[0-9]*' /tmp/api-c5.json | cut -d: -f2)/$(grep -o '"due":[0-9]*' /tmp/api-c5.json | cut -d: -f2)"

curl -s -o /dev/null -b $JAR -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{"appointmentReminders":false}'
bun scripts/reminder-fixture.ts create > /tmp/fixture3.txt
curl -s -o /tmp/api-c6.json -H "Authorization: Bearer $CRON_SECRET" $BASE/cron/reminders
check "Cron — patient opt-out jamais rappelé" "0/0" "$(grep -o '"sent":[0-9]*' /tmp/api-c6.json | cut -d: -f2)/$(grep -o '"due":[0-9]*' /tmp/api-c6.json | cut -d: -f2)"
curl -s -o /dev/null -b $JAR -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{"appointmentReminders":true}'

bun scripts/reminder-fixture.ts clean > /tmp/fixture4.txt
curl -s -o /tmp/api-c7.json -H "Authorization: Bearer $CRON_SECRET" $BASE/cron/reminders > /dev/null
check "Stub SMS — exactement 1 envoi sur tout le run" "1" "$(grep -c 'SMS:stub' /tmp/dev-e2e.log)"

# ── 2. Navigateur — PATIENT desktop 1440×900 : dialog secteur ────────────────
$AB close >/dev/null 2>&1
$AB set viewport 1440 900 >/dev/null
$AB open http://localhost:3000 >/dev/null
sleep 3
$AB eval "localStorage.clear(); sessionStorage.clear(); 'ok'" >/dev/null
echo "== login patient: $(login "0709229992" "TestPatient2026!")"
nav_click 3 >/dev/null; sleep 2   # Profil (3e onglet patient)

check "Profil — copy rappels = SMS avant RDV" "yes" "$(body_has 'Un SMS de rappel 24 h avant chacun de vos rendez-vous')"
check "Profil — mention envoi bientôt actif (A10)" "yes" "$(body_has 'envoi bientôt actif')"
check "Profil — secteur affiché (zone origine)" "yes" "$(body_has "$ZONE_ORIG_CHECK")"

sector_click
check "Dialog — « Modifier mon secteur » ouvert" "yes" "$(body_has 'Modifier mon secteur')"
select_open
check "Dialog — 4 options de secteur" "4" "$($AB eval "document.querySelectorAll('[role=\"option\"]').length" 2>/dev/null | tail -1 | tr -d '"')"
select_pick "Songon"
$AB screenshot $SHOT/sector-reminders-dialog.png >/dev/null
submit_edit
check "Secteur — héro mis à jour (Songon)" "yes" "$(body_has 'Songon')"
check "Secteur — toast de confirmation" "yes" "$(body_has 'Secteur mis à jour')"
check "Secteur — dialog fermé" "no-el" "$($AB eval "document.getElementById('profile-zone')?'el':'no-el'" 2>/dev/null | tail -1 | tr -d '"')"

# PERSISTANCE : reload → la zone vient du serveur.
$AB reload >/dev/null; sleep 6
nav_click 3 >/dev/null; sleep 2
check "Persisté — secteur Songon après reload" "yes" "$(body_has 'Songon')"
$AB screenshot $SHOT/sector-reminders-desktop.png >/dev/null

# Restauration du fixture via API (l'édition UI est déjà prouvée).
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d "{\"zone\":\"$ZONE_ORIG\"}")
check "Restauration — zone d'origine via API → 200" "200" "$CODE"
$AB reload >/dev/null; sleep 6
nav_click 3 >/dev/null; sleep 2
check "Restauré — héro sur zone d'origine" "yes" "$(body_has "$ZONE_ORIG_CHECK")"

# ── 3. Mobile 390×844 ────────────────────────────────────────────────────────
$AB set viewport 390 844 >/dev/null
sleep 2
check "Mobile — vue profil rendue" "yes" "$(body_has 'Informations Personnelles')"
check "Mobile — aucun débordement horizontal" "ok" "$($AB eval "document.documentElement.scrollWidth<=392?'ok':'overflow:'+document.documentElement.scrollWidth" 2>/dev/null | tail -1 | tr -d '"')"
sector_click
check "Mobile — dialog secteur utilisable" "yes" "$(body_has 'Modifier mon secteur')"
select_open
check "Mobile — select rendu" "yes" "$($AB eval "document.getElementById('profile-zone')?'yes':'no'" 2>/dev/null | tail -1 | tr -d '"')"
$AB screenshot $SHOT/sector-reminders-mobile.png >/dev/null
$AB eval "document.querySelector('[role=\"dialog\"] button[aria-label=\"Close\"]')?.click(); 'ok'" >/dev/null 2>&1; sleep 1

# ── 4. Régression INFIRMIER ──────────────────────────────────────────────────
$AB set viewport 1440 900 >/dev/null; sleep 1
$AB eval "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Se déconnecter'))?.click(); 'ok'" >/dev/null; sleep 4
echo "== login infirmier: $(login "0755666777" "TestInfirmier2026!")"
check "Infirmier — nav inchangée (2 onglets)" "Accueil | Profil" "$(nav_labels)"
nav_click 2 >/dev/null; sleep 2
check "Infirmier — profil simple conservé" "yes" "$(body_has 'Vos informations de compte')"
$AB screenshot $SHOT/sector-reminders-infirmier.png >/dev/null

# ── 5. Console / erreurs page ────────────────────────────────────────────────
ERRS=$($AB errors 2>/dev/null | grep -c -i "error" || true)
echo "PAGE_ERRORS=$ERRS"
echo "==============================="
echo "RESULT: PASS=$PASS FAIL=$FAIL"
$AB close >/dev/null 2>&1
[ $FAIL -eq 0 ] && echo "E2E GLOBAL: PASS" || echo "E2E GLOBAL: FAIL"
