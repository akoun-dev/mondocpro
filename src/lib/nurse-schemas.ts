import { z } from "zod";

export const missionStatusSchema = z.enum([
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const updateMissionStatusSchema = z.object({
  status: missionStatusSchema,
});

const optionalText = z.string().trim().max(5000).optional().nullable();

export const visitReportSchema = z.object({
  observations: z.string().trim().min(1).max(10000),
  actionsTaken: optionalText,
  recommendations: optionalText,
  vitalSigns: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

export const dispatchMissionSchema = z.object({
  appointmentId: z.string().min(1),
  nurseId: z.string().min(1),
});

export const reassignMissionSchema = z.object({
  nurseId: z.string().min(1),
});

export type MissionStatus = z.infer<typeof missionStatusSchema>;
export type UpdateMissionStatusInput = z.infer<typeof updateMissionStatusSchema>;
export type VisitReportInput = z.infer<typeof visitReportSchema>;
export type DispatchMissionInput = z.infer<typeof dispatchMissionSchema>;

export type MissionDto = {
  id: string;
  appointmentId: string;
  status: MissionStatus;
  assignedAt: string;
  acceptedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  nurse: { id: string; fullName: string; phone: string; zone: string };
  patient: { id: string; fullName: string; phone: string; zone: string };
  // Champs APLATIS par serializeMission (lib/nurse.ts) au premier niveau —
  // accès direct sans passer par `appointment` (fix BUG-003, audit 2026-10).
  scheduledAt: string;
  zone: string;
  type: string;
  appointment: {
    scheduledAt: string;
    type: string;
    zone: string;
    reason: string | null;
    specialty: { name: string } | null;
  };
  report: {
    id: string;
    observations: string;
    actionsTaken: string | null;
    recommendations: string | null;
    vitalSigns: unknown;
    createdAt: string;
  } | null;
  visitReport?: undefined;
};

// ——— Task 35 — Supervision ADMIN (client-safe) ———
// File « à affecter » : RDV à domicile actifs sans mission — payload
// sérialisé par GET /api/admin/missions (contrat étendu, additif).
export type DispatchQueueItem = {
  /** appointmentId — clé du POST /api/admin/missions. */
  id: string;
  patientName: string;
  patientPhone: string;
  zone: string;
  type: string;
  scheduledAt: string;
  specialtyName: string | null;
  reason: string | null;
  tokensReserved: number;
};

/** Annuaire des infirmiers (affectation / réaffectation, filtré par zone). */
export type NurseDirectoryItem = {
  id: string;
  fullName: string;
  phone: string;
  zone: string;
};

export type AdminMissionBoard = {
  missions: MissionDto[];
  dispatchQueue: DispatchQueueItem[];
  nurses: NurseDirectoryItem[];
};

// Libellés et classes de badge des statuts — source unique partagée par la
// vue infirmier (nurse-missions-view) et la vue admin (missions-view).
export const MISSION_STATUS_LABELS: Record<MissionStatus, string> = {
  ASSIGNED: "À traiter",
  ACCEPTED: "Acceptée",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
};

export const MISSION_STATUS_CLASSES: Record<MissionStatus, string> = {
  ASSIGNED: "bg-primary/10 text-primary",
  ACCEPTED: "bg-success/15 text-success-foreground",
  IN_PROGRESS: "bg-warning/20 text-warning-foreground",
  COMPLETED: "bg-success/15 text-success-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
};
