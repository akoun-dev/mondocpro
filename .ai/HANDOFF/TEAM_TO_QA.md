# 🤝 HANDOFF — Équipe → QA

> **Template** : rempli par l'équipe quand la feature est prête pour la phase de test E2E (phase 5, étape QA). QA = Agent 2 (🔴 QA).

---

## État

**Aucun.**

---

## Template (à dupliquer)

```markdown
# HANDOFF TEAM→QA — FEATURE-XXX : [Titre] — [Date]

## 1. Feature prête à tester
- Statut : Commit ✅ · Reviewer ✅ (REV-XXX) · Doc ✅ · Security ✅ · a11y ✅ · Perf ✅
- Serveur : vérifier dev.log avant de démarrer (build sans erreur).

## 2. Scénarios de test
| # | Scénario | Type |
|---|---|---|
| 1 | Chemin doré (nominal complet) | Obligatoire |
| 2 | Cas limites : … (champ vide, 404, réseau lent…) | Recommandé |
| 3 | Permissions / données volumineuses… | Optionnel |

## 3. Chemin doré (parcours nominal pas à pas)
1. Ouvrir /route → attendu : …
2. Action utilisateur → attendu : …
3. Vérifier état final (UI + données) → attendu : …

## 4. Attendu global
- Résultats consignés dans .ai/TEST_PLAN.md (PASS/FAIL + testeur).
- Tout écart → .ai/BUGS.md (routage cf. WORKFLOWS.md) avec sévérité P0-P4.

## 5. Points sensibles signalés par l'équipe
- Zones fragiles, comportements non triviaux, régressions potentielles (cf. .ai/REGRESSIONS.md).
```
