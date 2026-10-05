// GET /api/admin/teams — Supervision et dispatch des équipes
// (FEATURE-ANNUAIRE-ADMIN). ADMIN uniquement.
//
// Une seule requête de vue pour la carte « Équipes » : charge par infirmier,
// file « à affecter » et répartition par zone. La file vient de la même
// fonction que GET /api/admin/missions — les deux écrans ne peuvent donc pas
// afficher des files différentes.
import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { getAdminTeamBoard } from "@/lib/admin-users";

export async function GET() {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) return guard.response;

  try {
    const teams = await getAdminTeamBoard();
    return NextResponse.json({ teams });
  } catch (e) {
    console.error("[admin/teams/GET] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}