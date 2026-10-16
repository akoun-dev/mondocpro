# 🔄 WORKFLOWS — Processus du système multi-agents

> Les **3 workflows officiels** : cycle de vie d'une feature, boucle autonome de l'orchestrateur,
> routage des bugs. Ils font foi pour tous les agents.

---

## Workflow 1 — Feature Lifecycle (8 phases)

| Phase | Nom | Contenu |
|---|---|---|
| **0** | Conception UX/UI | Structure de la vue, composants à réutiliser, états (chargement, vide, erreur) |
| **1** | Spec | Exigences dans `.ai/SPECS/FEATURE-XXX.md` ; scénarios + chemin doré |
| **2** | Design technique | Contrat d'API, modèles de données, validation ; ADR si décision structurante |
| **3** | Découpage | Plan de tâches / handoffs ; mise à jour `.ai/TASKS.md` |
| **4** | Implémentation | Selon handoffs — **frontend d'abord**, backend ensuite |
| **5** | Chaîne qualité | 1) Commit → 2) Review → 3) Doc → 4) Sécurité → 5) A11y → 6) Perf → 7) QA E2E (navigateur) → 8) Routage bugs |
| **6** | Validation | Verdict final, `CHANGELOG.md`, worklog |
| **7** | Rétrospective | Leçons → `LESSONS_LEARNED.md`, dette → `DEBT_REPORT.md` |

---

## Workflow 2 — Boucle autonome de l'orchestrateur

```
SCAN → COMPRENDRE → CONCEVOIR → PLANIFIER → DÉLÉGUER → COMMIT → REVIEW → DOC
→ SÉCURITÉ → A11Y → PERF → TESTER → DÉTECTER → CORRIGER → RETESTER → VALIDER
→ MAJ TASKS → WORKLOG → LESSONS
```

- **SCAN / COMPRENDRE** : lecture du worklog, des registres et du code avant toute action.
- **DÉLÉGUER** : sous-agents autonomes avec Task ID + consigne de lecture/écriture du worklog.
- **TESTER → RETESTER** : boucle jusqu'à zéro régression ; preuve navigateur obligatoire.
- **VALIDER** : mise à jour TASKS, CHANGELOG, worklog — jamais de « terminé » sans preuve.

---

## Workflow 3 — Routage des bugs

| Nature | Registre destination | Règles |
|---|---|---|
| Fonctionnel | `.ai/BUGS.md` | P0-P4, assignation, re-test avant clôture |
| Sécurité | `.ai/SEC_BUGS.md` | P0/P1 = blocage immédiat de la livraison |
| Accessibilité | `.ai/A11Y_BUGS.md` | Citer le critère WCAG 2.1 AA exact |
| Performance | `.ai/PERF_ISSUES.md` | Toujours une mesure vs budgets |
| Récidive | `.ai/REGRESSIONS.md` | Après toute rechute post-correction |
| Impact durable | `.ai/DEBT_REPORT.md` | Chiffrer la dette |
| Leçon | `.ai/LESSONS_LEARNED.md` | Une leçon = un piège qu'on ne refera plus |
