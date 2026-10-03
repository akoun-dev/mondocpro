// Notifications InApp — FEATURE-RDV / Task 24. Contrat partagé front/back :
// le DTO sérialisé par GET /api/notifications et le schéma Zod du marquage
// « lu » partagé par POST /api/notifications/read (même philosophie que
// updateProfileSchema dans lib/auth-schemas.ts — une seule source de vérité).
import { z } from "zod";

// Types de notifications — un seul canal câblé au MVP : le rappel « 24 h avant
// RDV » créé par le scheduler (src/lib/reminders.ts). L'enum DB (NotificationType)
// est l'autorité ; les suivants (alertes de santé locales, changements de statut
// RDV) étendront les deux en miroir.
export const NOTIFICATION_TYPES = ["APPOINTMENT_REMINDER"] as const;
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
