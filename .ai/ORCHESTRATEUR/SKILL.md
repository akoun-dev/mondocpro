---
name: orchestrateur-multi-agents
description: Protocole d'orchestration multi-agents pour piloter un projet de développement de bout en bout (planification, délégation, worklog partagé, registres qualité, vérification navigateur, livraison git). Utiliser ce skill dès qu'une tâche de développement multi-étapes apparaît dans un projet — nouvelle feature, refonte de vue, correction complexe, refonte d'API, mise en place de gouvernance — même si l'utilisateur ne parle pas d'« orchestrateur » : toute demande du type « implémente », « redessine », « corrige », « ajoute », ou toute session où le repo possède un worklog.md et un dossier .ai/ doit passer par ce protocole.
---

# Orchestrateur multi-agents — protocole de travail

Ce skill encapsule le système de pilotage utilisé sur les projets gouvernés par un dossier `.ai/`
et un `worklog.md`. Il transforme toute demande en livraison **vérifiée, documentée et tracée**.

## Démarrage (obligatoire, dans cet ordre)

1. **Lire le protocole complet** : ouvrir `PROMPT-ORCHESTRATEUR.md` (à côté de ce fichier, ou
   `<repo>/.ai/ORCHESTRATEUR/PROMPT-ORCHESTRATEUR.md`) et l'appliquer intégralement. C'est la
   source de vérité : boucle autonome, conventions, chaîne de vérification, livraison git.
2. **Lire le contexte** : la fin de `worklog.md` (racine du repo) + `.ai/PROJECT_CONTEXT.md`
   (stack, commandes, comptes de test) + les registres `.ai/` concernés par la demande.
3. Si le projet n'a **pas encore** de squelette : exécuter `scripts/bootstrap.sh` depuis
   `ORCHESTRATEUR/`, puis faire remplir `.ai/PROJECT_CONTEXT.md` à l'utilisateur.

## Les 5 réflexes non négociables

1. **worklog append-only** — lire avant, ajouter sa section `Task ID / Agent / Task / Work Log /
   Stage Summary` après (gabarit exact dans le protocole, § 4).
2. **TodoWrite en temps réel** — plan en todos pour toute tâche ≥ 3 étapes ; une seule
   `in_progress` ; Task IDs (`1`, `2-a`, `2-b`…) pour la délégation en sous-agents autonomes.
3. **Frontend d'abord** — UI visible avant branchement backend ; API routes + contrats
   additifs ; composants existants (shadcn/ui) plutôt que du sur-mesure.
4. **« Terminé » = preuve navigateur** — lint 0 erreur + chemin doré cliqué + données réelles
   affichées + mobile sans débordement (`scrollWidth == innerWidth`) + clair/sombre + logs
   propres. « Ça compile » n'est jamais suffisant ; dire honnêtement ce qui n'a pas pu être vérifié.
5. **Livraison tracée** — commits conventionnels atomiques, push vers la branche principale
   (rebase si non-fast-forward), registres `.ai/` et worklog mis à jour.

## Ressources embarquées

- `PROMPT-ORCHESTRATEUR.md` — protocole complet (12 sections) — **à lire en premier**.
- `templates/` — gabarits : `README.ai.md`, `WORKFLOWS.md`, `registre.md`, `SPEC.md`, `ADR.md`,
  `HANDOFF.md`, `worklog.md`, `PROJECT_CONTEXT.md`.
- `scripts/bootstrap.sh` — installe le squelette `.ai/` + `worklog.md` dans un repo vierge.

## Placement des fichiers selon l'outil

- **GLM Code / Claude Code** : ce dossier tel quel dans les skills ; le repo cible garde
  `worklog.md` à la racine et la gouvernance dans `.ai/`.
- **Cursor / autres** : coller `PROMPT-ORCHESTRATEUR.md` dans les règles projet
  (`.cursorrules`, instructions personnalisées) après avoir remplacé les `{{PLACEHOLDERS}}`.
