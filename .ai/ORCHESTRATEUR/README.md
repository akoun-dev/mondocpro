# 🧩 ORCHESTRATEUR — Kit portable multi-agents

Kit autoportant pour **installer le même système d'orchestration multi-agents dans n'importe quel projet**.
Il encapsule tout ce qui fait tourner le pilotage de ce repo : journal partagé (`worklog.md`), boucle autonome,
cycle de vie des features, registres qualité, handoffs, et chaîne de vérification avant « terminé ».

> Copier le dossier `ORCHESTRATEUR/` tel quel dans le nouveau projet — il ne contient **aucune**
> dépendance à ce projet (les exemples Mon doc Pro sont marqués « exemple »).

## Contenu

| Fichier | Rôle |
|---|---|
| `PROMPT-ORCHESTRATEUR.md` | **Le prompt système complet** — à charger comme instructions de l'agent (GLM Code, Claude Code, Cursor…) |
| `SKILL.md` | Le même protocole au **format skill** (frontmatter `name`/`description`) — à déposer dans un dossier de skills |
| `PROJECT.template.md` | Contexte projet à remplir (stack, commandes, comptes de test, glossaire métier) |
| `templates/` | Squelettes des fichiers de gouvernance (worklog, registres, SPEC, ADR, HANDOFF, README `.ai/`) |
| `scripts/bootstrap.sh` | **Installation en 1 commande** dans le nouveau repo |

## Installation dans un autre projet

### Mode A — Prompt (recommandé)

```bash
# 1. Copier le kit à la racine du nouveau projet
cp -r /chemin/mondocpro/.ai/ORCHESTRATEUR ./orchestrateur-tmp && mv orchestrateur-tmp .ai-tmp

# 2. Scaffold le squelette de gouvernance (worklog.md + .ai/)
bash .ai-tmp/scripts/bootstrap.sh

# 3. Remplir le contexte projet
$EDITOR .ai/PROJECT_CONTEXT.md
```

Puis pointer l'agent sur le prompt : dans la config de l'outil (system prompt, `CLAUDE.md`,
`.cursorrules`, instructions personnalisées…), mettre :

> « Lis et applique `.ai/PROMPT-ORCHESTRATEUR.md` comme protocole de travail. »

### Mode B — Skill

Copier le dossier comme skill dans l'outil qui supporte les skills :

```bash
mkdir -p ~/.claude/skills/orchestrateur-multi-agents
cp .ai-tmp/SKILL.md ~/.claude/skills/orchestrateur-multi-agents/SKILL.md
cp -r .ai-tmp/templates .ai-tmp/PROMPT-ORCHESTRATEUR.md ~/.claude/skills/orchestrateur-multi-agents/
```

Le skill se déclenche dès qu'une tâche de développement multi-étapes apparaît ; son corps
renvoie vers `PROMPT-ORCHESTRATEUR.md` (protocole complet) et `templates/`.

## Les 3 piliers résumés

1. **Traçabilité** — un `worklog.md` unique, append-only, sections par `Task ID` ; tout agent le lit AVANT et l'incrémente APRÈS.
2. **Boucle autonome** — `SCAN → COMPRENDRE → CONCEVOIR → PLANIFIER → DÉLÉGUER → COMMIT → REVIEW → DOC → TESTER → DÉTECTER → CORRIGER → RETESTER → VALIDER` ; « ça compile » n'est jamais « terminé » (preuve navigateur exigée).
3. **Gouvernance** — registres spécialisés (bugs, sécurité, a11y, perf, régressions, dette), specs par feature, ADR, handoffs entre agents.

## Personnalisation

- `PROMPT-ORCHESTRATEUR.md` contient des `{{PLACEHOLDERS}}` (stack, commandes, port, comptes de test…).
- Renseigner `.ai/PROJECT_CONTEXT.md` après bootstrap — l'orchestrateur le lit à chaque SCAN.
- Les seuils (budget perf, score d'audit) sont des défauts raisonnables, à ajuster par projet.
