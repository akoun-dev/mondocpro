// Notifications InApp — FEATURE-RDV / Task 24, étendues Task 35. Contrat
// partagé front/back : le DTO sérialisé par GET /api/notifications et le
// schéma Zod du marquage « lu » partagé par POST /api/notifications/read
// (même philosophie que updateProfileSchema dans lib/auth-schemas.ts — une
// seule source de vérité).
import { z } from "zod";
import type { Prisma } from "@prisma/client";

// Types de notifications InApp câblés — couverture complète des cycles métier
// (Task 35) : rappels de RDV, cycle des missions infirmières, cycle financier
// des recharges de Tokens (déclaration patient → décision Médecin Chef) et
// cycle des RDV (demande à domicile à affecter, annulations, clôture).
// L'enum DB (NotificationType) reste l'autorité ; toute valeur y est ajoutée
// d'abord (migration + supabase/schema.prisma), puis en miroir ici.
export const NOTIFICATION_TYPES = [
    // Cycle RDV
    "APPOINTMENT_REMINDER",
    "APPOINTMENT_REQUESTED",
    "APPOINTMENT_CANCELLED",
    "APPOINTMENT_COMPLETED",
    // Cycle missions infirmières
    "MISSION_ASSIGNED",
    "MISSION_STATUS_CHANGED",
    "VISIT_REPORT_SUBMITTED",
    // Cycle financier (recharges de Tokens)
    "RECHARGE_REQUESTED",
    "RECHARGE_CONFIRMED",
    "RECHARGE_REJECTED",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// Familles de types — critère de routage du clic (destination par rôle) et
// de choix d'icône dans le panneau. Préfixes stables : tout type de recharge
// commence par « RECHARGE_ », tout type de RDV par « APPOINTMENT_ ».
export function notificationFamily(type: string): "recharge" | "appointment" | "mission" {
    if (type.startsWith("RECHARGE_")) return "recharge";
    if (type.startsWith("APPOINTMENT_")) return "appointment";
    return "mission";
}

// ——— Helpers d'écriture (server only) ———
// Une notification ne doit JAMAIS faire échouer l'opération métier qui la
// porte : les appelants créent leurs notifications DANS la transaction métier
// (atomicité RDV + notification) via ces helpers, qui acceptent tout client
// Prisma (db ou tx). Anti-doublon structurel : @@unique(userId, type,
// entityId) — la creationMany reste simple, les entityId portés sont uniques
// par opération (id du RDV / de la transaction de recharge).
type NotifClient = Pick<Prisma.TransactionClient, "notification" | "user">;

export type NotificationSeed = {
    type: NotificationType;
    title: string;
    body: string;
    /** Entité source (appointmentId, id de recharge…) — nullable. */
    entityId?: string | null;
};

// Notifie des destinataires explicites (dédupliqués, vides ignorés).
export async function notifyUsers(
    client: NotifClient,
    userIds: string[],
    seed: NotificationSeed,
): Promise<void> {
    const unique = [...new Set(userIds)].filter(Boolean);
    if (unique.length === 0) return;
    await client.notification.createMany({
        data: unique.map((userId) => ({
            userId,
            type: seed.type,
            title: seed.title,
            body: seed.body,
            entityId: seed.entityId ?? null,
        })),
    });
}

// Notifie TOUS les comptes ADMIN (Médecin Chef) — file de travail collective
// : une seule notification par admin, chacun la lit et la marque indépendamment.
export async function notifyAdmins(
    client: NotifClient,
    seed: NotificationSeed,
): Promise<void> {
    const admins = await client.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
    });
    await notifyUsers(client, admins.map((a) => a.id), seed);
}

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
