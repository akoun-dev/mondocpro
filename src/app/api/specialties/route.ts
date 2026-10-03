// GET /api/specialties — catalogue des spécialités ACTIVES (contrat
// API_CONTRACTS.md). Tous les rôles authentifiés (le wizard patient en a
// besoin ; l'ADMIN utilise /api/admin/specialties pour la gestion complète).
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listActiveSpecialties } from "@/lib/specialties";

export async function GET() {
  const guard = await requireRole(["PATIENT", "NURSE", "ADMIN"]);
  if (!guard.ok) return guard.response;

  try {
    const specialties = await listActiveSpecialties();
    return NextResponse.json({ specialties });
  } catch (e) {
    console.error("[specialties/GET] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}
