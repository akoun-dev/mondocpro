// GET /api/admin/recharges — File de validation des recharges de Tokens
// (FEATURE-TOKENS, ADR-007). ADMIN (Médecin Chef) uniquement : recharges
// PENDING à rapprocher (paiement Wave/OM/MTN/Visa reçu ?) + décisions
// récentes (traçabilité) — contrat API_CONTRACTS.md.
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listRechargesForAdmin } from "@/lib/tokens";

export async function GET() {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) return guard.response;

  try {
    const recharges = await listRechargesForAdmin();
    return NextResponse.json(recharges);
  } catch (e) {
    console.error("[admin/recharges/GET] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}
