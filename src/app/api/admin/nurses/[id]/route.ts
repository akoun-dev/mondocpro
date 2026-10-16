// GET /api/admin/nurses/:id — Fiche infirmier (FEATURE-ANNUAIRE-ADMIN).
// ADMIN uniquement. Charge courante + historique de missions (MissionDto, même
// sérialisation que la vue infirmier) pour que le Médecin Chef puisse juger
// d'un effectif sur son historique, pas sur la seule journée en cours.
import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { AdminUserError, getAdminNurse } from "@/lib/admin-users";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const nurse = await getAdminNurse(id);
    return NextResponse.json({ nurse });
  } catch (e) {
    if (e instanceof AdminUserError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/nurses/GET/:id] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}