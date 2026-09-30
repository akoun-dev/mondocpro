# 🔍 REVIEW_LOG — Journal des revues de code

> **Registre de toutes les revues.** Aucun code ne passe en validation sans revue REVIEWER (verdict `APPROVED`).
> **Légende verdict :** ✅ APPROVED · ⚠️ CHANGES_REQUESTED · ⛔ BLOCKED

**Total revues : 0**

| ID | Date | Fichiers | Reviewer | Verdict | Points soulevés | Résolution |
|---|---|---|---|---|---|---|
| _—_ | _—_ | _Aucune revue enregistrée_ | _—_ | _—_ | _—_ | _—_ |

---

## ✅ Checklist de revue (le Reviewer cocha chaque point avant verdict)

### Architecture & code
- [ ] **Séparation des couches** respectée : UI (frontend) ≠ logique métier ≠ accès données (Prisma) ≠ routes API ; z-ai-web-dev-sdk uniquement côté backend.
- [ ] **Non-duplication** : pas de logique dupliquée ; réutilisation des composants `src/components/ui` (shadcn) et utilitaires existants.
- [ ] **Nommage et lisibilité** : noms explicites, fonctions courtes, pas de code mort.

### Typage & robustesse
- [ ] **Types** : TypeScript strict, pas de `any` injustifié ; schémas **Zod** pour toute entrée externe (API, formulaires).
- [ ] **Gestion d'erreurs** : try/catch pertinent, messages utilisateur clairs, pas d'erreur avalée silencieusement ; états de chargement/erreur/vide gérés (TanStack Query).

### Qualité transverse
- [ ] **Accessibilité** : sémantique HTML, labels, focus visible, contrastes AA (WCAG 2.1 AA).
- [ ] **Performance** : budgets `.ai/PERFORMANCE_BUDGET.md` respectés ; pas de re-renders inutiles, pas de N+1 Prisma.
- [ ] **Sécurité** : pas de secret en clair, validation côté serveur, pas de risque XSS (contenu externe échappé), vérif `.ai/SEC_BUGS.md`.
- [ ] **Tests** : scénario de test défini dans `.ai/TEST_PLAN.md` ; E2E manuel agent-browser réalisé.
- [ ] **Conformité process** : commits conventionnels atomiques (cf. `.ai/COMMIT_LOG.md`), registres à jour, docs/ADR si décision structurante.
