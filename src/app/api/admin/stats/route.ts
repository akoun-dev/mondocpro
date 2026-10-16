// GET /api/admin/stats — indicateurs temps réel de l'accueil Médecin Chef
// (« Espace Médecin Chef »). ADMIN uniquement.
//
// Un seul appel charge les KPI, les séries de 14 jours et la charge par zone
// : l'accueil ne doit pas multiplier les requêtes (et les rendre incohérentes
// entre elles). Contrat dans .ai/API_CONTRACTS.md.
import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { getAdminStats } from "@/lib/admin-stats";

export async function GET() {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json(await getAdminStats());
  } catch (e) {
    console.error("[admin/stats/GET] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}
