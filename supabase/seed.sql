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

-- Compte Patient de démonstration
INSERT INTO public."users" (
  "id", "fullName", "phone", "passwordHash", "role", "zone", "createdAt", "updatedAt"
) VALUES (
  'seed_patient_demo',
  'Patient Démo',
  '+2250709229992',
  '$2b$10$7aBnbJuvqP7.JW0O42Af8.JvFn2ZygxoOl6bbDrc1oLPJ4pwb5r0u',
  'PATIENT',
  'YOPOUGON',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT ("phone") DO NOTHING;

-- Compte Infirmier de démonstration
INSERT INTO public."users" (
  "id", "fullName", "phone", "passwordHash", "role", "zone", "createdAt", "updatedAt"
) VALUES (
  'seed_nurse_demo',
  'Infirmier Démo',
  '+2250755443322',
  '$2b$10$dnXE004t96CgSD17iBcHhuK3UGc83a0I8tgcguLf0zgh8T4WaOm8i',
  'NURSE',
  'YOPOUGON',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT ("phone") DO NOTHING;

-- Spécialités de consultation
INSERT INTO public.specialties ("id", "name", "isActive", "sortOrder", "createdAt", "updatedAt") VALUES
('spec_generaliste', 'Médecine Générale', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('spec_pediatrie', 'Pédiatrie', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('spec_gynecologie', 'Gynécologie-Obstétrique', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('spec_cardiologie', 'Cardiologie', true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('spec_dermatologie', 'Dermatologie', true, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('spec_orl', 'ORL', true, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Spécialités supplémentaires
INSERT INTO public.specialties ("id", "name", "isActive", "sortOrder", "createdAt", "updatedAt") VALUES
('spec_ophtalmologie', 'Ophtalmologie', true, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('spec_pneumologie', 'Pneumologie', true, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('spec_gastroenterologie', 'Gastro-entérologie', true, 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('spec_neurologie', 'Neurologie', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('spec_urologie', 'Urologie', true, 11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('spec_orthopedie', 'Orthopédie-Traumatologie', true, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('spec_endocrinologie', 'Endocrinologie-Diabétologie', true, 13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('spec_psychiatrie', 'Psychiatrie', true, 14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('spec_rhumatologie', 'Rhumatologie', true, 15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('spec_stomatologie', 'Stomatologie', true, 16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
