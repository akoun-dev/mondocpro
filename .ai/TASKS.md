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
