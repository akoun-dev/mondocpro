# ♿ A11Y_BUGS — Registre des non-conformités accessibilité

> **Registre dédié aux problèmes d'accessibilité** (référentiel : **WCAG 2.1 niveau AA**).
> Chaque non-conformité détectée (revue a11y, test lecteur d'écran, audit automatisé, retour utilisateur) est consignée ici.

**Légende sévérité :** CRITIQUE (bloque l'usage) · MAJEUR (freine fortement) · MINEUR (inconvénient sans blocage)
**Légende statut :** ⏳ Ouvert · 🔄 En correction · 👀 En retest · ✅ Corrigé · 🚫 Rejeté

**Total non-conformités ouvertes : 2**

| ID | Titre | Critère WCAG 2.1 AA | Sévérité | Composant | Statut | Correctif | Date |
|---|---|---|---|---|---|---|---|
| A11Y-001 | Progression de tournée non annoncée | 4.1.2 Nom, rôle, valeur | MINEUR | `src/components/nurse/nurse-home-view.tsx` | ⏳ Ouvert | Ajouter `role="progressbar"` et `aria-valuemin/max/now` ou utiliser `Progress`. | 2026-10-25 |
| A11Y-002 | Sidebar admin mobile sans focus management complet | 2.1.1 Clavier, 2.4.3 Ordre du focus, 2.4.7 Focus visible | MAJEUR | `src/components/admin/admin-sidebar.tsx` | ⏳ Ouvert | Utiliser `Sheet`/`Dialog` ou ajouter focus initial, restauration, Échap et focus trap. | 2026-10-25 |

### Rappel de procédure
1. Créer la ligne A11Y-XXX, citer le **critère WCAG 2.1 AA exact** (numéro + intitulé, ex. « 1.4.3 Contraste (minimum) »).
2. Corriger dans le composant concerné (privilégier les composants shadcn/ui accessibles par défaut).
3. Retester avec le même scénario (navigation clavier, contraste, lecteur d'écran) avant de passer à ✅.
