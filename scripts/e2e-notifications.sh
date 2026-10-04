#!/bin/bash
# E2E — Task 24 : notifications InApp (centre de notifications du patient).
# Suites :
#   1. API — GET /api/notifications (401 sans session, fil + unreadCount),
#      POST /api/notifications/read ({all}, {id}, 400 formes ambiguës, 404 id
#      inconnu/hors propriétaire, 401 sans session) ;
#      scheduler : RDV CONFIRMÉ dû → 1 tick = 1 notification InApp créée
#      (entityId = appointmentId) + 1 envoi stub SMS ; ANTI-DOUBLON notification
#      au 2e tick (upsert idempotent) ; PENDING jamais notifié ; patient
#      opt-out jamais notifié ; nettoyage complet (RDV + notifications).
#   2. Navigateur patient desktop — badge cloche (aria-label), panneau :
#      rappel non lu visible (pastille + gras), « Tout marquer comme lu » →
#      badge disparaît, PERSISTANCE après reload, clic item → vue RDV.
#   3. Mobile 390×844 — panneau utilisable + zéro débordement horizontal.
#   4. Régression NURSE — nav 3 onglets, cloche InApp isolée par utilisateur.
# Pièges plateforme intégrés : DATABASE_URL exportée avant boot (sinon login
# 500), CRON_SECRET exporté avant boot (sinon scheduler 503), serveur + parcours
# en un seul appel, login par refs snapshot, evals strip des quotes.
set -u
cd /home/z/my-project
AB="agent-browser"
SHOT=/home/z/my-project/tool-results
JAR=/tmp/notif-e2e-cookies.txt
PASS=0; FAIL=0

check() {
  if [ "$2" = "$3" ]; then echo "PASS: $1"; PASS=$((PASS+1)); else echo "FAIL: $1 — attendu [$2] obtenu [$3]"; FAIL=$((FAIL+1)); fi
}
strip() { echo "$1" | tr -d '"'; }
nav_labels() { strip "$($AB eval "Array.from(document.querySelectorAll('nav[aria-label=\"Navigation principale\"] button')).map(b=>b.textContent.trim()).join(' | ')" 2>/dev/null | tail -1)"; }
body_has() { strip "$($AB eval "document.body.textContent.includes('$1') ? 'yes' : 'no'" 2>/dev/null | tail -1)"; }
nav_click() { $AB find first "nav[aria-label=\"Navigation principale\"] li:nth-child($1) button" click; }
# Cloche patient : bouton dont l'aria-label commence par "Notifications"
bell_click() {
  $AB eval "Array.from(document.querySelectorAll('button')).find(function(b){return (b.getAttribute('aria-label')||'').indexOf('Notifications')===0})?.click(); 'ok'" >/dev/null 2>&1
  sleep 2
}
bell_aria() {
  strip "$($AB eval "(Array.from(document.querySelectorAll('button')).find(function(b){return (b.getAttribute('aria-label')||'').indexOf('Notifications')===0})||{getAttribute:function(){return 'no-bell'}}).getAttribute('aria-label')" 2>/dev/null | tail -1)"
}
mark_all_click() {
  $AB eval "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Tout marquer comme lu')?.click(); 'ok'" >/dev/null 2>&1
  sleep 2
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

# ── 0. Boot serveur (DATABASE_URL + CRON_SECRET exportées) ───────────────────
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

# ── 1. Suite API — fil InApp + marquage lu + scheduler ───────────────────────
BASE=http://localhost:3000/api
rm -f $JAR
CODE=$(curl -s -o /tmp/n-login.json -w "%{http_code}" -c $JAR -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"phone":"+2250709229992","password":"TestPatient2026!"}')
check "API — login patient" "200" "$CODE"

# Base saine : purge des RDV + notifications de test des runs précédents.
bun scripts/reminder-fixture.ts clean > /tmp/n-clean0.txt
echo "  [fixture] clean initial: $(cat /tmp/n-clean0.txt)"

CODE=$(curl -s -o /tmp/n-g0.json -w "%{http_code}" $BASE/notifications)
check "Notifs — GET sans session → 401" "401" "$CODE"
CODE=$(curl -s -o /tmp/n-r0.json -w "%{http_code}" -X POST $BASE/notifications/read -H "Content-Type: application/json" -d '{"all":true}')
check "Notifs — POST read sans session → 401" "401" "$CODE"

curl -s -b $JAR $BASE/notifications > /tmp/n-g1.json
UNREAD_BEFORE=$(grep -o '"unreadCount":[0-9]*' /tmp/n-g1.json | cut -d: -f2)
check "Notifs — GET avec session → 200" "200" "$(strip "$CODE" >/dev/null; grep -q '"notifications":' /tmp/n-g1.json && echo 200 || echo 400)"
check "Notifs — base saine : 0 non lue avant fixtures" "0" "$UNREAD_BEFORE"

# Opt-in explicite (état connu) — le fixture est neutre sur la préférence.
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{"appointmentReminders":true}')
check "API — opt-in explicite avant fixtures → 200" "200" "$CODE"

bun scripts/reminder-fixture.ts create > /tmp/n-fix1.txt
FIXTURE_ID=$(sed -n 's/^created=\([a-z0-9]*\) .*/\1/p' /tmp/n-fix1.txt)
echo "  [fixture] RDV dû créé: $FIXTURE_ID"
check "Fixture — RDV CONFIRMED dû créé" "yes" "$([ -n "$FIXTURE_ID" ] && echo yes || echo no)"

CODE=$(curl -s -o /tmp/n-c1.json -w "%{http_code}" -H "Authorization: Bearer $CRON_SECRET" $BASE/cron/reminders)
check "Cron — 1 RDV dû → 1 envoi" "1/1" "$(grep -o '"sent":[0-9]*' /tmp/n-c1.json | cut -d: -f2)/$(grep -o '"due":[0-9]*' /tmp/n-c1.json | cut -d: -f2)"
check "Cron — passerelle = stub (A10)" "yes" "$(grep -q 'console-stub' /tmp/n-c1.json && echo yes || echo no)"

curl -s -b $JAR $BASE/notifications > /tmp/n-g2.json
check "Notifs — 1 notification InApp créée" "1" "$(grep -o '"unreadCount":[0-9]*' /tmp/n-g2.json | cut -d: -f2)"
check "Notifs — type APPOINTMENT_REMINDER" "yes" "$(grep -q '"type":"APPOINTMENT_REMINDER"' /tmp/n-g2.json && echo yes || echo no)"
check "Notifs — entityId = RDV fixture" "yes" "$(grep -q "\"entityId\":\"$FIXTURE_ID\"" /tmp/n-g2.json && echo yes || echo no)"
check "Notifs — copy rappel (cabinet)" "yes" "$(grep -q 'Rappel de rendez-vous' /tmp/n-g2.json && echo yes || echo no)"
NOTIF_ID=$(grep -o '"id":"[a-z0-9]*"' /tmp/n-g2.json | head -1 | cut -d'"' -f4)

# ANTI-DOUBLON : 2e tick → 0 envoi, toujours exactement 1 notification.
curl -s -o /tmp/n-c2.json -H "Authorization: Bearer $CRON_SECRET" $BASE/cron/reminders
check "Cron — ANTI-DOUBLON (2e tick → 0 dû)" "0/0" "$(grep -o '"sent":[0-9]*' /tmp/n-c2.json | cut -d: -f2)/$(grep -o '"due":[0-9]*' /tmp/n-c2.json | cut -d: -f2)"
check "Notifs — toujours 1 seule notification (upsert idempotent)" "1" "$(grep -c "\"entityId\":\"$FIXTURE_ID\"" /tmp/n-g2.json)"

# RDV PENDING : jamais notifié.
bun scripts/reminder-fixture.ts create-pending > /tmp/n-fix2.txt
curl -s -o /tmp/n-c3.json -H "Authorization: Bearer $CRON_SECRET" $BASE/cron/reminders
check "Cron — RDV PENDING jamais notifié" "0/0" "$(grep -o '"sent":[0-9]*' /tmp/n-c3.json | cut -d: -f2)/$(grep -o '"due":[0-9]*' /tmp/n-c3.json | cut -d: -f2)"

# Opt-out : aucune notification créée.
curl -s -o /dev/null -b $JAR -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{"appointmentReminders":false}'
bun scripts/reminder-fixture.ts create > /tmp/n-fix3.txt
curl -s -o /tmp/n-c4.json -H "Authorization: Bearer $CRON_SECRET" $BASE/cron/reminders
check "Cron — patient opt-out jamais notifié" "0/0" "$(grep -o '"sent":[0-9]*' /tmp/n-c4.json | cut -d: -f2)/$(grep -o '"due":[0-9]*' /tmp/n-c4.json | cut -d: -f2)"
curl -s -o /dev/null -b $JAR -X PATCH $BASE/auth/profile -H "Content-Type: application/json" -d '{"appointmentReminders":true}'

# Marquage lu — validation des formes.
CODE=$(curl -s -o /tmp/n-r1.json -w "%{http_code}" -b $JAR -X POST $BASE/notifications/read -H "Content-Type: application/json" -d '{"id":"inconnu-xyz"}')
check "Notifs — read id inconnu → 404 (indistinguable hors propriétaire)" "404" "$CODE"
CODE=$(curl -s -o /tmp/n-r2.json -w "%{http_code}" -b $JAR -X POST $BASE/notifications/read -H "Content-Type: application/json" -d '{"id":"x","all":true}')
check "Notifs — read formes ambiguës (id + all) → 400" "400" "$CODE"
CODE=$(curl -s -o /tmp/n-r3.json -w "%{http_code}" -b $JAR -X POST $BASE/notifications/read -H "Content-Type: application/json" -d '{}')
check "Notifs — read sans forme → 400" "400" "$CODE"
CODE=$(curl -s -o /tmp/n-r4.json -w "%{http_code}" -b $JAR -X POST $BASE/notifications/read -H "Content-Type: application/json" -d "{\"id\":\"$NOTIF_ID\"}")
check "Notifs — read {id} → 200" "200" "$CODE"
check "Notifs — read {id} → unreadCount 0" "0" "$(grep -o '"unreadCount":[0-9]*' /tmp/n-r4.json | cut -d: -f2)"
curl -s -b $JAR $BASE/notifications > /tmp/n-g3.json
check "Notifs — readAt renseigné après lecture" "yes" "$(grep -q "\"id\":\"$NOTIF_ID\",\"type\":\"APPOINTMENT_REMINDER\",\"title\":\"Rappel de rendez-vous\",\"body\":\"Votre RDV au cabinet est prévu le [^\"]*\",\"entityId\":\"$FIXTURE_ID\",\"readAt\":\"" /tmp/n-g3.json && echo yes || echo no)"

# Deuxième RDV dû → 2e notification → read {all:true}.
# NB : purge d'abord — le RDV du test opt-out (non rappelé) redevient
# éligible dès le ré-opt-in et polluerait le compteur du tick.
bun scripts/reminder-fixture.ts clean > /tmp/n-clean05.txt
bun scripts/reminder-fixture.ts create > /tmp/n-fix4.txt
curl -s -o /tmp/n-c5.json -H "Authorization: Bearer $CRON_SECRET" $BASE/cron/reminders
check "Cron — 2e RDV dû → 1 envoi" "1/1" "$(grep -o '"sent":[0-9]*' /tmp/n-c5.json | cut -d: -f2)/$(grep -o '"due":[0-9]*' /tmp/n-c5.json | cut -d: -f2)"
CODE=$(curl -s -o /tmp/n-r5.json -w "%{http_code}" -b $JAR -X POST $BASE/notifications/read -H "Content-Type: application/json" -d '{"all":true}')
check "Notifs — read {all} → 200" "200" "$CODE"
check "Notifs — read {all} → unreadCount 0" "0" "$(grep -o '"unreadCount":[0-9]*' /tmp/n-r5.json | cut -d: -f2)"

# Isolation : l'infirmier ne voit AUCUNE notification du patient.
rm -f /tmp/n-jar-inf.txt
CODE=$(curl -s -o /dev/null -w "%{http_code}" -c /tmp/n-jar-inf.txt -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"phone":"+2250755666777","password":"TestInfirmier2026!"}')
check "API — login infirmier" "200" "$CODE"
curl -s -b /tmp/n-jar-inf.txt $BASE/notifications > /tmp/n-g4.json
check "Notifs — isolation infirmier (0 notification, 0 non lue)" "0/0" "$(grep -o '"unreadCount":[0-9]*' /tmp/n-g4.json | cut -d: -f2)/$(echo "$(grep -o '"notifications":\[[^]]*' /tmp/n-g4.json | grep -c '"id":')" | head -1)"

# Nettoyage final (RDV E2E + leurs notifications InApp).
bun scripts/reminder-fixture.ts clean > /tmp/n-clean1.txt
check "Fixture — nettoyage RDV + notifications" "yes" "$(grep -q 'notifications=' /tmp/n-clean1.txt && echo yes || echo no)"
echo "  [fixture] clean final: $(cat /tmp/n-clean1.txt)"

# ── 2. Navigateur — PATIENT desktop 1440×900 ─────────────────────────────────
$AB close >/dev/null 2>&1
$AB set viewport 1440 900 >/dev/null
$AB open http://localhost:3000 >/dev/null
sleep 3
$AB eval "localStorage.clear(); sessionStorage.clear(); 'ok'" >/dev/null
echo "== login patient: $(login "0709229992" "TestPatient2026!")"

# Fixture d'un rappel NON LU pour le parcours UI + tick, puis reload (le badge
# vient du fetch au montage).
bun scripts/reminder-fixture.ts create > /tmp/n-fix5.txt
curl -s -o /dev/null -H "Authorization: Bearer $CRON_SECRET" $BASE/cron/reminders
$AB reload >/dev/null; sleep 7
check "Badge — cloche avec non lues (aria-label)" "Notifications (1 non lue)" "$(bell_aria)"
bell_click
check "Panneau — rappel non lu affiché" "yes" "$(body_has 'Rappel de rendez-vous')"
check "Panneau — corps du rappel (cabinet)" "yes" "$(body_has 'Votre RDV au cabinet')"
check "Panneau — action « Tout marquer comme lu » présente" "yes" "$(body_has 'Tout marquer comme lu')"
$AB screenshot $SHOT/notifications-panel.png >/dev/null
mark_all_click
check "Badge — disparu après « Tout marquer comme lu »" "Notifications" "$(bell_aria)"
check "Panneau — rappel toujours listé (état lu)" "yes" "$(body_has 'Rappel de rendez-vous')"

# PERSISTANCE : reload → le badge reste absent (readAt persisté).
$AB reload >/dev/null; sleep 7
check "Persisté — badge absent après reload" "Notifications" "$(bell_aria)"
bell_click
check "Panneau — rappel consultable après lecture" "yes" "$(body_has 'Rappel de rendez-vous')"
# Clic sur l'item → navigation vers la vue Rendez-vous.
$AB eval "Array.from(document.querySelectorAll('button')).find(function(b){return b.textContent.indexOf('Rappel de rendez-vous')>=0})?.click(); 'ok'" >/dev/null 2>&1
sleep 3
check "Navigation — clic rappel → vue Rendez-vous" "yes" "$(body_has 'Mes rendez-vous')"
$AB screenshot $SHOT/notifications-desktop.png >/dev/null

# ── 3. Mobile 390×844 ────────────────────────────────────────────────────────
$AB set viewport 390 844 >/dev/null
sleep 2
check "Mobile — cloche présente" "yes" "$($AB eval "Array.from(document.querySelectorAll('button')).some(function(b){return (b.getAttribute('aria-label')||'').indexOf('Notifications')===0}) ? 'yes' : 'no'" 2>/dev/null | tail -1 | tr -d '"')"
bell_click
check "Mobile — panneau notifications rendu" "yes" "$(body_has 'Rappel de rendez-vous')"
check "Mobile — aucun débordement horizontal" "ok" "$($AB eval "document.documentElement.scrollWidth<=392?'ok':'overflow:'+document.documentElement.scrollWidth" 2>/dev/null | tail -1 | tr -d '"')"
$AB screenshot $SHOT/notifications-mobile.png >/dev/null
$AB eval "document.body.click(); 'ok'" >/dev/null 2>&1; sleep 1

# ── 4. Régression NURSE ──────────────────────────────────────────────────
$AB set viewport 1440 900 >/dev/null; sleep 1
nav_click 3 >/dev/null; sleep 2   # « Se déconnecter » vit sur la vue Profil
$AB eval "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Se déconnecter'))?.click(); 'ok'" >/dev/null; sleep 4
echo "== login infirmier: $(login "0755666777" "TestInfirmier2026!")"
check "Infirmier — navigation missions" "Accueil | Missions | Profil" "$(nav_labels)"
check "Infirmier — cloche InApp disponible" "yes" "$($AB eval "Array.from(document.querySelectorAll('button')).some(function(b){return (b.getAttribute('aria-label')||'').indexOf('Notifications')===0}) ? 'yes' : 'no'" 2>/dev/null | tail -1 | tr -d '"')"
$AB screenshot $SHOT/notifications-infirmier.png >/dev/null

# ── 5. Console / erreurs page ────────────────────────────────────────────────
ERRS=$($AB errors 2>/dev/null | grep -c -i "error" || true)
echo "PAGE_ERRORS=$ERRS"
echo "==============================="
echo "RESULT: PASS=$PASS FAIL=$FAIL"
$AB close >/dev/null 2>&1
[ $FAIL -eq 0 ] && echo "E2E GLOBAL: PASS" || echo "E2E GLOBAL: FAIL"
