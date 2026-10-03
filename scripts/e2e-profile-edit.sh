#!/bin/bash
# E2E — FEATURE-PROFIL Task 22 : birthDate + édition de profil (PATCH
# /api/auth/profile) + préférences « Rappels de rendez-vous » / « Alertes de
# santé locales » persistées.
# Suites :
#   1. API (curl) — 401 non authentifié, 400 payload invalide / futur / vide,
#      PATCH valide (200 + vérité renvoyée), injection role/phone ignorée,
#      préférence persistée, GET /me aligné, état fixture restauré.
#   2. Navigateur patient desktop — dialog Modifier (nom + naissance), toggles
#      optimistes, PERSISTANCE après reload, état fixture restauré.
#   3. Mobile 390×844 — rendu + zéro débordement.
#   4. Régression NURSE — nav 2 onglets + profil simple inchangés.
# Pièges plateforme intégrés : DATABASE_URL exportée avant boot (sinon login
# 500), serveur + parcours en un seul appel (process moissonnés entre appels),
# login par refs snapshot, evals avec strip des quotes, clics par sélecteurs.
set -u
cd /home/z/my-project
AB="agent-browser"
SHOT=/home/z/my-project/tool-results
JAR=/tmp/profile-e2e-cookies.txt
PASS=0; FAIL=0

check() {
  if [ "$2" = "$3" ]; then echo "PASS: $1"; PASS=$((PASS+1)); else echo "FAIL: $1 — attendu [$2] obtenu [$3]"; FAIL=$((FAIL+1)); fi
}
strip() { echo "$1" | tr -d '"'; }
nav_labels() { strip "$($AB eval "Array.from(document.querySelectorAll('nav[aria-label=\"Navigation principale\"] button')).map(b=>b.textContent.trim()).join(' | ')" 2>/dev/null | tail -1)"; }
body_has() { strip "$($AB eval "document.body.textContent.includes('$1') ? 'yes' : 'no'" 2>/dev/null | tail -1)"; }
nav_click() { $AB find first "nav[aria-label=\"Navigation principale\"] li:nth-child($1) button" click; }
# aria-checked du Nième switch de la vue profil (0 = Rappels RDV, 1 = Alertes).
pref_checked() { strip "$($AB eval "document.querySelectorAll('button[role=\"switch\"]')[$1]?.getAttribute('aria-checked')" 2>/dev/null | tail -1)"; }
pref_click() { $AB eval "document.querySelectorAll('button[role=\"switch\"]')[$1]?.click(); 'ok'" >/dev/null 2>&1; }
# Champ React contrôlé : setter natif + événements input/change (refs inutiles).
set_input() {
  $AB eval "(function(){var el=document.getElementById('$1');if(!el)return 'no-el';var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,'$2');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return 'ok';})()" >/dev/null 2>&1
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

open_edit_dialog() {
  $AB eval "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Modifier')?.click(); 'ok'" >/dev/null 2>&1
  sleep 2
}
submit_edit() {
  $AB eval "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Enregistrer')?.click(); 'ok'" >/dev/null 2>&1
  sleep 3
}

# ── 0. Boot serveur (DATABASE_URL exportée — piège 2) ─────────────────────────
pkill -f "next dev" 2>/dev/null; sleep 1
export DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')
nohup bun run dev > /tmp/dev-e2e.log 2>&1 &
OK=0
for i in $(seq 1 75); do
  sleep 2
  if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then OK=1; echo "HEALTH OK (${i}x2s)"; break; fi
done
[ $OK -eq 1 ] || { echo "SERVER DOWN"; tail -20 /tmp/dev-e2e.log; exit 1; }
echo "health: $(curl -s http://localhost:3000/api/health)"

# ── 1. Suite API — PATCH /api/auth/profile ───────────────────────────────────
BASE=http://localhost:3000/api
rm -f $JAR
# NB : la base stocke les téléphones au format international (+225…) — le
# formulaire de login normalise la saisie locale, pas curl. Les corps API
# utilisent donc le format +225 (contrat : indicatif optionnel).
CODE=$(curl -s -o /tmp/api-login.json -w "%{http_code}" -c $JAR -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"phone":"+2250709229992","password":"TestPatient2026!"}')
check "API — login patient" "200" "$CODE"
CODE=$(curl -s -o /tmp/api-r0.json -w "%{http_code}" -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{"birthDate":"1995-06-15"}')
check "API — PATCH sans session → 401" "401" "$CODE"
CODE=$(curl -s -o /tmp/api-r1.json -w "%{http_code}" -b $JAR -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{"birthDate":"2999-01-01"}')
check "API — naissance dans le futur → 400" "400" "$CODE"
CODE=$(curl -s -o /tmp/api-r2.json -w "%{http_code}" -b $JAR -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{"birthDate":"15/06/1995"}')
check "API — format de date invalide → 400" "400" "$CODE"
CODE=$(curl -s -o /tmp/api-r3.json -w "%{http_code}" -b $JAR -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{}')
check "API — corps vide (aucune modif) → 400" "400" "$CODE"
curl -s -o /tmp/api-r4.json -w "%{http_code}" -b $JAR -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{"fullName":"Patient API Test","birthDate":"1995-06-15","appointmentReminders":false}' > /tmp/api-r4.code
check "API — PATCH valide → 200" "200" "$(cat /tmp/api-r4.code)"
check "API — birthDate ISO minuit UTC renvoyé" "yes" "$(grep -q '1995-06-15' /tmp/api-r4.json && echo yes || echo no)"
check "API — préférence false renvoyée" "yes" "$(grep -q '"appointmentReminders":false' /tmp/api-r4.json && echo yes || echo no)"
# Injection : role/phone absents du contrat Zod → stripped → plus aucun champ
# modifiable dans le corps → l'API REFUSE (400 « Aucune modification fournie ») :
# défense plus forte qu'un simple ignore silencieux. (Zone : éditable depuis la
# Task 23 — retirée de ce corps d'injection, couverte par e2e-sector-reminders.sh.)
curl -s -o /tmp/api-r5.json -w "%{http_code}" -b $JAR -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{"role":"ADMIN","phone":"+2250700000000"}' > /tmp/api-r5.code
check "API — injection role/phone → 400 (aucun champ modifiable)" "400" "$(cat /tmp/api-r5.code)"
check "API — message d'injection explicite" "yes" "$(grep -q 'Aucune modification fournie' /tmp/api-r5.json && echo yes || echo no)"
curl -s -b $JAR $BASE/auth/me > /tmp/api-me.json
check "API — /me : rôle toujours PATIENT" "yes" "$(grep -q '"role":"PATIENT"' /tmp/api-me.json && echo yes || echo no)"
check "API — /me : téléphone inchangé" "yes" "$(grep -q '0709229992' /tmp/api-me.json && echo yes || echo no)"  # sous-chaîne de +2250709229992
check "API — /me : birthDate persistée" "yes" "$(grep -q '1995-06-15' /tmp/api-me.json && echo yes || echo no)"
curl -s -o /tmp/api-r6.json -w "%{http_code}" -b $JAR -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{"birthDate":null}' > /tmp/api-r6.code
check "API — birthDate null → effacer (200)" "200" "$(cat /tmp/api-r6.code)"
# Multi-rôles : un NURSE édite aussi son profil (le sien uniquement).
rm -f $JAR
CODE=$(curl -s -o /dev/null -w "%{http_code}" -c $JAR -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"phone":"+2250755666777","password":"TestInfirmier2026!"}')
CODE=$(curl -s -o /tmp/api-r7.json -w "%{http_code}" -b $JAR -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{"healthAlerts":false}')
check "API — PATCH profil infirmier → 200" "200" "$CODE"
curl -s -o /dev/null -b $JAR -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{"healthAlerts":true}'
# Restauration fixture patient (nom, naissance, préférences par défaut).
rm -f $JAR
curl -s -o /dev/null -c $JAR -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"phone":"+2250709229992","password":"TestPatient2026!"}'
curl -s -o /dev/null -b $JAR -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{"fullName":"Patient UI Maquette","appointmentReminders":true}'
curl -s -b $JAR $BASE/auth/me > /tmp/api-me2.json
check "API — fixture restaurée (nom + prefs true)" "yes/yes" "$(grep -q 'Patient UI Maquette' /tmp/api-me2.json && echo yes || echo no)/$(grep -q '"appointmentReminders":true' /tmp/api-me2.json && echo yes || echo no)"

# ── 2. Navigateur — PATIENT desktop 1440×900 : dialog + toggles ──────────────
$AB close >/dev/null 2>&1
$AB set viewport 1440 900 >/dev/null
$AB open http://localhost:3000 >/dev/null
sleep 3
$AB eval "localStorage.clear(); sessionStorage.clear(); 'ok'" >/dev/null
echo "== login patient: $(login "0709229992" "TestPatient2026!")"
nav_click 3 >/dev/null; sleep 2   # Profil (3e onglet patient)

check "Profil — naissance « Non renseignée » (état initial)" "yes" "$(body_has 'Non renseignée')"
check "Profil — switches actifs (0 désactivé)" "0" "$($AB eval "document.querySelectorAll('button[role=\"switch\"][disabled]').length" 2>/dev/null | tail -1 | tr -d '"')"
check "Profil — rappels RDV actif par défaut" "true" "$(pref_checked 0)"
check "Profil — alertes locales actives par défaut" "true" "$(pref_checked 1)"

open_edit_dialog
check "Dialog — ouvert avec nom pré-rempli" "Patient UI Maquette" "$($AB eval "document.getElementById('profile-fullname')?.value" 2>/dev/null | tail -1 | tr -d '"')"
set_input "profile-birthdate" "1995-06-15"
set_input "profile-fullname" "Patient Maquette UI"
$AB screenshot $SHOT/profile-edit-dialog.png >/dev/null
submit_edit
check "Édition — héro mis à jour (store auth)" "yes" "$(body_has 'Patient Maquette UI')"
check "Édition — naissance affichée « 15 juin 1995 »" "yes" "$(body_has '15 juin 1995')"
check "Édition — dialog fermé" "no-el" "$($AB eval "document.getElementById('profile-fullname')?'el':'no-el'" 2>/dev/null | tail -1 | tr -d '"')"

pref_click 0; sleep 3
check "Toggle — rappels RDV désactivés (optimiste)" "false" "$(pref_checked 0)"
pref_click 1; sleep 3
check "Toggle — alertes locales désactivées" "false" "$(pref_checked 1)"
$AB screenshot $SHOT/profile-edit-desktop.png >/dev/null

# PERSISTANCE : reload complet → les valeurs viennent du serveur.
$AB reload >/dev/null; sleep 6
nav_click 3 >/dev/null; sleep 2
check "Persisté — nom après reload" "yes" "$(body_has 'Patient Maquette UI')"
check "Persisté — naissance après reload" "yes" "$(body_has '15 juin 1995')"
check "Persisté — rappels RDV désactivé après reload" "false" "$(pref_checked 0)"
check "Persisté — alertes désactivées après reload" "false" "$(pref_checked 1)"
$AB screenshot $SHOT/profile-edit-persisted.png >/dev/null

# Restauration via l'UI (fixture propre pour les prochaines exécutions).
pref_click 0; sleep 2.5
pref_click 1; sleep 2.5
open_edit_dialog
set_input "profile-fullname" "Patient UI Maquette"
set_input "profile-birthdate" ""
submit_edit
check "Restauration — nom d'origine" "yes" "$(body_has 'Patient UI Maquette')"
check "Restauration — naissance « Non renseignée »" "yes" "$(body_has 'Non renseignée')"
check "Restauration — switches tous actifs" "true/true" "$(pref_checked 0)/$(pref_checked 1)"

# ── 3. Mobile 390×844 ────────────────────────────────────────────────────────
$AB set viewport 390 844 >/dev/null
sleep 2
check "Mobile — vue profil rendue" "yes" "$(body_has 'Informations Personnelles')"
check "Mobile — aucun débordement horizontal" "ok" "$($AB eval "document.documentElement.scrollWidth<=392?'ok':'overflow:'+document.documentElement.scrollWidth" 2>/dev/null | tail -1 | tr -d '"')"
open_edit_dialog
check "Mobile — dialog d'édition utilisable" "Patient UI Maquette" "$($AB eval "document.getElementById('profile-fullname')?.value" 2>/dev/null | tail -1 | tr -d '"')"
$AB eval "document.querySelector('[role=\"dialog\"] button[aria-label=\"Close\"]')?.click(); 'ok'" >/dev/null 2>&1; sleep 1
$AB screenshot $SHOT/profile-edit-mobile.png >/dev/null

# ── 4. Régression NURSE ──────────────────────────────────────────────────
$AB set viewport 1440 900 >/dev/null; sleep 1
$AB eval "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Se déconnecter'))?.click(); 'ok'" >/dev/null; sleep 4
echo "== login infirmier: $(login "0755666777" "TestInfirmier2026!")"
check "Infirmier — nav inchangée (2 onglets)" "Accueil | Profil" "$(nav_labels)"
nav_click 2 >/dev/null; sleep 2
check "Infirmier — profil simple conservé" "yes" "$(body_has 'Vos informations de compte')"
$AB screenshot $SHOT/profile-edit-infirmier.png >/dev/null

# ── 5. Console / erreurs page ────────────────────────────────────────────────
ERRS=$($AB errors 2>/dev/null | grep -c -i "error" || true)
echo "PAGE_ERRORS=$ERRS"
echo "==============================="
echo "RESULT: PASS=$PASS FAIL=$FAIL"
$AB close >/dev/null 2>&1
[ $FAIL -eq 0 ] && echo "E2E GLOBAL: PASS" || echo "E2E GLOBAL: FAIL"
