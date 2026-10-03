# ADR-007 — Portefeuille de Tokens (crédits prépayés) et cycle financier des consultations

> Architecture Decision Record. Un ADR = **une** décision structurante, immuable une fois acceptée (si elle change, un nouvel ADR la déprécie).
> **Périmètre** : FEATURE-TOKENS. Les tarifs par type de consultation restent PROVISOIRES (§Décision) — ils ne sont pas une décision d'architecture et demeurent à valider par le PO.

## Statut
`Accepté` — avec tarifs **provisionnels** explicitement bornés (à valider par le porteur du projet) et recharge **transitoirement manuelle** (définitive avec la décision Mobile Money, ADR-005, encore ouverte).

## Date
2026-10-03

## Contexte

Le document de présentation Mon doc Pro fixe l'économie du service : les **Tokens** sont des crédits prépayés qui règlent les consultations et soins — **1 Token = 2 500 FCFA**, recharge par **Wave, Orange Money, MTN Mobile Money ou carte Visa**, Tokens visibles dans le compte du patient, et **remboursement annuel des Tokens non utilisés le 24 décembre** sur le Mobile Money du patient. Le document précise aussi que « le Médecin Chef autorise les recharges », sans trancher entre validation manuelle et automatique, et **ne fixe PAS la grille tarifaire** (nombre de Tokens par type de consultation : « à valider par le porteur du projet »).

Le point le plus sensible identifié par l'analyse fonctionnelle est le **moment du débit** : débit immédiat (comptabilité simple, remboursements fréquents) vs **réservation temporaire suivie d'un débit en fin de visite** (plus équitable, exige une gestion rigoureuse des annulations et clôtures). Par ailleurs, la confirmation de paiement par un prestataire externe (Wave/OM/MTN/Visa) dépend de la décision **ADR-005 (Mobile Money), encore ouverte** — comme pour le SMS (ADR-006), l'intégration doit être Reportée sans bloquer le produit.

Contraintes du socle existant : Prisma/PostgreSQL (ADR-003), sessions serveur (ADR-004), RDV avec machine à états `PENDING → CONFIRMED → DONE / CANCELLED` (FEATURE-RDV), rôle ADMIN = Médecin Chef, palette ADR-002.

## Décision

Nous adoptons le modèle **« réservation → débit en fin de visite »**, recommandé par le document fonctionnel, avec un **ledger append-only** :

1. **Valeur du Token** : `1 Token = 2 500 FCFA`, constante unique `TOKEN_VALUE_FCFA` (`src/lib/token-schemas.ts`), source partagée front/back. Tout montant de recharge doit en être un multiple exact.
2. **Ledger, pas de solde stocké** : chaque mouvement est une ligne immuable de `token_transactions` (`RECHARGE`, `RESERVATION`, `CONSUMPTION`, `RELEASE`, `REFUND`, `ADJUSTMENT`) ; le solde est **toujours recalculé** par agrégats via `computeBalance` (source unique partagée par l'affichage et la vérification de réservation) : `solde = recharges confirmées + remboursements + ajustements signés − TOUTES les réservations + toutes les libérations` ; le **blocage** (`reservedTokens`) = réservations dont le RDV lié est toujours `RESERVED`. Compter les réservations **toutes** (et non les seules actives) interdit tout double-crédit : une annulation ne restitue que ce qui avait été bloqué, une consommation ne restitue rien.
3. **Cycle d'un RDV** (`Appointment.tokenState`, `tokensReserved`) :
   - à la demande : le RDV naît `RESERVED`, la transaction `RESERVATION` est écrite **dans la même transaction sérialisable** que la création — solde insuffisant ⇒ HTTP 402 et rollback complet (aucun RDV sans réservation, aucune réservation orpheline) ;
   - annulation patient (avant visite) : `RELEASED` + ligne `RELEASE` (+N au disponible) — politique MVP « libération complète avant affectation » ; les frais après départ de l'équipe attendront le dispatch équipe ;
   - clôture par le **Médecin Chef** (`PATCH /api/appointments/:id` `{action:"DONE"}`, ADMIN seul) : `CONSUMED` + ligne `CONSUMPTION` — la réservation devient **dépense définitive** (le disponible ne bouge plus : les Tokens avaient déjà été déduits) ;
   - annulation par l'équipe/le système (`{action:"CANCEL"}` ADMIN) : libération intégrale.
4. **Recharges transitoirement manuelles** : le patient **déclare** un paiement (presets 2 500 / 5 000 / 10 000 / 25 000 FCFA) → recharge `PENDING` → le **Médecin Chef rapproche** le paiement (`PATCH /api/admin/recharges/:id` `CONFIRM|REJECT`). Garde **anti double-crédit** : la transition n'aboutit que depuis `PENDING` (`updateMany` conditionnel) — une double confirmation reste sans effet (exigence « deux confirmations prestataire = une seule recharge »). Le champ `providerRef` accueille la référence prestataire quand ADR-005 sera tranchée ; la confirmation automatique remplacera alors le clic Médecin Chef sans changer le ledger.
5. **Tarifs CONFIGURABLES PAR LE MÉDECIN CHEF** (demande PO 2026-10-03) : la grille vit en base (`tariff_configs`, une ligne par poste : clé métier → prix en Tokens, extensible sans migration) et s'édite dans la vue **« Tarifs »** du dashboard (`GET/PATCH /api/admin/tariffs/:key`, garde-fou 0..100 Tokens, audit `updatedById`). Valeurs par défaut provisionnelles : `CONSULTATION_CABINET = 1 Token`, `CONSULTATION_DOMICILE = 1 Token` (exemple du document fonctionnel). Le coût d'un RDV est **figé à sa réservation** (`tokensReserved`, lu dans la même transaction sérialisable) : modifier un tarif ne vaut que pour les demandes à venir, jamais pour les réservations engagées ; le wizard patient affiche le tarif en vigueur via `GET /api/tariffs`. La grille fine (spécialités, nuit/week-end, déplacement, patient absent) reste à valider par le PO — le design clé→valeur l'accueille sans migration.
6. **Remboursement du 24 décembre** : le type `REFUND` et le champ `processedById` existent dès maintenant ; le processus annuel (solde éligible → conversion 2 500 FCFA → versement Mobile Money → preuve) sera une **procédure dédiée auditable**, non automatisée à ce stade (décision PO requise sur le périmètre exact : Tokens de l'année ? Tokens réservés en cours ?).
7. **UI** : patient — section « Portefeuille de Tokens » dans Profil (solde, réservations, consommés, 5 derniers mouvements, dialog de recharge) ; coût + « solde après réservation » affichés **avant confirmation** dans le wizard RDV, blocage explicite si solde insuffisant ; Médecin Chef — vue « Recharges de Tokens » (file de validation + décisions récentes).

## Alternatives considérées

| Alternative | Raison du rejet |
|---|---|
| Débit immédiat à la demande | Simple en comptabilité mais expose le patient à des remboursements systématiques en cas de non-confirmation/annulation — moins équitable ; rejeté par le document fonctionnel lui-même |
| Champ `balance` stocké sur User (mis à jour incrémentalement) | Source de dérive (bug, crash entre deux écritures) ; le recalcul par agrégats indexés est suffisant à l'échelle MVP |
| Wallet externe (prestataire de paiement comme portefeuille) | Dépend d'ADR-005 (ouverte), coûte des frais par opération, et ne donne aucune traçabilité interne unifiée ; le ledger maison est indépendant du prestataire |
| Recharge 100 % automatique dès maintenant | Impossible honnêtement sans prestataire (ADR-005 ouverte) : une fausse confirmation automatique créditerait des Tokens sans paiement réel |
| Réservation par verrou applicatif (sans ligne RESERVATION) | Inaudituble et fragile ; la ligne de ledger rend le blocage traçable, daté et chaîné (`relatedTransactionId`) |

## Conséquences

**Positives :**
- Le patient ne peut jamais être débité pour une visite qui n'a pas lieu : tout RDV non réalisé libère ses Tokens (patient ou équipe) ;
- Anti-fraude structurelle : double confirmation de recharge sans effet, RDV atomique avec sa réservation, plafond de recharge (500 000 FCFA), historique immuable ;
- ADR-005 (Mobile Money) reste ouverte SANS bloquer le produit : le basculement « manuel → automatique » ne change ni le ledger ni les contrats, seulement le déclencheur de `CONFIRMED` (+ `providerRef`) ;
- Tarifs modifiables par le Médecin Chef lui-même (vue « Tarifs ») sans déploiement — la grille fine du PO (spécialités, majorations, frais) s'ajoutera par simple INSERT de clé.

**Négatives / risques assumés :**
- La validation manuelle des recharges dépend de la disponibilité du Médecin Chef (risque d'attente) — assumé transitoirement, copie UI honnête ;
- La grille tarifaire est désormais éditable en production : un mauvais prix devient visible immédiatement par les patients — compensé par les garde-fous (0..100 Tokens) et l'audit `updatedById` (qui a fixé quoi, quand) ;
- Un RDV `RESERVED` ne doit jamais être supprimé en base (suppression physique ⇒ réservation fantôme) : la suppression passe toujours par CANCEL/DONE ; le FK `SetNull` du ledger protège néanmoins la traçabilité ;
- La dérive enum préexistante `SensibilisationCategory` (base `CONSEIL/ALERTE` vs schéma `ADVICE/ALERT`) maintient `prisma db push` inutilisable — migration appliquée via `prisma db execute` (même traitement que Tasks 23/24), à arbitrer côté owner.

## Références
- Document de présentation Mon doc Pro (Tokens, 2 500 FCFA, recharge, remboursement du 24 décembre) — analyse fonctionnelle PO 2026-10-03 ;
- `SPECS/FEATURE-PATIENT.md` §arbitrages (tokens FCFA — entrée liée) ; ADR-003 (migrations), ADR-004 (auth/sessions), ADR-005 (Mobile Money, ouverte), ADR-006 (passerelle SMS — même pattern d'abstraction) ;
- Code : `src/lib/token-schemas.ts` (constantes + Zod), `src/lib/tokens.ts` (service ledger + grille tarifaire), `src/lib/appointments.ts` (cycle RDV), `src/app/api/wallet/**`, `src/app/api/admin/recharges/**`, `src/app/api/tariffs/**`, `src/app/api/admin/tariffs/**`, `src/components/patient/wallet-section.tsx`, `src/components/admin/recharges-view.tsx`, `src/components/admin/tariffs-view.tsx` ;
- Migrations : `supabase/migrations/20261003153000_create_token_transactions_table.sql` (+ colonnes `appointments` intégrées à `20261002232748_create_appointments_table.sql` — règle ADR-003) ; `supabase/migrations/20261003154000_create_tariff_configs_table.sql` (grille configurable, Task 28).
