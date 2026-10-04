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
  nurse: { id: string; fullName: string; phone: string; zone: string };
  patient: { id: string; fullName: string; phone: string; zone: string };
  appointment: { scheduledAt: string; type: string; zone: string; reason: string | null };
  report: {
    id: string;
    observations: string;
    actionsTaken: string | null;
    recommendations: string | null;
    vitalSigns: unknown;
    createdAt: string;
  } | null;
};
