# Migrations — source de vérité du schéma de base de données

Toutes les migrations du projet vivent dans ce dossier (`supabase/migrations/`),
quel que soit l'outil qui les applique. Deux familles cohabitent :

## 1. Migrations Prisma — source de vérité (SYS-009)

- Dossiers `20261003000000_init_auth/`, `20261003000001_patient_business/`, …
- Format Prisma Migrate : **un dossier par migration** contenant `migration.sql`
  (+ `migration_lock.toml` à la racine qui verrouille le provider).
- Application : `bun run db:migrate-deploy` (registre `_prisma_migrations`,
  idempotent — « No pending migrations » une fois appliquées).
- Évolutions du schéma : modifier `supabase/schema.prisma` puis
  `prisma migrate dev` (local) ou `bun run db:push` en filet de sécurité.

## 2. Scripts SQL « miroir » du scaffold (historiques — 2026-10-02)

- Fichiers plats `20261002150808_create_enum_role.sql`, `_create_enum_zone`,
  `_create_users_table`, `_create_sessions_table`.
- Référence documentaire du scaffold initial (format Supabase CLI). Les objets
  qu'ils décrivent ont été effectivement appliqués via Prisma (db push, puis
  migrations versionnées) — **ne pas les réappliquer** sur une base initialisée.

⚠️ Coexistence des formats : Prisma n'applique que ses dossiers de migration,
la CLI Supabase ne lirait que les fichiers `.sql` plats. Ne pas mélanger les
deux pour un même objet.
