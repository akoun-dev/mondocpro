// Service métier Rendez-vous — FEATURE-RDV (server only, importe db).
// Les règles de créneaux (arbitrages MVP spec FEATURE-PATIENT A1/A2/A6) vivent
// dans src/lib/schedule.ts — module client-safe partagé avec le formulaire de
// réservation, source unique front/back. Un seul RDV actif (PENDING/CONFIRMED)
// par patient sur un créneau donné.
import { db } from "@/lib/db";
import type { Appointment, AppointmentStatus } from "@prisma/client";
import type { CreateAppointmentInput } from "@/lib/appointment-schemas";
import {
  AppointmentError,
  slotToDate,
  validateSlot,
} from "@/lib/schedule";

// Ré-export : la route API et les scripts continuent d'importer depuis ici.
export {
  AppointmentError,
  SLOT_MINUTES,
  OPENING_HOUR,
  CLOSING_HOUR,
  BUSINESS_DAYS,
  MIN_LEAD_MINUTES,
  MAX_DAYS_AHEAD,
  listDaySlots,
  slotToDate,
  validateSlot,
} from "@/lib/schedule";

// DTO exposé au client — dates en ISO UTC, le rendu formate en Africa/Abidjan.
// Spécialité demandée (nullable : RDV créés avant la FEATURE-RDV wizard).
export type SpecialtyDto = { id: string; name: string };

// Payload Prisma attendu : Appointment + relation specialty incluse (select
// id/name) — cf. include dans les requêtes du service.
type AppointmentWithSpecialty = Appointment & {
  specialty: SpecialtyDto | null;
};

export type AppointmentDto = {
  id: string;
  type: Appointment["type"];
  zone: Appointment["zone"];
  specialty: SpecialtyDto | null;
  scheduledAt: string;
  status: AppointmentStatus;
  reason: string | null;
  createdAt: string;
};

export function toAppointmentDto(
  appointment: AppointmentWithSpecialty,
): AppointmentDto {
  return {
    id: appointment.id,
    type: appointment.type,
    zone: appointment.zone,
    specialty: appointment.specialty
      ? { id: appointment.specialty.id, name: appointment.specialty.name }
      : null,
    scheduledAt: appointment.scheduledAt.toISOString(),
    status: appointment.status,
    reason: appointment.reason,
    createdAt: appointment.createdAt.toISOString(),
  };
}

const ACTIVE_STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED"];

export async function listAppointmentsForPatient(
  patientId: string,
): Promise<AppointmentDto[]> {
  const rows = await db.appointment.findMany({
    where: { patientId },
    orderBy: [{ scheduledAt: "desc" }],
    take: 100,
    include: { specialty: { select: { id: true, name: true } } },
  });
  return rows.map(toAppointmentDto);
}

export async function createAppointmentForPatient(
  patientId: string,
  input: CreateAppointmentInput,
): Promise<AppointmentDto> {
  const scheduledAt = slotToDate(input.date, input.time);
  validateSlot(scheduledAt);

  // Spécialité : doit exister et être ACTIVE (catalogue piloté par l'ADMIN).
  const specialty = await db.specialty.findUnique({
    where: { id: input.specialtyId },
    select: { id: true, isActive: true },
  });
  if (!specialty || !specialty.isActive) {
    throw new AppointmentError(
      "La spécialité choisie n'est plus disponible — choisissez-en une autre",
      400,
    );
  }

  // Collision : le patient a déjà un RDV actif sur ce créneau exact.
  const clash = await db.appointment.findFirst({
    where: {
      patientId,
      scheduledAt,
      status: { in: ACTIVE_STATUSES },
    },
    select: { id: true },
  });
  if (clash) {
    throw new AppointmentError(
      "Vous avez déjà un rendez-vous sur ce créneau — annulez-le d'abord ou choisissez un autre horaire",
      409,
    );
  }

  const created = await db.appointment.create({
    data: {
      patientId,
      specialtyId: specialty.id,
      type: input.type,
      zone: input.zone,
      scheduledAt,
      reason: input.reason || null,
    },
    include: { specialty: { select: { id: true, name: true } } },
  });
  return toAppointmentDto(created);
}

export async function cancelAppointmentForPatient(
  patientId: string,
  appointmentId: string,
): Promise<AppointmentDto> {
  const existing = await db.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!existing || existing.patientId !== patientId) {
    throw new AppointmentError("Rendez-vous introuvable", 404);
  }
  if (!ACTIVE_STATUSES.includes(existing.status)) {
    throw new AppointmentError(
      "Ce rendez-vous ne peut plus être annulé",
      409,
    );
  }

  const cancelled = await db.appointment.update({
    where: { id: appointmentId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
    include: { specialty: { select: { id: true, name: true } } },
  });
  return toAppointmentDto(cancelled);
}
