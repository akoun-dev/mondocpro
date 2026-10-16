// GET  /api/admin/sensibilisations — annuaire éditorial COMPLET (toutes zones,
// gestion Médecin Chef). POST — publication d'un conseil ou d'une alerte
// santé (contrat API_CONTRACTS.md, FEATURE-SENSO phase 2). ADMIN uniquement.
// Règles métier portées par src/lib/sensibilisations.ts (bornes zod,
// déduplication des zones).
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
    SensibilisationError,
    createSensibilisation,
    listAllSensibilisations,
} from "@/lib/sensibilisations";
import { createSensibilisationSchema } from "@/lib/sensibilisations-schemas";

type GuardedHandler = () => Promise<NextResponse>;

// Factorise la garde ADMIN + gestion d'erreurs SensibilisationError.
async function guarded(handler: GuardedHandler): Promise<NextResponse> {
    const guard = await requireRole(["ADMIN"]);
    if (!guard.ok) return guard.response;
    try {
        return await handler();
    } catch (e) {
        if (e instanceof SensibilisationError) {
            return NextResponse.json(
                { error: e.message },
                { status: e.status },
            );
        }
        console.error("[admin/sensibilisations] erreur:", e);
        return NextResponse.json(
            { error: "Erreur interne — réessayez" },
            { status: 500 },
        );
    }
}

export async function GET() {
    return guarded(async () => {
        const sensibilisations = await listAllSensibilisations();
        return NextResponse.json({ sensibilisations });
    });
}

export async function POST(request: Request) {
    return guarded(async () => {
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: "Corps de requête invalide (JSON attendu)" },
                { status: 400 },
            );
        }

        const parsed = createSensibilisationSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: "Veuillez corriger les champs signalés",
                    details: parsed.error.issues.map((i) => ({
                        field: i.path.join("."),
                        message: i.message,
                    })),
                },
                { status: 400 },
            );
        }

        const sensibilisation = await createSensibilisation(parsed.data);
        return NextResponse.json({ sensibilisation }, { status: 201 });
    });
}
