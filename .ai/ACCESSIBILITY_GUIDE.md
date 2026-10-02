# ACCESSIBILITY_GUIDE.md — Règles d'accessibilité (WCAG 2.1 AA)

**Cible** : conformité **WCAG 2.1 niveau AA** sur toutes les features frontend.
Agent responsable : ♿ A11Y — aucun composant frontend n'est TERMINÉ sans sa validation.

## 1. Règles structurelles

- HTML sémantique : `header`, `nav`, `main`, `section`, `article`, `footer` (pas de div-tout).
- Hiérarchie de titres sans saut (`h1` unique par page → `h2` → `h3`).
- Contenu pour lecteurs d'écran seul : classe `sr-only`.
- `lang="fr"` sur `<html>` si contenu français (à aligner avec la langue cible de la feature).

## 2. Interactions clavier

- **Tout élément interactif accessible au clavier** (Tab, Enter, Espace, Échap pour fermer).
- Focus visible toujours préservé (ne jamais `outline-none` sans alternative `focus-visible:`).
- Ordre de tabulation logique ; pièges à focus gérés dans les Dialogs/Sheets (shadcn le fait nativement — ne pas casser).

## 3. ARIA

- `aria-label` / `aria-labelledby` sur les contrôles sans libellé textuel (boutons icône).
- `role` correct sur les composants custom ; shadcn/Radix fournit les rôles — les conserver.
- Régions live (`aria-live="polite"`) pour toasts et mises à jour asynchrones.
- `aria-invalid` + messages d'erreur liés (`aria-describedby`) sur les champs de formulaire.

## 4. Couleurs & contraste

- Contraste minimum : texte normal **4.5:1**, texte large (≥24px) **3:1**, bordures d'état 3:1.
- Ne jamais coder l'information uniquement par la couleur (ajouter icône/texte : erreur = icône + texte).

## 5. Formulaires

- `<Label>` associé à chaque champ (`htmlFor`/`id`) — jamais de placeholder-label.
- Erreurs annoncées et placées près du champ ; validation accessible au clavier.

## 6. Images & médias

- `alt` descriptif obligatoire sur toute image ; `alt=""` si purement décorative.
- Aucun contenu clignotant > 3 flashs/seconde.

## 7. Checklist de validation (par feature frontend)

- [ ] Navigation clavier complète du chemin doré
- [ ] Focus visible et logique
- [ ] Contrastes vérifiés (outils devtools)
- [ ] Labels ARIA pertinents, pas de répétitions inutiles
- [ ] Test au zoom 200% sans perte de fonctionnalité
- [ ] Largeur mobile 375px sans scroll horizontal
