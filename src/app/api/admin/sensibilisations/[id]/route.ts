// PATCH  /api/admin/sensibilisations/:id — édition partielle (titre, contenu,
// catégorie, ciblage zones). DELETE — suppression définitive (204 ; 404 si
// déjà supprimée). ADMIN uniquement (contrat API_CONTRACTS.md, FEATURE-SENSO
// phase 2).
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
    SensibilisationError,
    deleteSensibilisation,
    updateSensibilisation,
} from "@/lib/sensibilisations";
import { updateSensibilisationSchema } from "@/lib/sensibilisations-schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
    const guard = await requireRole(["ADMIN"]);
    if (!guard.ok) return guard.response;

    const { id } = await context.params;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Corps de requête invalide (JSON attendu)" },
            { status: 400 },
        );
    }

    const parsed = updateSensibilisationSchema.safeParse(body);
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

    try {
        const sensibilisation = await updateSensibilisation(id, parsed.data);
        return NextResponse.json({ sensibilisation });
    } catch (e) {
        if (e instanceof SensibilisationError) {
            return NextResponse.json(
                { error: e.message },
                { status: e.status },
            );
        }
        console.error("[admin/sensibilisations/PATCH] erreur:", e);
        return NextResponse.json(
            { error: "Erreur interne — réessayez" },
            { status: 500 },
        );
    }
}

export async function DELETE(_request: Request, context: RouteContext) {
    const guard = await requireRole(["ADMIN"]);
    if (!guard.ok) return guard.response;

    const { id } = await context.params;

    try {
        await deleteSensibilisation(id);
        return new NextResponse(null, { status: 204 });
    } catch (e) {
        if (e instanceof SensibilisationError) {
            return NextResponse.json(
                { error: e.message },
                { status: e.status },
            );
        }
        console.error("[admin/sensibilisations/DELETE] erreur:", e);
        return NextResponse.json(
            { error: "Erreur interne — réessayez" },
            { status: 500 },
        );
    }
}
