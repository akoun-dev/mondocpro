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
| **Suivi central des tâches** | `TASKS.xlsx` + `TASKS.md` |
| État de l'équipe en temps réel | `TEAM_STATUS.md` |
| Historique des versions | `CHANGELOG.md` |

## Registres qualité

| Registre | Contenu |
|---|---|
| `BUGS.md` | Bugs fonctionnels (routing QA) |
| `SEC_BUGS.md` | Vulnérabilités (SEC-XXX) |
| `A11Y_BUGS.md` | Problèmes d'accessibilité WCAG (A11Y-XXX) |
| `PERF_ISSUES.md` | Dépassements de budget perf (PERF-XXX) |
| `REGRESSIONS.md` | Régressions détectées/corrigées |
| `INCIDENTS.md` | Incidents projet / intégrité |
| `DEBT_REPORT.md` | Dette technique chiffrée |
| `SYSTEM_COMPLIANCE.md` | Conformité aux règles du système |
| `AUDIT_REPORT.md` + `AUDITS/` | Audits globaux périodiques |

## Processus

- `WORKFLOWS.md` — Feature Lifecycle (8 phases), boucle autonome, routage des bugs
- `TEST_PLAN.md` — Stratégie de test E2E
- `ADR/` — Architecture Decision Records
- `SPECS/` — Spécifications par feature (`FEATURE-XXX[_UX|_TECH_DESIGN].md`)
- `HANDOFF/` — Contrats de passage entre agents

## Règles d'or

1. **Aucune tâche TERMINÉE** sans commits propres + revue positive.
2. **Aucune tâche FRONTEND TERMINÉE** sans validation a11y + performance.
3. **Aucune livraison PROD** sans audit global (score ≥ 60/100).
4. **Intégrité absolue** : jamais déclarer terminé ce qui ne l'est pas — preuves exigées.
5. Frontend bloqué tant que le contrat API n'est pas validé dans `API_CONTRACTS.md`.
