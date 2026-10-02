// PATCH /api/admin/specialties/:id — renommage et/ou activation (contrat
// API_CONTRACTS.md). DELETE — suppression (409 si des RDV y sont rattachés,
// la désactivation douce est le chemin recommandé). ADMIN uniquement.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { SpecialtyError, deleteSpecialty, updateSpecialty } from "@/lib/specialties";

const updateSpecialtySchema = z.object({
  name: z.string().min(1, "Nom requis").optional(),
  isActive: z.boolean().optional(),
});

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

  const parsed = updateSpecialtySchema.safeParse(body);
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
    const specialty = await updateSpecialty(id, parsed.data);
    return NextResponse.json({ specialty });
  } catch (e) {
    if (e instanceof SpecialtyError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/specialties/PATCH] erreur:", e);
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
    await deleteSpecialty(id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof SpecialtyError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/specialties/DELETE] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}
