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

### [POST] /api/auth/register — Inscription (Patient / Infirmier)
- Feature: FEATURE-AUTH (SYS-010) | Owner: Backend | Statut: **VALIDÉ** (ADR-004)
- Request: `{ "fullName": string(2..80), "phone": string(regex ^\+?[0-9]{8,15}$), "password": string(8..72), "confirmPassword": string, "role": "PATIENT"|"INFIRMIER", "zone": "YOPOUGON"|"SONGON"|"PK22"|"NDOTRE" }`
- Response: 201 `{ "user": { "id": string, "fullName": string, "phone": string, "role": string, "zone": string, "createdAt": string } }` — cookie de session posé
- Errors: 400 `{ error, details }` (zod) · 409 `{ error }` numéro déjà inscrit · 500
- Notes: `ADMIN` refusé (seed uniquement) ; `confirmPassword` validé = `password` ; jamais de retour de `passwordHash`.

### [POST] /api/auth/login — Connexion
- Feature: FEATURE-AUTH (SYS-010) | Owner: Backend | Statut: **VALIDÉ** (ADR-004)
- Request: `{ "phone": string, "password": string }`
- Response: 200 `{ "user": { ...idem register } }` — cookie de session posé
- Errors: 400 `{ error, details }` (zod) · 401 `{ error: "Numéro ou mot de passe incorrect" }` (générique anti-énumération) · 500

### [GET] /api/auth/me — Profil courant
- Feature: FEATURE-AUTH (SYS-010) | Owner: Backend | Statut: **VALIDÉ** (ADR-004)
- Request: — (cookie de session)
- Response: 200 `{ "user": { ...idem register } }`
- Errors: 401 `{ error }` non authentifié / session expirée · 500

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
