// Schémas zod FEATURE-RDV — miroir des contrats API_CONTRACTS.md.
// Client-safe (aucun import serveur) : utilisé par le formulaire de réservation
// et par la route API. Règles créneaux détaillées dans src/lib/appointments.ts.
import { z } from "zod";
import { ZONES } from "@/lib/auth-schemas";

export const APPOINTMENT_TYPES = ["CABINET", "DOMICILE"] as const;
export type AppointmentTypeValue = (typeof APPOINTMENT_TYPES)[number];

export const APPOINTMENT_STATUS = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "DONE",
] as const;
export type AppointmentStatusValue = (typeof APPOINTMENT_STATUS)[number];

// Date « 2026-10-05 » et heure « 08:00 » saisies séparément : Afrique/Abidjan
// est en UTC+0 toute l'année (aucune heure d'été) → l'heure locale EST l'heure
// UTC, on combine donc côté serveur en ISO UTC sans conversion de fuseau.
export const appointmentDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");

export const appointmentTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide");

export const createAppointmentSchema = z.object({
  type: z.enum(APPOINTMENT_TYPES, {
    message: "Choisissez un type de rendez-vous",
  }),
  // Spécialité demandée (wizard étape 2) — doit référencer une spécialité
  // ACTIVE du catalogue (validé en base par le service).
  specialtyId: z.string().min(1, "Choisissez une spécialité"),
  zone: z.enum(ZONES, { message: "Zone invalide" }),
  date: appointmentDateSchema,
  time: appointmentTimeSchema,
  reason: z
    .string()
    .trim()
    .max(500, "Le motif ne peut pas dépasser 500 caractères")
    .optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

// Seule action patient supportée au MVP : l'annulation.
export const updateAppointmentSchema = z.object({
  action: z.literal("CANCEL"),
});
