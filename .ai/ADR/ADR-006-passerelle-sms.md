# ADR-006 — Passerelle SMS des rappels de rendez-vous (prépare la décision A10)

> Architecture Decision Record. Un ADR = **une** décision structurante, immuable une fois acceptée (si elle change, un nouvel ADR la déprécie).
> **Cas particulier** : ce document PRÉPARE l'arbitrage PO « A10 » (registre des arbitrages, `SPECS/FEATURE-PATIENT.md`). Il devient l'ADR de référence dès que le PO tranche ; jusqu'alors son statut reste `Proposé`.

## Statut
`Proposé` — décision A10 **en attente d'arbitrage PO** (l'intégration technique n'est PAS bloquée : le transport est abstrait derrière `SmsGateway`, cf. Décision).

## Date
2026-10-03

## Contexte

Le périmètre PO du 2026-10-03 (Task 23) fixe les « Rappels de rendez-vous » :
**uniquement AVANT les RDV** (fenêtre 24 h), patient opt-in (`User.appointmentReminders`), anti-doublon par `Appointment.reminderSentAt`. Le pipeline est câblé de bout en bout :

- sélection des RDV dus : `status = CONFIRMED` ∧ `scheduledAt ∈ [maintenant, +24 h]` ∧ non rappelé ∧ opt-in (`src/lib/reminders.ts`) ;
- tick applicatif exposé par `[GET|POST] /api/cron/reminders` (Bearer `CRON_SECRET`, 503 explicite tant que non déployé) — à brancher sur un planificateur externe ;
- **canal InApp actif dès aujourd'hui** (Task 24) : chaque rappel crée une notification persistée (`notifications`, centre de notifications du header patient) — indépendant de la passerelle ;
- **canal SMS en stub console** : `consoleStubGateway` journalise `[SMS:stub]` sans dépendance externe, aucun coût, aucune délivrance réelle.

Le choix de la passerelle SMS débloque trois besoins, aujourd'hui en attente :

1. **Rappels de RDV par SMS** (périmètre PO ci-dessus) — le seul canal garantissant d'atteindre un patient qui n'a pas l'app ouverte ;
2. **Code SMS du flux « mot de passe oublié »** (`TODO INT-SMS` dans `API_CONTRACTS.md` — placeholder console actuel) ;
3. Futur : alertes de santé locales par SMS (`User.healthAlerts`), convocations missions infirmier.

Contraintes factuelles :

- **Public ivoirien** (Abidjan : Yopougon, Songon, PK22, N'Dotré) — trois réseaux mobiles : **Orange CI, MTN CI, Moov Africa CI** ; l'identifiant métier est le téléphone (+225, ADR-004).
- **Volumétrie MVP modeste** (dizaines de SMS/jour au lancement : rappels 24 h avant RDV + codes de reset) — le critère n'est pas le tarif volume mais la délivrance et la simplicité.
- **Pas d'engagement long terme souhaité** au stade MVP ; facturation prépayée privilégiée.
- **Conformité** : régulateur ivoirien = **ARTP-CI** ; les expéditeurs alphanumériques peuvent exiger un pré-enregistrement selon l'opérateur/agrégateur (à vérifier au pilote).
- Le MVP n'a **pas besoin du 2-way** (aucune réponse attendue) ; le 1-way suffit.
- Budget tech : l'abstraction `SmsGateway` (une méthode `send({ to, body })`) est déjà en place — **le coût d'intégration d'un fournisseur est constant** (~1 fichier), quel que soit le choix.

## Décision (proposée)

> Énoncé soumis à l'arbitrage PO (A10). Rien n'est « adopté » tant que le PO n'a pas validé.

**Nous proposons un pilote comparatif à 2 candidats + 1 référence**, choisi sur le comparatif ci-dessous, l'arbitrage final (A10) étant pris sur des mesures réelles :

1. **Infobip** — candidat principal : meilleure couverture/délivrance documentée des trois réseaux ivoiriens chez les CPaaS internationaux, API complète, webhooks DLR.
2. **Africa's Talking** — candidat challenger : agrégateur panafricain, tarifs Afrique compétitifs, prépayé sans engagement, sandbox gratuite pour les développements (l'implémentation `SmsGateway` peut être écrite contre leur sandbox dès maintenant).
3. **Twilio** — référence de repli si les exigences de SLA/support enterprise priment sur le coût (à écarter au MVP si le budget décide).

**Plan de pilote (1 semaine)** : 50 SMS réels par candidat sur les trois réseaux (numéros de test équipe), mesurer : taux de délivrance (DLR), latence d'acheminement, présentation de l'expéditeur `MonDocPro`, coût réel unitaire. **Critères de sortie** : DLR ≥ 95 % sur les 3 réseaux, latence < 30 s, expéditeur alphanumérique non altéré, facturation prépayée sans engagement. Le candidat retenu est branché dans `getSmsGateway()` + configuration `CRON_SECRET` + planificateur externe (Vercel Cron ou cron système).

**En parallèle (sans attendre A10)** : démarcher **Orange CI** (contrat opérateur direct) pour une phase 2 — meilleur taux sur le parc Orange (majoritaire à Abidjan), facturation FCFA contractuelle ; onboarding commercial plus long, à ne pas mettre sur le chemin critique du MVP.

## Comparatif

**Prix indicatifs vers la Côte d'Ivoire** (tarifs publics observés oct. 2026, ~1 USD ≈ 600 FCFA) — **à confirmer par devis**, les prix évoluent par destination et par volume :

| Critère | Twilio | Vonage | Infobip | Africa's Talking | Termii | Orange CI (direct) |
|---|---|---|---|---|---|---|
| Type | CPaaS global | CPaaS global | CPaaS global (forte Afrique) | Agrégateur panafricain | Agrégateur ouest-africain | Opérateur local |
| Prix indicatif / SMS → CI | ~0,04–0,07 USD (~25–45 FCFA) | ~0,04–0,05 USD (~25–30 FCFA) | ~0,03–0,05 USD (~18–30 FCFA) | ~0,02–0,03 USD (~12–18 FCFA) | ~0,015–0,03 USD (~9–18 FCFA) | Tarif contractuel FCFA (à négocier, ~10–25 FCFA) |
| Couverture Orange/MTN/Moov CI | via partenaires | via partenaires | oui (routage régional) | oui | oui (via partenaires) | Orange natif ; MTN/Moov via interconnexion |
| Expéditeur alphanumérique `MonDocPro` | oui (pré-enreg. possible) | oui | oui | oui | oui (pré-enreg. requis) | oui (contrat) |
| DLR / webhooks d'accusés | excellents | bons | bons (portail + webhooks) | basiques mais suffisants | basiques | à définir au contrat |
| API REST + SDK TS / intégration `SmsGateway` | excellente (SDK officiel) | bonne | bonne | bonne (REST simple) | bonne (REST simple) | API opérateur (docs variables) |
| Sandbox de développement | payant à l'usage | payant | payant | **gratuite** | gratuite (crédit test) | non applicable |
| Facturation | USD, à l'usage | USD, à l'usage | USD/EUR, à l'usage | **prépayé sans engagement** | **prépayé sans engagement** | FCFA, contrat entreprise |
| Support / onboarding | self-serve + paid plans | self-serve | self-serve + manager régional | self-serve + Slack communautaire | self-serve | commercial (délais semaines) |
| Risque principal | coût unitaire le plus élevé | positionnement intermédiaire | délivrance à vérifier au pilote sur Moov | DLR moins riches, doc à composer | pérennité routage CI à vérifier | n'adresse pas nativement MTN/Moov ; onboarding long |

**Écartés au stade MVP** (avec raisons) :

| Alternative | Raison du rejet |
|---|---|
| Brevo (ex-Sendinblue) SMS | Orienté marketing/CRM ; routage transactionnel Afrique moins maîtrisé, tarifs variables par destination |
| Telnyx / Plivo | Prix attractifs mais présence Afrique de l'Ouest moins documentée ; gain marginal vs Infobip/AT non prouvé |
| MTN CI / Moov en contrat direct | Deux contrats opérateurs supplémentaires pour un parc minoritaire — disproportionné au MVP ; réévalué en phase 2 avec Orange CI |
| WhatsApp Business API (rappels) | Canal pertinent à terme (fort usage en CI) mais hors périmètre PO « SMS » ; coût par conversation > coût SMS ; candidat à un ADR séparé |
| Push notifications (FCM/APNs) | Nécessite une app mobile native (non prévue au MVP web) ; la cloche InApp (Task 24) couvre le besoin in-app sans l'installer |

## Conséquences

**Positives :**

- L'arbitrage A10 se fait sur des **mesures de pilote** (DLR/latence/coût réels) et non sur des brochures tarifaires — décision réversible jusqu'au dernier moment.
- Le coût d'intégration est **constant par construction** : `SmsGateway` (Task 23) + `consoleStubGateway` déjà en production grise ; brancher le fournisseur retenu = implémenter une interface dans 1 fichier + `CRON_SECRET` + planificateur externe.
- Le canal **InApp est déjà livré** (Task 24) : les patients opt-in reçoivent le rappel dans l'app indépendamment de la passerelle — la décision A10 n'est plus sur le chemin critique du produit.
- Le pilote documente aussi le réglage de l'expéditeur `MonDocPro` (pré-enregistrement ARTP/opérateur), réutilisable pour le futur code SMS du reset password.

**Négatives / risques assumés :**

- Jusqu'à l'arbitrage, le canal SMS reste un **stub console** : aucun SMS réel n'est émis (assumé — périmètre PO du 2026-10-03).
- Les tarifs publiés sont **indicatifs et volatils** (routage par destination) : seul le devis + le pilote font foi.
- La délivrance réelle sur **Moov CI** est la variable la moins documentée chez les agrégateurs — d'où son inclusion explicite dans les critères de sortie du pilote.
- Deux candidats en pilote = un peu de travail d'intégration jetable (le challenger) : borné à une implémentation d'interface (~1 fichier, testée contre sandbox).

## Références

- Pipeline & abstraction : `src/lib/reminders.ts` (`SmsGateway`, `getSmsGateway`, `selectDueAppointments`, `buildReminderMessage`), scheduler `[GET|POST] /api/cron/reminders` (`CRON_SECRET`).
- Notifications InApp (Task 24) : `notifications` (`supabase/schema.prisma`), `GET /api/notifications`, `POST /api/notifications/read`, centre de notifications du header patient (`user-dashboard.tsx`).
- Registre des arbitrages PO : `SPECS/FEATURE-PATIENT.md` — décision **A10** (passerelle SMS), voisines A8 (valeur jeton) et A9 (Mobile Money, ADR-005).
- Authentification par téléphone : ADR-004 (identifiant = numéro, prépare l'OTP/code SMS).
- TODO connexe : `INT-SMS` (livraison du code mot de passe oublié) dans `API_CONTRACTS.md`.
- Régulateur : ARTP-CI (autorité ivoirienne des télécommunications/TIC) — enregistrement des expéditeurs alphanumériques.
