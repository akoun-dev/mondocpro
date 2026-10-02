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

### [GET] /api/health — Sonde de vie
- Feature: SYS-001 (système) | Owner: Backend | Statut: **VALIDÉ**
- Response: 200 `{ "status": "ok", "timestamp": string }`
- Notes: remplace le hello-world scaffold comme vérification de santé lors des tests E2E.

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
| — | — | — |
