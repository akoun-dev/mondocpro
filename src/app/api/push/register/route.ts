// POST /api/push/register — FEATURE-PUSH (Task 36).
// Enregistre (ou met à jour) le jeton FCM de l'appareil natif courant pour
// l'utilisateur connecté. Idempotent côté client : l'app renvoie son jeton à
// chaque ouverture / changement de session (upsert par jeton — un appareil
// ne pousse que pour le compte courant).
// Corps : { token, platform, deviceName?, appVersion? }
// 401 sans session · 400 si corps invalide · 200 { ok: true } sinon.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { registerDeviceToken } from "@/lib/push";

// Les jetons FCM font typiquement 140–220 caractères (parfois plus) ;
// plafond défensif aligné sur la colonne VARCHAR(4096).
const registerPushSchema = z.object({
    token: z.string().min(16).max(4096),
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

    const parsed = registerPushSchema.safeParse(body);
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
        await registerDeviceToken(guard.user.id, parsed.data);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[push register] erreur:", error);
        return NextResponse.json(
            { error: "Erreur interne — réessayez" },
            { status: 500 },
        );
    }
}
