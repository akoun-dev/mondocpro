# 📋 CHANGELOG

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) — versionnage sémantique (SemVer).

## [Non publié]

_Rien de prévu à ce stade. Les modifications non publiées sont documentées ici dès leur validation._

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
