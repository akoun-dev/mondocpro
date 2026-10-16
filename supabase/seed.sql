-- =============================================================================
-- Seed : compte Médecin Chef de démonstration
-- -----------------------------------------------------------------------------
-- Équivalent SQL de .zscripts/seed_admin.ts.
-- Idempotent : un compte existant avec ce numéro n'est pas écrasé.
--
-- Mot de passe initial du fixture local : Admin#MonDocPro2026
-- À remplacer par un seed externe avec ADMIN_INITIAL_PASSWORD en production.
-- =============================================================================

INSERT INTO public."users" (
  "id",
  "fullName",
  "phone",
  "passwordHash",
  "role",
  "zone",
  "createdAt",
  "updatedAt"
)
VALUES (
  'seed_admin_dr_kadjane',
  'Dr Kadjane',
  '+2250700000001',
  '$2y$10$xSJ.Rx3eGjPBA7qfPOsMAusIRBC1zeR7SF7pXWGfal9ElpICvmTVG',
  'ADMIN',
  'YOPOUGON',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("phone") DO NOTHING;

-- Compte infirmier de démonstration pour tester l'espace Missions.
-- Identifiants locaux : +2250755666777 / TestInfirmier2026!
-- En production, remplacer ce compte par un seed externe sécurisé.
INSERT INTO public."users" (
  "id",
  "fullName",
  "phone",
  "passwordHash",
  "role",
  "zone",
  "createdAt",
  "updatedAt"
)
VALUES (
  'seed_nurse_maquette_ui',
  'Infirmier Maquette UI',
  '+2250755666777',
  '$2b$10$/FHFnVsaIAnU7NjFXR4TyeIYW4n86JCF37PP5578rt7Phz19C1Tze',
  'NURSE',
  'YOPOUGON',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("phone") DO NOTHING;
