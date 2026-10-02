# REQUIREMENTS.md — Exigences produit

**État** : en attente d'exigences métier. Le scaffold n'embarque **aucune exigence fonctionnelle**
initiale : le backlog se remplit à partir des demandes de l'utilisateur (PO).

## Format d'une exigence

```
### REQ-XXX — <Titre>
Priorité: P0…P4 (cf. règle 32) | Statut: PROPOSÉ / ACCEPTÉ / IMPLÉMENTÉ / VALIDÉ / REJETÉ
Source: demande utilisateur du <date>
Description: <besoin, critères d'acceptation mesurables>
Feature liée: FEATURE-XXX | Specs: .ai/SPECS/FEATURE-XXX*.md
```

## Exigences système (non fonctionnelles — héritées de l'environnement)

| ID | Exigence | Statut |
|---|---|---|
| SYS-001 | Route utilisateur unique `/` — tout module s'intègre dans la page principale | Accepté |
| SYS-002 | API routes (pas de server actions consommées par le client) | Accepté |
| SYS-003 | Stack figée : Next.js 16 / TS 5 / Tailwind 4 / shadcn / Prisma-SQLite / Zod / Zustand / TanStack Query (ADR-001) | Accepté |
| SYS-004 | `z-ai-web-dev-sdk` backend uniquement | Accepté |
| SYS-005 | Temps réel via mini-service socket.io + `XTransformPort` uniquement | Accepté |
| SYS-006 | Responsive mobile-first + footer collant (règles UI/UX du système) | Accepté |
| SYS-007 | Qualité : lint propre, revue, a11y AA, budgets perf respectés avant validation | Accepté |
| SYS-008 | Design fondé sur la palette médicale officielle (9 couleurs, ADR-002) — tokens sémantiques uniquement, aucune couleur hors palette/nuances documentées | Accepté |
| SYS-009 | Base de données = Supabase PostgreSQL (ADR-003) : accès SQL via Prisma uniquement, secrets en `.env` non versionné, `SUPABASE_SERVICE_ROLE_KEY` jamais exposé côté client, migrations versionnées obligatoires avant PROD | Accepté |
| SYS-010 | Authentification multirôle (FEATURE-AUTH, ADR-004) : identifiant = téléphone unique, mot de passe bcrypt, sessions serveur en DB (cookie httpOnly 30j, token hashé SHA-256), rôles PATIENT/INFIRMIER/ADMIN, zones YOPOUGON/SONGON/PK22/NDOTRE, pas d'auto-inscription ADMIN (seed), erreurs génériques anti-énumération | Accepté |

## Backlog produit

*(vide — en attente de la première demande utilisateur)*
