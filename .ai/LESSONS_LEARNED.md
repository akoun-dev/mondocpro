# 🧠 LESSONS_LEARNED — Registre des leçons apprises

> **Registre des retours d'expérience** issus des rétrospectives (phase 7 du Feature Lifecycle), des incidents et des blocages.
> Chaque leçon doit, si possible, déboucher sur une **action systémique** (mise à jour de workflow, template, checklist, budget…).

**Total entrées : 2 (+ exemples vierges)**

| ID | Date | Contexte | Leçon | Action systémique |
|---|---|---|---|---|
| LL-001 | 2026-09-30 | Analyse initiale du projet par l'orchestrateur (Task 1), avant tout code | L'analyse complète avant action (règle 2) a permis de détecter l'architecture standalone + gateway Caddy avant tout code, évitant des erreurs de configuration API | Analyse préalable rendue obligatoire avant toute implémentation ; registres `.ai/` initialisés pour capitaliser chaque retour |
| LL-002 | 2026-09-30 | Auto-commit plateforme `b3c635e` (message UUID) créé pendant la session, englobant la gouvernance `.ai/` — l'AGENT COMMIT a constaté un working tree « clean » au moment de committer | La plateforme sandbox peut committer automatiquement hors contrôle des agents : ne jamais supposer l'état Git, toujours vérifier avant/après (`git status`, `git log`) et consigner tout commit non conventionnel | Checklist pre-commit enrichie : vérifier `git status` + `git log -1` avant chaque commit ; tout commit hors-système est audité puis journalisé dans `COMMIT_LOG.md` |
| LL-003 | _AAAA-MM-JJ_ | _(contexte : feature, incident, revue…)_ | _(leçon formulée en une phrase claire)_ | _(action systémique ou « N/A »)_ |

---

### Rappel de procédure
1. Ajouter une entrée à la fin de **chaque rétrospective de feature** (phase 7) et après tout incident (`.ai/INCIDENTS.md`).
2. Une leçon utile est **actionnable** : elle dit quoi faire différemment la prochaine fois.
3. L'action systémique est appliquée immédiatement (workflow, template, checklist) et vérifiée lors de l'audit global suivant.
