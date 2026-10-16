# {{PREFIXE}}-XXX — {{Titre du problème}}

> Gabarit commun des registres qualité (`BUGS.md`, `SEC_BUGS.md`, `A11Y_BUGS.md`,
> `PERF_ISSUES.md`, `REGRESSIONS.md`). Un registre = une table, une règle de routage, zéro
> problème en mémoire seule.

**Sévérité :** P0 (bloquant) · P1 (majeur) · P2 (normal) · P3 (mineur) · P4 (cosmétique)
**Statut :** ⏳ Ouvert · 🔄 En correction · 👀 En retest · ✅ Corrigé · 🚫 Rejeté

**Total ouvert : 0**

| ID | Titre | Critère / Cause | Sévérité | Composant | Statut | Correctif | Date |
|---|---|---|---|---|---|---|---|
| _—_ | _Aucun problème enregistré_ | _—_ | _—_ | _—_ | _—_ | _—_ | _—_ |

### Règles de procédure

1. Créer la ligne `{{PREFIXE}}-XXX` avec la référence exacte (critère WCAG, mesure perf, stack d'erreur…).
2. Corriger la **cause racine** — jamais le symptôme seul.
3. Retester le **même scénario** de détection avant de passer à ✅ (preuve exigée).
4. Toute récidive post-clôture → dupliquer dans `REGRESSIONS.md`.
