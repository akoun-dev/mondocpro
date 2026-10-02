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
- Feature: FEATURE-RDV | Owner: Backend | Statut: **IMPLÉMENTÉ** (lot P0/P1 2026-10-03, audit §4 validé par GO PO)
- Request: — (cookie de session, rôle PATIENT)
- Response: 200 `{ "appointments": [{ "id": string, "type": "CABINET" | "DOMICILE", "zone": Zone, "scheduledAt": string(ISO UTC), "status": "PENDING" | "CONFIRMED" | "CANCELLED" | "DONE", "reason": string | null, "createdAt": string }] }` — tri décroissant par créneau, 100 derniers
- Errors: 401 `{ error }` non authentifié · 403 `{ error }` rôle hors PATIENT · 500

### [POST] /api/appointments — Prendre un rendez-vous
- Feature: FEATURE-RDV | Owner: Backend | Statut: **IMPLÉMENTÉ** (lot P0/P1 2026-10-03)
- Request: `{ "type": "CABINET" | "DOMICILE", "zone": Zone, "date": string("YYYY-MM-DD"), "time": string("HH:MM"), "reason"?: string(≤500) }` — date/heure saisis séparément (Afrique/Abidjan = UTC+0 : l'heure locale est l'heure UTC)
- Response: 201 `{ "appointment": { ...idem GET } }`
- Errors: 400 `{ error, details }` (zod ou règle créneau : grille 30 min, lundi–vendredi 08:00–16:30, ≥ 2 h à l'avance, ≤ 60 jours) · 401 · 403 · 409 `{ error }` RDV actif déjà réservé sur ce créneau par le patient · 500
- Notes: arbitrages MVP (spec FEATURE-PATIENT §arbitrages) modifiables sans migration — constantes `src/lib/appointments.ts`.

### [PATCH] /api/appointments/:id — Annuler un rendez-vous
- Feature: FEATURE-RDV | Owner: Backend | Statut: **IMPLÉMENTÉ** (lot P0/P1 2026-10-03)
- Request: `{ "action": "CANCEL" }` — seule action patient supportée au MVP
- Response: 200 `{ "appointment": { ...idem GET, status: "CANCELLED" } }`
- Errors: 400 `{ error, details }` (action non supportée) · 401 · 403 · 404 `{ error }` introuvable ou hors propriété (indistinguables) · 409 `{ error }` statut non annulable (CANCELLED/DONE) · 500
- Notes: propriété vérifiée côté serveur (`patientId` = session) ; pas de délai limite d'annulation au MVP (arbitrage PO à trancher pour la phase 2).

### [GET] /api/sensibilisations — Fil de sensibilisations santé
- Feature: FEATURE-SENSO | Owner: Backend | Statut: **IMPLÉMENTÉ** (lot P0/P1 2026-10-03)
- Request: — (cookie de session, tous rôles) — filtrage par la zone du lecteur
- Response: 200 `{ "sensibilisations": [{ "id": string, "title": string, "body": string, "category": "CONSEIL" | "ALERTE", "zones": Zone[], "publishedAt": string }] }` — tri décroissant publication, 50 derniers
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
- Response: 201 `{ "user": { "id": string, "fullName": string, "phone": string, "role": string, "zone": string, "createdAt": string } }` — cookie de session posé
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
