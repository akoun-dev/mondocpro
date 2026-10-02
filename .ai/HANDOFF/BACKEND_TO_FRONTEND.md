# 🤝 HANDOFF — Backend → Frontend

> **Template** : rempli par l'agent Backend quand les endpoints d'une feature sont prêts, afin que le Frontend branche l'UI sur l'API réelle (fin des mocks).

---

## État

**Aucun.**

---

## Template (à dupliquer)

```markdown
# HANDOFF BACK→FRONT — FEATURE-XXX : [Titre] — [Date]

## 1. Endpoints prêts
| Endpoint | Méthode | Statuts de retour | Notes (pagination, tri, filtres) |
|---|---|---|---|
| /api/… | GET | 200, 400, 404 | … |

## 2. Schémas Zod (source de vérité partagée)
Fichiers : src/lib/validators/feature-xxx.ts
- `xxxInputSchema` : champs, types, contraintes (min/max, optionnel, défaut)
- `xxxOutputSchema` : forme exacte des réponses (JSON sérialisé, dates en ISO string)

## 3. Exemples de payloads
Requête :
{ "field": "value" }
Réponse 200 :
{ "id": "…", "field": "value" }
Réponse 400 :
{ "error": { "code": "VALIDATION", "issues": [ … ] } }

## 4. Contrats côté Frontend
- TanStack Query : clés de cache recommandées (`["xxx", "list", params]`), staleTime/refetch.
- États à couvrir : chargement (skeleton), vide, erreur (message + retry).
- Zéro logique métier dans les composants : appel API isolé dans un hook/fichier service.

## 5. Limitations connues / TODO backend
- (ex. : pagination non implémentée, endpoint V2 prévu…)
```
