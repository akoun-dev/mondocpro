import { db } from "@/lib/db";
import type { MissionStatus } from "@prisma/client";
import { ZONE_LABELS } from "@/lib/auth-schemas";
import type { AdminMissionBoard, DispatchMissionInput, VisitReportInput } from "@/lib/nurse-schemas";

export class NurseMissionError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

const missionInclude = {
  nurse: { select: { id: true, fullName: true, phone: true, zone: true } },
  patient: { select: { id: true, fullName: true, phone: true, zone: true } },
  appointment: { select: { scheduledAt: true, type: true, zone: true, reason: true, specialty: { select: { name: true } } } },
  visitReport: { select: { id: true, observations: true, actionsTaken: true, recommendations: true, vitalSigns: true, createdAt: true } },
} as const;

// Contrat MissionDto (nurse-schemas.ts) : scheduledAt / zone / type au premier
// niveau + appointment.specialty.name — la vue infirmier (nurse-missions-view)
// les consomme directement (formatSlot(mission.scheduledAt), mission.zone…).
// Sans cet aplatissement : Date(undefined) → crash client dès la première
// mission (incident audit 2026-10-03).
export function serializeMission(mission: any) {
  return {
    ...mission,
    scheduledAt: mission.appointment.scheduledAt.toISOString(),
    zone: mission.appointment.zone,
    type: mission.appointment.type,
    assignedAt: mission.assignedAt.toISOString(),
    appointment: {
      ...mission.appointment,
      scheduledAt: mission.appointment.scheduledAt.toISOString(),
      specialty: mission.appointment.specialty ?? null,
    },
    report: mission.visitReport ? { ...mission.visitReport, createdAt: mission.visitReport.createdAt.toISOString() } : null,
    visitReport: undefined,
  };
}

export async function listNurseMissions(nurseId: string) {
  const rows = await db.nurseMission.findMany({ where: { nurseId }, orderBy: { assignedAt: "desc" }, include: missionInclude });
  return rows.map(serializeMission);
}

export async function listAdminMissions() {
  const rows = await db.nurseMission.findMany({ orderBy: { assignedAt: "desc" }, include: missionInclude });
  return rows.map(serializeMission);
}

// ——— Tableau de bord dispatch (ADMIN, Task 35) ———
// GET /api/admin/missions renvoie AUSSI la file « à affecter » (RDV à
// domicile actifs sans mission) et l'annuaire des infirmiers — un seul appel
// suffit à l'interface de dispatch. Additif : `missions` reste inchangé
// (contrat Task 32, scripts d'audit préservés). Les DTO vivent dans
// nurse-schemas.ts (client-safe) pour être consommés par la vue admin.
export async function listAdminMissionBoard(): Promise<AdminMissionBoard> {
  const [missions, queueRows, nurses] = await Promise.all([
    listAdminMissions(),
    db.appointment.findMany({
      where: {
        type: "DOMICILE",
        status: { in: ["PENDING", "CONFIRMED"] },
        nurseMission: { is: null },
      },
      orderBy: { scheduledAt: "asc" },
      take: 50,
      include: {
        patient: { select: { fullName: true, phone: true } },
        specialty: { select: { name: true } },
      },
    }),
    db.user.findMany({
      where: { role: "NURSE" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, phone: true, zone: true },
    }),
  ]);
  return {
    missions,
    dispatchQueue: queueRows.map((a) => ({
      id: a.id,
      patientName: a.patient.fullName,
      patientPhone: a.patient.phone,
      zone: a.zone,
      type: a.type,
      scheduledAt: a.scheduledAt.toISOString(),
      specialtyName: a.specialty?.name ?? null,
      reason: a.reason,
      tokensReserved: a.tokensReserved,
    })),
    nurses,
  };
}

export async function getNurseMission(nurseId: string, id: string) {
  const mission = await db.nurseMission.findFirst({ where: { id, nurseId }, include: missionInclude });
  if (!mission) throw new NurseMissionError(404, "Mission introuvable");
  return serializeMission(mission);
}

const transitions: Record<MissionStatus, MissionStatus[]> = {
  ASSIGNED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export async function updateNurseMissionStatus(nurseId: string, id: string, status: MissionStatus) {
  const mission = await db.nurseMission.findFirst({ where: { id, nurseId }, select: { id: true, patientId: true, assignedById: true, status: true } });
  if (!mission) throw new NurseMissionError(404, "Mission introuvable");
  if (!transitions[mission.status].includes(status)) throw new NurseMissionError(409, "Transition de statut non autorisée");
  const now = new Date();
  const data = {
    status,
    ...(status === "ACCEPTED" ? { acceptedAt: now } : {}),
    ...(status === "IN_PROGRESS" ? { startedAt: now } : {}),
    ...(status === "COMPLETED" ? { completedAt: now } : {}),
    ...(status === "CANCELLED" ? { cancelledAt: now } : {}),
  };
  const updated = await db.$transaction(async (tx) => {
    const next = await tx.nurseMission.update({ where: { id }, data, include: missionInclude });
    const recipients = [...new Set([mission.patientId, mission.assignedById])];
    await tx.notification.createMany({
      data: recipients.map(userId => ({
        userId,
        type: "MISSION_STATUS_CHANGED" as const,
        title: "Mission mise à jour",
        body: `La mission est maintenant « ${statusLabel(status)} ».`,
        entityId: `${id}:${status}`,
      })),
    });
    return next;
  });
  return serializeMission(updated);
}

function statusLabel(status: MissionStatus) {
  return { ASSIGNED: "à traiter", ACCEPTED: "acceptée", IN_PROGRESS: "en cours", COMPLETED: "terminée", CANCELLED: "annulée" }[status];
}

// « le vendredi 9 octobre à 10:00 » — heure Abidjan = UTC+0, même convention
// que reminders.ts (l'heure affichée est l'heure locale du patient).
function formatSlotFr(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Abidjan",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export async function createVisitReport(nurseId: string, id: string, input: VisitReportInput) {
  const mission = await db.nurseMission.findFirst({ where: { id, nurseId }, include: { visitReport: true } });
  if (!mission) throw new NurseMissionError(404, "Mission introuvable");
  if (mission.status !== "IN_PROGRESS") throw new NurseMissionError(409, "La mission doit être en cours");
  if (mission.visitReport) throw new NurseMissionError(409, "Un compte-rendu existe déjà pour cette mission");
  const report = await db.$transaction(async (tx) => {
    const created = await tx.visitReport.create({ data: { missionId: id, nurseId, ...input } });
    await tx.notification.createMany({
      data: [...new Set([mission.patientId, mission.assignedById])].map(userId => ({
        userId,
        type: "VISIT_REPORT_SUBMITTED" as const,
        title: "Compte rendu disponible",
        body: "Le compte rendu de votre mission est disponible.",
        entityId: `${id}:report`,
      })),
    });
    return created;
  });
  return { ...report, createdAt: report.createdAt.toISOString(), updatedAt: report.updatedAt.toISOString() };
}

export async function dispatchMission(adminId: string, input: DispatchMissionInput, missionId?: string) {
  const current = missionId ? await db.nurseMission.findUnique({ where: { id: missionId } }) : null;
  const appointmentId = missionId ? current?.appointmentId : input.appointmentId;
  const [appointment, nurse] = await Promise.all([
    appointmentId ? db.appointment.findUnique({ where: { id: appointmentId } }) : null,
    db.user.findUnique({ where: { id: input.nurseId }, select: { id: true, role: true, zone: true } }),
  ]);
  if (!appointment) throw new NurseMissionError(404, "Rendez-vous introuvable");
  if (!nurse || nurse.role !== "NURSE") throw new NurseMissionError(400, "Utilisateur infirmier invalide");
  if (nurse.zone !== appointment.zone) throw new NurseMissionError(400, "L'infirmier doit couvrir la zone du rendez-vous");
  const existing = appointmentId ? await db.nurseMission.findUnique({ where: { appointmentId } }) : null;
  if (missionId && (!existing || existing.id !== missionId)) throw new NurseMissionError(404, "Mission introuvable");
  if (!missionId && existing) throw new NurseMissionError(409, "Ce rendez-vous est déjà dispatché");
  const mission = await db.$transaction(async (tx) => {
    const next = missionId
      ? await tx.nurseMission.update({ where: { id: missionId }, data: { nurseId: input.nurseId, assignedById: adminId, assignedAt: new Date(), status: "ASSIGNED", acceptedAt: null, startedAt: null, completedAt: null, cancelledAt: null }, include: missionInclude })
      : await tx.nurseMission.create({ data: { appointmentId: appointmentId!, patientId: appointment.patientId, nurseId: input.nurseId, assignedById: adminId }, include: missionInclude });
    await tx.notification.create({ data: { userId: input.nurseId, type: "MISSION_ASSIGNED", title: "Nouvelle mission", body: `Une mission de soins à ${ZONE_LABELS[appointment.zone] ?? appointment.zone} vous a été attribuée pour le ${formatSlotFr(appointment.scheduledAt)}. Consultez l'onglet Missions pour l'accepter.`, entityId: `${next.id}:assignment:${next.assignedAt.getTime()}` } });
    return next;
  });
  return serializeMission(mission);
}
