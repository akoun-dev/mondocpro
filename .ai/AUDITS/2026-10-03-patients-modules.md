# AUDIT — Fonctionnalités patients : Rendez-vous / Épargne Tokens / Sensibilisations (2026-10-03)

**Déclencheur** : demande PO — « On peut passer à l'audit des fonctionnalités patients (Rendez-vous / Épargne Tokens / Sensibilisations) avant leur développement ».
**Périmètre** : les 3 modules patients **+ prérequis transverses** (modèles Prisma, migrations versionnées, passerelle SMS, notifications, garde API rôles, contrats API, gouvernance). Aucune modification de code.
**Méthode** : revue documentaire (`.ai/**`), revue de code (`src/`, `prisma/schema.prisma`, `package.json`), recoupement avec l'audit pré-patients du 2026-10-02 (`2026-10-02-pre-patients.md`).
**Nature** : audit ciblé fonctionnalités (même famille que le pré-audit) — ce n'est **pas** un audit global scoré `AUDIT-XXX` (cf. `AUDITS/README.md`).

---

## Verdict global : 🟢 PRÊT à démarrer — 4 arbitrages PO à trancher, aucun blocage technique

La base (auth, sessions, rôles, zones, design system, gouvernance) est solide et conforme.
Les 3 modules partent de zéro (aucun modèle, aucune API, aucune spec) mais toutes les
fondations pour les construire existent déjà. Le développement peut commencer dès que les
contrats API sont validés (règle API-first) — le lot de fondations est chiffré S.

---

## 1. État des lieux vérifié (preuves au 2026-10-03)

| Élément | État vérifié | Preuve |
|---|---|---|
| Auth complète | ✅ 6 routes API (`register, login, me, logout, forgot-password, reset-password`) conformes aux contrats | `src/app/api/auth/**`, `API_CONTRACTS.md` |
| Modèles Prisma | ✅ `User`, `Session`, `PasswordResetToken` — **aucune table métier** | `prisma/schema.prisma` (69 lignes) |
| Espace Patient UI | ✅ 3 cartes placeholder « Bientôt disponible » : Rendez-vous, Épargne santé, Sensibilisations | `src/components/auth/user-dashboard.tsx` (ROLE_SPACE.PATIENT) |
| Composants INFIRMIER/ADMIN | ⏳ placeholders vides (0 ligne) — hors périmètre de ce lot | `src/components/admin|nurses|users/page.tsx` |
| Lint / qualité | ✅ `bun run lint` 0 erreur ; 0 TODO/FIXME hors `TODO INT-SMS` documenté | lint du jour, pré-audit §2 |
| BDD réelle | ✅ users (2) / sessions / password_reset_tokens — tables métier absentes | pré-audit §3 (lecture Supabase) |

### Découvertes nouvelles (non présentes au pré-audit)

1. ⚠️ **`/api/health` contracté mais non implémenté** : `API_CONTRACTS.md` porte un contrat
   `[GET] /api/health` statut **VALIDÉ**, mais `src/app/api/route.ts` retourne toujours le
   scaffold `{ message: "Hello, world!" }` et aucun dossier `src/app/api/health/` n'existe.
   → Écart contrat↔code à corriger dans le lot P0 (10 min : route dédiée ou correction du contrat).
2. ⚠️ **Aucune migration versionnée** : `prisma/migrations/` n'existe pas, le projet vit en
   `db:push` direct. SYS-009 et le pré-audit exigent `prisma migrate dev` dès les premières
   tables métier. → Bascule obligatoire en ouverture du lot P0 (avant tout nouveau modèle).
3. ⚠️ **Garde API non factorisée** : `src/lib/auth.ts` expose `getCurrentUser()` (retourne
   `PublicUser` avec `role`) mais aucun helper `requireRole()` n'existe — chaque route refait
   sa garde à la main. → À factoriser avant d'exposer des endpoints métier patients.

---

## 2. Module par module — écarts spec ↔ code

### 2.1 FEATURE-RDV — Rendez-vous (cabinet / domicile)

| Dimension | État |
|---|---|
| Source de besoin | Carte dashboard : « Au cabinet ou à domicile, planifiez vos consultations. » — **aucune spec formelle** |
| Modèle Prisma | ✗ absent |
| Contrat API | ✗ absent |
| UI | ✗ placeholder « Bientôt disponible » |
| Seed / démo | ✗ |

**Contenu MVP proposé** (à valider en spec) : modèle `Appointment` (patient, type
`CABINET|DOMICILE`, zone, créneau `scheduledAt`, statut `PENDING|CONFIRMED|CANCELLED|DONE`,
motif, horodatages) + contrôle de collision côté service ; UI réservation guidée, liste
« Mes rendez-vous » avec états (attente = `warning`, confirmé = `success`, annulé),
annulation par le patient.

**Dépendances** : zones (déjà en DB ✓) ; rappels SMS (différable → P2) ; dispatch infirmier
(feature ultérieure, hors MVP — mais le schéma doit rester compatible).

**Effort : M** (hors SMS). **Arbitrages PO requis** : règles de créneaux (horaires,
durée), qui valide/confirmé le RDV, délai minimal d'annulation.

### 2.2 FEATURE-TOKENS — Épargne santé

| Dimension | État |
|---|---|
| Source de besoin | Carte dashboard : « Constituez votre épargne en Tokens, à votre rythme. » |
| Modèle Prisma | ✗ absent |
| Contrat API | ✗ absent |
| UI | ✗ placeholder |
| Paiement | ✗ **dépendance externe non arbitrée** (Mobile Money) |

**Contenu MVP proposé** : `TokenAccount` (1 par patient) + `TokenTransaction` en
**ledger immuable** (`DEPOSIT|DEBIT|REFUND`, montant, motif, référence, horodatage) — le
solde se calcule depuis le ledger ; UI solde + historique.

**Risque bloquant** : le paiement Mobile Money (Wave / Orange Money / MTN MoMo) n'est pas
arbitré → nécessitera un ADR. **Mitigation proposée** : phase 1 sans paiement réel
(recharges créditées manuellement par l'ADMIN / hors ligne), phase 2 brancher la passerelle.

**Effort : M** (ledger + crédit manuel) · **+L** (passerelle paiement). **Arbitrages PO** :
valeur d'usage d'un token (1 token = ? FCFA / = 1 consultation ?), plafonds, remboursement.

### 2.3 FEATURE-SENSO — Sensibilisations

| Dimension | État |
|---|---|
| Source de besoin | Carte dashboard : « Recevez des conseils et alertes santé fiables. » |
| Modèle Prisma | ✗ absent |
| Contrat API | ✗ absent |
| UI | ✗ placeholder |
| Dépendances externes | **aucune** → quick win |

**Contenu MVP proposé** : modèle `Sensibilisation` (titre, corps, catégorie
`CONSEIL|ALERTE`, zones cibles — null = toutes, publiée par l'ADMIN, `publishedAt`) ;
API de lecture (liste filtrée par zone du patient + détail) ; UI fil de cartes avec badge
« Alerte » (`destructive`) / « Conseil » (`success-light`), indicateur « Nouveau » ;
**seed éditorial initial** (4–6 contenus réalistes paludisme/hygiène/vaccination).

**Effort : S**. **Arbitrages PO** : qui rédige (ADMIN uniquement ?), ciblage par zone,
alertes push (plus tard, P2).

---

## 3. Transverse — prérequis et écarts

| Sujet | État | Action requise | Référence |
|---|---|---|---|
| Migrations versionnées | ✗ (`db:push` direct) | Bascule `prisma migrate dev` avant le 1er modèle métier | SYS-009, pré-audit §3 |
| Garde API rôles | ⚠️ partiel (`getCurrentUser`) | Helper `requireRole(roles)` factorisé dans `src/lib/auth.ts` | ARCHITECTURE §2-§3 |
| Contrats API patients | ✗ (table « à venir » vide) | Rédiger + VALIDER ici AVANT tout front | Règle API-first |
| Exigences REQ-XXX | ✗ (backlog vide) | Créer REQ-001..003 (une par module) | REQUIREMENTS.md |
| Spec fonctionnelle | ✗ (seul `SPEC-AUTH.md` existe) | `.ai/SPECS/FEATURE-PATIENT.md` (ou 3 specs) avec chemin doré | Workflow 1, phases 0-1 |
| Plan de tests | ✗ scénarios patients absents | Scénarios E2E par module dans TEST_PLAN.md | Workflow 1, phase 1 |
| INT-SMS | ⚠️ placeholder console (codes reset) | Interface injectable `sms-service` + passerelle réelle (compte PO requis) | TODO US-AUTH-5 |
| Notifications temps réel | ✗ | P2 uniquement : mini-service socket.io (SYS-005) — **pas dans le MVP** | SYS-005 |
| `/api/health` | ⚠️ contracté VALIDÉ, code = hello world | Implémenter la sonde (ou corriger le contrat) | API_CONTRACTS.md |
| Seeds | ⚠️ seed ADMIN seul | Seed éditorial sensibilisations (+ éventuel jeu démo RDV) | `.zscripts/seed_admin.ts` (modèle) |
| DET-004 (`ignoreBuildErrors`) | ⚠️ ouvert | Non bloquant pour ce lot ; à traiter quand le domaine stabilise | DEBT_REPORT.md |

---

## 4. Contrats API à rédiger (liste indicative — rédaction en phase 2, validation PO)

| Endpoint | Rôle | Priorité |
|---|---|---|
| `[GET] /api/appointments` | Mes rendez-vous (tri à venir/passés) | P1 |
| `[POST] /api/appointments` | Créer un RDV (type, zone, créneau, motif) | P1 |
| `[PATCH] /api/appointments/:id` | Annuler / modifier | P1 |
| `[GET] /api/sensibilisations` | Fil ciblé zone du patient | P1 |
| `[GET] /api/sensibilisations/:id` | Détail d'un contenu | P1 |
| `[GET] /api/tokens` | Solde + historique (ledger) | P2 |
| `[POST] /api/tokens/topup` | Recharge (phase 2 : paiement Mobile Money) | P2 |
| `[GET] /api/health` | Sonde de vie (déjà contractée — à implémenter) | P0 |

---

## 5. Risques et mitigations

| # | Risque | Impact | Mitigation |
|---|---|---|---|
| R1 | Paiement Mobile Money non arbitré | Bloque FEATURE-TOKENS phase 2 | MVP en 2 phases : ledger + crédit manuel ADMIN d'abord ; ADR-005 paiement quand arbitrée |
| R2 | Passerelle SMS non provisionnée | Codes reset en console, pas de rappels RDV | Interface `sms-service` injectable dès maintenant ; rappels RDV en P2 |
| R3 | Absence de migrations versionnées | Drift BDD, rollback impossible | Bascule `prisma migrate dev` en tête du lot P0 (obligatoire SYS-009) |
| R4 | Route unique `/` (SYS-001) | Complexité UI croissante | Réutiliser le pattern à états client éprouvé (`auth-flow`) ; bottom nav extensible |
| R5 | Surbooking RDV (créneaux non définis) | Double réservation | Contrôle de collision côté service + créneaux par défaut configurables |

---

## 6. Efforts estimés

Barème : **S** ≤ 1 j · **M** ≈ 2-4 j · **L** ≥ 5 j (lot complet : schéma + API + UI + tests + revue).

| Lot | Effort | Remarque |
|---|---|---|
| P0 — Fondations (migrations, `requireRole`, `/api/health`, REQ + spec + contrats + TEST_PLAN) | **S–M** | prérequis à tout le reste |
| P1 — FEATURE-RDV (MVP sans SMS) | **M** | cœur métier, valeur PO maximale |
| P1 — FEATURE-SENSO (MVP + seed) | **S** | quick win, zéro dépendance |
| P2 — FEATURE-TOKENS phase 1 (ledger + crédit manuel) | **M** | démarre sans attendre le paiement |
| P2 — FEATURE-TOKENS phase 2 (paiement Mobile Money) | **L** | après ADR-005 + compte marchand |
| P2 — INT-SMS + rappels RDV | **M** | compte passerelle requis (Orange CI / MTN CI) |
| P2 — Notifications temps réel (socket.io) | **L** | SYS-005, à arbitrer séparément |

---

## 7. Roadmap proposée (P0 / P1 / P2)

```
P0  Fondations        : /api/health · requireRole · migrations versionnées
                        REQ-001..003 + SPEC + contrats VALIDÉS + TEST_PLAN
P1  FEATURE-RDV       : réservation cabinet/domicile + mes rendez-vous + annulation   (M)
P1  FEATURE-SENSO     : fil de sensibilisations + seed éditorial                      (S)
                        → parallélisable avec RDV, ou AVANT si l'arbitrage
                          des créneaux RDV traîne (quick win immédiat)
P2  FEATURE-TOKENS-1  : ledger + solde + crédit manuel ADMIN                          (M)
P2  FEATURE-TOKENS-2  : paiement Mobile Money (après ADR-005)                         (L)
P2  INT-SMS           : passerelle réelle + rappels RDV + alertes SENSO               (M)
P2  Temps réel        : notifications socket.io                                       (L)
```

**Ordre de développement conseillé** : P0 → RDV → SENSO → TOKENS-1, en gardant
TOKENS-2 / SMS / temps réel pour après (chacun dépend d'un arbitrage ou d'un compte externe).
Cet ordre prolonge la recommandation du pré-audit (RDV = cœur métier, SENSO = quick win,
TOKENS = arbitrage requis) en la rendant exécutable lot par lot.

**Règles de gouvernance à respecter à chaque lot** (Workflow 1) : phase 0-2 d'abord
(conception UX, spec, contrats), API-first, commits conventionnels, E2E agent-browser
desktop + mobile, registres (.ai/) mis à jour avant push.

---

## 8. Décisions attendues du PO

1. **RDV** : horaires/créneaux par défaut ? qui confirme un RDV (Médecin Chef seul ?) ?
   délai minimal d'annulation ?
2. **Tokens** : 1 token = quelle valeur (FCFA / consultation) ? les tokens serviront-ils à
   payer des RDV ? plafonds de recharge ?
3. **Sensibilisations** : rédaction réservée à l'ADMIN ? ciblage par zone dès le MVP ?
4. **Paiement Mobile Money** : fournisseur cible (Wave / Orange Money / MTN MoMo / agrégateur)
   → déclenchera l'ADR-005.
5. **INT-SMS** : quelle passerelle et quel compte (décision déjà ouverte depuis US-AUTH-5) ?

---

## 9. Prochaine étape

Audit déposé — **en attente du GO du PO**. À réception : ouverture du lot P0 (fondations),
puis lots P1 selon l'ordre validé. Aucune ligne de code métier ne sera écrite avant ce GO.
