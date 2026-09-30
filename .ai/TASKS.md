# TASKS.md — Suivi central des tâches (miroir lisible de TASKS.xlsx)

**Source de vérité** : `TASKS.xlsx` (mêmes colonnes). Ce fichier est le miroir texte pour revue.
**Statuts** : `À FAIRE` → `EN COURS` → `EN REVUE` → `TEST QA` → `TERMINÉ` (ou `BLOQUÉ`).
**Règle d'intégrité** : un statut avancé exige la preuve associée (commit, revue, test, audit).

Colonnes (identiques au xlsx) :
ID | Epic | Fonctionnalité | Sous-tâche | Description | Rôle Assigné | Statut | Progression | Priorité | Dépendance Inter-Agents | Fichiers concernés | Tests | Résultat test | Bugs | Commits liés | Review Status | Date début | Date fin | Commentaires

## Tâches système (initialisation)

| ID | Epic | Fonctionnalité | Sous-tâche | Description | Rôle Assigné | Statut | Progression | Priorité | Dépendance | Fichiers | Tests | Résultat | Bugs | Commits | Review | Début | Fin | Commentaires |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SYS-T01 | Système | Analyse initiale | Scan complet | Analyse complète du projet avant action (règle 2) | Audit + Tech Lead | TERMINÉ | 100% | P0 | — | Tout le dépôt (lecture) | Lint, dev.log | Lint 0 err., GET / 200 | 0 | — | n/a | init | init | Preuves dans worklog.md Task 1 |
| SYS-T02 | Système | Gouvernance | Dossier .ai | Initialisation dossier de pilotage + registres | Doc + Tech Lead | TERMINÉ | 100% | P1 | SYS-T01 | .ai/** (38 fichiers) | Vérif LS | 38 fichiers présents | 0 | — | n/a | init | init | TASKS.xlsx généré séparément |
| SYS-T03 | Système | Gouvernance | TASKS.xlsx | Fichier central de suivi (20 colonnes) | Doc | TERMINÉ | 100% | P1 | SYS-T01 | .ai/TASKS.xlsx | Inspect xlsx | OK | 0 | — | n/a | init | init | Miroir : ce fichier |
| DESIGN-T01 | Design | Palette médicale | Tokens + docs | Implémentation des 9 couleurs PO en tokens Tailwind 4 (globals.css), règles d'usage, contrastes AA, ADR-002 | UX/UI + Frontend + Tech Lead | TERMINÉ | 100% | P1 | SYS-T01 | src/app/globals.css · .ai/DESIGN_SYSTEM.md §1 · .ai/ADR/ADR-002 | lint · CSS servi (grep hex) · agent-browser computed styles | Lint 0 err. · 8/8 hex servis · tokens calculés conformes | 0 | feat(design) | APPROVED (revue interne Tech Lead) | 2026-09-30 | 2026-09-30 | Contrastes : blanc interdit sur success/warning |
| BUG-T01 | Qualité | BUG-001 hydratation | Fix layout | suppressHydrationWarning sur body (attributs injectés par preview : bis_*, __processed_*) | DEV Frontend + QA | TERMINÉ | 100% | P2 | DESIGN-T01 | src/app/layout.tsx · .ai/BUGS.md | agent-browser reload : 0 erreur, console propre · lint | Lint 0 err. · 0 erreur page | BUG-001 corrigé | fix(ui) | APPROVED (revue interne Tech Lead) | 2026-09-30 | 2026-09-30 | Cause externe confirmée (absence bis_* en headless) |
| OPS-T01 | DevOps | Push GitHub | Synchronisation remote | Push de main vers github.com/akoun-dev/mondocpro.git (token PO one-shot, non persisté) + retrait .env/db du suivi git | DEVOPS + COMMIT + Security | TERMINÉ | 100% | P1 | BUG-T01 | remote origin · .gitignore · .env (untrack) · db/custom.db (untrack) | git ls-remote post-push | Hash remote 90786c8 = local | 0 | chore(securite) 90786c8 | n/a (ops) | 2026-09-30 | 2026-09-30 | SEC-ADV-001 : rotation token conseillée (action PO) |
| DB-T01 | Data | Supabase PostgreSQL | Migration BDD | Provider prisma sqlite→postgresql ; connexion pooler Supavisor IPv4 (host direct IPv6-only) ; région découverte par auth réelle (aws-1-eu-west-1) ; schéma User/Post synchronisé ; scripts db:* blindés (override DATABASE_URL shell) ; secrets en .env non versionné | DEVOPS/DATA + Tech Lead + Security | TERMINÉ | 100% | P1 | OPS-T01 | prisma/schema.prisma · .env · package.json · .ai/ADR/ADR-003 | Roundtrip Prisma SELECT 1 · REST /rest/v1/User 200 · GET / 200 post-restart | Roundtrip OK · REST 200 [] · lint 0 err. | 0 | feat(data) | APPROVED (revue interne Tech Lead) | 2026-09-30 | 2026-09-30 | ADR-003 · SEC-ADV-002 : rotation secrets Supabase conseillée · migrations versionnées avant PROD |
| OPS-T02 | DevOps | Résilience boot | dev.sh custom | /start.sh écrase .env (file:...) à chaque cold start → création du flux custom .zscripts/dev.sh (restaure .env Supabase depuis .zscripts/.env.supabase non versionné, bun install, db:push, dev) + relance serveur détachée vérifiée cross-session | DEVOPS/DATA | TERMINÉ | 100% | P0 | DB-T01 | .zscripts/dev.sh · .zscripts/.env.supabase (non versionné) | curl 200 cross-session · Caddy :81 200 · test_db SELECT 1 OK | 200/200/OK | 0 | chore(devops) | n/a (ops) | 2026-09-30 | 2026-09-30 | Secrets protégés (gitignore .env*) ; flux boot validé |

## Backlog (en attente de demandes utilisateur)

| ID | Epic | Fonctionnalité | Sous-tâche | Description | Rôle Assigné | Statut | Progression | Priorité | Dépendance | Fichiers | Tests | Résultat | Bugs | Commits | Review | Début | Fin | Commentaires |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | Aucune feature demandée à ce jour | — | — | — | — | — | — | — | — | — | — | — | — | — | En attente PO |

## Rappels de blocage (règle 5 du système)

- Frontend **bloqué** tant que contrat API non validé (`API_CONTRACTS.md`).
- Backend **bloqué** sur auth/permissions tant que Security n'a pas validé.
- Aucune tâche TERMINÉE sans commits propres (Commit) + revue positive (Reviewer).
- Aucune tâche FRONTEND TERMINÉE sans validation a11y + performance.
- Aucune livraison PROD sans audit global ≥ 60/100.
