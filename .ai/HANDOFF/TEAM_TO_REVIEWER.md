# 🤝 HANDOFF — Équipe → Reviewer

> **Template** : rempli par l'équipe pour soumettre un diff à la revue (phase 5, étape Reviewer). Aucun verdict APPROVED = pas de validation de feature.

---

## État

**Aucun.**

---

## Template (à dupliquer)

```markdown
# HANDOFF TEAM→REVIEWER — FEATURE-XXX : [Titre] — [Date]

## 1. Diff soumis
- Commits (conventionnels, atomiques) : hash + messages (cf. .ai/COMMIT_LOG.md)
- Fichiers modifiés/créés : liste avec intention de chaque fichier
- Hors périmètre (inchangé, volontairement) : …

## 2. Points d'attention demandés
- Zone à risque : logique nouvelle, migration Prisma, endpoint exposé…
- Choix techniques à arbitrer (ADR lié le cas échéant)
- Endroits où la duplication ou un couplage fort étaient difficiles à éviter

## 3. Auto-vérification de l'équipe (avant soumission)
- [ ] bun run lint : 0 erreur / 0 warning
- [ ] Aucun console.log / TODO / code mort / secret
- [ ] Types complets, Zod sur les entrées externes, gestion d'erreurs
- [ ] a11y de base : sémantique, labels, focus, contrastes (WCAG 2.1 AA)
- [ ] Perf : budgets .ai/PERFORMANCE_BUDGET.md a priori respectés
- [ ] Sécurité : pas de validation côté client seule, pas de z-ai-web-dev-sdk côté frontend
- [ ] Registres à jour (TEAM_STATUS, TEST_PLAN)

## 4. Résultat attendu du Reviewer
- Verdict APPROVED / CHANGES_REQUESTED / BLOCKED consigné dans .ai/REVIEW_LOG.md (REV-XXX)
- En cas de CHANGES_REQUESTED : liste des corrections + boucle de retour
```
