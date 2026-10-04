// Notifications InApp — FEATURE-RDV / Task 24. Contrat partagé front/back :
// le DTO sérialisé par GET /api/notifications et le schéma Zod du marquage
// « lu » partagé par POST /api/notifications/read (même philosophie que
// updateProfileSchema dans lib/auth-schemas.ts — une seule source de vérité).
import { z } from "zod";

// Types de notifications InApp câblés : rappels de RDV et cycle des missions
// infirmières. L'enum DB (NotificationType) reste l'autorité ; les futures
// alertes de santé et changements de statut RDV s'ajouteront ici en miroir.
export const NOTIFICATION_TYPES = [
    "APPOINTMENT_REMINDER",
    "MISSION_ASSIGNED",
    "MISSION_STATUS_CHANGED",
    "VISIT_REPORT_SUBMITTED",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// Icône/lisible par le front : le type reste opaque (string) côté client.
export type NotificationDto = {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    /** Entité source (ex: appointmentId) — nullable, sert de navigation. */
    entityId: string | null;
    /** ISO string ou null si non lue. */
    readAt: string | null;
    /** ISO string (tri du fil). */
    createdAt: string;
};

export type NotificationsResponse = {
    notifications: NotificationDto[];
    unreadCount: number;
};

// POST /api/notifications/read — marquer UNE notification (id) ou TOUTES
// (all: true). Exactement une des deux formes doit être fournie : un corps
// ambigu (les deux, ou ni l'un ni l'autre) est refusé 400.
export const markNotificationsReadSchema = z
    .object({
        id: z.string().min(1).optional(),
        all: z.boolean().optional(),
    })
    .refine(
        (body) => (body.all === true) !== (body.id !== undefined),
        {
            message:
                "Fournir soit { all: true }, soit { id } — pas les deux ni aucun",
        },
    );

export type MarkNotificationsReadInput = z.infer<
    typeof markNotificationsReadSchema
>;
