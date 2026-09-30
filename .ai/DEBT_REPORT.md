# 🧾 DEBT_REPORT — Registre de la dette technique

> **Registre de la dette technique** : tout écart de qualité, simplification temporaire ou nettoyage différé, assumé et tracé.
> **Classification :** CRITIQUE (bloque l'évolution / risque élevé) · MAJEUR (gêne l'évolution) · MINEUR (cosmétique ou faible risque)
> **Effort :** S (< 1 h) · M (quelques heures) · L (1-2 jours) · XL (> 2 jours)

## Tableau de la dette

| ID | Catégorie | Description | Classification | Effort | Fichiers | Priorité | Impact si non corrigé | Statut |
|---|---|---|---|---|---|---|---|---|
| DET-001 | code smell | `page.tsx` scaffold en styles inline : page d'accueil minimale (logo) à remplacer par l'UI de la première feature, sans conserver les styles inline | MINEUR | S | `src/app/page.tsx` | P4 | Page d'accueil non représentative du produit ; styles inline contournant Tailwind | ⏳ Ouvert (traité à la 1re feature) |
| DET-002 | code smell | Modèles Prisma scaffold `User`/`Post` non utilisés : à nettoyer ou adapter au premier besoin métier réel | MINEUR | S | `prisma/schema.prisma`, `db/custom.db` | P4 | Schéma de données trompeur (modèles sans usage) ; risque de confusion sur le domaine | ⏳ Ouvert (au premier besoin métier) |
| DET-003 | code smell | Warning `allowedDevOrigins` dans `next.config` non configuré : avertissement au démarrage du serveur dev (non bloquant) | MINEUR | S | `next.config.ts` | P4 | Bruit dans les logs ; rien de bloquant en dev | ⏳ Ouvert |
| DET-004 | code smell | `ignoreBuildErrors: true` dans `next.config.ts` : les erreurs TypeScript ne bloquent plus le build — à désactiver dès que le code métier stabilise | MAJEUR | M | `next.config.ts` | P2 | Les erreurs TS passent au build en production : risque de bug non détecté ; masque les régressions de type | ⏳ Ouvert |

**Répartition :** 3 × MINEUR, 1 × MAJEUR — aucune dette CRITIQUE.

### Rappel de procédure
- Toute simplification temporaire ("on corrigera plus tard") devient une ligne DET-XXX immédiatement.
- La dette est revue à chaque audit global ; les DET MAJEUR/CRITIQUE anciennes (> 1 cycle) sont escaladées à l'orchestrateur.
- Une dette corrigée passe en ✅ avec le commit/la feature de référence.
