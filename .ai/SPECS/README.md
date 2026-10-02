# 📂 SPECS/ — Spécifications des features

Ce dossier contient les **spécifications de chaque feature** avant implémentation.

## Naming

| Fichier | Rôle | Produit par |
|---|---|---|
| `FEATURE-XXX.md` | Spécification fonctionnelle : objectif, user stories, règles de gestion, critères d'acceptation | Orchestrateur + QA |
| `FEATURE-XXX_UX.md` | Conception UX/UI : wireframe/structure, composants shadcn/ui, états (chargement, vide, erreur), parcours utilisateur | UX/UI |
| `FEATURE-XXX_TECH_DESIGN.md` | Design technique : contrat d'API (endpoints, payloads Zod), modèles Prisma, découpage des couches et fichiers | Tech Lead |

- **FEATURE-XXX** : numéro séquentiel (`FEATURE-001`, `FEATURE-002`, … jamais réutilisé), attribué à la création du backlog.
- Les trois fichiers d'une même feature portent le **même numéro**.

## ARCHIVED/

Le sous-dossier `ARCHIVED/` reçoit les specs des features **livrées et closes** (ou abandonnées), avec leur statut final. Une spec archivée n'est plus modifiée — elle sert de référence historique (rétrospectives, audits, anti-régression).

## État actuel

📁 Aucune spec (aucune feature demandée). Les templates de handoff associés au cycle de spécification sont dans `.ai/HANDOFF/`.
