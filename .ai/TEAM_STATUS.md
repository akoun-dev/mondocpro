# 👥 TEAM_STATUS — Répartition de l'équipe multi-agents

> **Registre de répartition des tâches.** Mis à jour à chaque handoff, à chaque démarrage de tâche et à chaque changement de statut.
> **Légende statuts :** ⏳ En attente · 🔄 En cours · ✅ Terminé · ❌ Bloqué · 🔁 À refaire

**Dernière mise à jour :** 2026-09-30
**Projet :** Next.js 16.1.1 (App Router) + React 19 + TS 5 — **design fondé** (palette médicale ADR-002) ; backlog features en attente PO.

---

## 🟢 BACKEND

| Tâche                                                                                              | Fichiers                                                        | Statut                                                           |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| AUTH-T01 — Schéma Prisma auth (User métier + Session, enums Role/Zone) + seed Dr Kadjane (ADR-004) | prisma/schema.prisma, .zscripts/seed_admin.ts                   | ✅ Terminé (2026-09-30, db push + seed vérifiés)                 |
| AUTH-T02 — Service auth + routes /api/auth/register·login·me·logout (9/9 tests contrats PASS)      | src/lib/auth.ts, src/lib/auth-schemas.ts, src/app/api/auth/\*\* | ✅ Terminé (2026-09-30, revue Tech Lead)                         |
| —                                                                                                  | —                                                               | En attente de prochaine feature (RDV, Tokens, sensibilisations…) |

## 🔵 FRONTEND

| Tâche                                                                                                  | Fichiers                                                                                           | Statut                                                             |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| DESIGN-T01 — Implémentation palette médicale (tokens)                                                  | src/app/globals.css                                                                                | ✅ Terminé (vérifié navigateur + CSS servi)                        |
| AUTH-T03 — Écran auth complet + espace connecté (store zustand + hook useAuth, a11y AA, footer sticky) | src/app/layout.tsx, src/app/page.tsx, src/components/auth/**, src/stores/**, src/hooks/use-auth.ts | ✅ Terminé (2026-09-30, 10/10 étapes agent-browser)                |
| —                                                                                                      | —                                                                                                  | Composants PO (admin/nurses/users) prêts pour les espaces complets |

## 🟣 DEVOPS/DATA

| Tâche                                                                                                                                        | Fichiers                                 | Statut                           |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------- |
| OPS-T01 — Push main → github.com/akoun-dev/Mon doc Pro.git (vérifié 90786c8) + retrait .env/db du suivi                                      | .gitignore, remote origin                | ✅ Terminé (2026-09-30)          |
| DB-T01 — Migration BDD vers Supabase PostgreSQL (diagnostic réseau, région aws-1-eu-west-1, push schéma, roundtrip vérifié, scripts blindés) | prisma/schema.prisma, .env, package.json | ✅ Terminé (2026-09-30, ADR-003) |

## 🔒 SECURITY

| Tâche                                                                                                                                                     | Fichiers          | Statut                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------- |
| SEC-ADV-001/002 — Secrets transmis en clair par le PO (token GitHub, mot de passe DB, service_role) : usage audité, non persisté ; rotations recommandées | SECURITY_AUDIT.md | ✅ Consigné · ⏳ Rotation = action PO |

## 📝 COMMIT

| Tâche                                                                                        | Fichiers                          | Statut                            |
| -------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------- |
| Commits aa26f1f→90786c8 (palette, fix hydratation, registres, untrack .env/db) + push GitHub | voir COMMIT_LOG.md                | ✅ Terminé                        |
| Constat auto-commit plateforme b3c635e (message UUID)                                        | COMMIT_LOG.md, LESSONS_LEARNED.md | ✅ Consigné (hors contrôle agent) |

## 🔍 REVIEWER

| Tâche | Fichiers | Statut                                                              |
| ----- | -------- | ------------------------------------------------------------------- |
| —     | —        | En attente de backlog (système initialisé, aucune feature demandée) |

## 📚 DOC

| Tâche                                                         | Fichiers | Statut                  |
| ------------------------------------------------------------- | -------- | ----------------------- |
| Initialisation des registres de pilotage `.ai/` (30 fichiers) | .ai/\*   | ✅ Terminé (2026-09-30) |

## ♿ A11Y

| Tâche | Fichiers | Statut                                                              |
| ----- | -------- | ------------------------------------------------------------------- |
| —     | —        | En attente de backlog (système initialisé, aucune feature demandée) |

## ⚡ PERF

| Tâche | Fichiers | Statut                                                              |
| ----- | -------- | ------------------------------------------------------------------- |
| —     | —        | En attente de backlog (système initialisé, aucune feature demandée) |

## 🎨 UX/UI

| Tâche                                                                                      | Fichiers                                 | Statut                   |
| ------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------ |
| DESIGN-T01 — Palette médicale : mapping tokens + règles d'usage sémantique + contrastes AA | .ai/DESIGN_SYSTEM.md §1, .ai/ADR/ADR-002 | ✅ Terminé (2026-09-30)  |
| Prochain : wireframes 1re feature (phase 0)                                                | —                                        | ⏳ En attente demande PO |

## 🕵️ AUDIT

| Tâche | Fichiers | Statut                                                              |
| ----- | -------- | ------------------------------------------------------------------- |
| —     | —        | En attente de backlog (système initialisé, aucune feature demandée) |

## 🔴 QA (AGENT 2)

| Tâche | Fichiers | Statut                                                              |
| ----- | -------- | ------------------------------------------------------------------- |
| —     | —        | En attente de backlog (système initialisé, aucune feature demandée) |

---

### Notes de coordination

- L'orchestrateur (CTO) attribue les tâches via les handoffs de `.ai/HANDOFF/` et met à jour ce registre.
- Les changements de statut doivent être répercutés dans `.ai/DAILY_STANDUP.md`.
- Tout blocage est consigné ici (statut ❌) ET dans le standup du jour.
