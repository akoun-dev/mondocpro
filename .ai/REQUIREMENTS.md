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
| SYS-009 | Base de données = Supabase PostgreSQL (ADR-003) : accès SQL via Prisma uniquement, secrets en `.env` non versionné, `SUPABASE_SERVICE_ROLE_KEY` jamais exposé côté client, migrations **Supabase CLI uniquement** (`supabase/migrations/`, registre `supabase_migrations.schema_migrations` — `prisma migrate`/`prisma db push` interdits) | Accepté |
| SYS-010 | Authentification multirôle (FEATURE-AUTH, ADR-004) : identifiant = téléphone unique, mot de passe bcrypt, sessions serveur en DB (cookie httpOnly 30j, token hashé SHA-256), rôles PATIENT/NURSE/ADMIN, zones YOPOUGON/SONGON/PK22/NDOTRE, pas d'auto-inscription ADMIN (seed), erreurs génériques anti-énumération | Accepté |

## Backlog produit

### REQ-001 — Rendez-vous cabinet / domicile (FEATURE-RDV)
Priorité: P1 (lot P1 roadmap audit 2026-10-03) | Statut: **IMPLÉMENTÉ** (backend + API ; UI à venir)
Source: demande PO — audit fonctionnalités patients du 2026-10-03, GO lot P0/P1
Description: le patient réserve une consultation au cabinet ou à domicile dans sa zone, voit ses rendez-vous (à venir et passés) et annule un rendez-vous actif. Critères d'acceptation : créneaux sur grille de 30 min du lundi au vendredi 08:00–16:30 ; réservation ≥ 2 h à l'avance et ≤ 60 jours ; un seul RDV actif (PENDING/CONFIRMED) par patient et par créneau (409 sinon) ; annulation propriétaire uniquement, statuts CANCELLED/DONE non annulables ; date/heure interprétées en Afrique/Abidjan (UTC+0, pas d'heure d'été).
Feature liée: FEATURE-RDV | Specs: .ai/SPECS/FEATURE-PATIENT.md | Contrats: GET/POST /api/appointments, PATCH /api/appointments/:id

### REQ-002 — Sensibilisations santé (FEATURE-SENSO)
Priorité: P1 (quick win — lot P1 roadmap audit 2026-10-03) | Statut: **IMPLÉMENTÉ** (backend + API + seed éditorial ; UI à venir)
Source: demande PO — audit fonctionnalités patients du 2026-10-03, GO lot P0/P1
Description: le patient connecté consulte un fil d'articles de sensibilisation santé (conseils et alertes) filtré par sa zone. Critères d'acceptation : accessible à tous les rôles authentifiés ; contenu sans ciblage de zone visible de tous, contenu ciblé visible uniquement de ses zones ; tri du plus récent au plus ancien (50 derniers) ; détail 404 indistinguable absent/hors ciblage (pas de fuite d'existence) ; contenu de référence seedé (6 articles) jusqu'à la rédaction ADMIN (phase 2).
Feature liée: FEATURE-SENSO | Specs: .ai/SPECS/FEATURE-PATIENT.md | Contrats: GET /api/sensibilisations, GET /api/sensibilisations/:id

### REQ-003 — Épargne santé en jetons (FEATURE-TOKENS)
Priorité: P2 (lot P2 roadmap audit 2026-10-03) | Statut: **ACCEPTÉ** (contrats à rédiger — API-first)
Source: demande PO — audit fonctionnalités patients du 2026-10-03, GO lot P0/P1
Description: le patient crédite un compte d'épargne santé (jetons) et paie ses consultations par débit de jetons. Critères d'acceptation : ledger immuable `TokenAccount` + `TokenTransaction` (DEPOSIT/DEBIT/REFUND, soldes dérivés des transactions) ; crédit manuel par l'ADMIN au MVP ; paiement Mobile Money suspendu à l'ADR-005 (fournisseur à arbitrer) ; valeur du jeton (1 token = ? FCFA) à arbitrer par le PO avant tout développement.
Feature liée: FEATURE-TOKENS | Specs: .ai/SPECS/FEATURE-PATIENT.md | Contrats: à venir (GET /api/tokens, POST /api/tokens/topup)

### REQ-004 — Missions infirmières et comptes-rendus (FEATURE-NURSE)
Priorité: P1 | Statut: **IMPLÉMENTÉ** (backend + API ; UI hors périmètre)
Source: demande utilisateur du 2026-10-04
Description: l'ADMIN affecte ou réaffecte un rendez-vous à un infirmier de la même zone ; l'infirmier consulte uniquement ses missions, fait progresser leur statut et dépose un compte-rendu unique. Critères d'acceptation : garde de rôle sur chaque route ; cloisonnement par propriétaire côté serveur ; transitions de statut strictes ; un rapport ne peut être créé qu'en mission `IN_PROGRESS` et ne peut être dupliqué ; affectation notifiée en in-app.
Feature liée: FEATURE-NURSE | Specs: .ai/SPECS/FEATURE-NURSE.md | Contrats: GET/PATCH /api/nurse/missions, POST /api/nurse/missions/:id/report, POST/PATCH /api/admin/missions
