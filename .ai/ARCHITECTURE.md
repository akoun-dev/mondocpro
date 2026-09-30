# ARCHITECTURE.md — Architecture technique

**Statut** : v1.0 — validée par ADR-001 (stack socle conservée)

## 1. Vue d'ensemble

```
┌────────────────────────────────────────────────────────────────┐
│                        CADDY GATEWAY (:81)                     │
│        /  → localhost:3000   |   ?XTransformPort=N → service   │
└──────────────┬─────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐   ┌────────────────────────┐
│  NEXT.JS 16 (App Router, standalone)        │   │  MINI-SERVICES (bun)   │
│  ┌─────────────────┐  ┌───────────────────┐ │   │  ex: socket.io :3003   │
│  │ Frontend (React)│  │ API Routes (TS)   │ │   │  ex: IA long-running   │
│  │ hooks/Zustand/  │  │ zod + db (Prisma) │ │◄──┤                        │
│  │ TanStack Query  │  │ z-ai-web-dev-sdk  │ │   └────────────────────────┘
│  └─────────────────┘  └─────────┬─────────┘ │
└─────────────────────────────────┼───────────┘
                        ┌─────────▼─────────┐
                        │  SQLITE (Prisma)  │
                        │  db/custom.db     │
                        └───────────────────┘
```

## 2. Séparation des couches (RÈGLE 22 — non négociable)

| Couche | Localisation | Interdit |
|---|---|---|
| Présentation | `src/app/**`, `src/components/**` | requête DB directe, logique métier |
| Orchestration client | hooks `src/hooks/**` (appels API, TanStack Query, Zustand) | fetch en vrac dans les composants |
| API / Controllers | `src/app/api/**/route.ts` (validation zod, statuts HTTP) | logique métier longue non factorisée |
| Services / logique métier | `src/lib/**` (purs, testables) | accès au DOM / React |
| Accès données | `src/lib/db.ts` (Prisma, singleton) | exposé côté client |

**Toute opération CRUD** : Component → Hook → fetch API → route.ts (zod) → service (src/lib) → Prisma.

## 3. Patterns imposés

- **Singleton Prisma** (`src/lib/db.ts`) — aucune autre instance.
- **Validation Zod systématique** en entrée de chaque route API + réponses JSON typées.
- **Gestion d'erreurs uniforme** : try/catch → `NextResponse.json({error}, {status})` ; côté client, toasts (sonner/use-toast).
- **Non-duplication** (RÈGLE 23) : toute logique/typage partagé va dans `src/lib` ou `src/types` — duplication interdite sans justification dans ce fichier.
- **API-FIRST** : le contrat (`API_CONTRACTS.md`) précède l'implémentation Front.
- **Temps réel** : uniquement via mini-service socket.io dédié (`io('/?XTransformPort=…')`, path `/`).

## 4. Conventions

- Nommage fichiers : `kebab-case.ts(x)` ; hooks : `use-*.ts` ; types partagés : `src/types/**`.
- Imports absolus `@/…` (alias tsconfig) ; composants shadcn réutilisés plutôt que recréés.
- `'use client'` uniquement quand nécessaire (interactivité/hooks) ; défaut = Server Components.
- Styles : variables sémantiques Tailwind (`bg-background`, `text-foreground`, `bg-primary`…).
- Responsive mobile-first (`sm/md/lg/xl`) ; footer collant (`min-h-screen flex flex-col` + `mt-auto`).

## 5. Décisions (ADR)

| ADR | Décision | Statut |
|---|---|---|
| [ADR-001](ADR/ADR-001-technologie-stack.md) | Conservation stack socle Next.js 16 / React 19 / Prisma SQLite | Accepté |

Les décisions majeures futures (auth NextAuth, i18n next-intl, IA, temps réel…) **doivent** faire l'objet d'un ADR.

## 6. Modularité & frontières

- Un domaine métier = 1 dossier de routes API (`src/app/api/<domaine>/`) + 1 service (`src/lib/<domaine>.ts`) + 1 dossier de composants si volumineux.
- Dépendances circulaires interdites entre domaines ; communication via services ou contrats.
- Mini-services uniquement pour ce que Next.js ne peut pas porter (WebSocket natif, tâches longues) — port fixe déclaré, démarrés par `bun run dev` dans leur dossier `mini-services/<nom>/`.
