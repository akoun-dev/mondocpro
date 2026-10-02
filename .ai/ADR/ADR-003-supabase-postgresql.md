# ADR-003 — Migration de la base de données vers Supabase (PostgreSQL)

**Statut** : Accepté
**Date** : 2026-09-30
**Décideurs** : PO (utilisateur) · Agent 1 Tech Lead · DEVOPS/DATA · DEV SÉCURITÉ

## Contexte

Le scaffold embarquait Prisma + SQLite local (`db/custom.db`, non versionnée). Le PO demande
l'utilisation de **Supabase** comme base de données et fournit : URL projet, clé publishable,
clé anon (JWT), clé **service_role** (JWT) et mot de passe PostgreSQL.

Diagnostics réseau réalisés (preuves) :
- Host direct `db.<ref>.supabase.co:5432` : **IPv6 uniquement** (aucun enregistrement A) et le
  sandbox n'a pas de connectivité IPv6 → connexion directe impossible (Supabase sans add-on IPv4).
- API REST : `/auth/v1/health` → 200 avec la clé publishable (projet **actif**, clés valides) ;
  `/rest/v1/User` avant push → PGRST205 (auth OK, table absente).
- Pooler **Supavisor** (IPv4) : le projet n'est PAS sur la flotte `aws-0-*` (erreur `tenant/user
  not found`) → flotte récente **`aws-1-*`** ; région identifiée par auth réelle : **aws-1-eu-west-1**.

## Décision

1. **Prisma conserve le rôle d'ORM** — seul le provider change : `sqlite` → `postgresql`
   (`prisma/schema.prisma`). Aucune autre couche impactée.
2. **Connexion via le pooler Supavisor en session mode (5432)**, IPv4, `sslmode=require` :
   `postgresql://postgres.<ref>:<mot-de-passe>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require`
   (session mode retenu plutôt que transaction 6543 : serveur Node long-running, prepared
   statements supportés, pas de besoin de `pgbouncer=true`).
3. **Secrets dans `.env` uniquement** (fichier non versionné, retrait effectué en 90786c8) :
   `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy, compat), `SUPABASE_SERVICE_ROLE_KEY` (serveur
   uniquement, jamais préfixé `NEXT_PUBLIC_`).
4. **Scripts `db:*` blindés** : le sandbox exporte `DATABASE_URL=file:…` (héritage scaffold) qui
   prime sur `.env` → les scripts package.json réexportent la valeur du `.env` avant d'invoquer
   Prisma (évite la régression P1012).
5. **Stratégie de schéma** : `prisma db push` pour l'amorçage (MVP) ; `prisma migrate` (migrations
   versionnées + shadow database) à activer dès la première feature métier — les migrations
   historisées sont obligatoires avant la PROD.
6. `@supabase/supabase-js` **non installé à ce stade** (YAGNI) : Prisma couvre l'accès SQL.
   Sera ajouté par un ADR dédié si auth/realtime/storage Supabase sont demandés.

## Alternatives considérées

| Alternative | Verdict |
|---|---|
| Conserver SQLite local | Rejeté — contredit la demande explicite du PO |
| Connexion directe `db.<ref>.supabase.co` | Rejeté — IPv6-only, sandbox sans IPv6 (preuve DNS/TCP) |
| Pooler en mode transaction (6543) | Différé — inutile ici, session mode plus simple et plus complet |
| supabase-js comme client DB principal | Rejeté — dupliquerait Prisma (non-duplication, règle 23) |

## Conséquences

**Positives** : PostgreSQL managé (contraintes, index, types riches), dashboard Supabase, REST
auto-générée, base prête pour auth/realtime/storage ; schéma User/Post synchronisé (vérifié :
REST 200, roundtrip Prisma `SELECT 1` OK).

**Négatives / vigilance** : dépendance réseau externe (latence pooler) ; RLS à configurer dans
Supabase pour tout accès REST direct côté client ; **service_role contourne le RLS** — jamais
exposé ; secrets transmis en clair par le PO → rotation recommandée (SEC-ADV-002) ; migrations
versionnées à mettre en place avant PROD (dette suivie en TASKS).

## Références

- `.env` (non versionné) · `prisma/schema.prisma` (provider postgresql) · `package.json` (db:*)
- Diagnostics : worklog.md Task 5 · `.ai/SECURITY_AUDIT.md` SEC-ADV-002
- Demande PO (conversation, 2026-09-30)
