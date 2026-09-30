# PROJECT_CONTEXT.md — Contexte du projet

**Date de création** : initialisation du système multi-agents
**Nature du projet** : Application web fullstack (scaffold vierge à transformer selon les besoins métier)
**Propriétaire** : Utilisateur (décisions produit) — Orchestration : CTO / Agent 1 / Agent 2

## 1. Résumé

Le dépôt est un **scaffold Next.js 16 vierge** fourni par le socle Z.ai. Aucune fonctionnalité
métier n'est implémentée à l'initialisation du système. Le backlog sera alimenté par les
demandes successives de l'utilisateur, traitées via le Feature Lifecycle (`WORKFLOWS.md`).

## 2. Stack détectée (à l'analyse initiale — AUDIT Task 1)

| Couche | Technologie | Version |
|---|---|---|
| Framework | Next.js (App Router, output standalone) | 16.1.1 |
| UI | React | 19 |
| Langage | TypeScript | 5 |
| Style | Tailwind CSS + tw-animate-css | 4 |
| Composants | shadcn/ui (New York) — 44 composants dans `src/components/ui` | — |
| Icônes | lucide-react | 0.525 |
| ORM / DB | **Supabase (PostgreSQL managé)** via Prisma — pooler Supavisor `aws-1-eu-west-1` (ADR-003) | 6.19 |
| Validation | Zod | 4 |
| État client | Zustand | 5 |
| État serveur | TanStack Query | 5 |
| Formulaires | react-hook-form + @hookform/resolvers | — |
| Animation | framer-motion | 12 |
| IA backend | z-ai-web-dev-sdk (**backend uniquement**) | 0.0.18 |
| Temps réel | socket.io (mini-services dédiés, cf. `examples/websocket`) | — |
| Gateway | Caddy :81 → 3000, routage `?XTransformPort=` vers mini-services | — |
| Runtime | Bun | 1.3.x |

## 3. État initial (preuves d'audit)

- `src/app/page.tsx` : page scaffold minimale (logo) — à remplacer à la première feature.
- `src/app/api/route.ts` : endpoint GET "Hello world" de démonstration.
- `prisma/schema.prisma` : modèles scaffold `User` / `Post` (non consommés).
- `bun run lint` : **0 erreur / 0 warning**.
- Serveur dev : démarré, `GET / → 200` (voir `dev.log`).
- Git : 1 commit initial `d464483`.
- 0 TODO/FIXME/console.log, 0 bug, 0 vulnérabilité connue, 0 incident.

## 4. Contraintes d'environnement

- Port unique exposé : 3000 (Next.js) ; mini-services via `XTransformPort` (jamais de port dans l'URL).
- `z-ai-web-dev-sdk` réservé au backend (routes API / mini-services).
- Route utilisateur visible : `/` uniquement (tout nouveau module s'intègre dans la page principale).
- Dev server : `bun run dev` (port 3000, log `dev.log`) — jamais `bun run build` en dev.
- ⚠️ **Boot plateforme** : `/start.sh` écrase `.env` (`DATABASE_URL=file:…`) à chaque cold start → flux custom `.zscripts/dev.sh` (restaure l'env Supabase depuis `.zscripts/.env.supabase`, non versionné) puis démarre le serveur ; OPS-T02.
- ⚠️ Le shell sandbox exporte `DATABASE_URL=file:…` (héritage scaffold) qui PRIME sur `.env` :
  les scripts `db:push/db:migrate/db:reset` réexportent la valeur du `.env` (cf. ADR-003 §4) ;
  le serveur dev doit être redémarré après changement de `.env` (Next ne réécrase pas l'env existant).
- Connexion Supabase : uniquement via pooler Supavisor (host direct IPv6-only, sandbox sans IPv6).
- API routes (pas de server actions pour la consommation client), appels par chemins relatifs.

## 5. Parties prenantes (équipe virtuelle)

Voir `TEAM_STATUS.md` pour l'état en temps réel et `WORKFLOWS.md` pour les interactions.
