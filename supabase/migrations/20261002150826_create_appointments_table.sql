-- =============================================================================
-- Migration : création de la table « appointments »
-- -----------------------------------------------------------------------------
-- Rendez-vous cabinet/domicile avec spécialité facultative.
-- Miroir : prisma/schema.prisma → model Appointment (FEATURE-RDV).
-- =============================================================================

create table if not exists public."appointments" (
  "id" text not null,
  "patientId" text not null,
  "specialtyId" text,
  "type" public."AppointmentType" not null,
  "zone" public."Zone" not null,
  "scheduledAt" timestamp(3) not null,
  "status" public."AppointmentStatus" not null default 'PENDING',
  "reason" varchar(500),
  "notes" varchar(1000),
  "cancelledAt" timestamp(3),
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null,

  constraint "appointments_pkey" primary key ("id"),
  constraint "appointments_patientId_fkey"
    foreign key ("patientId") references public."users" ("id")
    on delete cascade on update cascade,
  constraint "appointments_specialtyId_fkey"
    foreign key ("specialtyId") references public."specialties" ("id")
    on delete set null on update cascade
);

create index if not exists "appointments_patientId_idx" on public."appointments" ("patientId");
create index if not exists "appointments_scheduledAt_idx" on public."appointments" ("scheduledAt");
create index if not exists "appointments_specialtyId_idx" on public."appointments" ("specialtyId");
