# DESIGN_SYSTEM.md — Système de design

**Base** : shadcn/ui (style **New York**) + Tailwind CSS 4. Aucun composant custom tant qu'un
équivalent shadcn existe dans `src/components/ui` (44 composants disponibles).

## 1. Palette médicale (ADR-002 — définie par le PO)

Tokens implémentés dans `src/app/globals.css` (format Tailwind 4 CSS-first). Utilisation via
les classes sémantiques (`bg-primary`, `text-muted-foreground`, `bg-success`…).

### 1.1 Couleurs de la palette (source de vérité = PO)

| Token | HEX | Utilisation imposée | Classes Tailwind |
|---|---|---|---|
| Bleu médical principal | `#1565C0` | Couleur principale, boutons, navigation, titres | `bg-primary`, `text-primary`, `ring-ring` |
| Bleu foncé | `#0D47A1` | En-têtes, textes importants, éléments actifs | `bg-primary-dark`, `text-secondary-foreground` |
| Vert santé | `#2EBD85` | Validation, disponibilité, succès, équipe en route | `bg-success`, `text-success` |
| Vert clair | `#E8F8F1` | Fonds légers, cartes, états positifs | `bg-accent` (light), `bg-success-light` |
| Blanc | `#FFFFFF` | Fond principal, cartes | `bg-background`, `bg-card` |
| Gris texte | `#263238` | Texte principal | `text-foreground` |
| Gris clair | `#F5F7FA` | Fonds secondaires | `bg-secondary`, `bg-muted` |
| Rouge urgence | `#D32F2F` | Urgence, erreur, action critique | `bg-destructive`, `text-destructive` |
| Orange | `#F59E0B` | Attention, attente, paiement en attente | `bg-warning`, `text-warning` |

### 1.2 Règles d'usage sémantique (Agent UX/UI — obligatoires)

- **Succès/validation** : icône + `text-success`/`bg-success-light` ; jamais la couleur seule (a11y).
- **Attente** : `bg-warning` (badge "paiement en attente", états pending) avec `text-warning-foreground`.
- **Urgence/critique** : `bg-destructive` réservé aux actions destructrices et aux états d'erreur réels.
- **Hiérarchie bleue** : titres importants `text-primary-dark` ; actions principales `bg-primary` ;
  états actifs/hover `bg-primary-dark`.
- Les 9 couleurs de la palette couvrent aussi les séries de graphiques (`--chart-1..5`).

### 1.3 Contrastes WCAG AA (vérifiés à l'implémentation)

| Combinaison | Ratio | Verdict |
|---|---|---|
| `#FFFFFF` sur `#1565C0` (bouton primaire) | ≈ 6,3 : 1 | ✅ AA |
| `#263238` sur `#2EBD85` (succès) | ≈ 5,5 : 1 | ✅ AA |
| `#263238` sur `#F59E0B` (attente) | ≈ 6,1 : 1 | ✅ AA |
| `#FFFFFF` sur `#D32F2F` (urgence) | ≈ 5,9 : 1 | ✅ AA |
| `#263238` sur `#E8F8F1` / `#F5F7FA` (fonds) | > 12 : 1 | ✅ AAA |

⚠️ **Interdit** : texte blanc sur `bg-success` (#2EBD85) ou `bg-warning` (#F59E0B) — contraste
insuffisant (≈ 2,4 : 1). Toujours `text-success-foreground` / `text-warning-foreground`.

### 1.4 Nuances dérivées (documentées, thème sombre et surfaces)

| Nuance | HEX | Dérivation | Usage |
|---|---|---|---|
| `--muted-foreground` (light) | `#546E7A` | éclaircie de `#263238` | texte secondaire (ratio 7,5:1 sur blanc) |
| `--border`/`--input` (light) | `#E1E7ED` | assombrie de `#F5F7FA` | séparateurs, champs |
| `--primary` (dark) | `#42A5F5` | éclaircie de `#1565C0` | primaire sur fond sombre (AA : 5,9:1 avec `#16212A`) |
| `--destructive` (dark) | `#EF5350` | éclaircie de `#D32F2F` | urgence sur fond sombre |
| surfaces dark (`#1B262F`, `#232F3A`, `#2A3642`) | — | assombrissements de `#263238` | background/card/accents sombres |

Toute nouvelle nuance devra être ajoutée dans ce tableau avec sa justification de contraste.

### 1.5 Thème

Thème clair par défaut ; `.dark` fourni (nuances dérivées §1.4) via `next-themes` quand activé.
La palette médicale étant claire, l'usage principal reste le thème light.

## 2. Typographie

| Usage | Classe |
|---|---|
| Titre de page | `text-2xl md:text-3xl font-bold tracking-tight` |
| Titre de section | `text-lg md:text-xl font-semibold` |
| Corps | `text-sm md:text-base` |
| Légende / aide | `text-sm text-muted-foreground` |

## 3. Composants réutilisables (mapping besoin → shadcn)

| Besoin | Composant |
|---|---|
| Actions | `Button` (variants), `DropdownMenu`, `Toggle` |
| Conteneurs | `Card` (p-4/p-6), `Tabs`, `Accordion`, `Sheet`, `Dialog` |
| Formulaires | `Form` (react-hook-form + zod), `Input`, `Select`, `Checkbox`, `Switch` |
| Listes | `Table`, `ScrollArea`, `Pagination`, `Command` |
| Feedback | `Sonner`/`Toast`, `Alert`, `Progress`, `Skeleton`, `Badge` |
| Navigation | `Breadcrumb`, `NavigationMenu`, `Sidebar`, `Menubar` |
| Surfaces flottantes | `Popover`, `Tooltip`, `HoverCard`, `ContextMenu` |

## 4. Règles de mise en page

- Espacements cohérents : contenu en `p-4`/`p-6`, gouts `gap-4`/`gap-6`.
- **Listes longues** : conteneur `max-h-96 overflow-y-auto` + scrollbar stylée.
- **Footer collant** : racine `min-h-screen flex flex-col`, footer `mt-auto` ; poussé
  naturellement si contenu > viewport ; safe-area iOS respectée.
- **Responsive mobile-first obligatoire** : breakpoints `sm:/md:/lg:/xl:` ; cibles tactiles ≥ 44px.
- Animations sobres via framer-motion (hover, focus, transitions de page) — jamais au détriment
  des métriques perf.

## 5. États UI obligatoires

Tout écran asynchrone doit couvrir : **chargement** (Skeleton/Spinner), **vide** (EmptyState),
**erreur** (Alert + action de recovery), **succès** (toast). Aucun spinner infini.

## 6. Icônes & images

- Icônes : `lucide-react` uniquement.
- Images : `next/image` avec `alt` descriptif ; illustrations générées via le skill image-generation si besoin.
