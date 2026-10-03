// GET /api/tariffs — Grille tarifaire en vigueur (FEATURE-TOKENS, ADR-007).
// PATIENT uniquement : consommée par le wizard de réservation pour afficher
// le coût exact AVANT confirmation (tokens + équivalent FCFA). Les valeurs
// sont éditées par le Médecin Chef (table tariff_configs) — le serveur
// revalide toujours de toute façon à la soumission du RDV.
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listTariffsForAdmin } from "@/lib/tokens";

export async function GET() {
  const guard = await requireRole(["PATIENT"]);
  if (!guard.ok) return guard.response;

  try {
    const tariffs = await listTariffsForAdmin();
    return NextResponse.json({ tariffs });
  } catch (e) {
    console.error("[tariffs/GET] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}
