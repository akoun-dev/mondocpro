# SPEC-FEATURE-PATIENT.md — Features patients : RDV · Sensibilisations · Épargne Tokens

**Feature IDs** : FEATURE-RDV · FEATURE-SENSO · FEATURE-TOKENS · **Phase** : 1 (backend/API P0-P1) · **Statut** : VALIDÉE (GO PO 2026-10-03 — audit `.ai/AUDITS/2026-10-03-patients-modules.md`)
**Acteurs concernés** : Patient (RDV, tokens, lecture SENSO) · Infirmier (lecture SENSO ; missions P3) · Admin (supervision, crédit tokens, rédaction SENSO phase 2)
**Date** : 2026-10-03 · **Owner** : Tech Lead

---

## 1. Contexte métier

Trois modules complètent l'espace patient après FEATURE-AUTH : la prise de rendez-vous
(cabinet ou domicile), le fil de sensibilisations santé et l'épargne santé en jetons.
L'audit pré-développement (2026-10-03) a ordonnancé les lots : **P0 fondations** (health
probe DB, `requireRole`, migrations versionnées, exigences + contrats + spec + plan de
test) → **P1** RDV puis SENSO (backend livré en P0/P1) → **P2** TOKENS-1 (ledger + crédit
manuel). Ce document fixe le périmètre fonctionnel et les **arbitrages MVP** retenus.

## 2. Périmètre par module

### FEATURE-RDV — Rendez-vous (REQ-001)
- Patient : liste de ses RDV (100 derniers, tri décroissant), création (type CABINET/DOMICILE,
  zone, date+heure, motif optionnel ≤ 500 car.), annulation d'un RDV actif.
- Statuts : `PENDING` (défaut) → `CONFIRMED` (équipe, phase 2) → `DONE` ; `CANCELLED`
  (patient au MVP) avec horodatage `cancelledAt`.
- Hors périmètre MVP : confirmation équipe (NURSE/ADMIN), reprogrammation, rappels SMS.

### FEATURE-SENSO — Sensibilisations (REQ-002)
- Fil consultable par tout utilisateur authentifié (50 derniers, tri décroissant) ;
  détail par id avec 404 indistinguable absent/hors ciblage.
- Catégories API : `ADVICE` · `ALERT` (libellés UI français « Conseil » · « Alerte »). Ciblage par zone : liste vide = visible de toutes.
- Éditorial : 6 contenus de référence seedés (`.zscripts/seed_sensibilisations.ts`,
  idempotent) ; rédaction ADMIN (route POST admin) en phase 2.

### FEATURE-TOKENS — Épargne santé (REQ-003, P2)
- Ledger immuable : `TokenAccount` (solde dérivé) + `TokenTransaction`
  (`DEPOSIT` | `DEBIT` | `REFUND`, jamais de UPDATE/DELETE).
- MVP : crédit **manuel** par l'ADMIN ; paiement Mobile Money suspendu à l'ADR-005.
- Modèles Prisma à créer (migration dédiée) — aucun développement avant arbitrages PO.

## 3. Arbitrages MVP retenus (modifiables sans migration)

| # | Sujet | Arbitrage MVP | À trancher (phase 2) |
|---|---|---|---|
| A1 | Créneaux | Lun–ven 08:00–16:30, grille 30 min (constantes `src/lib/appointments.ts`) | Ouverture samedi, créneaux par praticien |
| A2 | Délai de réservation | ≥ 2 h à l'avance, ≤ 60 jours | Utgence du jour, file d'attente |
| A3 | Collision | 1 seul RDV actif par patient **et par créneau** (409) | Capacité par créneau (anti-surbooking global — risque R5 audit) |
| A4 | Annulation | Patient propriétaire, RDV PENDING/CONFIRMED, **sans délai limite** | Délai limite + motif obligatoire |
| A5 | Confirmateur | Personne (statut PENDING jusqu'à phase 2) | Qui confirme : NURSE, ADMIN ou auto |
| A6 | Fuseau | Afrique/Abidjan = UTC+0 sans heure d'été : l'heure locale **est** l'heure UTC (date+heure saisis séparés, combinés côté serveur) | — (constant) |
| A7 | SENSO rédaction | Seed éditorial versionné | Compte(s) rédacteur(s), workflow de publication |
| A8 | Valeur jeton | **Tranché** — 1 Token = 2 500 FCFA (doc fonctionnel PO) ; portefeuille implémenté (Task 26, **ADR-007**) — grille tarifaire **configurable par le Médecin Chef** (Task 28 : table `tariff_configs` + vue « Tarifs », garde-fou 0..100 Tokens, audit) — valeurs par défaut provisionnelles à valider PO | FEATURE-TOKENS (wallet, réservation/débit, recharges) |
| A9 | Paiement | **Non arbitré** — ADR-005 à ouvrir ; en attendant : recharge déclarée → rapprochement manuel Médecin Chef (ADR-007 §recharges, garde anti double-crédit) | Fournisseur Mobile Money (Wave/Orange/MTN) |
| A10 | SMS | **Non arbitré** — comparatif + pilote préparés par **ADR-006** (InApp actif Task 24, SMS en stub) | Passerelle (rappels RDV, codes OTP) |

## 4. Contrats API

Voir `API_CONTRACTS.md` — sections appointments (GET/POST, PATCH :id), wallet
(GET) + wallet/recharges (POST) + admin/recharges (GET/PATCH) — FEATURE-TOKENS
**IMPLÉMENTÉ** (Task 26, ADR-007) ; sensibilisations (GET, GET :id) ; admin
SENSO en « Contrats à venir ». Schémas zod de référence :
`src/lib/appointment-schemas.ts` + `src/lib/token-schemas.ts`.

## 5. Vérification (TEST_PLAN)

- Parcours API complet en curl (création → collision 409 → annulation → recréation) ;
- gardes 401/403 (`requireRole`) ; SENSO list + détail + 404 hors ciblage ;
- health probe DB (`database: "up"`) ; résultats consignés dans `TEST_PLAN.md`.

## 6. Suite (après lot P1)

UI patient (vues RDV + SENSO dans l'espace connecté, route unique `/` — SYS-001),
puis P2 TOKENS-1 dès arbitrages A8/A9 tranchés. Board de dispatch NURSE : P3.
