// POST /api/push/unregister — FEATURE-PUSH (Task 36) · ADR-010 (Task 40).
// Révoque l'identifiant de l'appareil courant (déconnexion de l'app) ou, en
// secours, TOUS les identifiants de l'utilisateur. L'identifiant peut être
// un jeton FCM (canal distant dormant, ADR-009) ou une clé de sondage du
// Background Runner (ADR-010) — la révocation est identique (hash lookup).
// Idempotent : supprimer un identifiant déjà absent est un succès (200) —
// la déconnexion ne doit jamais échouer pour autant.
// Corps : { token } OU { all: true } — exactement une des deux formes.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { removeAllDeviceTokens, removeDeviceToken } from "@/lib/push";

const unregisterPushSchema = z
    .object({
        token: z.string().min(16).max(4096).optional(),
        all: z.boolean().optional(),
    })
    .refine((body) => (body.all === true) !== (body.token !== undefined), {
        message:
            "Fournir soit { token }, soit { all: true } — pas les deux ni aucun",
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

    const parsed = unregisterPushSchema.safeParse(body);
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
        if (parsed.data.all) {
            await removeAllDeviceTokens(guard.user.id);
        } else if (parsed.data.token) {
            await removeDeviceToken(parsed.data.token);
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[push unregister] erreur:", error);
        return NextResponse.json(
            { error: "Erreur interne — réessayez" },
            { status: 500 },
        );
    }
}
