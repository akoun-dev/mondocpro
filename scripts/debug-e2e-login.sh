#!/bin/bash
# DEBUG E2E — login patient pas à pas
set -u
cd /home/z/my-project
AB="agent-browser"

if ! curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
  nohup bun run dev > /tmp/dev-e2e.log 2>&1 &
  for i in $(seq 1 75); do sleep 2; curl -sf http://localhost:3000/api/health >/dev/null 2>&1 && break; done
fi
echo "== health: $(curl -s http://localhost:3000/api/health | head -c 80)"

echo "== API login patient: $(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"phone":"+2250709229992","password":"TestPatient2026!"}')"

$AB close >/dev/null 2>&1
$AB set viewport 1440 900 >/dev/null
$AB open http://localhost:3000 >/dev/null
sleep 3
$AB eval "localStorage.clear(); sessionStorage.clear(); 'cleared'" >/dev/null
$AB reload >/dev/null
sleep 6
echo "== snapshot login:"
$AB snapshot -i 2>/dev/null | head -25

SNAP=$($AB snapshot -i 2>/dev/null)
PHONE_REF=$(echo "$SNAP" | sed -n 's/.*\[ref=\(e[0-9]*\)\].*/&/p' | grep 'Numéro\|téléphone' | sed -n 's/.*\[ref=\(e[0-9]*\)\]/\1/p' | head -1)
PWD_REF=$(echo "$SNAP" | grep -i 'mot de passe' | grep -v 'oublié\|Afficher\|Masquer' | sed -n 's/.*\[ref=\(e[0-9]*\)\]/\1/p' | head -1)
BTN_REF=$(echo "$SNAP" | grep 'Se connecter' | sed -n 's/.*\[ref=\(e[0-9]*\)\]/\1/p' | head -1)
echo "== refs: phone=$PHONE_REF pwd=$PWD_REF btn=$BTN_REF"

[ -n "$PHONE_REF" ] && { $AB fill "@$PHONE_REF" "0709229992"; echo "phone value: $($AB get value "@$PHONE_REF" 2>/dev/null)"; }
[ -n "$PWD_REF" ] && { $AB fill "@$PWD_REF" "TestPatient2026!" >/dev/null; echo "pwd filled"; }
[ -n "$BTN_REF" ] && $AB click "@$BTN_REF"
sleep 6
echo "== nav après login: $($AB eval "Array.from(document.querySelectorAll('nav[aria-label=\"Navigation principale\"] button')).map(b=>b.textContent.trim()).join(' | ')" 2>/dev/null | tail -1)"
echo "== erreurs: $($AB errors 2>/dev/null | head -5)"
echo "== console (5 dernières): $($AB console 2>/dev/null | tail -5)"
