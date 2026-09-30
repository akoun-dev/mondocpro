# ADR-002 — Adoption de la palette médicale officielle

**Statut** : Accepté
**Date** : 2026-09-30 (timezone PO : Africa/Abidjan)
**Décideurs** : PO (utilisateur) · Agent 1 Tech Lead · Agent UX/UI

## Contexte

Le scaffold embarquait la palette shadcn neutre (oklch, monochrome). Le PO (utilisateur) a fourni
une palette produit explicite à dominante « médicale » (9 couleurs) avec un cahier d'utilisation
par couleur (boutons, validation, urgence, attente…). Les règles système interdisent les bleus
par défaut **sauf demande explicite de l'utilisateur** — présente ici.

## Décision

1. Adoption intégrale des 9 couleurs comme **source de vérité visuelle** du produit.
2. Mapping vers les tokens sémantiques shadcn/ui (`primary`, `success`, `warning`, `destructive`…) —
   implémenté dans `src/app/globals.css` (format Tailwind 4 CSS-first ; `tailwind.config.ts` héritage
   v3 ignoré).
3. Ajout de tokens applicatifs dédiés : `success`, `success-foreground`, `success-light`,
   `warning`, `warning-foreground`, `primary-dark`.
4. Thème sombre fourni par **nuances dérivées documentées** (DESIGN_SYSTEM.md §1.4).
5. Contrastes AA vérifiés au moment de l'implémentation ; interdiction documentée du texte blanc
   sur vert santé/orange (ratio insuffisant).

## Alternatives considérées

| Alternative | Verdict |
|---|---|
| Conserver la palette neutre shadcn | Rejeté — contredit la demande explicite du PO |
| Codes hex en dur dans les composants | Rejeté — viole la règle de tokens sémantiques et complique les changements |
| Palette dark custom indépendante | Rejeté — dérive non maîtrisée ; dérivations tracées préférées |

## Conséquences

**Positives** : identité produit cohérente ; tokens centralisés ; graphiques alignés (`--chart-1..5`) ;
règles d'usage sémantique écrites (validation/attente/urgence) ; contrastes AA prouvés.

**Négatives / vigilance** : deux verts proches (`#2EBD85` action/état vs `#E8F8F1` fond) — à ne pas
confondre avec des états différents ; texte blanc interdit sur success/warning ; toute nouvelle
couleur devra passer par une mise à jour du DESIGN_SYSTEM.md (non-duplication).

## Références

- `.ai/DESIGN_SYSTEM.md` §1 (implémentation détaillée)
- `src/app/globals.css` (tokens)
- Demande PO (conversation, 2026-09-30)
