// POST /api/notifications/read — marquer des notifications InApp comme lues
// (Task 24). Deux formes acceptées (exactement une) :
//   { all: true }  → toutes les notifications non lues de la session ;
//   { id: string } → une seule notification.
// Sécurité : le user ciblé est TOUJOURS celui de la session — un `id`
// inexistant ou appartenant à un autre utilisateur est indistinguable (404
// identique, pas de fuite d'existence).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { markNotificationsReadSchema } from "@/lib/notifications";

export async function POST(request: Request) {
    const guard = await requireRole(["PATIENT", "NURSE", "ADMIN"]);
    if (!guard.ok) return guard.response;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Corps de requête invalide (JSON attendu)" },
            { status: 400 }
        );
    }

    const parsed = markNotificationsReadSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            {
                error: "Veuillez corriger les champs signalés",
                details: parsed.error.issues.map((i) => ({
                    field: i.path.join("."),
                    message: i.message,
                })),
            },
            { status: 400 }
        );
    }

    try {
        const readAt = new Date();
        const where = parsed.data.all
            ? { userId: guard.user.id, readAt: null }
            : { userId: guard.user.id, id: parsed.data.id as string };

        const result = await db.notification.updateMany({
            where,
            data: { readAt },
        });

        if (!parsed.data.all && result.count === 0) {
            return NextResponse.json(
                { error: "Notification introuvable" },
                { status: 404 }
            );
        }

        const unreadCount = await db.notification.count({
            where: { userId: guard.user.id, readAt: null },
        });
        return NextResponse.json({ ok: true, unreadCount });
    } catch (e) {
        console.error("[notifications/read POST] erreur:", e);
        return NextResponse.json(
            { error: "Erreur interne — réessayez" },
            { status: 500 }
        );
    }
}
