// GET  /api/admin/specialties — catalogue COMPLET (actives + désactivées,
// gestion Médecin Chef). POST — création d'une spécialité (contrat
// API_CONTRACTS.md). ADMIN uniquement. Règles métier portées par
// src/lib/specialties.ts (nom 2–80, unicité 409).
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  SpecialtyError,
  createSpecialty,
  listAllSpecialties,
} from "@/lib/specialties";

const createSpecialtySchema = z.object({
  name: z.string({ message: "Nom requis" }).min(1, "Nom requis"),
  sortOrder: z.number().int().min(0).optional(),
});

type GuardedHandler = () => Promise<NextResponse>;

// Factorise la garde ADMIN + gestion d'erreurs SpecialtyError.
async function guarded(handler: GuardedHandler): Promise<NextResponse> {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) return guard.response;
  try {
    return await handler();
  } catch (e) {
    if (e instanceof SpecialtyError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/specialties] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return guarded(async () => {
    const specialties = await listAllSpecialties();
    return NextResponse.json({ specialties });
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

    const parsed = createSpecialtySchema.safeParse(body);
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

    const specialty = await createSpecialty(
      parsed.data.name,
      parsed.data.sortOrder,
    );
    return NextResponse.json({ specialty }, { status: 201 });
  });
}
