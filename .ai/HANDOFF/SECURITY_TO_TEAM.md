# 🤝 HANDOFF — Security → Équipe

> **Template** : rempli par l'agent Security après audit d'une feature, pour transmettre les vulnérabilités et actions requises. Les P0/P1 bloquent la livraison.

---

## État

**Aucun.**

---

## Template (à dupliquer)

```markdown
# HANDOFF SECURITY→TEAM — FEATURE-XXX : [Titre] — [Date]

## 1. Synthèse de l'audit
- Périmètre audité : fichiers / endpoints / modèles
- Verdict : 🟢 RAS · 🟡 Réserves (correctifs non bloquants) · 🔴 BLOQUÉ (P0/P1 ouverts)

## 2. Vulnérabilités détectées
| ID (SEC-XXX) | Titre | Type OWASP | Sévérité | Fichier/Endpoint | Blocant ? |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

Détails complets + preuves : .ai/SEC_BUGS.md

## 3. Actions requises par l'équipe
| Action | Agent | Échéance | Vérification attendue |
|---|---|---|---|
| … | 🟢/🔵/🟣 | … | Re-test de la preuve initiale (doit échouer) |

## 4. Rappels permanents
- Validation Zod de toute entrée externe, côté serveur uniquement.
- Aucun secret dans le code (variables d'environnement) ; z-ai-web-dev-sdk jamais côté client.
- Contrôle d'accès sur toute route manipulant des données ; principe du moindre privilège.

## 5. Déblocage
La feature repart dans la boucle Commit → Reviewer après correction + re-test Security (preuve invalidée).
```
