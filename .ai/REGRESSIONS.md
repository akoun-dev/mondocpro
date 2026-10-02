# 🔁 REGRESSIONS — Registre des régressions

> **Registre de toute régression** : fonctionnalité auparavant opérationnelle qui cesse de l'être à la suite d'un changement.
> Toute régression détectée (QA, revue, re-test E2E, utilisateur) est consignée ici en plus d'une éventuelle ligne correctrice dans `.ai/BUGS.md`.

**Total régressions : 0**

| ID | Date | Feature | Description | Cause | Correctif | Test anti-régression |
|---|---|---|---|---|---|---|
| _—_ | _—_ | _Aucune régression enregistrée_ | _—_ | _—_ | _—_ | _—_ |

---

## 🛡️ Protocole anti-régression (appliqué avant chaque validation de feature)

1. **Lint systématique** : `bun run lint` doit rester à 0 erreur / 0 warning avant chaque commit (cf. `.ai/COMMIT_LOG.md`).
2. **Revue obligatoire** : le Reviewer vérifie l'impact des changements sur les fonctionnalités existantes (checklist `.ai/REVIEW_LOG.md`), pas seulement le code nouveau.
3. **Tests E2E manuels via agent-browser** avant toute validation : parcours complet du **chemin doré** de chaque feature impactée (navigation réelle, états de chargement/erreur, interactions clés).
4. **Vérification `dev.log`** : serveur dev démarré sans erreur ni warning nouveau ; routes touchées répondent comme attendu.
5. **Re-test des registres ouverts** : tout bug ✅ corrigé (`BUGS.md`, `SEC_BUGS.md`, `A11Y_BUGS.md`, `PERF_ISSUES.md`) est re-testé sur la zone modifiée.
6. **En cas de régression** : créer la ligne REG-XXX, identifier la cause racine, corriger, puis formaliser un **test anti-régression** (étape E2E reproductible ajoutée à `.ai/TEST_PLAN.md`) pour que la régression ne puisse plus repasser inaperçue.
