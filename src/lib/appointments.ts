// Service métier Rendez-vous — FEATURE-RDV (server only, importe db).
// Règles de créneaux par défaut (arbitrages MVP documentés dans la spec
// FEATURE-PATIENT, modifiables sans migration) :
//   · Lundi → vendredi, 08:00 – 17:00 (dernier créneau 16:30)
//   · Grille de 30 minutes
//   · Réservation ≥ 2 h à l'avance, jusqu'à 60 jours
//   · Un seul RDV actif (PENDING/CONFIRMED) par patient sur un créneau donné
import { db } from "@/lib/db";
import type { Appointment, AppointmentStatus } from "@prisma/client";
import type { CreateAppointmentInput } from "@/lib/appointment-schemas";

export const SLOT_MINUTES = 30;
export const OPENING_HOUR = 8;
export const CLOSING_HOUR = 17;
export const BUSINESS_DAYS = [1, 2, 3, 4, 5]; // getUTCDay : 0 = dimanche
export const MIN_LEAD_MINUTES = 120;
export const MAX_DAYS_AHEAD = 60;

// Erreur métier transportant le statut HTTP de la réponse API.
export class AppointmentError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

// Grille des créneaux d'une journée (heures locales = UTC, Afrique/Abidjan).
export function listDaySlots(): string[] {
  const slots: string[] = [];
  for (let minutes = OPENING_HOUR * 60; minutes < CLOSING_HOUR * 60; minutes += SLOT_MINUTES) {
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

export function slotToDate(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000Z`);
}

// Validation des règles de créneau — messages en français affichés au patient.
export function validateSlot(scheduledAt: Date, now = new Date()): void {
  const day = scheduledAt.getUTCDay();
  const minutes = scheduledAt.getUTCHours() * 60 + scheduledAt.getUTCMinutes();

  if (scheduledAt.getUTCSeconds() !== 0 || minutes % SLOT_MINUTES !== 0) {
    throw new AppointmentError(
      `Le créneau doit être aligné sur la grille de ${SLOT_MINUTES} minutes`,
      400,
    );
  }
  if (!BUSINESS_DAYS.includes(day)) {
    throw new AppointmentError(
      "Les rendez-vous sont proposés du lundi au vendredi",
      400,
    );
  }
  if (minutes < OPENING_HOUR * 60 || minutes >= CLOSING_HOUR * 60) {
    throw new AppointmentError(
      `Les créneaux vont de ${String(OPENING_HOUR).padStart(2, "0")}:00 à ${CLOSING_HOUR - 1}:30`,
      400,
    );
  }
  const minTime = now.getTime() + MIN_LEAD_MINUTES * 60 * 1000;
  if (scheduledAt.getTime() < minTime) {
    throw new AppointmentError(
      `Le rendez-vous doit être pris au moins ${MIN_LEAD_MINUTES / 60} heures à l'avance`,
      400,
    );
  }
  const maxTime = now.getTime() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000;
  if (scheduledAt.getTime() > maxTime) {
    throw new AppointmentError(
      `Le rendez-vous ne peut pas être pris à plus de ${MAX_DAYS_AHEAD} jours`,
      400,
    );
  }
}

// DTO exposé au client — dates en ISO UTC, le rendu formate en Africa/Abidjan.
export type AppointmentDto = {
  id: string;
  type: Appointment["type"];
  zone: Appointment["zone"];
  scheduledAt: string;
  status: AppointmentStatus;
  reason: string | null;
  createdAt: string;
};

export function toAppointmentDto(appointment: Appointment): AppointmentDto {
  return {
    id: appointment.id,
    type: appointment.type,
    zone: appointment.zone,
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
  });
  return rows.map(toAppointmentDto);
}

export async function createAppointmentForPatient(
  patientId: string,
  input: CreateAppointmentInput,
): Promise<AppointmentDto> {
  const scheduledAt = slotToDate(input.date, input.time);
  validateSlot(scheduledAt);

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
      type: input.type,
      zone: input.zone,
      scheduledAt,
      reason: input.reason || null,
    },
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
  });
  return toAppointmentDto(cancelled);
}
