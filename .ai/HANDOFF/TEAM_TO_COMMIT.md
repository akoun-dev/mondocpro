# 🤝 HANDOFF — Équipe → Commit

> **Template** : rempli par l'équipe pour remettre du code validé à l'agent Commit (phase 5, étape 1). Le Commit ne pousse que du code linté, vérifié, et commite de façon conventionnelle et atomique.

---

## État

**Aucun.**

---

## Template (à dupliquer)

```markdown
# HANDOFF TEAM→COMMIT — FEATURE-XXX : [Titre] — [Date]

## 1. Fichiers prêts
| Fichier | Intention | Feature liée |
|---|---|---|
| src/… | … | FEATURE-XXX |

## 2. Découpage de commits proposé (atomique)
1. `feat(scope): description` — fichiers concernés
2. `fix(scope): description` (si correctif) — fichiers concernés
3. `docs(scope): description` — registres/docs .ai

## 3. Vérifications pre-commit (obligatoires, à cocher avant git commit)
- [ ] `bun run lint` : 0 erreur / 0 warning
- [ ] Serveur dev OK, dev.log propre (GET / → 200)
- [ ] Aucun fichier indésirable (env, db/*.db, artefacts, node_modules)
- [ ] Aucun console.log / TODO / secret dans le diff
- [ ] Périmètre strictement limité à la tâche

## 4. Après commit
- Mettre à jour le journal .ai/COMMIT_LOG.md (Hash | Type | Scope | Message | Auteur | Date | Feature liée)
- Transmettre au Reviewer (handoff TEAM_TO_REVIEWER.md)

## 5. Contraintes
- Aucun amend de commit déjà journalisé sans mise à jour du registre
- Messages ≤ 72 caractères, impératif présent, sans point final
```
