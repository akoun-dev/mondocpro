// GET /api/admin/patients/:id — Dossier patient (FEATURE-ANNUAIRE-ADMIN).
// ADMIN uniquement. Renvoie l'identité, les compteurs du dossier (non filtrés)
// et l'historique des consultations — chaque ligne porte son compte rendu de
// visite quand la consultation a eu lieu à domicile.
// Query : ?period=all|30d|90d|1y · ?status=all|done|upcoming|cancelled · ?zone=
import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { parseQuery } from "@/lib/api-query";
import { AdminUserError, getAdminPatient } from "@/lib/admin-users";
import { patientHistoryQuerySchema } from "@/lib/admin-users-schemas";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const query = parseQuery(patientHistoryQuerySchema, request);
  if (!query.ok) {
    return NextResponse.json(
      { error: "Filtres invalides", details: query.fieldErrors },
      { status: 400 },
    );
  }

  try {
    const patient = await getAdminPatient(id, query.data);
    return NextResponse.json({ patient });
  } catch (e) {
    if (e instanceof AdminUserError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/patients/GET/:id] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}