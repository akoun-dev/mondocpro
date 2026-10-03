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
- Feature: SYS-001 (système) | Owner: Backend | Statut: **VALIDÉ** (v2, lot P0 2026-10-03 : ajout probe DB)
- Response: 200 `{ "status": "ok" | "degraded", "database": "up" | "down", "timestamp": string }`
- Notes: remplace le hello-world scaffold comme vérification de santé lors des tests E2E et du monitoring. La sonde exécute `SELECT 1` via Prisma — toujours HTTP 200 (l'état porté par le corps permet à l'app de répondre même en cas d'incident DB) ; `status: "degraded"` ⇔ `database: "down"`.

### [GET] /api/appointments — Mes rendez-vous
- Feature: FEATURE-RDV | Owner: Backend | Statut: **IMPLÉMENTÉ** (lot P0/P1 2026-10-03, audit §4 validé par GO PO ; spécialité ajoutée Task 19)
- Request: — (cookie de session, rôle PATIENT)
- Response: 200 `{ "appointments": [{ "id": string, "type": "CABINET" | "DOMICILE", "zone": Zone, "specialty": { "id": string, "name": string } | null, "scheduledAt": string(ISO UTC), "status": "PENDING" | "CONFIRMED" | "CANCELLED" | "DONE", "reason": string | null, "createdAt": string }] }` — tri décroissant par créneau, 100 derniers ; `specialty: null` = RDV antérieurs au wizard (backfill « Médecine générale » en base)
- Errors: 401 `{ error }` non authentifié · 403 `{ error }` rôle hors PATIENT · 500

### [POST] /api/appointments — Prendre un rendez-vous
- Feature: FEATURE-RDV | Owner: Backend | Statut: **IMPLÉMENTÉ** (lot P0/P1 2026-10-03 ; wizard 4 étapes + specialtyId requis — Task 19)
- Request: `{ "type": "CABINET" | "DOMICILE", "specialtyId": string, "zone": Zone, "date": string("YYYY-MM-DD"), "time": string("HH:MM"), "reason"?: string(≤500) }` — date/heure saisis séparément (Afrique/Abidjan = UTC+0 : l'heure locale est l'heure UTC)
- Response: 201 `{ "appointment": { ...idem GET } }`
- Errors: 400 `{ error, details }` (zod, règle créneau : grille 30 min, lundi–vendredi 08:00–16:30, ≥ 2 h à l'avance, ≤ 60 jours, ou spécialité inexistante/inactive) · 401 · 403 · 409 `{ error }` RDV actif déjà réservé sur ce créneau par le patient · 500
- Notes: arbitrages MVP (spec FEATURE-PATIENT §arbitrages) modifiables sans migration — constantes `src/lib/schedule.ts` (client-safe partagé avec le formulaire) ; `specialtyId` validé en base (doit référencer une spécialité ACTIVE du catalogue ADMIN).

### [PATCH] /api/appointments/:id — Annuler un rendez-vous
- Feature: FEATURE-RDV | Owner: Backend | Statut: **IMPLÉMENTÉ** (lot P0/P1 2026-10-03)
- Request: `{ "action": "CANCEL" }` — seule action patient supportée au MVP
- Response: 200 `{ "appointment": { ...idem GET, status: "CANCELLED" } }`
- Errors: 400 `{ error, details }` (action non supportée) · 401 · 403 · 404 `{ error }` introuvable ou hors propriété (indistinguables) · 409 `{ error }` statut non annulable (CANCELLED/DONE) · 500
- Notes: propriété vérifiée côté serveur (`patientId` = session) ; pas de délai limite d'annulation au MVP (arbitrage PO à trancher pour la phase 2).

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
- Response: 201 `{ "user": { "id": string, "fullName": string, "phone": string, "role": string, "zone": string, "birthDate": string|null, "appointmentReminders": boolean, "healthAlerts": boolean, "createdAt": string } }` — cookie de session posé
- Errors: 400 `{ error, details }` (zod) · 409 `{ error }` numéro déjà inscrit · 500
- Notes: **rôle `PATIENT` forcé côté serveur** (décision PO 2026-10 : pas de choix de rôle à l'inscription ; toute valeur `role` cliente est ignorée) ; `INFIRMIER`/`ADMIN` créés par l'administration ; `confirmPassword` validé = `password` ; jamais de retour de `passwordHash`.

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
- Request: `{ "fullName"?: string(2..80), "birthDate"?: string("AAAA-MM-JJ", passée) | null, "zone"?: "YOPOUGON" | "SONGON" | "PK22" | "NDOTRE", "appointmentReminders"?: boolean, "healthAlerts"?: boolean }` — delta sémantique : seuls les champs fournis sont modifiés ; `birthDate: null` efface (« Non renseignée ») ; au moins un champ requis. **`phone`/`role` absents du contrat Zod** → stripped : un corps qui ne contient qu'eux est refusé 400 (le user ciblé = session, jamais le corps). `zone` éditable depuis la Task 23 (secteur d'habitation, même liste fermée que l'inscription)
- Response: 200 `{ "user": { ...idem register } }` — vérité serveur renvoyée (le front réaligne son store dessus)
- Errors: 400 `{ error, details }` (zod : nom, format/passage de la date, « Aucune modification fournie ») · 401 `{ error }` non authentifié · 500
- Notes: tous rôles authentifiés (chacun édite SON profil) ; naissance stockée à minuit UTC (Afrique/Abidjan = UTC+0) ; préférences = opt-out par défaut `true` (rappels RDV **SMS** 24 h avant · alertes de santé locales) ; schéma Zod partagé front/back (`updateProfileSchema`, src/lib/auth-schemas.ts) ; E2E `scripts/e2e-profile-edit.sh` + `scripts/e2e-sector-reminders.sh`.

### [GET|POST] /api/cron/reminders — Scheduler des rappels de RDV (FEATURE-RDV, Task 23)
- Feature: FEATURE-RDV | Owner: Backend | Statut: **IMPLÉMENTÉ** (Task 23, 2026-10-03 — transport en stub tant que la décision A10 est ouverte)
- Request: — · header `Authorization: Bearer ${CRON_SECRET}` (obligatoire) ; à brancher sur un planificateur externe (Vercel Cron / cron système)
- Response: 200 `{ ok: true, gateway: string, due: number, sent: number, failed: number, results: [{ appointmentId, ok, error? }] }` — résumé du tick
- Errors: 401 `{ error }` secret absent/faux (comparaison à temps constant) · 503 `{ error }` **CRON_SECRET non configuré** = scheduler non déployé (passerelle SMS : décision A10 en attente) · 500
- Notes: périmètre PO — rappels **UNIQUEMENT AVANT les RDV**, fenêtre **24 h** (`REMINDER_LEAD_HOURS`, src/lib/reminders.ts) ; sélection : `status = CONFIRMED` ∧ `scheduledAt ∈ [maintenant, +24 h]` ∧ `reminderSentAt IS NULL` ∧ patient `appointmentReminders = true` ; **anti-doublon** : envoi réussi ⇒ `Appointment.reminderSentAt` marqué (un RDV rappelé n'est jamais repris ; échec ⇒ non marqué ⇒ retenté au tick suivant) ; batch plafonné à 100/tick ; transport **provider-agnostic** (`SmsGateway`) avec stub console — brancher le fournisseur choisi à A10 = 1 seule fonction (`getSmsGateway`) ; message SMS fr-FR ≤ 160 c. (heure locale Afrique/Abidjan = UTC+0).

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

### [POST] /api/auth/logout — Déconnexion
- Feature: FEATURE-AUTH (SYS-010) | Owner: Backend | Statut: **VALIDÉ** (ADR-004)
- Request: — (cookie de session)
- Response: 200 `{ "ok": true }` — session détruite en DB + cookie écrasé
- Errors: 500 (idempotent : sans cookie valide → 200 `ok`)

---

## Contrats à venir

*(Le tableau se remplira au fil des features. Format exigé ci-dessus.)*

| Endpoint | Feature | Statut |
|---|---|---|
| [GET] /api/tokens | FEATURE-TOKENS (P2) | À venir — contrat à rédiger (ledger `TokenAccount`/`TokenTransaction`, audit §2)
| [POST] /api/tokens/topup | FEATURE-TOKENS (P2) | À venir — crédit manuel ADMIN au MVP ; paiement Mobile Money suspendu à l'ADR-005
| [POST] /api/admin/sensibilisations | FEATURE-SENSO phase 2 | À venir — rédaction ADMIN (au MVP : seed éditorial) |
