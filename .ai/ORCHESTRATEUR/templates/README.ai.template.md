# .ai/ — DOSSIER DE PILOTAGE DU SYSTÈME MULTI-AGENTS

Ce dossier contient l'ensemble des artefacts de pilotage, de gouvernance et de traçabilité
du projet. Il est maintenu par l'équipe virtuelle d'agents spécialisés orchestrée par le CTO.

## Lecture rapide

| Besoin | Fichier |
|---|---|
| Comprendre le projet | `PROJECT_CONTEXT.md` |
| Architecture cible & patterns | `ARCHITECTURE.md` |
| Contrats d'API (source de vérité Front ↔ Back) | `API_CONTRACTS.md` |
| Design system UI | `DESIGN_SYSTEM.md` |
| Règles d'accessibilité | `ACCESSIBILITY_GUIDE.md` |
| Budgets de performance | `PERFORMANCE_BUDGET.md` |
| Exigences fonctionnelles | `REQUIREMENTS.md` |
| **Suivi central des tâches** | `TASKS.md` |
| Processus (feature lifecycle, boucle, bugs) | `WORKFLOWS.md` |
| Journal opérationnel (racine du repo) | `../worklog.md` |

## Registres qualité

| Registre | Contenu |
|---|---|
| `BUGS.md` | Bugs fonctionnels (P0-P4, retest avant clôture) |
| `SEC_BUGS.md` | Vulnérabilités (SEC-XXX) — P0/P1 = blocage livraison |
| `A11Y_BUGS.md` | Problèmes d'accessibilité WCAG 2.1 AA (A11Y-XXX) |
| `PERF_ISSUES.md` | Dépassements de budget perf (PERF-XXX, avec mesure) |
| `REGRESSIONS.md` | Régressions détectées/corrigées |
| `INCIDENTS.md` | Incidents projet / intégrité |
| `DEBT_REPORT.md` | Dette technique chiffrée |
| `LESSONS_LEARNED.md` | Leçons durables (pièges, décisions, procédures) |
| `AUDITS/` | Audits globaux périodiques (score /100) |

## Processus

- `WORKFLOWS.md` — Feature Lifecycle (8 phases), boucle autonome, routage des bugs
- `SPECS/` — Spécifications par feature (`FEATURE-XXX.md`)
- `ADR/` — Architecture Decision Records
- `HANDOFF/` — Contrats de passage entre agents

## Règles d'or

1. **Aucune tâche TERMINÉE** sans commits propres + preuve de vérification (navigateur, chemin doré).
2. **« Ça compile » n'est jamais « terminé »** — intégrité absolue : preuves exigées.
3. **Frontend bloqué** tant que le contrat d'API n'est pas validé dans `API_CONTRACTS.md`.
4. Tout problème détecté va dans le **registre spécialisé** (jamais en mémoire seule).
5. Le `worklog.md` est **append-only** : tout agent lit avant, ajoute après, n'édite jamais l'existant.
