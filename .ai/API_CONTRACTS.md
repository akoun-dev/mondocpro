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

---

## Contrats à venir

*(Le tableau se remplira au fil des features. Format exigé ci-dessus.)*

| Endpoint | Feature | Statut |
|---|---|---|
| — | — | — |
