// GET /api/notifications — fil InApp de l'utilisateur connecté (Task 24).
// Chacun ne voit JAMAIS que ses propres notifications (filtrage serveur par
// la session) ; les rappels de RDV sont la première source câblée (scheduler
// src/lib/reminders.ts), le fil alimentera ensuite les alertes de santé etc.
// Réponse : les 50 plus récentes + nombre de non-lues (badge de la cloche).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import type { NotificationDto } from "@/lib/notifications";

// Sélection explicite (jamais de select * — le modèle peut s'étendre).
const LIST_TAKE = 50;

export async function GET() {
    const guard = await requireRole(["PATIENT", "INFIRMIER", "ADMIN"]);
    if (!guard.ok) return guard.response;

    try {
        const [notifications, unreadCount] = await Promise.all([
            db.notification.findMany({
                where: { userId: guard.user.id },
                orderBy: { createdAt: "desc" },
                take: LIST_TAKE,
                select: {
                    id: true,
                    type: true,
                    title: true,
                    body: true,
                    entityId: true,
                    readAt: true,
                    createdAt: true,
                },
            }),
            db.notification.count({
                where: { userId: guard.user.id, readAt: null },
            }),
        ]);

        const payload: NotificationDto[] = notifications.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            entityId: n.entityId,
            readAt: n.readAt ? n.readAt.toISOString() : null,
            createdAt: n.createdAt.toISOString(),
        }));

        return NextResponse.json({
            notifications: payload,
            unreadCount,
        });
    } catch (e) {
        console.error("[notifications GET] erreur:", e);
        return NextResponse.json(
            { error: "Erreur interne — réessayez" },
            { status: 500 }
        );
    }
}
