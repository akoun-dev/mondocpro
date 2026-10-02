# SPEC-AUTH.md — Feature AUTH : Système d'authentification complet

**Feature ID** : FEATURE-AUTH · **Phase** : 0-1 (UX + Spec) · **Statut** : VALIDÉE
**Acteurs concernés** : Patient, Infirmier, Admin (Médecin Chef Dr Kadjane)
**Zones de couverture** : Yopougon, Songon, PK22, N'Dotré
**Date** : 2026-09-30 · **Owner** : Tech Lead + UX/UI + Security

---

## 1. Contexte métier (SYS-010)

MondocPro permet aux patients de planifier des rendez-vous (cabinet ou domicile), de
constituer une épargne santé en "Tokens" et de recevoir des sensibilisations médicales.
L'équipe médicale (infirmiers) reçoit les missions en temps réel ; le Médecin Chef
supervise et dispatche. **Prérequis de tout le reste** : une authentification
multirôle robuste et traçable (contrainte médicale : traçabilité des actions exigée).

## 2. Découpage des acteurs → rôles applicatifs

| Acteur métier                | Rôle applicatif | Identifiant | Particularités                                            |
| ---------------------------- | --------------- | ----------- | --------------------------------------------------------- |
| Patient                      | `PATIENT`       | Téléphone   | Zone de résidence obligatoire (livraison/domicile)        |
| Infirmier / Assistant mobile | `INFIRMIER`     | Téléphone   | Zone de rattachement obligatoire (dispatch)               |
| Médecin Chef (Dr Kadjane)    | `ADMIN`         | Téléphone   | **Compte unique** — créé par seed, pas d'auto-inscription |

> Décision : l'identifiant est le **numéro de téléphone** (réalité terrain Côte
> d'Ivoire — les patients n'ont pas tous un e-mail ; usage âgé inclus). Détails : ADR-004.

## 3. Zones de couverture (énumération métier)

`YOPOUGON` · `SONGON` · `PK22` · `NDOTRE` — affichées : « Yopougon », « Songon »,
« PK22 », « N'Dotré ». Stockées en enum Prisma (liste fermée, définie par le PO).

## 4. User stories + critères d'acceptation

### US-AUTH-1 — Inscription (Patient / Infirmier)

**En tant que** visiteur, **je veux** créer un compte avec mon numéro, mon nom, ma
zone et mon rôle, **afin de** accéder aux services MondocPro.

- [ ] Formulaire : nom complet (2-80), téléphone (format international ou local 8-15 chiffres), zone (select 4 zones), rôle (Patient ou Infirmier — cards radio), mot de passe (≥ 8 car.) + confirmation
- [ ] Validation temps réel avec messages d'erreur explicites (fr)
- [ ] Succès → session ouverte automatiquement → redirection vers l'espace du rôle
- [ ] Numéro déjà utilisé → erreur 409 affichée : « Ce numéro est déjà inscrit. Connectez-vous. »
- [ ] `ADMIN` **jamais proposé** dans le formulaire (compte seedé uniquement — ADR-004 §5)

### US-AUTH-2 — Connexion

**En tant qu'utilisateur**, **je veux** me connecter avec téléphone + mot de passe.

- [ ] 2 champs + bouton ; message d'erreur générique 401 (jamais d'indice sur l'existence du compte)
- [ ] Succès → dashboard selon rôle (PATIENT → espace patient, INFIRMIER → espace infirmier, ADMIN → console admin)
- [ ] Session persistante 30 jours (cookie httpOnly) — reload garde l'utilisateur connecté

### US-AUTH-3 — Session / Guard de route

**En tant que système**, **je veux** que `/` affiche le bon écran selon l'état d'auth.

- [ ] Chargement initial → état "checking" (spinner), pas de flash de formulaire
- [ ] Non connecté → écran auth (connexion/inscription)
- [ ] Connecté → espace du rôle (MVP : placeholder profil + déconnexion ; les espaces complets admin/nurses/users sont des itérations suivantes — composants préparés par le PO)

### US-AUTH-4 — Déconnexion

- [ ] Bouton visible dans l'espace connecté → session détruite (DB + cookie) → retour écran auth

### US-AUTH-5 — Sécurité (transverse)

- [ ] Mots de passe hashés bcrypt (10 rounds) — jamais stockés/envoyés en clair
- [ ] Cookie `httpOnly` + `sameSite=lax` (+ `secure` en production) — inaccessible au JS
- [ ] Validation zod côté API — jamais de confiance aux données client
- [ ] Erreurs d'auth génériques (anti-énumération de comptes)
- [ ] `passwordHash`, sessions, jamais exposés dans les réponses JSON

## 5. Phase 0 — Wireframe UX (écran auth, mobile-first)

```
┌─────────────────────────────┐
│  [img mondocpro.jpeg]       │  ← brand rond 96px, centré
│  MondocPro                  │  ← titre, bleu médical #1565C0
│  « Votre santé en main »│  ← sous-titre muted
│                             │
│  ┌─────────┬───────────┐    │  ← Tabs (shadcn)
│  │Connexion│Inscription│    │
│  ├─────────┴───────────┤    │
│  │ (Champs du tab)      │    │  ← Card p-6, gap-4
│  │ [ Input téléphone ]  │    │
│  │ [ Input mot de passe]│    │
│  │      [ Bouton ]      │    │  ← bg-primary, h-11 (44px touch)
│  └──────────────────────┘    │
│  Yopougon · Songon · PK22 ·  │
│  N'Dotré        (footer)     │  ← mt-auto, sticky bottom
└─────────────────────────────┘
```

Inscription (2e tab) : nom complet, téléphone, zone (Select), rôle (2 cards radio
avec icônes User / Stethoscope), mot de passe + confirmation. Desktop (≥ md) :
carte centrée max-w-md, colonne unique — l'app est **mobile d'abord**.

Espace connecté (MVP) : header brand + carte profil (avatar initiales, nom,
téléphone, rôle badge, zone) + carte « À venir » contextualisée par rôle +
bouton Déconnexion (destructive outline).

## 6. Hors périmètre (itérations suivantes)

- OTP SMS / vérification du numéro · réinitialisation mot de passe · changement
  de mot de passe · OAuth. Contenus des espaces Patient/Infirmier/Admin (RDV,
  Tokens, sensibilisations, dispatch) : features séparées qui consommeront
  `GET /api/auth/me` comme source d'identité.
