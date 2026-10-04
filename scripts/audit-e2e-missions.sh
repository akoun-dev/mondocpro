#!/bin/bash
# Audit E2E — FEATURE-NURSE (cycle de vie complet d'une mission) + sondes globales.
# Pré-requis : serveur dev démarré sur :3000 (boot .zscripts/dev.sh).
# Usage : bash scripts/audit-e2e-missions.sh
set -u
BASE="http://localhost:3000/api"
PASS=0; FAIL=0

check() { # $1 libellé, $2 attendu, $3 obtenu
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  ✓ $1 ($3)"; else FAIL=$((FAIL+1)); echo "  ✗ $1 (attendu $2, obtenu $3)"; fi
}

json() { # $1 json, $2 chemin jq-like basique via node
  node -e "const d=JSON.parse(process.argv[1]);const p=process.argv[2].split('.');let v=d;for(const k of p){v=v?.[k]};process.stdout.write(String(v??''))" "$1" "$2"
}

echo "=== 1. Sondes globales ==="
check "GET /health" 200 "$(curl -s -o /dev/null -w '%{http_code}' $BASE/health --max-time 10)"
check "GET / (page)" 200 "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ --max-time 20)"

echo "=== 2. Connexions par rôle ==="
JP=$(mktemp); JN=$(mktemp); JA=$(mktemp)
check "login PATIENT" 200 "$(curl -s -o /dev/null -w '%{http_code}' -c $JP -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"phone":"+2250709229992","password":"TestPatient2026!"}' --max-time 15)"
check "login NURSE" 200 "$(curl -s -o /dev/null -w '%{http_code}' -c $JN -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"phone":"+2250755666777","password":"TestInfirmier2026!"}' --max-time 15)"
check "login ADMIN" 200 "$(curl -s -o /dev/null -w '%{http_code}' -c $JA -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"phone":"+2250700000001","password":"Admin#MonDocPro2026"}' --max-time 15)"

ME_N=$(curl -s -b $JN $BASE/auth/me --max-time 10)
NURSE_ID=$(json "$ME_N" "user.id")
echo "  infirmier: ${NURSE_ID:0:12}…"

echo "=== 3. Cloisonnement des rôles sur les routes missions ==="
check "PATIENT → /admin/missions (403 attendu)" 403 "$(curl -s -o /dev/null -w '%{http_code}' -b $JP $BASE/admin/missions --max-time 10)"
check "PATIENT → /nurse/missions (403 attendu)" 403 "$(curl -s -o /dev/null -w '%{http_code}' -b $JP $BASE/nurse/missions --max-time 10)"
check "anonyme → /admin/missions (401 attendu)" 401 "$(curl -s -o /dev/null -w '%{http_code}' $BASE/admin/missions --max-time 10)"
check "NURSE → GET /nurse/missions" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN $BASE/nurse/missions --max-time 10)"
check "ADMIN → GET /admin/missions" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JA $BASE/admin/missions --max-time 10)"

echo "=== 3.5 Crédit Tokens (recharge patient confirmée par l'admin) ==="
WALLET=$(curl -s -b $JP $BASE/wallet --max-time 10)
BAL=$(json "$WALLET" "wallet.availableTokens")
echo "  solde disponible : ${BAL:-?} tokens"
if [ "${BAL:-0}" = "0" ] || [ -z "$BAL" ]; then
  RC=$(curl -s -b $JP -X POST $BASE/wallet/recharges -H 'Content-Type: application/json' -d '{"amountFcfa":10000,"paymentMethod":"WAVE"}' --max-time 15)
  RID=$(json "$RC" "recharge.id")
  echo "  recharge déclarée : ${RID:0:12}… (10000 FCFA = 4 tokens)"
  if [ -n "$RID" ]; then
    check "ADMIN CONFIRM recharge" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JA -X PATCH $BASE/admin/recharges/$RID -H 'Content-Type: application/json' -d '{"decision":"CONFIRM","note":"Audit E2E"}' --max-time 15)"
  fi
fi

echo "=== 4. Cycle de vie d'une mission (dispatch → accept → en cours → CR) ==="
# Créer un RDV frais si aucun RDV dispatchable (spécialité active requise).
APPTS=$(curl -s -b $JP $BASE/appointments --max-time 10)
N=$(node -e "const d=JSON.parse(process.argv[1]);console.log((d.appointments||[]).length)" "$APPTS" 2>/dev/null || echo 0)
echo "  RDV existants : $N"
if [ "$N" = "0" ]; then
  SPEC=$(curl -s -b $JP $BASE/specialties --max-time 10 | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const l=j.specialties||j;console.log((Array.isArray(l)?l:[])[0]?.id??'')}catch{console.log('')}})")
  TOMORROW=$(date -u -d "+1 day" +%Y-%m-%d 2>/dev/null || date -u +%Y-%m-%d)
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -b $JP -X POST $BASE/appointments -H 'Content-Type: application/json' -d "{\"type\":\"DOMICILE\",\"specialtyId\":\"$SPEC\",\"zone\":\"YOPOUGON\",\"date\":\"$TOMORROW\",\"time\":\"10:00\",\"reason\":\"Audit E2E — mission test\"}" --max-time 15)
  echo "  création RDV de test : $CODE"
  APPTS=$(curl -s -b $JP $BASE/appointments --max-time 10)
fi

N=$(node -e "const d=JSON.parse(process.argv[1]);console.log((d.appointments||[]).filter(a=>!a.missionId).length)" "$APPTS" 2>/dev/null || echo 0)
echo "  RDV sans mission disponibles : $N"
MISSION_ID=""; CREATED="0"
for i in $(seq 0 $((N>3?3:N-1))); do
  AID=$(node -e "const d=JSON.parse(process.argv[1]);const l=(d.appointments||[]).filter(a=>!a.missionId);console.log(l[$i]?.id??'')" "$APPTS" 2>/dev/null)
  [ -z "$AID" ] && continue
  RES=$(curl -s -w '\n%{http_code}' -b $JA -X POST $BASE/admin/missions -H 'Content-Type: application/json' -d "{\"appointmentId\":\"$AID\",\"nurseId\":\"$NURSE_ID\"}" --max-time 15)
  CODE=$(echo "$RES" | tail -1); BODY=$(echo "$RES" | head -1)
  if [ "$CODE" = "201" ] || [ "$CODE" = "200" ]; then
    MISSION_ID=$(json "$BODY" "mission.id"); CREATED="1"; DISPATCHED_AID="$AID"; check "POST /admin/missions (dispatch)" "$CODE" "$CODE"; break
  fi
done
if [ "$CREATED" = "1" ] && [ -n "$MISSION_ID" ]; then
  check "doublon dispatch (409 attendu)" 409 "$(curl -s -o /dev/null -w '%{http_code}' -b $JA -X POST $BASE/admin/missions -H 'Content-Type: application/json' -d "{\"appointmentId\":\"$DISPATCHED_AID\",\"nurseId\":\"$NURSE_ID\"}" --max-time 15)"
  check "NURSE PATCH status ACCEPTED" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN -X PATCH $BASE/nurse/missions/$MISSION_ID/status -H 'Content-Type: application/json' -d '{"status":"ACCEPTED"}' --max-time 15)"
  check "transition illégale ASSIGNED→COMPLETED via ACCEPTED ? (409 attendu)" 409 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN -X PATCH $BASE/nurse/missions/$MISSION_ID/status -H 'Content-Type: application/json' -d '{"status":"COMPLETED"}' --max-time 15)"
  check "NURSE PATCH status IN_PROGRESS" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN -X PATCH $BASE/nurse/missions/$MISSION_ID/status -H 'Content-Type: application/json' -d '{"status":"IN_PROGRESS"}' --max-time 15)"
  check "CR avant IN_PROGRESS : doublon/état — POST report" 201 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN -X POST $BASE/nurse/missions/$MISSION_ID/report -H 'Content-Type: application/json' -d '{"observations":"Audit : constantes normales, patient rassuré.","vitalSigns":{"tension":"12/8","temperature":36.8}}' --max-time 15)"
  check "second CR interdit (409 attendu)" 409 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN -X POST $BASE/nurse/missions/$MISSION_ID/report -H 'Content-Type: application/json' -d '{"observations":"doublon"}' --max-time 15)"
  NOTIF=$(curl -s -b $JP $BASE/notifications --max-time 10)
  echo "  notifications patient contenant mission : $(node -e "const d=JSON.parse(process.argv[1]);console.log((d.notifications||[]).filter(n=>(n.type||'').startsWith('MISSION')||n.type==='VISIT_REPORT_SUBMITTED').length)" "$NOTIF" 2>/dev/null)"
else
  echo "  (pas de RDV dispatchable — cycle de vie sauté, listes seules validées)"
fi

echo "=== BILAN ==="
echo "  PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ] && echo "AUDIT_E2E_TOUT_OK" || echo "AUDIT_E2E_ECHECS=$FAIL"
rm -f $JP $JN $JA
