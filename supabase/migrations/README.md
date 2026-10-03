# Migrations — source unique du schéma (Supabase CLI)

**Les migrations sont exclusivement gérées par la CLI Supabase.** Aucun
`prisma migrate`, `prisma db push`, ni registre `_prisma_migrations`.

## Format

Un fichier SQL plat par changement logique, nommé `<timestamp>_<nom>.sql` :

```
20261002150808_create_enum_role.sql
20261002150810_create_enum_zone.sql
20261002232735_create_specialties_table.sql
…
20261003130000_create_notifications_table.sql
```

- Les enums sont créés **avant** les tables qui les référencent.
- Ajouter une valeur à un enum existant = migration dédiée
  `alter type … add value` (supprimer une valeur est impossible sans risque).
- `migration_lock.toml` n'a plus lieu d'être : c'était un artefact Prisma.

## Workflow

| Commande                     | Effet                                                        |
| ---------------------------- | ------------------------------------------------------------ |
| `bun run db:migration <nom>`  | Crée `supabase/migrations/<timestamp>_<nom>.sql`               |
| `bun run db:migrate-deploy`   | Applique les migrations en attente sur le projet lié (`--linked`) |
| `bun run db:status`           | Compare local ↔ distant (`supabase migration list`)            |
| `bun run db:diff`             | Génère le SQL manquant si la base a dérivé du schéma           |
| `bun run db:reset`            | ⚠️ **Réinitialise la base liée** : supprime tout, rejoue les migrations + `seed.sql` |
| `bun run db:generate`         | `prisma generate` — regénère le client (codegen, **pas** une migration) |

Après `db:migration`, écrire le SQL dans le fichier généré, puis
`bun run db:migrate-deploy`.

Le projet doit être lié une fois (`supabase link --project-ref <ref>`) : le ref
est mémorisé dans `supabase/.temp/` (ignoré par git). ⚠️ La CLI 2.116 lit
`.temp/project-ref` — le seul `linked-project.json` ne suffit pas.

### Pourquoi `--include-all` sur `db:migrate-deploy`

`supabase db push` refuse par défaut d'appliquer une migration antérieure à la
dernière migration déjà appliquée. Or `20261003130000_create_notifications_table.sql`
est horodatée **13:00** alors que la machine était à 12:10 UTC : toute migration
nouvelle était donc rejetée (« Found local migration files to be inserted before
the last migration »). `--include-all` lève ce blocage.

Contrepartie : une migration réellement désordonnée sera appliquée sans
avertissement. À lever quand l'horloge aura dépassé `20261003130000` — ou en
réalignant l'historique avec `bash .zscripts/migrate_realign.sh`.

## Prisma reste l'ORM, plus le gestionnaire de schéma

`supabase/schema.prisma` (pointé par `prisma.config.ts`) sert uniquement au
**client** : types, requêtes, `prisma generate`. Toute évolution du schéma
passe par une migration SQL de ce dossier — ne jamais éditer le schéma Prisma
pour créer une table sans migration.

## Après un `db push`, ne pas se fier au registre seul

`supabase_migrations.schema_migrations` déclare une migration appliquée ; il ne
prouve pas que le DDL existe réellement (cf. INC-001 : la migration de flotte du
pooler a fait disparaître des tables alors que le registre les déclarait
appliquées). Après toute opération d'infrastructure Supabase, vérifier les
objets avec `bun scripts/inspect-schema.ts` et la sonde `/api/health`.