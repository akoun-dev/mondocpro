# DESIGN_SYSTEM.md — Système de design

**Base** : shadcn/ui (style **New York**) + Tailwind CSS 4. Aucun composant custom tant qu'un
équivalent shadcn existe dans `src/components/ui` (44 composants disponibles).

## 1. Palette & thème

- Variables sémantiques obligatoires : `bg-background`, `text-foreground`, `bg-primary`,
  `text-primary-foreground`, `bg-muted`, `border`, `ring`, `bg-card`…
- **Interdits** : couleurs indigo/bleues brut sauf demande explicite utilisateur.
- Thème clair/sombre via `next-themes` (support prévu dès la première feature UI majeure).
- Wrapper avec classe de fond si un fond non blanc est nécessaire (rendu de base = fond blanc).

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
