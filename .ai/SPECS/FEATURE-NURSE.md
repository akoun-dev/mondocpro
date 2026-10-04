# FEATURE-NURSE — Missions et visites

## Périmètre

Cette feature fournit le dispatch des visites à domicile et l'espace opérationnel infirmier dans le dashboard connecté.

## Modèle métier

- `NurseMission` est lié à un rendez-vous unique, un patient, un infirmier et l'ADMIN qui l'a affecté.
- L'infirmier doit couvrir la zone du rendez-vous.
- `VisitReport` est 1:1 avec une mission et conserve observations, actes, recommandations et constantes JSON.
- Une affectation/re-affectation produit une notification in-app `MISSION_ASSIGNED`.

## Statuts

`ASSIGNED → ACCEPTED → IN_PROGRESS → COMPLETED`.

Une mission non clôturée peut être `CANCELLED`. Les statuts terminaux ne sont plus modifiables. Un rapport est autorisé uniquement durant `IN_PROGRESS`.

## Sécurité

Les routes infirmier exigent le rôle `NURSE` et ajoutent toujours `nurseId` depuis la session à la requête Prisma. Les routes admin exigent `ADMIN`. Les erreurs de mission absente et hors propriété sont indistinguables (404).

## Persistance

Le schéma Prisma est `supabase/schema.prisma`. La migration additive est `supabase/migrations/20261004140000_create_nurse_missions_and_visit_reports.sql` et doit être appliquée exclusivement via Supabase CLI.

## Interface

Le rôle `NURSE` dispose d'une navigation Accueil / Missions / Profil. La vue Missions charge les missions appartenant à la session, expose les transitions autorisées et permet de soumettre un compte-rendu avant la clôture.

Le rôle `ADMIN` peut lire la file via `GET /api/admin/missions`, affecter une mission via `POST /api/admin/missions` et réaffecter via `PATCH /api/admin/missions/:id`.
