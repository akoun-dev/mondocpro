# 🐛 BUGS — Registre des bugs fonctionnels

> **Registre unique des bugs fonctionnels.** Tout bug détecté (QA, revue, tests E2E, utilisateur) est consigné ici avant correction.
> **Routage :** bug de sécurité → `SEC_BUGS.md` · accessibilité → `A11Y_BUGS.md` · performance → `PERF_ISSUES.md`.

**Légende sévérité :** P0 = bloquant critique · P1 = majeur · P2 = normal · P3 = mineur · P4 = trivial
**Légende statut :** ⏳ Ouvert · 🔄 En correction · 👀 En retest · ✅ Corrigé · 🚫 Rejeté ( wontfix)

**Total bugs ouverts : 0** (1 corrigé)

| ID | Titre | Description | Sévérité (P0-P4) | Composant | Statut | Détecté par | Assigné à | Date | Résolution |
|---|---|---|---|---|---|---|---|---|---|
| BUG-001 | Erreur d'hydratation sur `<body>` (mismatch SSR/client) | L'environnement de preview (script d'intégration navigateur) injecte des attributs (`__processed_*`, `bis_status`, `bis_frame_id`) sur `<body>` après le rendu serveur → React signale un mismatch d'hydratation en console dev. Aucun impact prod fonctionnel. | P2 | `src/app/layout.tsx` | ✅ Corrigé | PO (utilisateur) | DEV Frontend | 2026-09-30 | `suppressHydrationWarning` ajouté sur `<body>` (correctif canonique React pour injections externes) ; vérifié : rechargement agent-browser sans erreur, console propre, lint 0 erreur. Cause externe confirmée (`bis_*` absents en navigateur headless) |

### Rappel de procédure
1. Créer la ligne BUG-XXX (séquentiel, jamais réutilisé).
2. Remplir tous les champs ; assigner un responsable de correction.
3. Après correction : retester (cf. `.ai/TEST_PLAN.md`), passer le statut à ✅ et documenter la résolution.
4. Toute récidive post-correction → consigner dans `.ai/REGRESSIONS.md`.
