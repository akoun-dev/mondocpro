// GET /api/admin/nurses — Annuaire des infirmiers et charge courante
// (FEATURE-ANNUAIRE-ADMIN). ADMIN uniquement.
// Chaque ligne indique les missions en cours, celles en attente d'acceptation
// et les visites terminées dans le mois : c'est la matière de la vue Équipes
// et de la supervision. Mêmes filtres que l'annuaire patients.
import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { parseQuery } from "@/lib/api-query";
import { listAdminNurseLoads } from "@/lib/admin-users";
import { adminUserListQuerySchema } from "@/lib/admin-users-schemas";

export async function GET(request: Request) {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) return guard.response;

  const query = parseQuery(adminUserListQuerySchema, request);
  if (!query.ok) {
    return NextResponse.json(
      { error: "Filtres invalides", details: query.fieldErrors },
      { status: 400 },
    );
  }

  try {
    const nurses = await listAdminNurseLoads(query.data);
    return NextResponse.json({ nurses });
  } catch (e) {
    console.error("[admin/nurses/GET] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}