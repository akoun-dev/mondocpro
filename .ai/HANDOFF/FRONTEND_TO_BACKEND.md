# 🤝 HANDOFF — Frontend → Backend

> **Template** : rempli par l'agent Frontend pour exprimer ses besoins d'API (pendant la phase 2/4, ou dès qu'un écart entre contrat et besoin réel apparaît).

---

## État

**Aucun.**

---

## Template (à dupliquer)

```markdown
# HANDOFF FRONT→BACK — FEATURE-XXX : [Titre] — [Date]

## 1. Besoins API
| Besoin | Endpoint souhaité | Méthode | Priorité | Justification UX |
|---|---|---|---|---|
| … | /api/… | POST | Bloquant / Souhaitable | … |

## 2. Props/données attendues par l'UI
- Champs affichés, format attendu (texte, nombre, date ISO, énumération)
- Champs requis pour l'envoi des formulaires + règles de validation Zod côté client
- Données de référence nécessaires (listes déroulantes, options)

## 3. Cas limites à couvrir par l'API
- Résultat vide, introuvable (404), validation (400), doublon (409)…
- Pagination / tri attendus par l'UI

## 4. En attendant (mock)
- Fichier de mock utilisé + forme exacte, à remplacer par l'API réelle sans changer les composants.

## 5. Contraintes Frontend
- Performance : taille de réponse raisonnable, pas de sur-fetch (budgets .ai/PERFORMANCE_BUDGET.md)
- a11y : messages d'erreur exploitables pour les lecteurs d'écran
```
