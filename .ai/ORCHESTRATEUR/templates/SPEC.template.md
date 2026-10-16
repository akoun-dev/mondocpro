# SPEC — FEATURE-{{XXX}} : {{Titre}}

> Gabarit de spécification. Une feature non specifiée ici n'est pas une feature prête à coder.

## 1. Problème & objectif

- **Problème** : {{qui souffre de quoi, quand}}
- **Objectif** : {{résultat mesurable attendu}}
- **Hors périmètre** : {{ce qu'on ne fait PAS}}

## 2. Exigences fonctionnelles

1. {{Exigence testable}}
2. {{…}}

## 3. UX / UI

- **Vues impactées** : {{liste}}
- **Composants à réutiliser** : {{liste (shadcn/ui d'abord)}}
- **États obligatoires** : chargement (skeleton/spinner), vide, erreur, succès
- **Responsive** : mobile {{390×844}} sans débordement ; desktop ≥ {{1280}}
- **Thèmes** : clair + sombre

## 4. Chemin doré (QA)

1. {{Étape 1 — ex. : l'utilisateur ouvre X}}
2. {{Étape 2 — ex. : clique Y}}
3. {{Résultat attendu — observable à l'écran}}

## 5. Contrat d'API

| Endpoint | Méthode | Entrée | Sortie | Erreurs |
|---|---|---|---|---|
| `{{/api/…}}` | {{GET}} | {{schéma}} | {{schéma}} | {{codes}} |

_Règle : le frontend ne démarre pas tant que ce contrat n'est pas écrit ici._

## 6. Données

- {{Modèle / migration (jamais destructive sans accord explicite)}}

## 7. Critères d'acceptation

- [ ] Lint 0 erreur
- [ ] Chemin doré vérifié en navigateur (desktop + mobile)
- [ ] Clair + sombre OK
- [ ] A11y : labels, clavier, contraste
- [ ] Registres + worklog mis à jour
