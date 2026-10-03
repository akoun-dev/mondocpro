-- =============================================================================
-- Migration : création de l'enum « AppointmentType »
-- -----------------------------------------------------------------------------
-- Types de rendez-vous (cabinet/domicile).
-- Miroir : prisma/schema.prisma → enum AppointmentType (FEATURE-RDV).
-- =============================================================================

create type public."AppointmentType" as enum ('CABINET', 'DOMICILE');
