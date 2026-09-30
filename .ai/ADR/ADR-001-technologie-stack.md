# ADR-001 — Adoption de la stack Next.js 16 + TypeScript 5 + Tailwind 4 + shadcn/ui + Prisma 6 (SQLite) + Zod + Zustand + TanStack Query

## Statut
**Accepté**

## Date
2026-09-30

## Contexte
Le projet démarre à partir d'un scaffold préexistant et fonctionnel, analysé par l'orchestrateur (Task 1) :
- **Next.js 16.1.1** (App Router, `output: standalone`) + **React 19** + **TypeScript 5**
- **Tailwind CSS 4** + **shadcn/ui** (44 composants déjà présents dans `src/components/ui`)
- **Prisma 6** + **SQLite** (`db/custom.db`, modèles scaffold `User`/`Post`), `DATABASE_URL` configurée dans `.env`
- **Zod 4**, **Zustand 5**, **TanStack Query 5**, **framer-motion**
- **z-ai-web-dev-sdk** (usage backend uniquement) et **gateway Caddy** (:81 → 3000, `XTransformPort` pour mini-services)

La question posée : conserver cette stack standard du socle ou la remplacer avant la première feature métier.

## Décision
Nous **conservons la stack standard du socle** telle quelle : Next.js 16 (App Router) + TypeScript 5 + Tailwind CSS 4 + shadcn/ui + Prisma 6/SQLite + Zod + Zustand + TanStack Query, avec z-ai-web-dev-sdk réservé au backend. Tout le développement métier s'appuiera sur cette stack, sans migration ni ajout de framework concurrent, sauf décision contraire tracée dans un futur ADR.

## Alternatives considérées
| Alternative | Raison du rejet |
|---|---|
| Migrer vers un autre framework (ex. Remix, Astro, Nuxt) | Coût de migration inutile sur un scaffold vierge ; perte de l'écosystème et des composants shadcn/ui déjà installés ; aucun besoin métier justifiant ce risque |
| Remplacer Prisma/SQLite par un autre ORM ou une base serveur (PostgreSQL) | Aucun besoin de données à l'échelle ; SQLite suffit pour démarrer ; PostgreSQL envisageable plus tard via ADR dédié si les besoins évoluent |
| Supprimer des librairies scaffold (Zustand, TanStack Query, framer-motion) | Perte de temps pour un gain minime ; elles restent inactives tant que non utilisées et pourront servir aux premières features |

## Conséquences
**Positives :**
- Zéro coût de migration : la première feature peut démarrer immédiatement sur un socle vérifié (lint propre, serveur OK).
- Cohérence d'équipe : tous les agents partagent les mêmes conventions (shadcn/ui pour l'UI, Zod pour la validation, Prisma pour l'accès données).
- Compatibilité préservée avec le gateway Caddy et l'architecture standalone (`XTransformPort` pour mini-services).

**Négatives / risques assumés :**
- La dette scaffold existante est assumée et tracée (voir `DEBT_REPORT.md` : DET-001 à DET-004, dont `ignoreBuildErrors: true` à désactiver dès que le code métier stabilise).
- SQLite impose des limites de concurrence : à réévaluer par ADR si le besoin métier grandit.

## Références
- `worklog.md` (Task 1 — analyse initiale du scaffold)
- `.ai/CHANGELOG.md` (0.1.0 — inventaire de la stack)
- `.ai/DEBT_REPORT.md` (dette scaffold assumée)
