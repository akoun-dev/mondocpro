// POST /api/native/device-key — ADR-010 (Task 40).
// Émet une clé de sondage pour le Background Runner de l'appareil natif :
// le runner la présente en `Authorization: Bearer` sur
// GET /api/notifications/poll pour transformer les nouvelles notifications
// en notifications locales — même l'app fermée, sans Firebase.
//  - Auth par SESSION (cookie) : seul l'app web provisionne, jamais le runner.
//  - La clé en clair est retournée UNE seule fois ; la base ne stocke que
//    son SHA-256 (lib/push.ts). TTL 180 jours (DEVICE_KEY_TTL_DAYS).
//  - Révocation : POST /api/push/unregister { token: key } au logout +
//    purge de toutes les clés à la réinitialisation de mot de passe.
// 401 sans session · 400 si corps invalide · 200 { key, expiresAt } sinon.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { issueDeviceKey } from "@/lib/push";

const issueDeviceKeySchema = z.object({
    platform: z.enum(["android", "ios", "web"]),
    deviceName: z.string().max(120).optional(),
    appVersion: z.string().max(40).optional(),
});

export async function POST(request: Request) {
    const guard = await requireRole(["PATIENT", "NURSE", "ADMIN"]);
    if (!guard.ok) return guard.response;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
    }

    const parsed = issueDeviceKeySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            {
                error: "Corps invalide",
                details: parsed.error.issues.map((i) => ({
                    field: i.path.join("."),
                    message: i.message,
                })),
            },
            { status: 400 },
        );
    }

    try {
        const { key, expiresAt } = await issueDeviceKey(guard.user.id, parsed.data);
        return NextResponse.json({
            key,
            expiresAt: expiresAt.toISOString(),
        });
    } catch (error) {
        console.error("[device-key] erreur d'émission:", error);
        return NextResponse.json(
            { error: "Erreur interne — réessayez" },
            { status: 500 },
        );
    }
}
