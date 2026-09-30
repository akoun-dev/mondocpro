# PERFORMANCE_BUDGET.md — Budgets de performance

**Cible** : Lighthouse ≥ 90 sur les axes perf accessibles ; Core Web Vitals au vert.
Agent responsable : ⚡ PERF — toute régression d'un budget = ticket `PERF-XXX` (P2 minimum).

## 1. Core Web Vitals (budgets)

| Métrique | Budget | Seuil alerte |
|---|---|---|
| LCP (Largest Contentful Paint) | ≤ 2.5 s | > 2.0 s |
| INP (Interaction to Next Paint) | ≤ 200 ms | > 150 ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | > 0.05 |
| TTFB (dev sandbox) | ≤ 800 ms | > 500 ms |

## 2. Budgets de bundle (dev/perçu)

| Élément | Budget |
|---|---|
| First Load JS par route | ≤ 250 kB gzip |
| Composants lourds (`recharts`, `@mdxeditor`, `react-syntax-highlighter`) | import dynamique `next/dynamic` obligatoire |
| Images | `next/image`, formats optimisés, dimensions fixes (anti-CLS) |

## 3. Règles d'implémentation

- `reactStrictMode` et imports proprement arborescents (pas de `import *` de librairies UI).
- **Lazy loading** : composants hors premier écran en `dynamic()` ; listes longues virtualisées si > 200 items.
- Pas de fetch en cascade : TanStack Query (cache, déduplication) ; prefetch ciblé.
- Server Components par défaut ; `'use client'` au plus près des feuilles.
- Requêtes Prisma : pas de N+1 (`include`/`select` ciblés) ; index sur les champs filtrés.
- Cache mémoire local autorisé (aucun Redis/MySQL externe — règle d'environnement).

## 4. Mesures (protocole)

1. Après chaque feature : mesure perçue via agent-browser (temps de rendu du chemin doré),
   lecture `dev.log` (temps compile/render Next.js).
2. Registre des mesures dans `PERF_ISSUES.md` ; comparaison à la baseline.

## 5. Baseline initiale (mesurée à l'audit Task 1)

| Point | Valeur observée |
|---|---|
| Boot dev server | Ready in ~618 ms |
| GET / (compilé, second accès) | render ~24 ms |
| First Load JS route `/` | à mesurer à la première feature |

*Baseline volontairement minimale sur scaffold : elle sera recalée à la première feature.*
