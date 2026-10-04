# 🐛 BUGS — Registre des bugs fonctionnels

> **Registre unique des bugs fonctionnels.** Tout bug détecté (QA, revue, tests E2E, utilisateur) est consigné ici avant correction.
> **Routage :** bug de sécurité → `SEC_BUGS.md` · accessibilité → `A11Y_BUGS.md` · performance → `PERF_ISSUES.md`.

**Légende sévérité :** P0 = bloquant critique · P1 = majeur · P2 = normal · P3 = mineur · P4 = trivial
**Légende statut :** ⏳ Ouvert · 🔄 En correction · 👀 En retest · ✅ Corrigé · 🚫 Rejeté ( wontfix)

**Total bugs ouverts : 0** (4 corrigés)

| ID | Titre | Description | Sévérité (P0-P4) | Composant | Statut | Détecté par | Assigné à | Date | Résolution |
|---|---|---|---|---|---|---|---|---|---|
| BUG-001 | Erreur d'hydratation sur `<body>` (mismatch SSR/client) | L'environnement de preview (script d'intégration navigateur) injecte des attributs (`__processed_*`, `bis_status`, `bis_frame_id`) sur `<body>` après le rendu serveur → React signale un mismatch d'hydratation en console dev. Aucun impact prod fonctionnel. | P2 | `src/app/layout.tsx` | ✅ Corrigé | PO (utilisateur) | DEV Frontend | 2026-09-30 | `suppressHydrationWarning` ajouté sur `<body>` (correctif canonique React pour injections externes) ; vérifié : rechargement agent-browser sans erreur, console propre, lint 0 erreur. Cause externe confirmée (`bis_*` absents en navigateur headless) |
| BUG-002 | Client Prisma périmé au boot → 500 routes missions | Commit ff24eaa ajoutait NurseMission/VisitReport au schéma sans `prisma generate` : le client généré n'exposait pas `nurseMission` → GET /api/nurse/missions et /api/admin/missions en 500 après tout redémarrage process. | P1 | `.zscripts/dev.sh` + build | ✅ Corrigé | Audit-001 (sondes API) | Super Z | 2026-10-04 | Étape `prisma generate` (non fatale) ajoutée au boot plateforme après `bun install` ; client régénéré ; E2E 18/18 vert. Commit `2570e76` |
| BUG-003 | Crash client vue « Mes missions » dès la 1re mission | `serializeMission` ne respectait pas `MissionDto` (scheduledAt/zone/type absents au 1er niveau, appointment.specialty non inclus) → `formatSlot(undefined)` → exception React, écran blanc (reproduit agent-browser). | P0 | `src/lib/nurse.ts` + `nurse-missions-view.tsx` | ✅ Corrigé | Audit-001 (E2E navigateur) | Super Z | 2026-10-04 | include specialty + aplatissement scheduledAt/zone/type dans serializeMission ; vue vérifiée visuellement (carte complète : date, badge, zone, spécialité, motif, actions). Commit `83aec56` |
| BUG-004 | Ref union mal narrowing (2 erreurs tsc) | `register-form.tsx:159` — `headingRef.current?.focus()` sur `Ref<HTMLHeadingElement>` (callback \| objet) : tsc --noEmit échouait ; runtime sûr via `?.` mais gate TS cassée. | P3 | `src/components/auth/register-form.tsx` | ✅ Corrigé | Audit-001 (tsc) | Super Z | 2026-10-04 | Narrowing `headingRef && "current" in headingRef` avant accès `.current` ; tsc src = 0 erreur. Commit `2570e76` |

### Rappel de procédure
1. Créer la ligne BUG-XXX (séquentiel, jamais réutilisé).
2. Remplir tous les champs ; assigner un responsable de correction.
3. Après correction : retester (cf. `.ai/TEST_PLAN.md`), passer le statut à ✅ et documenter la résolution.
4. Toute récidive post-correction → consigner dans `.ai/REGRESSIONS.md`.
