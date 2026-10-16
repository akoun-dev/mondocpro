# ADR-011 — Connexion base en serverless : pooler de transaction Supabase (6543) + normalisation par le code

> Architecture Decision Record. Un ADR = **une** décision structurante, immuable une fois acceptée (si elle change, un nouvel ADR la déprécie).
> **Périmètre** : infrastructure de données — connexion Prisma/PostgreSQL depuis les fonctions serverless Vercel (impacte TOUTES les routes API).
> **Amende** : ADR-001 (stack) — Prisma 6 conservé ; précise le paramétrage de connexion requis par le déploiement serverless.

## Statut
`Accepté` — incident production 2026-10-06 : wallet patient et RDV en erreur 500 intermittents puis persistants chez le PO (« la vue wallet ne charge pas correctement, token indisponible sur l'accueil »).

## Date
2026-10-06

## Contexte
La chaîne `DATABASE_URL` (copiée du `.env` du projet vers les variables Vercel) vise le **pooler de SESSION Supabase** (`aws-0-eu-west-1.pooler.supabase.com:5432`). En mode session, chaque client Prisma ouvre des connexions **dédiées** que l'instance garde tant qu'elle reste chaude. Sur Vercel, chaque instance de fonction en retient plusieurs (défaut Prisma ≈ CPU×2+1) et les instances chaudes s'accumulent : le plafond du pooler de session de ce projet (**pool_size 15**) finit saturé — preuve capturée en diagnostic :

```
FATAL: (EMAXCONNSESSION) max clients reached in session mode
       - max clients are limited to pool_size: 15
```

Symptômes observés (mondocpro.vercel.app, compte patient de test) :
- `GET /api/wallet` **500** depuis le navigateur, `200` via curl quelques minutes plus tôt — puis **tous** les appels en 500 (curl et navigateur), `GET /api/appointments` 500 également, `/api/sensibilisations` 200 : dégradation qui « flotte » selon la disponibilité d'une connexion ;
- l'UI patient affiche alors « Solde indisponible » sur l'accueil et la vue Wallet en erreur — les états d'erreur sont conformes, la cause est côté base ;
- le serveur dev (sessions déjà établies avant saturation) continuait de fonctionner : le bug était **invisible en local, bloquant en production**.

Aggravant : `getWalletForPatient` lançait **6 agrégats parallèles + 1 findMany** (7 connexions sollicitées simultanément par requête) — le pire consommateur du pool au moment précis où il est rare.

Le pooler de **transaction** Supabase (port **6543**) est la voie officielle pour les déploiements serverless : il multiplexe de très nombreux clients sur un petit nombre de connexions serveur. Contrepartie documentée : Prisma doit y désactiver son cache de statements préparés (`pgbouncer=true`), sinon erreurs aléatoires « prepared statement already exists ».

## Décision
1. **Normalisation par le code (`src/lib/db.ts`, export `serverlessSafeDatasourceUrl`)** : en production (`NODE_ENV=production`), toute chaîne visant `*.pooler.supabase.com:5432` est **réécrite à l'exécution** vers `:6543` avec `pgbouncer=true&connection_limit=1&pool_timeout=20` (une connexion par instance — montage recommandé Supabase × Vercel). La réécriture est **idempotente** (une variable déjà en 6543 est intacte) et **sans effet en dev** (serveur longue durée : le pooler de session reste le bon choix, aucune régression locale). Le PO peut aussi fixer directement la variable Vercel en 6543 — le code restera compatible.
2. **Wallet en un seul aller-retour (`src/lib/tokens.ts`, `getWalletForPatient`)** : les 6 agrégats parallèles + findMany deviennent **une `$transaction` batchée** — un `groupBy type×status` (les six familles de mouvements), un agrégat pour le blocage RDV actifs (filtre relation `tokenState=RESERVED`), le findMany du ledger — soit **une connexion, un aller-retour, un snapshot cohérent**. La formule de solde est strictement inchangée (`computeBalance` demeure la source unique pour la réservation RDV) ; équivalence prouvée sur données réelles (191 / 5 / 16 · 40 000 FCFA, 50 mouvements).
3. **Relance client unique** (`use-patient-data.ts`, `wallet-section.tsx`) : le fetch wallet est rejoué **une fois** après 700 ms — un échec isolé (réseau mobile, redéploiement) n'affiche plus « Solde indisponible » / vue en erreur.

## Conséquences
- **Positives** : production insensible à la saturation du pooler de session ; consommation de connexions par instance bornée à 1 ; wallet en 1 requête batchée ; dev inchangé ; aucune migration, aucune variable d'environnement à modifier pour rétablir le service.
- **Négatives / assumées** : statements préparés désactivés en production (léger surcoût de planification PostgreSQL, invisible à notre échelle) ; la transaction sérialisable de création de RDV transite par le pooler de transaction — validé par test ( Supavisor épingle le client pendant une transaction explicite, timeout 15 s conservé).
- **Backlog PO** : mettre à jour la variable Vercel `DATABASE_URL` vers le port 6543 avec les paramètres ci-dessus (le code rend ce changement optionnel) ; `scripts/e2e-tokens.sh` est **devenu obsolète** depuis l'évolution des onglets (Wallet dédié, sidebar admin complète) — baseline déjà rouge avant ce lot (45/14), à réécrire sur les deep links `?tab=`.

## Validation
- Unitaires : `scripts/check-datasource-url.ts` — 11 vérifications (réécriture prod, dev intact, idempotence, base directe intacte, cas dégénérés).
- Service sur 6543 (`scripts/check-wallet-6543.ts`) : équivalence stricte refacto ↔ `computeBalance`, 3 appels consécutifs stables (zéro erreur de statement).
- Audits non-régression : 23/23 (nurse-profile), 47/47 (admin-notifications), 17/17 (device-key-poll) ; lint 0 ; tsc src 0.
- Production post-déploiement : `/api/wallet` et `/api/appointments` en série de 200 (voir worklog Task 48).
