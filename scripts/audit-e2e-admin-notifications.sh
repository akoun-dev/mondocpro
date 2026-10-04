#!/bin/bash
# Audit E2E — Task 35 : interface ADMIN + notifications InApp « complètes ».
# Couvre le cycle intégral patient ↔ Médecin Chef ↔ infirmier :
#   recharges (déclaration → alerte admin → décision → notification patient),
#   RDV à domicile (demande → file dispatch → affectation → réaffectation),
#   clôtures/annulations (notification patient, Tokens consommés/libérés).
# Pré-requis : serveur dev démarré sur :3000 (bash scripts/dev-boot.sh).
# Usage : bash scripts/audit-e2e-admin-notifications.sh
set -u
BASE="http://localhost:3000/api"
PASS=0; FAIL=0

check() {
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  ✓ $1 ($3)"; else FAIL=$((FAIL+1)); echo "  ✗ $1 (attendu $2, obtenu $3)"; fi
}

json() {
  node -e "const d=JSON.parse(process.argv[1]);const p=process.argv[2].split('.');let v=d;for(const k of p){v=v?.[k]};process.stdout.write(String(v??''))" "$1" "$2"
}

jsonlen() { # $1 json, $2 chemin tableau → longueur
  node -e "const d=JSON.parse(process.argv[1]);const p=process.argv[2].split('.');let v=d;for(const k of p){v=v?.[k]};process.stdout.write(String(Array.isArray(v)?v.length:''))" "$1" "$2"
}

has_type() { # $1 json notifications, $2 type, $3 fragment optionnel du corps → 0/1
  node -e "const d=JSON.parse(process.argv[1]);const t=process.argv[2];const f=process.argv[3]||'';const n=(d.notifications||[]).filter(x=>x.type===t&&(f===''||x.body.includes(f)));process.stdout.write(String(n.length))" "$1" "$2" "$3"
}

has_entity() { # $1 json, $2 type, $3 préfixe d'entityId, $4 fragment du corps → count
  node -e "const d=JSON.parse(process.argv[1]);const n=(d.notifications||[]).filter(x=>x.type===process.argv[2]&&(x.entityId||'').startsWith(process.argv[3])&&(!process.argv[4]||x.body.includes(process.argv[4])));process.stdout.write(String(n.length))" "$1" "$2" "$3" "$4"
}

entity_bad_iso() { # $1 json, $2 préfixe entityId → count des corps contenant une date ISO brute
  node -e "const d=JSON.parse(process.argv[1]);const n=(d.notifications||[]).filter(x=>(x.entityId||'').startsWith(process.argv[2])&&/[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(x.body));process.stdout.write(String(n.length))" "$1" "$2"
}

next_business_date() { # $1 = décalage minimal en jours
  for i in $(seq "$1" 12); do
    DOW=$(date -u -d "+$i day" +%u 2>/dev/null)
    if [ "$DOW" -ge 1 ] && [ "$DOW" -le 5 ]; then date -u -d "+$i day" +%Y-%m-%d; return; fi
  done
  date -u -d "+7 day" +%Y-%m-%d
}

# Rotation de créneaux par minute/jour : plusieurs exécutions du script ne
# doivent pas se marcher (collision 409 sur le même créneau).
SLOT_CASE=$(( ( $(date +%s) / 60 ) % 3 ))
case $SLOT_CASE in
  0) T1="08:00"; T2="10:30"; T3="13:30" ;;
  1) T1="09:30"; T2="14:00"; T3="15:30" ;;
  *) T1="08:30"; T2="14:30"; T3="16:00" ;;
esac
DAY_CASE=$(( ($(date +%s) / 86400) % 3 ))
D1=$(next_business_date $((DAY_CASE+2)))
D2=$(next_business_date $((DAY_CASE+4)))
D3=$(next_business_date $((DAY_CASE+5)))

echo "=== 1. Connexions des trois rôles ==="
JP=$(mktemp); JN=$(mktemp); JA=$(mktemp)
check "login PATIENT" 200 "$(curl -s -o /dev/null -w '%{http_code}' -c $JP -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"phone":"+2250709229992","password":"TestPatient2026!"}' --max-time 15)"
check "login NURSE" 200 "$(curl -s -o /dev/null -w '%{http_code}' -c $JN -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"phone":"+2250755666777","password":"TestInfirmier2026!"}' --max-time 15)"
check "login ADMIN" 200 "$(curl -s -o /dev/null -w '%{http_code}' -c $JA -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"phone":"+2250700000001","password":"Admin#MonDocPro2026"}' --max-time 15)"
NURSE_ID=$(json "$(curl -s -b $JN $BASE/auth/me --max-time 10)" "user.id")

echo "=== 2. Garde des routes admin (Task 35) ==="
check "PATIENT → GET /admin/missions (403)" 403 "$(curl -s -o /dev/null -w '%{http_code}' -b $JP $BASE/admin/missions --max-time 10)"
check "anonyme → GET /admin/missions (401)" 401 "$(curl -s -o /dev/null -w '%{http_code}' $BASE/admin/missions --max-time 10)"
check "NURSE → POST /admin/missions (403)" 403 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN -X POST $BASE/admin/missions -H 'Content-Type: application/json' -d '{"appointmentId":"x","nurseId":"y"}' --max-time 10)"

echo "=== 3. GET /api/admin/missions — contrat étendu (missions + dispatchQueue + nurses) ==="
BOARD=$(curl -s -b $JA $BASE/admin/missions --max-time 15)
check "clé missions présente" yes "$([ "$(jsonlen "$BOARD" "missions")" != "" ] && echo yes || echo no)"
check "clé dispatchQueue présente" yes "$([ "$(jsonlen "$BOARD" "dispatchQueue")" != "" ] && echo yes || echo no)"
check "clé nurses présente" yes "$([ "$(jsonlen "$BOARD" "nurses")" != "" ] && echo yes || echo no)"
check "annuaire contient l'infirmier de test" yes "$(node -e "const d=JSON.parse(process.argv[1]);process.stdout.write(d.nurses.some(n=>n.id==='$NURSE_ID')?'yes':'no')" "$BOARD")"

echo "=== 4. Cycle recharge — déclaration patient → alerte admin → décision ==="
UNREAD_ADMIN_BEFORE=$(json "$(curl -s -b $JA $BASE/notifications --max-time 10)" "unreadCount")
RC=$(curl -s -b $JP -X POST $BASE/wallet/recharges -H 'Content-Type: application/json' -d '{"amountFcfa":25000,"paymentMethod":"WAVE"}' --max-time 15)
RID=$(json "$RC" "recharge.id")
check "déclaration recharge (201 + id)" yes "$([ -n "$RID" ] && [ "$RID" != "null" ] && echo yes || echo no)"
ADMIN_NOTIFS=$(curl -s -b $JA $BASE/notifications --max-time 10)
check "admin notifié RECHARGE_REQUESTED (montant + tokens)" 1 "$(has_entity "$ADMIN_NOTIFS" "RECHARGE_REQUESTED" "$RID" "10 Tokens")"
check "badge admin incrémenté" "$((UNREAD_ADMIN_BEFORE+1))" "$(json "$ADMIN_NOTIFS" "unreadCount")"

check "admin CONFIRM recharge" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JA -X PATCH $BASE/admin/recharges/$RID -H 'Content-Type: application/json' -d '{"decision":"CONFIRM","note":"Audit Task 35"}' --max-time 15)"
check "double décision refusée (409)" 409 "$(curl -s -o /dev/null -w '%{http_code}' -b $JA -X PATCH $BASE/admin/recharges/$RID -H 'Content-Type: application/json' -d '{"decision":"CONFIRM"}' --max-time 15)"
PATIENT_NOTIFS=$(curl -s -b $JP $BASE/notifications --max-time 10)
check "patient notifié RECHARGE_CONFIRMED (cette recharge)" 1 "$(has_entity "$(curl -s -b $JP $BASE/notifications --max-time 10)" "RECHARGE_CONFIRMED" "$RID" "")"

echo "=== 5. Cycle recharge — refus patient notifié ==="
RC2=$(curl -s -b $JP -X POST $BASE/wallet/recharges -H 'Content-Type: application/json' -d '{"amountFcfa":5000,"paymentMethod":"ORANGE_MONEY"}' --max-time 15)
RID2=$(json "$RC2" "recharge.id")
check "admin REJECT recharge 2" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JA -X PATCH $BASE/admin/recharges/$RID2 -H 'Content-Type: application/json' -d '{"decision":"REJECT"}' --max-time 15)"
check "patient notifié RECHARGE_REJECTED (montant)" 1 "$(has_entity "$(curl -s -b $JP $BASE/notifications --max-time 10)" "RECHARGE_REJECTED" "$RID2" "")"

echo "=== 6. RDV à domicile → demande admin → dispatch → notifications ==="
SPEC=$(curl -s -b $JP $BASE/specialties --max-time 10 | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const l=j.specialties||j;console.log((Array.isArray(l)?l:[])[0]?.id??'')}catch{console.log('')}})")
APPT1=$(curl -s -b $JP -X POST $BASE/appointments -H 'Content-Type: application/json' -d "{\"type\":\"DOMICILE\",\"specialtyId\":\"$SPEC\",\"zone\":\"YOPOUGON\",\"date\":\"$D1\",\"time\":\"$T1\",\"reason\":\"Audit Task 35 — clôture DONE\"}" --max-time 20)
AID1=$(json "$APPT1" "appointment.id")
check "RDV domicile 1 créé" yes "$([ -n "$AID1" ] && [ "$AID1" != "null" ] && echo yes || echo no)"
check "admin notifié APPOINTMENT_REQUESTED (patient + zone)" 1 "$(has_entity "$(curl -s -b $JA $BASE/notifications --max-time 10)" "APPOINTMENT_REQUESTED" "$AID1" "a demandé une consultation à domicile")"
BOARD2=$(curl -s -b $JA $BASE/admin/missions --max-time 15)
check "file dispatch contient le RDV" 1 "$(node -e "const d=JSON.parse(process.argv[1]);process.stdout.write(String(d.dispatchQueue.filter(q=>q.id==='$AID1').length))" "$BOARD2")"

DISPATCH=$(curl -s -b $JA -X POST $BASE/admin/missions -H 'Content-Type: application/json' -d "{\"appointmentId\":\"$AID1\",\"nurseId\":\"$NURSE_ID\"}" --max-time 15)
MID1=$(json "$DISPATCH" "mission.id")
check "dispatch mission (201)" yes "$([ -n "$MID1" ] && [ "$MID1" != "null" ] && echo yes || echo no)"
check "doublon dispatch refusé (409)" 409 "$(curl -s -o /dev/null -w '%{http_code}' -b $JA -X POST $BASE/admin/missions -H 'Content-Type: application/json' -d "{\"appointmentId\":\"$AID1\",\"nurseId\":\"$NURSE_ID\"}" --max-time 15)"
NURSE_NOTIFS=$(curl -s -b $JN $BASE/notifications --max-time 10)
check "infirmier notifié MISSION_ASSIGNED (date FR)" 1 "$(has_entity "$NURSE_NOTIFS" "MISSION_ASSIGNED" "$MID1:assignment" "vous a été attribuée pour le")"
check "corps mission SANS date ISO brute" 0 "$(entity_bad_iso "$NURSE_NOTIFS" "$MID1:assignment")"

echo "=== 7. Réaffectation admin — mission remise à ASSIGNED + notification ==="
check "admin réaffecte (PATCH :id)" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JA -X PATCH $BASE/admin/missions/$MID1 -H 'Content-Type: application/json' -d "{\"nurseId\":\"$NURSE_ID\"}" --max-time 15)"
check "infirmier re-notifié MISSION_ASSIGNED" yes "$(node -e "const d=JSON.parse(process.argv[1]);const n=(d.notifications||[]).filter(x=>x.type==='MISSION_ASSIGNED'&&!x.readAt);process.stdout.write(n.length>0?'yes':'no')" "$(curl -s -b $JN $BASE/notifications --max-time 10)")"

echo "=== 8. Statuts infirmier → notifications patient + admin ==="
check "nurse ACCEPT (200)" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN -X PATCH $BASE/nurse/missions/$MID1 -H 'Content-Type: application/json' -d '{"status":"ACCEPTED"}' --max-time 15)"
check "transition illégale refusée (409)" 409 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN -X PATCH $BASE/nurse/missions/$MID1 -H 'Content-Type: application/json' -d '{"status":"ASSIGNED"}' --max-time 15)"
check "admin notifié MISSION_STATUS_CHANGED (acceptée)" 1 "$(has_entity "$(curl -s -b $JA $BASE/notifications --max-time 10)" "MISSION_STATUS_CHANGED" "$MID1:" "acceptée")"
check "patient notifié MISSION_STATUS_CHANGED (acceptée)" 1 "$(has_entity "$(curl -s -b $JP $BASE/notifications --max-time 10)" "MISSION_STATUS_CHANGED" "$MID1:" "acceptée")"

echo "=== 9. Clôture admin DONE → patient notifié (Tokens débités) ==="
check "nurse IN_PROGRESS" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JN -X PATCH $BASE/nurse/missions/$MID1 -H 'Content-Type: application/json' -d '{"status":"IN_PROGRESS"}' --max-time 15)"
check "admin DONE RDV 1" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JA -X PATCH $BASE/appointments/$AID1 -H 'Content-Type: application/json' -d '{"action":"DONE"}' --max-time 15)"
PATIENT_NOTIFS=$(curl -s -b $JP $BASE/notifications --max-time 10)
check "patient notifié APPOINTMENT_COMPLETED" 1 "$(has_entity "$PATIENT_NOTIFS" "APPOINTMENT_COMPLETED" "$AID1" "terminée")"
check "corps mentionne le Token débité" yes "$(node -e "const d=JSON.parse(process.argv[1]);const n=(d.notifications||[]).find(x=>x.type==='APPOINTMENT_COMPLETED'&&(x.entityId||'')==='$AID1');process.stdout.write(n&&n.body.includes('Token')?'yes':'no')" "$PATIENT_NOTIFS")"

echo "=== 10. Annulation patient → admin notifié (Tokens libérés) ==="
APPT2=$(curl -s -b $JP -X POST $BASE/appointments -H 'Content-Type: application/json' -d "{\"type\":\"DOMICILE\",\"specialtyId\":\"$SPEC\",\"zone\":\"YOPOUGON\",\"date\":\"$D2\",\"time\":\"$T2\",\"reason\":\"Audit Task 35 — annulation patient\"}" --max-time 20)
AID2=$(json "$APPT2" "appointment.id")
check "RDV domicile 2 créé" yes "$([ -n "$AID2" ] && [ "$AID2" != "null" ] && echo yes || echo no)"
check "patient CANCEL RDV 2" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JP -X PATCH $BASE/appointments/$AID2 -H 'Content-Type: application/json' -d '{"action":"CANCEL"}' --max-time 15)"
check "admin notifié APPOINTMENT_CANCELLED (patient)" 1 "$(has_entity "$(curl -s -b $JA $BASE/notifications --max-time 10)" "APPOINTMENT_CANCELLED" "$AID2" "a annulé")"

echo "=== 11. Annulation admin → patient notifié (libération) ==="
APPT3=$(curl -s -b $JP -X POST $BASE/appointments -H 'Content-Type: application/json' -d "{\"type\":\"CABINET\",\"specialtyId\":\"$SPEC\",\"zone\":\"YOPOUGON\",\"date\":\"$D3\",\"time\":\"$T3\",\"reason\":\"Audit Task 35 — annulation équipe\"}" --max-time 20)
AID3=$(json "$APPT3" "appointment.id")
check "RDV cabinet 3 créé" yes "$([ -n "$AID3" ] && [ "$AID3" != "null" ] && echo yes || echo no)"
check "admin CANCEL RDV 3" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JA -X PATCH $BASE/appointments/$AID3 -H 'Content-Type: application/json' -d '{"action":"CANCEL"}' --max-time 15)"
check "patient notifié APPOINTMENT_CANCELLED (équipe)" 1 "$(has_entity "$(curl -s -b $JP $BASE/notifications --max-time 10)" "APPOINTMENT_CANCELLED" "$AID3" "notre équipe")"

echo "=== 12. Marquage lu (une / tout) + isolation ==="
FIRST_NOTIF=$(curl -s -b $JP $BASE/notifications --max-time 10 | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);const n=(j.notifications||[]).find(x=>!x.readAt);console.log(n?n.id:'')})")
check "patient marque UNE lue (200)" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JP -X POST $BASE/notifications/read -H 'Content-Type: application/json' -d "{\"id\":\"$FIRST_NOTIF\"}" --max-time 10)"
check "id inconnu → 404 (sans fuite)" 404 "$(curl -s -o /dev/null -w '%{http_code}' -b $JP -X POST $BASE/notifications/read -H 'Content-Type: application/json' -d '{"id":"cmuunknown000000000000000"}' --max-time 10)"
check "corps ambigu → 400" 400 "$(curl -s -o /dev/null -w '%{http_code}' -b $JA -X POST $BASE/notifications/read -H 'Content-Type: application/json' -d '{"id":"x","all":true}' --max-time 10)"
check "admin marque TOUT lu (unread 0)" 0 "$(json "$(curl -s -b $JA -X POST $BASE/notifications/read -H 'Content-Type: application/json' -d '{"all":true}' --max-time 10)" "unreadCount")"

echo "=== 13. Profil admin (Task 35) — PATCH profil + change-password accessibles ==="
check "ADMIN PATCH profile (200)" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $JA -X PATCH $BASE/auth/profile -H 'Content-Type: application/json' -d '{"healthAlerts":true}' --max-time 10)"
check "ADMIN change-password garde (400 champ manquant)" 400 "$(curl -s -o /dev/null -w '%{http_code}' -b $JA -X POST $BASE/auth/change-password -H 'Content-Type: application/json' -d '{}' --max-time 10)"

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ]
