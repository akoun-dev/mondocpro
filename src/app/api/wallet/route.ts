// GET /api/wallet — Portefeuille de Tokens du patient (FEATURE-TOKENS,
// ADR-007). PATIENT uniquement : solde disponible, Tokens réservés, dépenses
// cumulées + 50 derniers mouvements du ledger (contrat API_CONTRACTS.md).
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getWalletForPatient } from "@/lib/tokens";

export async function GET() {
  const guard = await requireRole(["PATIENT"]);
  if (!guard.ok) return guard.response;

  try {
    const wallet = await getWalletForPatient(guard.user.id);
    return NextResponse.json(wallet);
  } catch (e) {
    console.error("[wallet/GET] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}
