# API_CONTRACTS.md — Contrats d'API (source de vérité Front ↔ Back)

**RÈGLE API-FIRST** : aucun développement frontend ne démarre tant que le contrat n'est pas
**validé ici** par l'Agent 1 (Tech Lead) et accepté par le Frontend. Toute modification de
contrat après implémentation = régression potentielle → mettre à jour ce fichier AVANT le code.

## Format d'un contrat

```yaml
### [METHOD] /api/<ressource>[/<id>]
Feature: FEATURE-XXX | Owner: Backend | Statut: PROPOSÉ / VALIDÉ / IMPLÉMENTÉ / DÉPRÉCIÉ
Request:  { champ: type (zod) }            # body / query / params
Response: 200 { ... } | 400 { error } | 404 { error } | 500 { error }
Validation: schéma zod de référence (src/lib/<domaine>.ts)
```

## Conventions globales (imposées)

- Chemins **relatifs** uniquement côté client (`fetch('/api/…')`).
- Enveloppe d'erreur standard : `{ "error": string, "details"?: unknown }`.
- Statuts : 200 OK · 201 Created · 400 Validation · 404 Not found · 500 Server error.
- Toute entrée validée par **zod** côté route ; jamais de confiance aux données client.

## Contrats actifs

### [GET] /api/health — Sonde de vie + base de données

- Feature: SYS-001 (système) | Owner: Backend | Statut: **VALIDÉ** (v2, lot P0 2026-10-03 : ajout probe DB ; v3 2026-10-04 : bloc `diagnostic` déploiement)
- Response: 200 `{ "status": "ok" | "degraded", "database": "up" | "down", "timestamp": string, "diagnostic": { "hasDatabaseUrl": boolean, "dbErrorCode": string | null, "dbHint": string | null } }`
- Notes: remplace le hello-world scaffold comme vérification de santé lors des tests E2E et du monitoring. La sonde exécute `SELECT 1` via Prisma — toujours HTTP 200 (l'état porté par le corps permet à l'app de répondre même en cas d'incident DB) ; `status: "degraded"` ⇔ `database: "down"`. v3 : `diagnostic` distingue sans logs plateforme une `DATABASE_URL` absente (`hasDatabaseUrl: false`) d'une base injoignable (`dbErrorCode` P1001/P1010/…, hints dans `.ai/DEPLOY_VERCEL.md`) — aucun secret exposé (codes courts uniquement, jamais le message Prisma brut).

### [GET] /api/appointments — Mes rendez-vous

- Feature: FEATURE-RDV | Owner: Backend | Statut: **IMPLÉMENTÉ** (lot P0/P1 2026-10-03, audit §4 validé par GO PO ; spécialité ajoutée Task 19 ; cycle Tokens ajouté Task 26)
- Request: — (cookie de session, rôle PATIENT)
- Response: 200 `{ "appointments": [{ "id": string, "type": "CABINET" | "DOMICILE", "zone": Zone, "specialty": { "id": string, "name": string } | null, "scheduledAt": string(ISO UTC), "status": "PENDING" | "CONFIRMED" | "CANCELLED" | "DONE", "reason": string | null, "tokenState": "NONE" | "RESERVED" | "CONSUMED" | "RELEASED", "tokensReserved": number, "createdAt": string }] }` — tri décroissant par créneau, 100 derniers ; `specialty: null` = RDV antérieurs au wizard (backfill « Médecine générale » en base) ; `tokenState: "NONE"` = RDV antérieurs aux Tokens
- Errors: 401 `{ error }` non authentifié · 403 `{ error }` rôle hors PATIENT · 500

### [POST] /api/appointments — Prendre un rendez-vous

- Feature: FEATURE-RDV | Owner: Backend | Statut: **IMPLÉMENTÉ** (lot P0/P1 2026-10-03 ; wizard 4 étapes + specialtyId requis — Task 19 ; réservation de Tokens atomique — Task 26/ADR-007)
- Request: `{ "type": "CABINET" | "DOMICILE", "specialtyId": string, "zone": Zone, "date": string("YYYY-MM-DD"), "time": string("HH:MM"), "reason"?: string(≤500) }` — date/heure saisis séparément (Afrique/Abidjan = UTC+0 : l'heure locale est l'heure UTC)
- Response: 201 `{ "appointment": { ...idem GET, tokenState: "RESERVED" } }` — le RDV naît AVEC sa réservation de Tokens (même transaction sérialisable)
- Errors: 400 `{ error, details }` (zod, règle créneau : grille 30 min, lundi–vendredi 08:00–16:30, ≥ 2 h à l'avance, ≤ 60 jours, ou spécialité inexistante/inactive) · **402 `{ error }` solde insuffisant** (message patient prêt à afficher : coût + recharge depuis le profil) · 401 · 403 · 409 `{ error }` RDV actif déjà réservé sur ce créneau par le patient · 500
- Notes: arbitrages MVP (spec FEATURE-PATIENT §arbitrages) modifiables sans migration — constantes `src/lib/schedule.ts` (client-safe partagé avec le formulaire) ; `specialtyId` validé en base (doit référencer une spécialité ACTIVE du catalogue ADMIN) ; **coût** = grille tarifaire **EN VIGUEUR lue en base** (`tariff_configs`, éditable par le Médecin Chef — `GET/PATCH /api/admin/tariffs/:key`, défaut provisionnel 1 Token ADR-007), figée ensuite dans `tokensReserved` : un changement de tarif ne vaut que pour les demandes à venir ; solde vérifié DANS la transaction (réservation `RESERVATION` écrite au ledger) — solde insuffisant ⇒ rollback complet.

### [PATCH] /api/appointments/:id — Annuler (patient) / clôturer (Médecin Chef) un rendez-vous

- Feature: FEATURE-RDV + FEATURE-TOKENS | Owner: Backend | Statut: **IMPLÉMENTÉ** (lot P0/P1 2026-10-03 ; actions étendues + sort des Tokens — Task 26/ADR-007)
- Request: `{ "action": "CANCEL" }` (patient propriétaire **ou** ADMIN) **ou** `{ "action": "DONE" }` (**ADMIN uniquement** — consultation réalisée)
- Response: 200 `{ "appointment": { ...idem GET, status: "CANCELLED" | "DONE", tokenState: "RELEASED" | "CONSUMED" } }` — le sort des Tokens réservés suit l'action DANS la même transaction : CANCEL ⇒ `RELEASE` (+N au disponible) ; DONE ⇒ `CONSUMPTION` (dépense définitive, disponible inchangé)
- Errors: 400 `{ error, details }` (action non supportée) · 401 · 403 `{ error }` patient demandant DONE · 404 `{ error }` introuvable ou hors propriété (patient ; indistinguables) · 409 `{ error }` statut non annulable/clôturable (CANCELLED/DONE) · 500
- Notes: propriété vérifiée côté serveur (`patientId` = session) pour le patient ; pas de délai limite d'annulation au MVP (arbitrage PO à trancher pour la phase 2) — politique Tokens MVP : **libération complète avant visite** (frais après départ de l'équipe : attends le dispatch équipe, ADR-007).

### [GET] /api/specialties — Catalogue des spécialités actives

- Feature: FEATURE-RDV (wizard étape 2) | Owner: Backend | Statut: **IMPLÉMENTÉ** (Task 19)
- Request: — (cookie de session, tous rôles)
- Response: 200 `{ "specialties": [{ "id": string, "name": string, "isActive": true, "sortOrder": number }] }` — actives uniquement, tri sortOrder asc puis nom
- Errors: 401 `{ error }` non authentifié · 500
- Notes: catalogue géré par l'ADMIN (voir /api/admin/specialties) ; seed référence : Médecine générale, Pédiatrie, Gynécologie, Cardiologie, Diabétologie, Chirurgie dentaire, Ophtalmologie (`scripts/seed-specialties.ts`, idempotent + backfill).

### [GET] /api/admin/specialties — Catalogue complet (gestion)

- Feature: FEATURE-RDV | Owner: Backend | Statut: **IMPLÉMENTÉ** (Task 19)
- Request: — (cookie de session, rôle ADMIN)
- Response: 200 `{ "specialties": [{ "id", "name", "isActive", "sortOrder" }] }` — actives ET désactivées
- Errors: 401 · 403 `{ error }` hors ADMIN · 500

### [POST] /api/admin/specialties — Créer une spécialité

- Feature: FEATURE-RDV | Owner: Backend | Statut: **IMPLÉMENTÉ** (Task 19)
- Request: `{ "name": string(2–80 après nettoyage), "sortOrder"?: int ≥ 0 }` — défaut : compteur ×10
- Response: 201 `{ "specialty": { id, name, isActive: true, sortOrder } }`
- Errors: 400 `{ error, details }` (zod, nom < 2 ou > 80) · 401 · 403 hors ADMIN · 409 `{ error }` nom déjà existant · 500

### [PATCH] /api/admin/specialties/:id — Renommer / activer-désactiver

- Feature: FEATURE-RDV | Owner: Backend | Statut: **IMPLÉMENTÉ** (Task 19)
- Request: `{ "name"?: string(2–80), "isActive"?: boolean }` — au moins un champ
- Response: 200 `{ "specialty": { id, name, isActive, sortOrder } }`
- Errors: 400 `{ error, details }` · 401 · 403 hors ADMIN · 404 `{ error }` introuvable · 409 `{ error }` nom déjà existant · 500
- Notes: désactivation douce = masquée aux patients, conservée pour l'historique des RDV.

### [DELETE] /api/admin/specialties/:id — Supprimer une spécialité

- Feature: FEATURE-RDV | Owner: Backend | Statut: **IMPLÉMENTÉ** (Task 19)
- Request: —
- Response: 204 (sans corps)
- Errors: 401 · 403 hors ADMIN · 404 `{ error }` introuvable · 409 `{ error }` des RDV y sont rattachés (désactivation recommandée) · 500
- Notes: la suppression détache les RDV via FK `onDelete: SetNull` — refusée si des RDV existent (l'historique clinique reste rattaché à une spécialité).

### [GET] /api/sensibilisations — Fil de sensibilisations santé

- Feature: FEATURE-SENSO | Owner: Backend | Statut: **IMPLÉMENTÉ** (lot P0/P1 2026-10-03)
- Request: — (cookie de session, tous rôles) — filtrage par la zone du lecteur
- Response: 200 `{ "sensibilisations": [{ "id": string, "title": string, "body": string, "category": "ADVICE" | "ALERT", "zones": Zone[], "publishedAt": string }] }` — tri décroissant publication, 50 derniers
- Errors: 401 · 500
- Notes: ciblage vide (`zones: []`) = visible de toutes les zones ; contenu éditorial seedé (6 contenus référence) jusqu'à la rédaction ADMIN (phase 2).

### [GET] /api/sensibilisations/:id — Détail d'une sensibilisation

- Feature: FEATURE-SENSO | Owner: Backend | Statut: **IMPLÉMENTÉ** (lot P0/P1 2026-10-03)
- Request: — (cookie de session, tous rôles)
- Response: 200 `{ "sensibilisation": { ...idem liste } }`
- Errors: 401 · 404 `{ error }` introuvable **ou** hors ciblage de zone du lecteur (indistinguables — pas de fuite d'existence) · 500

### [POST] /api/auth/register — Inscription (Patient)

- Feature: FEATURE-AUTH (SYS-010) | Owner: Backend | Statut: **VALIDÉ** (ADR-004, maj PO 2026-10)
- Request: `{ "fullName": string(2..80), "phone": string(regex ^\+?[0-9]{8,15}$), "password": string(8..72), "confirmPassword": string, "zone": "YOPOUGON"|"SONGON"|"PK22"|"NDOTRE" }`
- Response: 201 `{ "user": { "id": string, "fullName": string, "phone": string, "role": string, "zone": string, "birthDate": string|null, "appointmentReminders": boolean, "healthAlerts": boolean, "theme": "SYSTEM"|"LIGHT"|"DARK", "createdAt": string } }` — cookie de session posé
- Errors: 400 `{ error, details }` (zod) · 409 `{ error }` numéro déjà inscrit · 500
- Notes: **rôle `PATIENT` forcé côté serveur** (décision PO 2026-10 : pas de choix de rôle à l'inscription ; toute valeur `role` cliente est ignorée) ; `NURSE`/`ADMIN` créés par l'administration ; `confirmPassword` validé = `password` ; jamais de retour de `passwordHash`.

### [POST] /api/auth/login — Connexion

- Feature: FEATURE-AUTH (SYS-010) | Owner: Backend | Statut: **VALIDÉ** (ADR-004, maj PO 2026-10)
- Request: `{ "phone": string, "password": string, "rememberMe"?: boolean }` — `rememberMe` optionnel, défaut `true`
- Response: 200 `{ "user": { ...idem register } }` — cookie de session posé : `rememberMe: true` → persistant 30 jours (DB + cookie) ; `false` → cookie de session navigateur + TTL DB 24 h
- Errors: 400 `{ error, details }` (zod) · 401 `{ error: "Numéro ou mot de passe incorrect" }` (générique anti-énumération) · 500

### [GET] /api/auth/me — Profil courant

- Feature: FEATURE-AUTH (SYS-010) | Owner: Backend | Statut: **VALIDÉ** (ADR-004)
- Request: — (cookie de session)
- Response: 200 `{ "user": { ...idem register } }`
- Errors: 401 `{ error }` non authentifié / session expirée · 500

### [PATCH] /api/auth/profile — Éditer son profil (FEATURE-PROFIL, Task 22/23)

- Feature: FEATURE-PROFIL | Owner: Backend | Statut: **IMPLÉMENTÉ** (Task 22/23, 2026-10-03)
- Request: `{ "fullName"?: string(2..80), "birthDate"?: string("AAAA-MM-JJ", passée) | null, "zone"?: "YOPOUGON" | "SONGON" | "PK22" | "NDOTRE", "appointmentReminders"?: boolean, "healthAlerts"?: boolean, "theme"?: "SYSTEM" | "LIGHT" | "DARK" }` — delta sémantique : seuls les champs fournis sont modifiés ; `birthDate: null` efface (« Non renseignée ») ; au moins un champ requis. **`phone`/`role` absents du contrat Zod** → stripped : un corps qui ne contient qu'eux est refusé 400 (le user ciblé = session, jamais le corps). `zone` éditable depuis la Task 23 (secteur d'habitation, même liste fermée que l'inscription). `theme` éditable depuis la Task 37 (FEATURE-DARK-MODE : préférence de thème par utilisateur — toggle en-tête dashboard LIGHT/DARK + sélecteur « Apparence » du profil SYSTEM/LIGHT/DARK ; appliqué par ThemeInit qui privilégie le serveur au boot)
- Response: 200 `{ "user": { ...idem register } }` — vérité serveur renvoyée (le front réaligne son store dessus)
- Errors: 400 `{ error, details }` (zod : nom, format/passage de la date, « Aucune modification fournie ») · 401 `{ error }` non authentifié · 500
- Notes: tous rôles authentifiés (chacun édite SON profil) ; naissance stockée à minuit UTC (Afrique/Abidjan = UTC+0) ; préférences = opt-out par défaut `true` (rappels RDV **SMS** 24 h avant · alertes de santé locales) ; schéma Zod partagé front/back (`updateProfileSchema`, src/lib/auth-schemas.ts) ; E2E `scripts/e2e-profile-edit.sh` + `scripts/e2e-sector-reminders.sh`.

### [GET|POST] /api/cron/reminders — Scheduler des rappels de RDV (FEATURE-RDV, Task 23)

- Feature: FEATURE-RDV | Owner: Backend | Statut: **IMPLÉMENTÉ** (Task 23, 2026-10-03 — transport en stub tant que la décision A10 est ouverte)
- Request: — · header `Authorization: Bearer ${CRON_SECRET}` (obligatoire) ; à brancher sur un planificateur externe (Vercel Cron / cron système)
- Response: 200 `{ ok: true, gateway: string, due: number, sent: number, failed: number, results: [{ appointmentId, ok, error? }] }` — résumé du tick
- Errors: 401 `{ error }` secret absent/faux (comparaison à temps constant) · 503 `{ error }` **CRON_SECRET non configuré** = scheduler non déployé (passerelle SMS : décision A10 en attente) · 500
- Notes: périmètre PO — rappels **UNIQUEMENT AVANT les RDV**, fenêtre **24 h** (`REMINDER_LEAD_HOURS`, src/lib/reminders.ts) ; sélection : `status = CONFIRMED` ∧ `scheduledAt ∈ [maintenant, +24 h]` ∧ `reminderSentAt IS NULL` ∧ patient `appointmentReminders = true` ; **anti-doublon** : envoi réussi ⇒ `Appointment.reminderSentAt` marqué (un RDV rappelé n'est jamais repris ; échec ⇒ non marqué ⇒ retenté au tick suivant) ; batch plafonné à 100/tick ; **deux canaux par tick (Task 24)** : notification InApp créée d'abord (upsert idempotent via unique `userId+type+entityId` — jamais de doublon même en cas de retentement SMS) puis SMS via la passerelle **provider-agnostic** (`SmsGateway`) en stub console — brancher le fournisseur choisi à A10 (ADR-006) = 1 seule fonction (`getSmsGateway`) ; message SMS fr-FR ≤ 160 c. (heure locale Afrique/Abidjan = UTC+0).

### [GET] /api/notifications — Fil InApp de l'utilisateur (FEATURE-RDV, Task 24 ; étendu Task 35)

- Feature: FEATURE-RDV (canal InApp des rappels) | Owner: Backend | Statut: **IMPLÉMENTÉ** (Task 24, 2026-10-03 ; couverture complète des cycles métier Task 35, 2026-10-04)
- Request: — (cookie de session, tous rôles) — l'utilisateur ne voit JAMAIS que ses propres notifications
- Response: 200 `{ "notifications": [{ "id": string, "type": NotificationType, "title": string, "body": string, "entityId": string|null, "readAt": string|null, "createdAt": string }], "unreadCount": number }` — 50 plus récentes, tri décroissant `createdAt` ; `unreadCount` = badge de la cloche
- Errors: 401 `{ error }` non authentifié · 500
- Notes: **`NotificationType` (Task 35 — enum DB autorité, miroir `src/lib/notifications.ts`) :**
  | Type | Destinataire | Déclencheur (transaction métier) | `entityId` |
  |---|---|---|---|
  | `APPOINTMENT_REMINDER` | patient | scheduler rappels 24 h (reminders.ts, upsert idempotent) | appointmentId |
  | `APPOINTMENT_REQUESTED` | ADMIN(s) | RDV **DOMICILE** créé (appointments.ts) — file de dispatch | appointmentId |
  | `APPOINTMENT_CANCELLED` | ADMIN(s) / patient | annulation patient → admins ; annulation équipe → patient | appointmentId |
  | `APPOINTMENT_COMPLETED` | patient | clôture `DONE` par le Médecin Chef (Tokens consommés) | appointmentId |
  | `MISSION_ASSIGNED` | infirmier affecté | dispatch / réaffectation (nurse.ts, date en fr-FR) | missionId:assignment:ts |
  | `MISSION_STATUS_CHANGED` | patient + admin affecteur | transition de statut infirmier | missionId:status |
  | `VISIT_REPORT_SUBMITTED` | patient + admin affecteur | compte rendu rédigé | missionId:report |
  | `RECHARGE_REQUESTED` | ADMIN(s) | déclaration de recharge patient (tokens.ts) | rechargeId |
  | `RECHARGE_CONFIRMED` | patient | décision `CONFIRM` du Médecin Chef | rechargeId |
  | `RECHARGE_REJECTED` | patient | décision `REJECT` | rechargeId |
  Anti-doublon structurel via index unique `(userId, type, entityId)` (NB Postgres : NULL distincts — dédoublonnage effectif pour les types portant une `entityId`) ; helpers partagés `notifyUsers` / `notifyAdmins` (server-only) — les notifications naissent DANS la transaction métier (jamais de mutation sans nouvelle).
- Notes front (Task 35) : routage du clic par **famille** (`notificationFamily`) + rôle — patient : `RECHARGE_*` → Wallet, `APPOINTMENT_*`/missions → Mes rendez-vous ; infirmier → Missions ; admin : `RECHARGE_*` → Recharges, le reste → Missions & Dispatch ; icône/couleur par famille dans le panneau.

### [POST] /api/notifications/read — Marquer des notifications comme lues (Task 24)

- Feature: FEATURE-RDV (canal InApp des rappels) | Owner: Backend | Statut: **IMPLÉMENTÉ** (Task 24, 2026-10-03)
- Request: exactement une des deux formes — `{ "all": true }` (toutes les non-lues de la session) **ou** `{ "id": string }` (une seule) ; schéma Zod partagé front/back (`markNotificationsReadSchema`, src/lib/notifications.ts)
- Response: 200 `{ "ok": true, "unreadCount": number }` — vérité serveur pour réaligner le badge
- Errors: 400 `{ error, details }` (JSON invalide, les deux formes ou aucune) · 401 `{ error }` non authentifié · 404 `{ error }` `id` inexistant **ou** appartenant à un autre utilisateur (indistinguables — pas de fuite d'existence) · 500
- Notes: le user ciblé = session (jamais le corps) ; `updateMany` scopé `userId + readAt IS NULL` — idempotent ; le front patient applique en optimiste puis réaligne sur le `unreadCount` renvoyé.

### [GET] /api/wallet — Portefeuille de Tokens du patient (FEATURE-TOKENS, ADR-007)

- Feature: FEATURE-TOKENS | Owner: Backend | Statut: **IMPLÉMENTÉ** (Task 26, 2026-10-03)
- Request: — (cookie de session, rôle PATIENT)
- Response: 200 `{ "balanceTokens": number, "balanceFcfa": number, "reservedTokens": number, "spentTokens": number, "spentFcfa": number, "transactions": [{ "id": string, "type": "RECHARGE" | "RESERVATION" | "CONSUMPTION" | "RELEASE" | "REFUND" | "ADJUSTMENT", "status": "PENDING" | "CONFIRMED" | "REJECTED", "tokens": number, "amountFcfa": number | null, "note": string | null, "createdAt": string }] }` — 50 derniers mouvements, tri décroissant
- Errors: 401 `{ error }` non authentifié · 403 `{ error }` rôle hors PATIENT · 500
- Notes: **ledger append-only** — le solde est TOUJOURS recalculé par `computeBalance` (source unique partagée avec la réservation de RDV) : `recharges confirmées + remboursements + ajustements − TOUTES les réservations + libérations` (une réservation déduit tant qu'elle existe : active = bloquée, consommée = dépense définitive, libérée = neutralisée par sa RELEASE) ; `reservedTokens` = lignes `RESERVATION` dont le RDV lié est toujours `tokenState=RESERVED` ; 1 Token = 2 500 FCFA (`TOKEN_VALUE_FCFA`).

### [POST] /api/wallet/recharges — Déclarer une recharge (FEATURE-TOKENS, ADR-007)

- Feature: FEATURE-TOKENS | Owner: Backend | Statut: **IMPLÉMENTÉ** (Task 26, 2026-10-03 — validation manuelle transitoire, ADR-005 ouverte)
- Request: `{ "amountFcfa": number }` — multiple exact de 2 500 FCFA, plafond 500 000 FCFA (anti-fraude MVP)
- Response: 201 `{ "recharge": { "id": string, "type": "RECHARGE", "status": "PENDING", "tokens": number, "amountFcfa": number, "createdAt": string } }`
- Errors: 400 `{ error, details }` (zod : multiple/plafond/entier) · 401 · 403 · 500
- Notes: la recharge naît **PENDING** (paiement Wave/OM/MTN/Visa déclaré mais non rapproché) ; le Médecin Chef crédite via [PATCH] /api/admin/recharges/:id ; `providerRef` accueillera la référence prestataire à ADR-005.

### [GET] /api/admin/recharges — File de validation des recharges (Médecin Chef)

- Feature: FEATURE-TOKENS | Owner: Backend | Statut: **IMPLÉMENTÉ** (Task 26, 2026-10-03)
- Request: — (cookie de session, rôle ADMIN)
- Response: 200 `{ "pending": [{ ...recharge, "patientName": string, "patientPhone": string }], "processed": [...] }` — PENDING triées croissantes (50 max) puis décisions récentes (30 max, triées par date de décision)
- Errors: 401 `{ error }` · 403 `{ error }` rôle hors ADMIN · 500

### [PATCH] /api/admin/recharges/:id — Décision du Médecin Chef sur une recharge

- Feature: FEATURE-TOKENS | Owner: Backend | Statut: **IMPLÉMENTÉ** (Task 26, 2026-10-03)
- Request: `{ "decision": "CONFIRM" | "REJECT", "note"?: string(≤300) }` — note par défaut : « Paiement rapproché par le Médecin Chef » / « Paiement non rapproché »
- Response: 200 `{ "recharge": { ...status: "CONFIRMED" | "REJECTED" } }` — CONFIRM crédite les Tokens (statut comptabilisé) ; REJECT ne crédite jamais
- Errors: 400 `{ error, details }` · 401 · 403 · 404 `{ error }` recharge inexistante ou hors type RECHARGE · 409 `{ error }` déjà traitée (garde anti double-crédit : transition conditionnelle `PENDING → CONFIRMED/REJECTED` via `updateMany` — une double confirmation, même concurrente, ne crédite JAMAIS deux fois) · 500

### [GET] /api/tariffs — Grille tarifaire en vigueur (wizard patient)

- Feature: FEATURE-TOKENS (ADR-007 — tarifs configurables, Task 28) | Owner: Backend | Statut: **IMPLÉMENTÉ** (Task 28, 2026-10-03)
- Request: — (cookie de session, rôle PATIENT)
- Response: 200 `{ "tariffs": [{ "key": "CONSULTATION_CABINET" | "CONSULTATION_DOMICILE", "label": string, "description": string, "tokens": number, "updatedAt": string, "updatedByName": string | null }] }` — le wizard consomme `tokens` pour afficher le coût exact avant confirmation
- Errors: 401 `{ error }` non authentifié · 403 `{ error }` rôle hors PATIENT · 500
- Notes: la grille vit en base (`tariff_configs`, une ligne par poste — extensible sans migration) ; valeurs par défaut provisionnelles 1 Token (ADR-007) ; les clés manquantes en base sont ré-tablées au défaut (auto-réparation idempotente) ; le serveur revalide le tarif réel DANS la transaction de réservation.

### [GET] /api/admin/tariffs — Grille tarifaire complète (Médecin Chef)

- Feature: FEATURE-TOKENS (ADR-007 — Task 28) | Owner: Backend | Statut: **IMPLÉMENTÉ** (Task 28, 2026-10-03)
- Request: — (cookie de session, rôle ADMIN)
- Response: 200 `{ "tariffs": [{ "key", "label", "description", "tokens", "updatedAt", "updatedByName" }] }` — tous les postes, audit de dernière modification inclus
- Errors: 401 `{ error }` · 403 `{ error }` rôle hors ADMIN · 500

### [PATCH] /api/admin/tariffs/:key — Fixer le prix en Tokens d'un poste (Médecin Chef)

- Feature: FEATURE-TOKENS (ADR-007 — Task 28) | Owner: Backend | Statut: **IMPLÉMENTÉ** (Task 28, 2026-10-03)
- Request: `{ "tokens": number }` — entier 0..100 (`TARIFF_MAX_TOKENS` ; 0 = consultation gratuite, choix explicite ADMIN)
- Response: 200 `{ "tariff": { "key", "label", "description", "tokens", "updatedAt", "updatedByName" } }` — modification auditable (`updatedById`)
- Errors: 400 `{ error, details }` (zod : entier hors 0..100) · 401 · 403 · **404 `{ error }` clé inconnue** (liste fermée `TARIFF_KEYS`) · 500
- Notes: la modification vaut pour les **DEMANDES À VENIR** — le coût d'un RDV est figé à sa réservation (`appointments.tokensReserved`, lu dans la même transaction sérialisable) ; les réservations déjà engagées ne sont JAMAIS impactées (invariant financier du ledger).

### [POST] /api/auth/forgot-password — Mot de passe oublié (étape 1)

- Feature: FEATURE-AUTH (SYS-010 / US-AUTH-5) | Owner: Backend | Statut: **VALIDÉ** (maj PO 2026-10)
- Request: `{ "phone": string(regex ^\+?[0-9]{8,15}$) }`
- Response: 200 `{ "ok": true, "message": string }` — **toujours 200**, même numéro inconnu
- Errors: 400 `{ error, details }` (zod) · 500
- Notes: **anti-énumération** — réponse identique que le compte existe ou non. Code à 6 chiffres stocké hashé SHA-256 (`password_reset_tokens`), expiration 15 min, usage unique, anciens jetons purgés à chaque demande. Livraison : **TODO INT-SMS** passerelle SMS (placeholder console serveur — le code n'est jamais renvoyé dans la réponse HTTP).

### [POST] /api/auth/reset-password — Réinitialisation (étape 2)

- Feature: FEATURE-AUTH (SYS-010 / US-AUTH-5) | Owner: Backend | Statut: **VALIDÉ** (maj PO 2026-10)
- Request: `{ "phone": string, "code": string(6 chiffres), "password": string(8..72), "confirmPassword": string }`
- Response: 200 `{ "ok": true }` — mot de passe mis à jour (bcrypt), **toutes les sessions du compte révoquées**
- Errors: 400 `{ error: "Code invalide ou expiré — demandez un nouveau code" }` (générique : code faux/expiré/utilisé/compte absent indistinguables) · 400 `{ error, details }` (zod) · 500

### [POST] /api/auth/change-password — Changement de mot de passe (session active)

- Feature: FEATURE-NURSE-PROFIL (Task 34, réutilisable tous rôles) | Owner: Backend | Statut: **IMPLÉMENTÉ** (2026-10-04)
- Request: `{ "currentPassword": string, "password": string(8..72), "confirmPassword": string }` (cookie de session)
- Response: 200 `{ "ok": true }` — mot de passe mis à jour (bcrypt) ; **les autres sessions du compte sont révoquées**, la session courante est préservée
- Errors: 400 `{ error, details: [{ field: "currentPassword", message: "Mot de passe actuel incorrect" }] }` · 400 `{ error, details: [{ field: "password", message: "Le nouveau mot de passe doit être différent de l'actuel" }] }` · 400 `{ error, details }` (zod : robustesse 8..72, confirmation) · 401 non authentifié · 500
- Notes: l'utilisateur ciblé est toujours celui de la session (jamais pris du corps) ; comparaison anti timing-attack (hash factice) ; diffère du flux forgot/reset (US-AUTH-5) qui reste la voie hors session / code SMS (ADR-006). Branché sur la vue profil infirmier (Task 34) ; disponible pour patient/admin à l'avenir.

### [POST] /api/auth/logout — Déconnexion

- Feature: FEATURE-AUTH (SYS-010) | Owner: Backend | Statut: **VALIDÉ** (ADR-004)
- Request: — (cookie de session)
- Response: 200 `{ "ok": true }` — session détruite en DB + cookie écrasé
- Errors: 500 (idempotent : sans cookie valide → 200 `ok`)

### [POST] /api/push/register — Enregistrement du jeton FCM (appareil natif)

- Feature: FEATURE-PUSH (Task 36, ADR-008) | Owner: Backend | Statut: **IMPLÉMENTÉ** (2026-10-05)
- Request: `{ "token": string(16..4096), "platform": "android" | "ios" | "web", "deviceName"?: string(≤120), "appVersion"?: string(≤40) }` (cookie de session, tous rôles)
- Response: 200 `{ "ok": true }` — **upsert par jeton** : si l'appareil était lié à un autre compte, le jeton est réattribué (un appareil ne pousse que pour le compte courant)
- Errors: 400 `{ error, details }` (zod : token longueur, platform énumérée) · 401 `{ error }` · 500
- Notes: appelé par `src/lib/native.ts` à chaque ouverture/reprise de l'APK (idempotent). Le jeton autorise à ENVOYER à l'appareil — aucune donnée lisible. **ADR-009 (2026-10-05) : canal push distant DORMANT** — le client n'appelle cette route que si Firebase est initialisé dans l'APK (jamais le cas : aucun projet Firebase). Route conservée saine (401/400/200) comme carnet d'adresses pour un futur transport.

### [POST] /api/push/unregister — Révocation du jeton FCM (déconnexion)

- Feature: FEATURE-PUSH (Task 36, ADR-008) | Owner: Backend | Statut: **IMPLÉMENTÉ** (2026-10-05)
- Request: `{ "token": string }` **ou** `{ "all": true }` — exactement une des deux formes (sinon 400)
- Response: 200 `{ "ok": true }` — **idempotent** : supprimer un jeton absent est un succès
- Errors: 400 `{ error, details }` (corps ambigu) · 401 `{ error }` · 500
- Notes: appelé fire-and-forget AVANT `POST /api/auth/logout` (la session doit encore être valide) ; `{ all: true }` disponible pour une future « déconnexion partout ».

### Push FCM — payload (HISTORIQUE — canal distant dormant, ADR-009)

- Feature: FEATURE-PUSH | Owner: Backend | Statut: **RETIRÉ** (2026-10-05 — firebase-admin et code d'envoi supprimés)
- Ce que c'était : envoi FCM fire-and-forget après le commit de la transaction métier, `{ title, body }` identique à la notification InApp jumelle + `data: { url, type, entityId }` pour le routage du clic au tap (mapping miroir de `notificationDestination()`).
- État actuel : les notifications métier restent créées **dans la transaction** (canal InApp, Task 35) et les rappels RDV sont planifiés **localement** sur l'appareil (H-24/H-1) — les deux 100 % sans Firebase. Ré-activation éventuelle du push : cf. `.ai/ADR/ADR-009-notifications-sans-firebase.md` (git revert + config projet Firebase).

---

## Contrats à venir

### [GET] /api/nurse/missions — Missions de l'infirmier connecté

- Feature: FEATURE-NURSE | Owner: Backend | Statut: **IMPLÉMENTÉ**
- Auth: rôle `NURSE` uniquement ; la requête est toujours filtrée par `nurseId = session.user.id`.
- Response: 200 `{ "missions": Mission[] }`, triées de la plus récente affectation à la plus ancienne.
- Errors: 401 · 403 hors NURSE · 500

### [GET] /api/nurse/missions/:id — Détail d'une mission

- Feature: FEATURE-NURSE | Statut: **IMPLÉMENTÉ**
- Response: 200 `{ "mission": Mission }` avec rendez-vous, patient, infirmier et compte-rendu éventuel.
- Errors: 401 · 403 · 404 mission absente ou appartenant à un autre infirmier · 500

### [PATCH] /api/nurse/missions/:id — Changer le statut

- Request: `{ "status": "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" }` (Zod)
- Feature: FEATURE-NURSE | Statut: **IMPLÉMENTÉ**
- Notes: transitions strictes `ASSIGNED→ACCEPTED→IN_PROGRESS→COMPLETED`; annulation possible avant clôture. Propriété vérifiée côté serveur.
- Errors: 400 validation · 401 · 403 · 404 · 409 transition illégale · 500

`PATCH /api/nurse/missions/:id/status` expose le même contrat explicite pour les clients qui séparent le sous-ressource statut.

### [POST] /api/nurse/missions/:id/report — Créer le compte-rendu de visite

- Request: `{ observations: string, actionsTaken?: string, recommendations?: string, vitalSigns?: Record<string,string|number> }` (Zod)
- Feature: FEATURE-NURSE | Statut: **IMPLÉMENTÉ**
- Notes: infirmier propriétaire uniquement ; mission obligatoirement `IN_PROGRESS` ; un seul rapport par mission.
- Response: 201 `{ "report": VisitReport }`
- Errors: 400 · 401 · 403 · 404 · 409 mission non démarrée ou rapport déjà présent · 500

### [POST] /api/admin/missions — Affecter une mission

- Request: `{ "appointmentId": string, "nurseId": string }` (Zod)
- Feature: FEATURE-NURSE | Statut: **IMPLÉMENTÉ**
- Notes: ADMIN uniquement ; l'infirmier doit avoir le rôle NURSE et couvrir la zone du rendez-vous. Un rendez-vous ne possède qu'une mission.
- Response: 201 `{ "mission": Mission }`
- Errors: 400 · 401 · 403 · 404 · 409 déjà dispatché · 500

### [GET] /api/admin/missions — Tableau de bord des missions (supervision + dispatch, Task 35)

- Feature: FEATURE-NURSE | Statut: **IMPLÉMENTÉ** (contrat étendu Task 35, 2026-10-04 — additif, `missions` inchangé)
- Auth: rôle `ADMIN` uniquement.
- Response: 200 `{ "missions": Mission[], "dispatchQueue": [{ "id": appointmentId, "patientName": string, "patientPhone": string, "zone": string, "type": string, "scheduledAt": string, "specialtyName": string|null, "reason": string|null, "tokensReserved": number }], "nurses": [{ "id": string, "fullName": string, "phone": string, "zone": string }] }` — `missions` triées par date d'affectation décroissante ; `dispatchQueue` = RDV **DOMICILE** actifs (PENDING/CONFIRMED) **sans mission**, tri croissant par créneau, 50 max ; `nurses` = annuaire des comptes NURSE (tri alphabétique). DTO partagés client-safe dans `src/lib/nurse-schemas.ts` (`AdminMissionBoard`).
- Errors: 401 · 403 · 500
- Notes: payload unique consommé par la vue admin « Missions & Dispatch » (components/admin/missions-view.tsx) — file à affecter (POST dispatch), suivi des statuts, réaffectation, lecture des comptes rendus ; l'UI guide la contrainte de zone (l'API refuse un infirmier hors zone, 400).

### [PATCH] /api/admin/missions/:id — Réaffecter une mission

- Request: `{ "nurseId": string }` (Zod)
- Feature: FEATURE-NURSE | Statut: **IMPLÉMENTÉ**
- Notes: ADMIN uniquement ; la réaffectation remet le statut à `ASSIGNED`, réinitialise les timestamps de progression et crée une notification `MISSION_ASSIGNED`.
- Response: 200 `{ "mission": Mission }`
- Errors: 400 · 401 · 403 · 404 · 500

_(Le tableau se remplira au fil des features. Format exigé ci-dessus.)_

| Endpoint                           | Feature               | Statut                                                                            |
| ---------------------------------- | --------------------- | --------------------------------------------------------------------------------- |
| [GET] /api/tokens                  | FEATURE-TOKENS (P2)   | À venir — contrat à rédiger (ledger `TokenAccount`/`TokenTransaction`, audit §2)  |
| [POST] /api/tokens/topup           | FEATURE-TOKENS (P2)   | À venir — crédit manuel ADMIN au MVP ; paiement Mobile Money suspendu à l'ADR-005 |
| [POST] /api/admin/sensibilisations | FEATURE-SENSO phase 2 | À venir — rédaction ADMIN (au MVP : seed éditorial)                               |
