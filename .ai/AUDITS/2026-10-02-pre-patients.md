# AUDIT — Pré-fonctionnalités patients (2026-10-02)

**Déclencheur** : demande PO « Passons aux fonctionnalités patients mais fais un audit avant ».
**Périmètre** : gouvernance, code, base de données, sécurité, UI, qualité. Aucune modification métier.

## Verdict global : 🟢 PRÊT pour FEATURE-PATIENT (aucun blocage)

## 1. Gouvernance (.ai/)

| Élément | État | Note |
|---|---|---|
| TASKS.md / TASKS.xlsx | ✅ à jour | SYS/DESIGN/BUG/OPS/DB/AUTH-T01..T04 TERMINÉ avec preuves |
| API_CONTRACTS.md | ✅ à jour | 6 contrats auth VALIDÉ + conventions (enveloppe `{error}`, zod obligatoire) |
| CHANGELOG.md | ✅ à jour | refonte UI v4 consignée |
| REQUIREMENTS.md | ⚠️ backlog vide | les 3 features patients ne sont pas encore formalisées (REQ-XXX à créer) |
| DEBT_REPORT.md | ⚠️ partiellement obsolète | DET-001/DET-002 résolues de facto (page réécrite, modèle Post supprimé) — correction appliquée lors de cet audit |
| ADR 001–004 | ✅ | stack, palette, Supabase, auth |

## 2. Code produit (src/)

- **Route unique `/`** + 6 routes API auth (`register, login, me, logout, forgot-password, reset-password`) — conformes aux contrats.
- **0 TODO / FIXME / console.log** dans `src/` hors `TODO INT-SMS` documenté (forgot-password, livraison SMS = passerelle à brancher).
- **tsc --noEmit : 0 erreur dans src/** (erreurs restantes confinées à `examples/`, `skills/`, `scripts/` — hors produit).
- **ESLint : 0 erreur / 0 warning.**
- Composants vides `admin/nurses/users/page.tsx` (placeholders PO) — intacts, à alimenter plus tard.
- DET-004 (`ignoreBuildErrors: true`) toujours ouvert (MAJEUR) : à désactiver quand le domaine stabilise.

## 3. Base de données réelle (Supabase — lecture seule)

| Table | Lignes | Observation |
|---|---|---|
| users | 2 | 1 ADMIN (Dr Kadjane, seed) + 1 PATIENT (test) |
| sessions | 3 | 0 expirées — cookie 30 j |
| password_reset_tokens | 0 | purge fonctionnelle OK |
| **metier patient** | **—** | **aucune table RDV / Tokens / Sensibilisations** |

⚠️ **SYS-009** : migrations Prisma versionnées inexistantes (`db:push` direct) — **obligatoire avant PROD**, recommandé dès FEATURE-PATIENT (`prisma migrate dev` pour créer les tables métier avec historique).

## 4. Sécurité (héritée de FEATURE-AUTH, auditée AUTH-T04)

- bcrypt 10 rounds · sessions hashées SHA-256 en DB · cookies httpOnly 30 j.
- Anti-énumération (login 401 générique, forgot toujours 200, reset 400 générique).
- ADMIN par seed uniquement (pas d'auto-inscription) — conforme ADR-004.
- Ouvert : INT-SMS (livraison réelle des codes) — action PO, passerelle Orange CI / MTN CI.

## 5. UI/UX

- Auth v4 premium (dégradé ADR-002, verre dépoli) + dashboard app mobile (bottom nav Accueil/Profil).
- Vérifié E2E agent-browser (1440 px + 390 px) : 0 erreur console ; lint 0 erreur.
- L'espace Patient affiche 3 cartes « Bientôt disponible » : RDV, Épargne, Sensibilisations — **c'est la cible du prochain lot**.

## 6. Écart → fonctionnalités patients

| Feature | Modèle | API | UI | État |
|---|---|---|---|---|
| FEATURE-RDV (rendez-vous cabinet/domicile) | ✗ | ✗ | ✗ (placeholder) | à construire |
| FEATURE-TOKENS (épargne santé) | ✗ | ✗ | ✗ (placeholder) | à construire — dépend paiement Mobile Money (à arbitrer) |
| FEATURE-SENSO (sensibilisations) | ✗ | ✗ | ✗ (placeholder) | à construire (quick win) |

## 7. Recommandations d'exécution

1. **Ordre de valeur conseillé** : RDV (cœur métier) → Sensibilisations (quick win, contenu seedé) → Tokens (arbitrage paiement requis).
2. **API-first** (règle gouvernance) : contracts `API_CONTRACTS.md` validés AVANT le frontend.
3. **Migrations versionnées** dès le premier modèle métier (SYS-009).
4. Requis REQ-XXX + entrées TASKS.md avant code (traçabilité).
