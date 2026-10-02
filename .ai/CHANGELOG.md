# 📋 CHANGELOG

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) — versionnage sémantique (SemVer).

## [Non publié]

### Ajouté
- **Auto-réparation boot SYS-010** : `dev.sh` détecte la perte de `.zscripts/.env.supabase` (les rebuilds conteneur ne restaurent que les fichiers versionnés — constaté 2026-10-03) et la reconstruit via `scripts/find-pooler-region.mjs --write-env`, qui redécouvre la région active du pooler Supavisor par auth Prisma réelle (flotte aws-0 testée en premier après migration aws-1 → aws-0) puis réécrit `.env` + backup ; `bun install` déplacé avant la restauration d'env (le fallback a besoin de bunx/prisma) ; `cat` de restauration blindé (`|| true`, plus de `set -e` mortel au boot) ; chaîne vérifiée de bout en bout (suppression simulée → auto-réparation → migrations → HTTP 200).
- **Mot de passe oublié complet (US-AUTH-5, décision PO 2026-10)** : vues dédiées « Mot de passe oublié » (téléphone → code) et « Nouveau mot de passe » (code 6 chiffres + confirmation) ; API `/api/auth/forgot-password` (anti-énumération : toujours 200) et `/api/auth/reset-password` (code hashé SHA-256, expiration 15 min, usage unique, révocation de toutes les sessions après succès) ; modèle Prisma `PasswordResetToken` ; livraison du code = TODO INT-SMS passerelle SMS (placeholder console serveur, jamais dans la réponse HTTP).
- **Authentification multirôle complète (FEATURE-AUTH, SYS-010, ADR-004)** : inscription/connexion par téléphone (PATIENT/INFIRMIER), sessions serveur en DB (token hashé SHA-256, cookie httpOnly 30 jours), mots de passe bcrypt, zones Yopougon/Songon/PK22/N'Dotré, compte Médecin Chef par seed, erreurs anti-énumération ; écran auth complet (tabs connexion/inscription, sélection zone et rôle, erreurs inline) + espace connecté par rôle + orchestration `page.tsx` (loading/auth/dashboard) ; 4 routes API `/api/auth/*` validées (9/9 tests contrats) ; schéma Prisma `User`/`Session` (+ enums `Role`/`Zone`).
- **Modèle `.env.example` versionné (OPS-T03)** : reproduction facile de la configuration en local — placeholders uniquement (zéro secret, scan avant commit), exception `.gitignore` `!.env.example`, instructions pas-à-pas (`cp .env.example .env` → valeurs Dashboard Supabase → `db:push` → `dev`).
- **Résilience boot (OPS-T02)** : flux custom `.zscripts/dev.sh` — restaure `.env` Supabase écrasé par la plateforme au cold start, puis `bun install` + `db:push` + serveur.
- **Base de données Supabase PostgreSQL (ADR-003)** : provider Prisma `sqlite`→`postgresql`, connexion via pooler Supavisor (IPv4, session mode, région aws-1-eu-west-1), schéma `User`/`Post` synchronisé (vérifié roundtrip `SELECT 1` + REST 200), scripts `db:*` blindés contre l'override d'environnement, clés Supabase en `.env` (non versionné).
- **Palette médicale officielle (ADR-002)** : 9 couleurs définies par le PO implémentées en tokens Tailwind 4 (`globals.css`) — bleu médical `#1565C0`, bleu foncé `#0D47A1`, vert santé `#2EBD85`, vert clair `#E8F8F1`, blanc `#FFFFFF`, gris texte `#263238`, gris clair `#F5F7FA`, rouge urgence `#D32F2F`, orange `#F59E0B`.
- Nouveaux tokens applicatifs : `success`, `success-foreground`, `success-light`, `warning`, `warning-foreground`, `primary-dark` (+ mapping `@theme inline` → classes `bg-success`, `bg-warning`…).
- Séries de graphiques `--chart-1..5` alignées sur la palette.

### Modifié
- **Mot de passe oublié — indicatif +225 fixe (demande PO 2026-10)** : champ Téléphone de la vue « Mot de passe oublié » aligné sur la Connexion — bloc préfixe drapeau CI + `+225` (composant partagé `ci-flag.tsx`), saisie du numéro local uniquement (10 chiffres, sanitisation chiffres/espaces), label capitales, numéro normalisé `toInternationalPhone` avant validation/API (format `+225XXXXXXXXXX` inchangé, contrat intact) ; vérifié E2E desktop + mobile (transition vers « Nouveau mot de passe », bandeau affiche `+225 07 01 02 03 99`).
- **Inscription étape 2 — design demandé par le PO (2026-10)** : section « Localisation sanitaire » (overline bleu + « Où résidez-vous à Abidjan ? » + contexte médecins de garde/cliniques/officines), champ de recherche de zone fonctionnel (filtre local insensible casse/accents sur libellé/quartier, suffixe CI, état vide), cartes zones enrichies (pastille pin, quartier indicatif : Abidjan Ouest / Route Dabou / Zone industrielle / Abobo Nord, badge « Recommandé » sur Yopougon, indicateur radio+check en coin) ; stepper global : étapes terminées en vert santé avec check (ADR-002), segments verts ; étape « Commune » renommée « Zone » (libellé maquette).
- **Inscription étape 1 — design demandé par le PO (2026-10)** : en-tête « Retour » + badge « Accès Patient », fil d'étapes iconé avec libellés sous les pastilles (Identité / Commune / Sécurité) et fil bleu médical, bloc « Étape N sur 3 » avec pourcentage, champs Nom complet (icône) et Numéro de téléphone avec indicatif **+225 fixe** (drapeau CI en CSS) + aide SMS ; étape « Zone » renommée « Commune » ; numéro normalisé `+225` + 10 chiffres avant validation/API (format stocké inchangé, contrat API intact).
- **Refonte UI — design auth premium + espace connecté app mobile (demande PO 2026-10)** : écran d'auth recentré sur dégradé médical plein écran (logo flottant, carte verre dépoli `rounded-3xl` + `backdrop-blur`, motif « plus » médical discret, pastilles de verre des arguments de vente, badges zones) ; espace connecté réorganisé en style application native — barre d'app sticky verre dépoli, navigation basse flottante (Accueil / Profil) avec safe-area iOS, hero de bienvenue en dégradé (date, badges rôle/zone), profil en grille de tuiles icônes, cartes fonctionnalités par rôle avec badges « Bientôt disponible » ; état de chargement brandé. Palette ADR-002 inchangée, contrastes AA vérifiés (texte blanc réservé aux surfaces primary/primary-dark), animations sobres 220–250 ms (DESIGN_SYSTEM §4).
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
