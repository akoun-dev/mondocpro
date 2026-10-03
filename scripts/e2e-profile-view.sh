#!/bin/bash
# E2E — Vue « Profil » patient selon maquette PO 2026-10-03 (pastedImage 1790992312025)
# Héro avatar+zone, Informations Personnelles, Sécurité & Accès (RGPD 2013-430),
# Préférences & Alertes (switches désactivés + « Bientôt »), Urgences (SAMU 185 /
# Pompiers 180), Centre d'aide. Rôles INFIRMIER/ADMIN : profil simple inchangé.
set -u
cd /home/z/my-project
AB="agent-browser"
SHOT=/home/z/my-project/tool-results
PASS=0; FAIL=0

check() {
  if [ "$2" = "$3" ]; then echo "PASS: $1"; PASS=$((PASS+1)); else echo "FAIL: $1 — attendu [$2] obtenu [$3]"; FAIL=$((FAIL+1)); fi
}
strip() { echo "$1" | tr -d '"'; }
nav_labels() { strip "$($AB eval "Array.from(document.querySelectorAll('nav[aria-label=\"Navigation principale\"] button')).map(b=>b.textContent.trim()).join(' | ')" 2>/dev/null | tail -1)"; }
body_has() { strip "$($AB eval "document.body.textContent.includes('$1') ? 'yes' : 'no'" 2>/dev/null | tail -1)"; }
nav_click() { $AB find first "nav[aria-label=\"Navigation principale\"] li:nth-child($1) button" click; }

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

# ── 0. Boot serveur (DATABASE_URL exportée — piège 2) ───────────────────────
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

$AB close >/dev/null 2>&1

# ── 1. PATIENT desktop 1440×900 ─────────────────────────────────────────────
$AB set viewport 1440 900 >/dev/null
$AB open http://localhost:3000 >/dev/null
sleep 3
$AB eval "localStorage.clear(); sessionStorage.clear(); 'ok'" >/dev/null
echo "== login patient: $(login "0709229992" "TestPatient2026!")"
nav_click 3 >/dev/null; sleep 2   # Profil (3e onglet patient)

check "Profil — section Informations Personnelles" "yes" "$(body_has 'Informations Personnelles')"
check "Profil — nom complet affiché" "yes" "$(body_has 'Patient UI Maquette')"
check "Profil — téléphone formaté +225" "yes" "$(body_has '+225 07 09 22 99 92')"
check "Profil — secteur d'habitation = zone" "yes/yes" "$(body_has 'Secteur')/$(body_has 'Yopougon')"
check "Profil — date de naissance honnête (Bientôt)" "yes/yes" "$(body_has 'Date de naissance')/$(body_has 'Non renseignée')"
check "Profil — section Sécurité & Accès + RGPD" "yes/yes" "$(body_has 'Sécurité & Accès')/$(body_has '2013-430')"
check "Profil — Préférences & Alertes + langue" "yes/yes" "$(body_has 'Rappels de rendez-vous')/$(body_has 'Langue de l')"
check "Profil — switches désactivés (pas de fausse promesse)" "2" "$($AB eval "document.querySelectorAll('button[role=\"switch\"][disabled]').length" 2>/dev/null | tail -1 | tr -d '"')"
check "Profil — Urgences SAMU 185 / Pompiers 180 (tel:)" "yes/yes" "$(body_has 'SAMU')/$(body_has '185')"
check "Profil — liens d'appel réels" "2" "$($AB eval "document.querySelectorAll('a[href=\"tel:185\"], a[href=\"tel:180\"]').length" 2>/dev/null | tail -1 | tr -d '"')"
check "Profil — Centre d'aide présent" "yes" "$(body_has 'Assistance Mondoc')"
check "Profil — Se déconnecter conservé" "yes" "$(body_has 'Se déconnecter')"
$AB screenshot $SHOT/profile-desktop.png >/dev/null

# ── 2. PATIENT mobile 390×844 ───────────────────────────────────────────────
$AB set viewport 390 844 >/dev/null
sleep 2
check "Mobile — vue profil rendue" "yes" "$(body_has 'Informations Personnelles')"
check "Mobile — aucun débordement horizontal" "ok" "$($AB eval "document.documentElement.scrollWidth<=392?'ok':'overflow:'+document.documentElement.scrollWidth" 2>/dev/null | tail -1 | tr -d '"')"
$AB screenshot $SHOT/profile-mobile.png >/dev/null

# ── 3. Régression INFIRMIER (profil simple inchangé) ────────────────────────
$AB set viewport 1440 900 >/dev/null
nav_click 3 >/dev/null; sleep 2   # Profil (3e onglet — session PATIENT active)
$AB eval "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Se déconnecter'))?.click(); 'ok'" >/dev/null; sleep 4
echo "== login infirmier: $(login "0755666777" "TestInfirmier2026!")"
check "Infirmier — nav inchangée (2 onglets)" "Accueil | Profil" "$(nav_labels)"
nav_click 2 >/dev/null; sleep 2
check "Infirmier — profil simple conservé" "yes" "$(body_has 'Vos informations de compte')"
$AB screenshot $SHOT/profile-infirmier.png >/dev/null

# ── 4. Console / erreurs page ───────────────────────────────────────────────
ERRS=$($AB errors 2>/dev/null | grep -c -i "error" || true)
echo "PAGE_ERRORS=$ERRS"
echo "==============================="
echo "RESULT: PASS=$PASS FAIL=$FAIL"
$AB close >/dev/null 2>&1
[ $FAIL -eq 0 ] && echo "E2E GLOBAL: PASS" || echo "E2E GLOBAL: FAIL"
