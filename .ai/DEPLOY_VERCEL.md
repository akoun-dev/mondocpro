# Déploiement Vercel — Mon doc Pro

> Guide opérationnel de déploiement production sur Vercel (front + API routes
> Next.js 16) avec base **Supabase PostgreSQL** via Prisma.
> Incident fondateur : `https://mondocpro.vercel.app/` renvoyait
> « Erreur interne — réessayez » à la connexion (2026-10-04).

---

## 1. Résumé express (cause n° 1 des échecs de login)

**`.env` est gitignore — il n'arrive JAMAIS sur Vercel.** Toute l'application
(repères `src/lib/db.ts`, `src/lib/auth.ts`) ne dépend à l'exécution que d'une
seule variable :

| Variable | Obligatoire | Rôle |
|---|---|---|
| `DATABASE_URL` | **OUI** | Connexion PostgreSQL Supabase (via Prisma) |

Les variables `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
`SUPABASE_SERVICE_ROLE_KEY` ne sont utilisées **par aucun code de `src/`**
(l'app parle à la base exclusivement via Prisma) — elles peuvent rester
non configurées. `ADMIN_INITIAL_PASSWORD` ne sert qu'au script de seed local
(`.zscripts/seed_admin.ts`), jamais au runtime.

**Symptôme typique d'une `DATABASE_URL` manquante ou fausse :**
- la page d'accueil s'affiche (build OK) ;
- `/api/health` renvoie 200 avec `{"status":"degraded","database":"down"}` ;
- login/register/… renvoient 500 « Erreur interne — réessayez »
  (message générique du `catch` de `src/app/api/auth/login/route.ts` —
  volontaire, aucune fuite d'information).

**Diagnostic sans accès aux logs :** ouvrir
`https://<votre-app>.vercel.app/api/health` — le bloc `diagnostic` indique si
la variable est absente (`hasDatabaseUrl: false`) ou si la base est
injoignable (`dbErrorCode: "P1001"`, etc.) avec un hint de correction.

---

## 2. Procédure de configuration des variables sur Vercel

1. Ouvrir **Vercel → projet `mondocpro` → Settings → Environment Variables**.
2. Ajouter `DATABASE_URL` pour les environnements **Production** **et**
   **Preview** (et Development si utilisé) avec l'une des deux formes
   ci-dessous (Section 3).
3. **Redéployer** (Deployments → ⋯ → Redeploy) : les variables ne sont
   injectées qu'au build/démarrage suivant.
4. Vérifier `https://<votre-app>.vercel.app/api/health` →
   `{"status":"ok","database":"up", ...}`.
5. Se connecter avec un compte de test (ex. patient `+2250709229992` /
   `TestPatient2026!`).

> Les secrets ne doivent jamais être commités (politique `.ai/SECURITY_AUDIT.md`,
> SEC-ADV-001/002). Le mot de passe DB se réinitialise dans
> Supabase → Settings → Database si perdu.

---

## 3. Choix de la chaîne de connexion (Supabase × serverless)

Vercel exécute les API routes en fonctions serverless **IPv4 uniquement**.
Utiliser le **pooler Supavisor** (jamais le host direct
`db.<ref>.supabase.co`, IPv6-only sans add-on) :

### Option A — Session mode (port 5432) — identique au local

```
postgresql://postgres.<PROJECT_REF>:<MOT_DE_PASSE_DB>@aws-<N>-<REGION>.pooler.supabase.com:5432/postgres?sslmode=require
```

- Connexions persistantes par instance de fonction ; parfait pour démarrer.
- C'est la forme du `.env` local (host `aws-0-eu-west-1.pooler.supabase.com`
  pour ce projet) — copier la valeur de `.env` **en retirant le préfixe
  `DATABASE_URL="` et le `"` final**.

### Option B — Transaction mode (port 6543) — recommandé serverless

```
postgresql://postgres.<PROJECT_REF>:<MOT_DE_PASSE_DB>@aws-<N>-<REGION>.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1
```

- `pgbouncer=true` : Prisma désactive les prepared statements (obligatoire
  derrière un pooler en transaction mode).
- `connection_limit=1` par instance : évite d'épuiser le pool Supavisor quand
  les fonctions scalent.

Les deux options sont IPv4-compatibles et acceptées par Prisma. En cas de
doute, commencer par l'option A (même chaîne que le local, déjà validée).

### Génération du client Prisma sur Vercel

- Le schéma vit dans `supabase/schema.prisma` (demande PO 2026-10-03) ; la CLI
  le localise via `prisma.config.ts` **commité** — `prisma generate` fonctionne
  tel quel dans l'environnement de build Vercel.
- Ceinture de sécurité : `package.json` déclare
  `"postinstall": "prisma generate"` → le client est toujours régénéré après
  l'installation, quel que soit le gestionnaire détecté (npm/bun).
- ⚠️ Ne jamais lancer `prisma migrate` / `prisma db push` en build Vercel : le
  schéma de la base est piloté par les migrations Supabase versionnées
  (`supabase/migrations/`, ADR-003 / SYS-009), appliquées depuis l'environnement
  de développement (`bun run db:migrate-deploy`).

---

## 4. Dépannage (table de correspondance de `/api/health`)

| Symptôme (`/api/health`) | Cause probable | Correction |
|---|---|---|
| `diagnostic.hasDatabaseUrl: false` | `DATABASE_URL` non définie sur Vercel | Section 2 → ajouter la variable → Redeploy |
| `dbErrorCode: "P1001"` | Host/port/région du pooler erronés, base en pause | Vérifier la chaîne (Supabase → Connect → Connection pooling) ; réveiller le projet |
| `dbErrorCode: "P1010"` ou `28P01` | Mot de passe DB faux / allowlist IP active | Réinitialiser le mot de passe (Settings → Database) ; vérifier Network restrictions Supabase |
| `dbErrorCode: "P2021"` / `42P01` | Base vierge : migrations non appliquées | Depuis le local : `bun run db:migrate-deploy` (+ seeds `.zscripts/`) |
| `database: "up"` mais login 500 | Regarder `dbErrorCode` du login dans les **logs Vercel** (Dashboard → Deployments → Functions) | Suivre le code ; vérifier la table `Session` (migrations) |

### Points de contrôle secondaires

- **Cookies de session en production** : sur tout host non-localhost, le
  serveur pose `SameSite=None; Secure; Partitioned` (CHIPS) — correct en HTTPS
  Vercel ; ne rien modifier sans relire `sessionCookieOptions()`
  (`src/lib/auth.ts`).
- **Build** : `next build && cp -r .next/static .next/standalone/.next/ && cp
  -r public .next/standalone/` — le `output: "standalone"` est inoffensif sur
  Vercel ; ne pas « simplifier » le `cp` (utilisé par le `start` local).
- **Lockfiles** : le dépôt contient `bun.lock` ET `package-lock.json` ; Vercel
  en déduit son gestionnaire. En cas de build incohérent, supprimer
  `package-lock.json` (le projet est développé sous bun) ou forcer le package
  manager dans Settings → General → Build & Development Settings.

---

## 5. Checklist de mise en production

- [ ] `DATABASE_URL` définie sur Vercel (Production + Preview)
- [ ] Redeploy déclenché après ajout des variables
- [ ] `/api/health` → `status: "ok"`, `database: "up"`
- [ ] Login patient de test effectif (compte `+2250709229992`)
- [ ] Migrations Supabase appliquées sur la base de prod (une seule fois, depuis le local)
- [ ] Seeds métier appliqués si base vierge (spécialités, sensibilisations)
- [ ] Aucun secret versionné (`.env` ignoré, audit `rg "postgresql://" .ai/`)
