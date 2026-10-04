// Service métier Rendez-vous — FEATURE-RDV (server only, importe db).
// Les règles de créneaux (arbitrages MVP spec FEATURE-PATIENT A1/A2/A6) vivent
// dans src/lib/schedule.ts — module client-safe partagé avec le formulaire de
// réservation, source unique front/back. Un seul RDV actif (PENDING/CONFIRMED)
// par patient sur un créneau donné.
import { db } from "@/lib/db";
import { Prisma, type Appointment, type AppointmentStatus } from "@prisma/client";
import type { CreateAppointmentInput } from "@/lib/appointment-schemas";
import { notifyAdmins, notifyUsers } from "@/lib/notifications";
import { ZONE_LABELS } from "@/lib/auth-schemas";
import { formatFullSlotUTC } from "@/lib/datetime";
import {
  AppointmentError,
  slotToDate,
  validateSlot,
} from "@/lib/schedule";
import {
  TokenError,
  consumeAppointmentTokens,
  getAppointmentCostTokens,
  releaseAppointmentTokens,
  reserveTokensForAppointment,
} from "@/lib/tokens";

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
  // FEATURE-TOKENS (ADR-007) — cycle financier du RDV.
  tokenState: "NONE" | "RESERVED" | "CONSUMED" | "RELEASED";
  tokensReserved: number;
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
    tokenState: appointment.tokenState,
    tokensReserved: appointment.tokensReserved,
    createdAt: appointment.createdAt.toISOString(),
  };
}

const ACTIVE_STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED"];
const MAX_ACTIVE_APPOINTMENTS = 10;

export async function listAppointmentsForPatient(
  patientId: string,
): Promise<AppointmentDto[]> {
  const now = new Date();
  const include = { specialty: { select: { id: true, name: true } } } as const;
  // Les rendez-vous actifs ne sont pas bornés : le prochain ne doit jamais
  // être masqué par un historique volumineux. L'historique reste limité à 100.
  const [upcoming, history] = await Promise.all([
    db.appointment.findMany({
      where: {
        patientId,
        status: { in: ACTIVE_STATUSES },
        scheduledAt: { gte: new Date(now.getTime() - 60_000) },
      },
      orderBy: [{ scheduledAt: "asc" }],
      include,
    }),
    db.appointment.findMany({
      where: {
        patientId,
        OR: [
          { status: { notIn: ACTIVE_STATUSES } },
          { scheduledAt: { lt: new Date(now.getTime() - 60_000) } },
        ],
      },
      orderBy: [{ scheduledAt: "desc" }],
      take: 100,
      include,
    }),
  ]);
  const rows = [...upcoming, ...history];
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
  try {
    const created = await db.$transaction(
      async tx => {
        const activeCount = await tx.appointment.count({
          where: { patientId, status: { in: ACTIVE_STATUSES } },
        });
        if (activeCount >= MAX_ACTIVE_APPOINTMENTS) {
          throw new AppointmentError(
            `Vous ne pouvez pas avoir plus de ${MAX_ACTIVE_APPOINTMENTS} rendez-vous actifs`,
            409,
          );
        }

        const clash = await tx.appointment.findFirst({
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

        // FEATURE-TOKENS (ADR-007) : le RDV naît AVEC sa réservation de
        // Tokens (tokenState=RESERVED). Le coût suit le tarif EN VIGUEUR
        // (table tariff_configs, édité par le Médecin Chef) lu DANS la même
        // transaction — le prix figuré est celui réservé, même si l'ADMIN
        // modifie la grille entre-temps.
        const costTokens = await getAppointmentCostTokens(input.type, tx);
        const created = await tx.appointment.create({
          data: {
            patientId,
            specialtyId: specialty.id,
            type: input.type,
            zone: input.zone,
            scheduledAt,
            reason: input.reason || null,
            tokenState: "RESERVED",
            tokensReserved: costTokens,
          },
          include: { specialty: { select: { id: true, name: true } } },
        });

        // Vérification du solde + écriture de la réservation dans le ledger
        // — DANS la même transaction : solde insuffisant ⇒ rollback complet
        // (aucun RDV sans réservation, aucune réservation orpheline).
        await reserveTokensForAppointment(tx, patientId, created.id, costTokens);

        // Task 35 — une consultation À DOMICILE exige une mission infirmière :
        // le Médecin Chef est alerté dès la demande (sinon la file de dispatch
        // reste invisible tant qu'il n'ouvre pas l'interface). Les RDV CABINET
        // ne requièrent aucune action admin → pas de notification (anti-bruit).
        if (input.type === "DOMICILE") {
          const patient = await tx.user.findUnique({
            where: { id: patientId },
            select: { fullName: true },
          });
          await notifyAdmins(tx, {
            type: "APPOINTMENT_REQUESTED",
            title: "Consultation à domicile à affecter",
            body: `${patient?.fullName ?? "Un patient"} a demandé une consultation à domicile (${ZONE_LABELS[input.zone] ?? input.zone}) le ${formatFullSlotUTC(created.scheduledAt.toISOString())}. Affectez une équipe infirmière.`,
            entityId: created.id,
          });
        }

        return created;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        // Latence Supabase pooler (~0,2–0,4 s/requête) : la transaction de
        // création enchaîne 9 requêtes (quota, collision, tarif, RDV, solde
        // via 6 agrégats, écriture ledger) — le défaut Prisma (5 s) est
        // parfois dépassé (« Transaction not found » → 500). 15 s = marge
        // saine sans dégrader l'UX (réponse reste de l'ordre de 1–3 s).
        timeout: 15_000,
        maxWait: 10_000,
      },
    );
    return toAppointmentDto(created);
  } catch (error) {
    if (error instanceof AppointmentError) throw error;
    if (error instanceof TokenError) {
      // Solde insuffisant (402) — message patient prêt à afficher.
      throw new AppointmentError(error.message, error.status);
    }
    // Deux créations concurrentes peuvent faire échouer la transaction
    // sérialisable : restituer une collision métier plutôt qu'un 500.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw new AppointmentError(
        "Ce créneau vient d'être réservé — choisissez un autre horaire",
        409,
      );
    }
    throw error;
  }
}

// Annulation patient (PATCH action=CANCEL) — FEATURE-TOKENS : si le RDV
// porte une réservation active, les Tokens sont LIBÉRÉS dans la même
// transaction (politique MVP « avant affectation : libération complète » —
// les frais après départ de l'équipe attendent le dispatch équipe, ADR-007).
export async function cancelAppointmentForPatient(
  patientId: string,
  appointmentId: string,
): Promise<AppointmentDto> {
  const existing = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: { select: { fullName: true } } },
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

  const cancelled = await db.$transaction(async tx => {
    const updated = await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        ...(existing.tokenState === "RESERVED"
          ? { tokenState: "RELEASED" as const }
          : {}),
      },
      include: { specialty: { select: { id: true, name: true } } },
    });
    const released = existing.tokenState === "RESERVED";
    if (released) {
      await releaseAppointmentTokens(
        tx,
        existing,
        "Annulation par le patient — libération de la réservation",
      );
    }
    // Task 35 — le Médecin Chef supervise l'activité : il doit savoir qu'un
    // créneau vient de se libérer (suivi de charge + ré-affectation éventuelle
    // d'une équipe). Même transaction : jamais d'annulation sans nouvelle.
    await notifyAdmins(tx, {
      type: "APPOINTMENT_CANCELLED",
      title: "Rendez-vous annulé par le patient",
      body: `${existing.patient.fullName} a annulé son rendez-vous du ${formatFullSlotUTC(existing.scheduledAt.toISOString())}.${released ? " Les Tokens réservés ont été libérés." : ""}`,
      entityId: existing.id,
    });
    return updated;
  });
  return toAppointmentDto(cancelled);
}

// Clôture par le Médecin Chef (PATCH admin action=DONE|CANCEL) — FEATURE-
// TOKENS : DONE transforme la réservation en DÉPENSE DÉFINITIVE (visite
// réalisée, ADR-007 §cycle) ; CANCEL libère la réservation (échec imputable
// à l'équipe / au système ⇒ le patient ne paie pas).
export async function closeAppointmentByAdmin(
  adminId: string,
  appointmentId: string,
  action: "DONE" | "CANCEL",
): Promise<AppointmentDto> {
  const existing = await db.appointment.findUnique({
    where: { id: appointmentId },
  });
  if (!existing) {
    throw new AppointmentError("Rendez-vous introuvable", 404);
  }
  if (!ACTIVE_STATUSES.includes(existing.status)) {
    throw new AppointmentError(
      action === "DONE"
        ? "Ce rendez-vous n'est plus actif — il ne peut pas être clôturé"
        : "Ce rendez-vous n'est plus actif — il ne peut pas être annulé",
      409,
    );
  }

  const closed = await db.$transaction(async tx => {
    const updated = await tx.appointment.update({
      where: { id: appointmentId },
      data:
        action === "DONE"
          ? {
              status: "DONE" as const,
              ...(existing.tokenState === "RESERVED"
                ? { tokenState: "CONSUMED" as const }
                : {}),
            }
          : {
              status: "CANCELLED" as const,
              cancelledAt: new Date(),
              ...(existing.tokenState === "RESERVED"
                ? { tokenState: "RELEASED" as const }
                : {}),
            },
      include: { specialty: { select: { id: true, name: true } } },
    });
    if (existing.tokenState === "RESERVED") {
      if (action === "DONE") {
        await consumeAppointmentTokens(tx, existing, adminId);
      } else {
        await releaseAppointmentTokens(
          tx,
          existing,
          "Annulation par l'équipe — libération de la réservation",
          adminId,
        );
      }
    }
    // Task 35 — le patient n'est jamais laissé dans l'incertitude : la clôture
    // (visite réalisée → Tokens consommés) et l'annulation équipe (Tokens
    // libérés) arrivent dans son fil InApp, dans la même transaction que la
    // mutation (jamais de RDV clôturé sans nouvelle).
    const slot = formatFullSlotUTC(existing.scheduledAt.toISOString());
    if (action === "DONE") {
      await notifyUsers(tx, [existing.patientId], {
        type: "APPOINTMENT_COMPLETED",
        title: "Consultation réalisée",
        body:
          existing.tokensReserved > 0
            ? `Votre consultation du ${slot} est terminée. ${existing.tokensReserved === 1 ? "1 Token a été débité" : `${existing.tokensReserved} Tokens ont été débités`} de votre portefeuille. Merci de votre confiance.`
            : `Votre consultation du ${slot} est terminée. Merci de votre confiance.`,
        entityId: existing.id,
      });
    } else {
      await notifyUsers(tx, [existing.patientId], {
        type: "APPOINTMENT_CANCELLED",
        title: "Rendez-vous annulé par l'équipe",
        body:
          existing.tokenState === "RESERVED"
            ? `Votre rendez-vous du ${slot} a été annulé par notre équipe — vos Tokens réservés ont été libérés. Vous pouvez reprendre un nouveau créneau depuis l'app.`
            : `Votre rendez-vous du ${slot} a été annulé par notre équipe. Vous pouvez reprendre un nouveau créneau depuis l'app.`,
        entityId: existing.id,
      });
    }
    return updated;
  });
  return toAppointmentDto(closed);
}
