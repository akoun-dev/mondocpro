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
| b3c635e | ⚠️ hors-système | — | 8e88d3b5-62ff-43c1-a190-f714eeb86cbd (message UUID) | Plateforme sandbox (Z User) | 2026-09-30 | — (auto-commit plateforme : gouvernance .ai/ + worklog inclus) |
| aa26f1f | feat | design | adoption de la palette medicale officielle en tokens Tailwind 4 | AGENT COMMIT | 2026-09-30 | DESIGN-T01 (Refs: ADR-002, SYS-008) |
| 665c177 | docs | gouvernance | journal des commits (hash aa26f1f) et worklog palette medicale | AGENT COMMIT | 2026-09-30 | DESIGN-T01 |
| 13d8d92 | fix | ui | supprime le faux mismatch d'hydratation sur body | AGENT COMMIT | 2026-09-30 | BUG-001 |
| 4f85b0d | docs | gouvernance | registres BUG-001, avis SEC-ADV-001 (rotation token), tasks ops push | AGENT COMMIT | 2026-09-30 | BUG-001, SEC-ADV-001, OPS-T01 |
| 90786c8 | chore | securite | retire .env et la base sqlite du suivi git | AGENT COMMIT | 2026-09-30 | SEC-ADV-001, OPS-T01 |
| 7657ee2 | docs | gouvernance | clôture BUG-001/OPS-T01 dans les registres et worklog | AGENT COMMIT | 2026-09-30 | BUG-001, OPS-T01 |
| ace3161 | feat | data | migration de la base vers supabase postgresql | AGENT COMMIT | 2026-09-30 | DB-T01 (Refs: ADR-003) |
| c6b1d34 | docs | gouvernance | worklog migration supabase (Task 5) | AGENT COMMIT | 2026-09-30 | DB-T01 |
| d1370c3 | chore | devops | flux de boot custom resistant au cold start (dev.sh) | AGENT COMMIT | 2026-09-30 | OPS-T02 |
| 0badaee | ⚠️ hors-système | — | 92996b23-36f9-46a0-b6fc-33944f81c473 (message UUID) | Plateforme sandbox (Z User) | 2026-09-30 | — (auto-commit plateforme : .zscripts/gen_tasks_xlsx.py uniquement, audité sans secret) |


> **Push 2026-09-30 (OPS-T01)** : `main` poussée vers `github.com/akoun-dev/mondocpro.git` (remote vide au départ) — vérification : hash remote `90786c8` = hash local. Token PO utilisé one-shot en URL de commande (non persisté : `git config` et `.git/config` audités), remote `origin` ajouté sans identifiants.

> Le commit `d464483` est antérieur à l'initialisation du système multi-agents : il correspond au scaffold livré.
> ⚠️ **Incident d'intégrité consigné** : le commit `b3c635e` a été créé automatiquement par la plateforme (message UUID non conventionnel) pendant la session, échappant au contrôle de l'AGENT COMMIT. Son contenu a été audité (128 fichiers : gouvernance `.ai/`, worklog, configs scaffold — rien d'anormal). Les agents ne peuvent pas empêcher cet auto-commit : **lesson LL-002** — chaque commit d'agent vérifie l'état Git avant/après et le présent journal fait foi. Tous les commits d'agents respectent les règles ci-dessus.
