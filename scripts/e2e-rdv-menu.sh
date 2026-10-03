#!/bin/bash
# E2E — Menu « Rendez-vous » dans la navigation basse (demande PO 2026-10-03)
# Patient : Accueil / Rendez-vous / Profil (3 onglets) — autres rôles inchangés (2).
# Exécuter en un seul appel (le serveur lancé depuis une session outil est moissonné).
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
active_tab() { strip "$($AB eval "var b=document.querySelector('nav[aria-label=\"Navigation principale\"] button[aria-current=\"page\"]'); b?b.textContent.trim():'-'" 2>/dev/null | tail -1)"; }
body_has() { strip "$($AB eval "document.body.textContent.includes('$1') ? 'yes' : 'no'" 2>/dev/null | tail -1)"; }
nav_click() { $AB find first "nav[aria-label=\"Navigation principale\"] li:nth-child($1) button" click; }

# login <phone> <password> — remplit via refs (snapshot), clique, attend la nav
login() {
  $AB reload >/dev/null
  sleep 5
  local SNAP REFS PHONE_REF PWD_REF BTN_REF i
  SNAP=$($AB snapshot -i 2>/dev/null)
  REFS=$(echo "$SNAP" | grep 'textbox' | sed -n 's/.*ref=\(e[0-9]*\)\].*/\1/p')
  PHONE_REF=$(echo "$REFS" | sed -n 1p); PWD_REF=$(echo "$REFS" | sed -n 2p)
  BTN_REF=$(echo "$SNAP" | grep 'button "Se connecter"' | sed -n 's/.*\[ref=\(e[0-9]*\)\].*/\1/p' | head -1)
  echo "  [login $1] refs phone=$PHONE_REF pwd=$PWD_REF btn=$BTN_REF"
  [ -z "$PHONE_REF" ] || [ -z "$PWD_REF" ] || [ -z "$BTN_REF" ] && { echo "  [login] formulaire introuvable"; return 1; }
  $AB fill "@$PHONE_REF" "$1" >/dev/null
  $AB fill "@$PWD_REF" "$2" >/dev/null
  echo "  [login] phone saisi = $($AB get value "@$PHONE_REF" 2>/dev/null)"
  $AB click "@$BTN_REF" >/dev/null
  for i in $(seq 1 12); do
    sleep 1
    [ -n "$(nav_labels)" ] && break
  done
  nav_labels
}

# ── 0. Boot serveur (DATABASE_URL exportée — piège 2, sinon DB down) ────────
pkill -f "next dev" 2>/dev/null; sleep 1
export DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')
nohup bun run dev > /tmp/dev-e2e.log 2>&1 &
echo "server lancé (DATABASE_URL exportée)"
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
check "Patient — nav basse 3 onglets" "Accueil | Rendez-vous | Profil" "$(nav_labels)"

# Clic direct (hit-testé) sur l'onglet Rendez-vous (2e onglet)
nav_click 2 >/dev/null
sleep 2
check "Patient — vue Mes Rendez-vous affichée" "yes" "$(body_has 'Mes Rendez-vous')"
check "Patient — onglet actif = Rendez-vous" "Rendez-vous" "$(active_tab)"
check "Patient — plus de flèche retour (vue 1er niveau)" "0" "$($AB eval "document.querySelectorAll('button[aria-label=\"Retour à l\\'accueil\"]').length" 2>/dev/null | tail -1 | tr -d '"')"
check "Patient — segments À venir/Passées" "yes/yes" "$(body_has 'À venir')/$(body_has 'Passées')"
$AB screenshot $SHOT/rdv-menu-desktop.png >/dev/null

# Le dialog Nouveau RDV s'ouvre depuis cette vue
$AB find role button click --name "Nouveau RDV" >/dev/null
sleep 2
check "Patient — dialog réservation ouvert" "yes" "$($AB eval "document.querySelector('[role=\"dialog\"]') ? 'yes' : 'no'" 2>/dev/null | tail -1 | tr -d '"')"
$AB screenshot $SHOT/rdv-menu-dialog.png >/dev/null
$AB press Escape >/dev/null; sleep 1

# Le raccourci accueil « Mes rendez-vous » mène toujours à la vue
nav_click 1 >/dev/null; sleep 2
$AB eval "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Consulter'))?.click(); 'ok'" >/dev/null
sleep 2
check "Patient — raccourci accueil → vue RDV" "Rendez-vous" "$(active_tab)"

# ── 2. PATIENT mobile 390×844 ───────────────────────────────────────────────
$AB set viewport 390 844 >/dev/null
sleep 2
check "Mobile — nav 3 onglets visibles" "Accueil | Rendez-vous | Profil" "$(nav_labels)"
nav_click 2 >/dev/null; sleep 2
check "Mobile — vue RDV affichée" "yes" "$(body_has 'Mes Rendez-vous')"
check "Mobile — libellé sans débordement" "ok" "$($AB eval "var b=Array.from(document.querySelectorAll('nav button')).find(x=>x.textContent.trim()==='Rendez-vous'); b ? (b.scrollWidth<=b.clientWidth+2 ? 'ok' : 'overflow') : 'absent'" 2>/dev/null | tail -1 | tr -d '"')"
$AB screenshot $SHOT/rdv-menu-mobile.png >/dev/null

# ── 3. Régression NURSE (nav inchangée : 2 onglets) ─────────────────────
$AB set viewport 1440 900 >/dev/null
nav_click 3 >/dev/null; sleep 2   # Profil (patient)
$AB find role button click --name "Se déconnecter" >/dev/null; sleep 4
echo "== login infirmier: $(login "0755666777" "TestInfirmier2026!")"
check "Infirmier — nav inchangée (2 onglets)" "Accueil | Profil" "$(nav_labels)"
$AB screenshot $SHOT/rdv-menu-infirmier.png >/dev/null

# ── 4. Console / erreurs page ───────────────────────────────────────────────
ERRS=$($AB errors 2>/dev/null | grep -c -i "error" || true)
echo "PAGE_ERRORS=$ERRS"
echo "==============================="
echo "RESULT: PASS=$PASS FAIL=$FAIL"
$AB close >/dev/null 2>&1
[ $FAIL -eq 0 ] && echo "E2E GLOBAL: PASS" || echo "E2E GLOBAL: FAIL"
