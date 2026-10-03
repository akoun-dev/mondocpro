-- FEATURE-PROFIL — édition du profil + préférences notifications (Task 22)
-- Ajout au modèle User :
--   birthDate            : date de naissance, éditable via PATCH /api/auth/profile
--                          (stockée à minuit UTC — Afrique/Abidjan = UTC+0)
--   appointmentReminders : toggle « Rappels de rendez-vous » (SMS/WhatsApp 24 h avant)
--   healthAlerts         : toggle « Alertes de santé locales » (vaccination, gestes santé)
-- Valeurs par défaut = true : les deux canaux sont opt-out (préférences de la
-- maquette PO, interrupteurs activés à l'inscription).
ALTER TABLE "users" ADD COLUMN "birthDate" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "appointmentReminders" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "healthAlerts" BOOLEAN NOT NULL DEFAULT true;
