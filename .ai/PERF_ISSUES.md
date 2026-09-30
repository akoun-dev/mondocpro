# ⚡ PERF_ISSUES — Registre des problèmes de performance

> **Registre des dégradations de performance** constatées par mesure (jamais par intuition seule).
> Les **budgets de référence** (Core Web Vitals, bundle, temps de réponse API, requêtes Prisma) sont définis dans **`.ai/PERFORMANCE_BUDGET.md`** — c'est le document de référence : un problème n'existe que si une valeur mesurée dépasse un budget.

**Légende sévérité :** CRITIQUE (dépassement > 2× budget) · MAJEUR (> 1,5×) · MINEUR (léger dépassement)
**Légende statut :** ⏳ Ouvert · 🔄 En optimisation · 👀 En re-mesure · ✅ Résolu · 📉 Accepté (dérogation justifiée)

**Total problèmes ouverts : 0**

| ID | Titre | Métrique | Valeur mesurée | Budget | Sévérité | Fichier | Statut | Date |
|---|---|---|---|---|---|---|---|---|
| _—_ | _Aucun problème enregistré_ | _—_ | _—_ | _—_ | _—_ | _—_ | _—_ | _—_ |

### Rappel de procédure
1. Créer la ligne PERF-XXX avec la **métrique, la valeur mesurée et le budget violé** (cités de `.ai/PERFORMANCE_BUDGET.md`).
2. Optimiser (mémoïsation, code splitting, index Prisma, mise en cache TanStack Query, images `next/image`, etc.).
3. **Re-mesurer** avec la même méthode et le même contexte avant de passer à ✅.
4. Toute dérogation permanente doit être justifiée et actée en ADR (`.ai/ADR/`).
