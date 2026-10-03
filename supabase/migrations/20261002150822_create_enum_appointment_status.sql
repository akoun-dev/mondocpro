-- =============================================================================
-- Migration : création de l'enum « AppointmentStatus »
-- -----------------------------------------------------------------------------
-- Statuts de rendez-vous.
-- Miroir : prisma/schema.prisma → enum AppointmentStatus (FEATURE-RDV).
-- =============================================================================

create type public."AppointmentStatus" as enum ('PENDING', 'CONFIRMED', 'CANCELLED', 'DONE');
