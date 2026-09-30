# ✅ SYSTEM_COMPLIANCE — Conformité aux règles du système multi-agents

> **Checklist de conformité aux 15 règles du système.** Évaluée à chaque audit global.
> **Légende statut :** ✅ Conforme · ⚠️ Conforme avec réserve · ❌ Non conforme · ⏳ Non applicable tant qu'aucune feature n'est implémentée
> **Score cible :** ≥ 60/100 pour toute livraison PROD.

## Checklist

| # | Règle | Statut | Preuve | Plan d'action |
|---|---|---|---|---|
| 1 | Intégrité du projet (aucun fichier métier cassé, registres à jour) | ⏳ | Scaffold vierge non modifié ; registres `.ai/` initialisés (30 fichiers) | Vérifier à chaque audit global |
| 2 | Analyse complète avant action (SCAN → COMPRENDRE) | ⏳ | Task 1 : analyse scaffold réalisée (voir `worklog.md`) | Appliquer à chaque nouvelle demande |
| 3 | Séparation des couches (UI / métier / data / API) | ⏳ | Aucune couche métier existante ; conventions posées dans `WORKFLOWS.md` | Contrôler à chaque revue (`REVIEW_LOG.md`) |
| 4 | Non-duplication du code | ⏳ | Scaffold vierge, réutilisation shadcn/ui par défaut | Contrôler à chaque revue |
| 5 | Commits conventionnels (`type(scope): description`) | ⏳ | Règles définies dans `COMMIT_LOG.md` ; 1 commit pré-système (d464483) | Appliquer dès le 1er commit de feature |
| 6 | Atomicité des commits | ⏳ | Règle posée (un commit = une intention) | Contrôler le journal `COMMIT_LOG.md` |
| 7 | Revue de code systématique avant validation | ⏳ | Checklist REVIEWER prête (`REVIEW_LOG.md`) | Toute feature passe par un verdict APPROVED |
| 8 | Documentation à jour (registres, specs, changelog) | ✅ | Registres `.ai/` créés le 2026-09-30 ; `CHANGELOG.md` versionné | Maintenir à chaque livraison |
| 9 | Décisions structurantes tracées en ADR | ⏳ | Template + ADR-001 (stack) en place (`ADR/`) | ADR à chaque décision d'architecture |
| 10 | Accessibilité WCAG 2.1 AA | ⏳ | Référentiel posé ; 0 non-conformité (`A11Y_BUGS.md`) | Contrôler à chaque feature |
| 11 | Performance sous budget (`PERFORMANCE_BUDGET.md`) | ⏳ | Budgets de référence définis ; 0 dépassement (`PERF_ISSUES.md`) | Mesurer à chaque feature |
| 12 | Sécurité (validation, secrets, OWASP) | ⏳ | Audit initial scaffold : aucune vulnérabilité (`SECURITY_AUDIT.md`, `SEC_BUGS.md`) | Auditer chaque surface API/auth |
| 13 | Tests (E2E manuel agent-browser, scénarios QA) | ⏳ | Stratégie définie dans `TEST_PLAN.md` | Tester chaque chemin doré de feature |
| 14 | RGPD (données personnelles minimisées, protégées) | ⏳ | Aucune donnée personnelle traitée à ce stade (modèles scaffold non exposés) | Évaluer dès qu'une donnée perso est manipulée |
| 15 | Licences (dépendances compatibles, pas d'asset illégal) | ⏳ | Stack standard à licences permissives (MIT/Apache-2.0) | Vérifier à chaque nouvelle dépendance |

## Score global

**Score actuel : N/A (initialisation).** La conformité sera notée au premier audit global (après la première feature) — seuil de livraison PROD : **≥ 60/100**.
