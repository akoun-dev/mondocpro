// GET /api/admin/overview — tableau de bord Médecin Chef (FEATURE-ADMIN-
// DASHBOARD) : KPI (patients, infirmiers, missions, file de dispatch,
// recharges PENDING, RDV du jour), visites terminées 7 jours, répartition
// par zone et trois files d'action. ADMIN uniquement. Agrégation portée par
// src/lib/admin-overview.ts — un seul aller-retour HTTP pour la vue Accueil.
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getAdminOverview } from "@/lib/admin-overview";

export async function GET() {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) return guard.response;

  try {
    const overview = await getAdminOverview();
    return NextResponse.json({ overview });
  } catch (e) {
    console.error("[admin/overview/GET] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}
