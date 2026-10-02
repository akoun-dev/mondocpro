# 🔄 WORKFLOWS — Processus du système multi-agents

> Ce document décrit les **3 workflows officiels** du système : le cycle de vie d'une feature, la boucle autonome de l'orchestrateur, et le routage des bugs. Ils font foi pour tous les agents.

---

## Workflow 1 — Feature Lifecycle (8 phases)

Chaque feature traverse exactement ces phases, dans l'ordre. Aucune phase ne peut être sautée.

| Phase | Nom | Responsable | Contenu |
|---|---|---|---|
| **0** | Conception UX/UI | 🎨 UX/UI + 🔵 Front | Maquette/structure de la page, composants shadcn/ui à utiliser, états (chargement, vide, erreur) |
| **1** | Capture / Spec QA | 🔴 QA + 📚 Doc | Capture des exigences dans `.ai/SPECS/FEATURE-XXX.md` ; scénarios et chemin doré posés dans `.ai/TEST_PLAN.md` |
| **2** | Design technique | 🟢 Tech Lead | Contrat d'API, modèles Prisma, schémas Zod, découpage des couches ; ADR si décision structurante |
| **3** | Découpage / planification | Orchestrateur | Plan de tâches par agent (`.ai/HANDOFF/LEAD_TO_TEAM.md`), mise à jour `.ai/TEAM_STATUS.md` |
| **4** | Implémentation parallèle | 🟢 Back · 🔵 Front · 🟣 DevOps/Data | Implémentation selon les handoffs ; rien n'est partagé tant que non terminé individuellement |
| **5** | Revue / intégration / tests — **dans cet ordre :** | — | 1) 📝 **Commit** (commits conventionnels atomiques) → 2) 🔍 **Reviewer** (checklist + verdict) → 3) 📚 **Doc** (registres, specs, changelog) → 4) 🔒 **Security** (audit surface d'attaque) → 5) ♿ **a11y** (WCAG 2.1 AA) → 6) ⚡ **Perf** (budgets) → 7) 🔴 **QA E2E** (agent-browser) → 8) **Bugs / routage** (corrections éventuelles puis retour à l'étape concernée) |
| **6** | Validation et doc finale | Orchestrateur + 📚 Doc | Verdict final, mise à jour `CHANGELOG.md`, `TEST_PLAN.md`, handoffs archivés |
| **7** | Rétrospective | Toute l'équipe | Leçons → `.ai/LESSONS_LEARNED.md`, dette → `DEBT_REPORT.md`, standup final ; audit global si déclencheur |

---

## Workflow 2 — Boucle autonome de l'orchestrateur

Séquence exécutée par l'orchestrateur pour toute demande, sans intervention humaine entre deux jalons de validation :

```
SCAN → COMPRENDRE → CONCEVOIR → PLANIFIER → DÉLÉGUER → COMMIT → REVIEW → DOC
→ AUDIT SÉCURITÉ → A11Y → PERF → TESTER → DÉTECTER → CORRIGER → RETESTER
→ VALIDER → MAJ TASKS → STANDUP → LESSONS → AUDIT GLOBAL
```

- **SCAN / COMPRENDRE** : lecture du projet, des registres et du worklog avant toute action (jamais de code écrit sans analyse).
- **CONCEVOIR / PLANIFIER / DÉLÉGUER** : design technique + découpage + handoffs vers les agents.
- **COMMIT → REVIEW → DOC → AUDIT SÉCURITÉ → A11Y → PERF → TESTER** : chaîne de qualité de la phase 5 du Feature Lifecycle.
- **DÉTECTER / CORRIGER / RETESTER** : boucle de correction des bugs détectés (routage cf. Workflow 3), répétée jusqu'à zéro régression.
- **VALIDER / MAJ TASKS / STANDUP / LESSONS** : clôture, mise à jour des registres et du worklog.
- **AUDIT GLOBAL** : systématique en fin de cycle complet, ou si un signal faible est atteint (cf. `AUDIT_REPORT.md`).

---

## Workflow 3 — Routage des bugs

Tout problème détecté est routé vers le registre spécialisé — jamais dans un fichier de code, jamais en mémoire seule :

| Nature du problème | Registre destination | Règles spécifiques |
|---|---|---|
| **Fonctionnel** (comportement incorrect, panne UI/logique) | `.ai/BUGS.md` | Sévérité P0-P4, assignation, re-test avant clôture |
| **Sécurité** (faille, exposition de données, injection…) | `.ai/SEC_BUGS.md` | **P0/P1 = blocage immédiat de la livraison** + handoff `.ai/HANDOFF/SECURITY_TO_TEAM.md` ; trace dans `SECURITY_AUDIT.md` |
| **Accessibilité** (WCAG 2.1 AA) | `.ai/A11Y_BUGS.md` | Citer le critère WCAG exact |
| **Performance** (budget dépassé) | `.ai/PERF_ISSUES.md` | Toujours accompagner d'une **mesure** comparée aux budgets de `.ai/PERFORMANCE_BUDGET.md` |
| **Audit global / conformité** | `.ai/AUDIT_REPORT.md` (+ rapport détaillé dans `.ai/AUDITS/`) | Score /100, signaux faibles mis à jour |

Toute récidive après correction → `.ai/REGRESSIONS.md` ; tout impact projet durable → `.ai/DEBT_REPORT.md` ; toute leçon → `.ai/LESSONS_LEARNED.md`.
