# 📋 CHANGELOG

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) — versionnage sémantique (SemVer).

## [Non publié]

### Ajouté
- **Mot de passe oublié complet (US-AUTH-5, décision PO 2026-10)** : vues dédiées « Mot de passe oublié » (téléphone → code) et « Nouveau mot de passe » (code 6 chiffres + confirmation) ; API `/api/auth/forgot-password` (anti-énumération : toujours 200) et `/api/auth/reset-password` (code hashé SHA-256, expiration 15 min, usage unique, révocation de toutes les sessions après succès) ; modèle Prisma `PasswordResetToken` ; livraison du code = TODO INT-SMS passerelle SMS (placeholder console serveur, jamais dans la réponse HTTP).
- **Authentification multirôle complète (FEATURE-AUTH, SYS-010, ADR-004)** : inscription/connexion par téléphone (PATIENT/INFIRMIER), sessions serveur en DB (token hashé SHA-256, cookie httpOnly 30 jours), mots de passe bcrypt, zones Yopougon/Songon/PK22/N'Dotré, compte Médecin Chef par seed, erreurs anti-énumération ; écran auth complet (tabs connexion/inscription, sélection zone et rôle, erreurs inline) + espace connecté par rôle + orchestration `page.tsx` (loading/auth/dashboard) ; 4 routes API `/api/auth/*` validées (9/9 tests contrats) ; schéma Prisma `User`/`Session` (+ enums `Role`/`Zone`).
- **Modèle `.env.example` versionné (OPS-T03)** : reproduction facile de la configuration en local — placeholders uniquement (zéro secret, scan avant commit), exception `.gitignore` `!.env.example`, instructions pas-à-pas (`cp .env.example .env` → valeurs Dashboard Supabase → `db:push` → `dev`).
- **Résilience boot (OPS-T02)** : flux custom `.zscripts/dev.sh` — restaure `.env` Supabase écrasé par la plateforme au cold start, puis `bun install` + `db:push` + serveur.
- **Base de données Supabase PostgreSQL (ADR-003)** : provider Prisma `sqlite`→`postgresql`, connexion via pooler Supavisor (IPv4, session mode, région aws-1-eu-west-1), schéma `User`/`Post` synchronisé (vérifié roundtrip `SELECT 1` + REST 200), scripts `db:*` blindés contre l'override d'environnement, clés Supabase en `.env` (non versionné).
- **Palette médicale officielle (ADR-002)** : 9 couleurs définies par le PO implémentées en tokens Tailwind 4 (`globals.css`) — bleu médical `#1565C0`, bleu foncé `#0D47A1`, vert santé `#2EBD85`, vert clair `#E8F8F1`, blanc `#FFFFFF`, gris texte `#263238`, gris clair `#F5F7FA`, rouge urgence `#D32F2F`, orange `#F59E0B`.
- Nouveaux tokens applicatifs : `success`, `success-foreground`, `success-light`, `warning`, `warning-foreground`, `primary-dark` (+ mapping `@theme inline` → classes `bg-success`, `bg-warning`…).
- Séries de graphiques `--chart-1..5` alignées sur la palette.

### Modifié
- **Vues d'authentification dédiées (décision PO 2026-10)** : suppression des onglets Connexion/Inscription au profit de vues pleine page dédiées (Connexion / Inscription / Mot de passe oublié / Nouveau mot de passe) pilotées par machine à états client (`auth-flow.tsx`, route unique `/`), navigation animée AnimatePresence, bouton Retour contextuel, focus a11y sur changement de vue ; liens « Mot de passe oublié ? » et « Créer un compte » sur la vue Connexion.
- **Inscription multi-étapes + rôle Patient par défaut (décision PO 2026-10)** : parcours guidé en 3 étapes (Identité → Zone → Sécurité) avec animations framer-motion sobres (glissement directionnel, fil d'étapes animé bleu médical/vert santé, récapitulatif avant soumission) ; choix de rôle retiré de l'UI — `PATIENT` forcé en triple couche (hook `use-auth`, API `/api/auth/register` ignore toute valeur `role` cliente, schéma zod sans rôle) ; `API_CONTRACTS.md` mis à jour.
- Thème sombre recalculé par nuances dérivées documentées (`DESIGN_SYSTEM.md` §1.4).

### Vérifié
- Contrastes WCAG AA calculés et consignés (texte blanc interdit sur `success`/`warning`) ; tokens contrôlés dans le navigateur (computed styles) et dans le CSS servi ; lint 0 erreur ; page `/` sans erreur (agent-browser).

### Corrigé
- **BUG-001** : faux mismatch d'hydratation sur `<body>` causé par l'injection d'attributs externes (`bis_status`, `__processed_*`) par l'environnement de preview → `suppressHydrationWarning` ajouté sur `<body>` (`src/app/layout.tsx`).

---

## [0.1.0] — Scaffold · 2026-09-30

### Ajouté
- **Système multi-agents de pilotage** : initialisation du dossier `.ai/` (registres de suivi qualité, audits, ADR, specs, handoffs, workflows).
- Registres créés : `TEAM_STATUS`, `CHANGELOG`, `BUGS`, `SEC_BUGS`, `A11Y_BUGS`, `PERF_ISSUES`, `SECURITY_AUDIT`, `INCIDENTS`, `COMMIT_LOG`, `REVIEW_LOG`, `LESSONS_LEARNED`, `DAILY_STANDUP`, `AUDIT_REPORT`, `DEBT_REPORT`, `SYSTEM_COMPLIANCE`, `REGRESSIONS`, `TEST_PLAN`, `WORKFLOWS`.
- Dossiers structurés : `.ai/ADR/` (template + ADR-001), `.ai/AUDITS/`, `.ai/SPECS/` (+ `ARCHIVED/`), `.ai/HANDOFF/` (7 templates).

### Détecté (stack du scaffold — non modifié)
- **Next.js 16.1.1** (App Router, `output: standalone`) + **React 19** + **TypeScript 5**
- **Tailwind CSS 4** + **shadcn/ui** (44 composants dans `src/components/ui`)
- **Prisma 6** + SQLite (`db/custom.db`, modèles scaffold `User`/`Post`)
- **Zod 4**, **Zustand 5**, **TanStack Query 5**, **framer-motion**
- **z-ai-web-dev-sdk** (backend uniquement)
- **Gateway Caddy** : port 81 → 3000, `XTransformPort` pour le routage des mini-services ; exemple websocket dans `examples/`

### État initial vérifié (baseline)
- Lint propre (0 erreur / 0 warning), serveur dev OK (`GET /` → 200), 1 commit git initial (d464483)
- 0 TODO/console.log, 0 bug connu, 0 vulnérabilité connue, 0 incident, 0 feature implémentée

### Connu (dette consignée)
- Voir `.ai/DEBT_REPORT.md` (DET-001 à DET-004, issues de l'analyse du scaffold).

[0.1.0]: #010--scaffold--2026-09-30
