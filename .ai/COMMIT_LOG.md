# 📝 COMMIT_LOG — Règles et journal des commits

## Règles de commit (obligatoires)

### 1. Format conventionnel
```
type(scope): description
```
- **Types autorisés :** `feat` (feature), `fix` (correctif), `docs` (documentation), `style` (formatage sans logique), `refactor` (restructuration sans changement de comportement), `perf` (performance), `test` (tests), `chore` (outillage/maintenance).
- **Scope (optionnel mais recommandé)** : module ou couche concernée, ex. `auth`, `api/users`, `ui/filters`, `prisma`.
- **Description** : impératif présent, minuscule, sans point final, ≤ 72 caractères.
- Corps optionnel (ligne vide après la description) : motivation + points d'attention. Footer pour références (`Refs: BUG-012`, `Closes FEATURE-003`).

### 2. Commits atomiques
- **Un commit = une intention unitaire** (un correctif, une fonctionnalité découpée, une refactoration isolée).
- Jamais de commit fourre-tout mêlant feature + fix + docs : séparer en commits distincts.
- Jamais de commit d'un code cassant le build ou le lint (pre-commit obligatoire).

### 3. Vérifications pre-commit (checklist avant chaque commit)
- [ ] `bun run lint` : 0 erreur, 0 warning
- [ ] Build / compilation TypeScript sans erreur (rappel : `ignoreBuildErrors` est actif dans `next.config.ts` — voir DET-004 ; la vérification TS reste de la responsabilité de l'agent)
- [ ] Aucun `console.log`, TODO, code mort, secret ou identifiant laissé dans le code
- [ ] Serveur dev démarré sans erreur (`dev.log` propre)
- [ ] Changements limités au périmètre de la tâche (pas de fichier annexe modifié par accident)

### 4. Interdictions
- ❌ `git commit -m "fix"` / messages vides ou non conventionnels
- ❌ Commit direct de fichiers `.env`, `db/*.db` (données), node_modules, artefacts de build
- ❌ Push sans que le registre `.ai/COMMIT_LOG.md` soit mis à jour

---

## Journal des commits

| Hash | Type | Scope | Message | Auteur | Date | Feature liée |
|---|---|---|---|---|---|---|
| d464483 | chore | — | Initial commit | Orchestrateur | Pré-système | — (scaffold) |

> Le commit `d464483` est antérieur à l'initialisation du système multi-agents : il correspond au scaffold livré. Tous les commits suivants respectent les règles ci-dessus.
