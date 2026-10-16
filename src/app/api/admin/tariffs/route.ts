// GET /api/admin/tariffs — Grille tarifaire complète pour le Médecin Chef
// (FEATURE-TOKENS, ADR-007 — tarifs configurables ADMIN, demande PO
// 2026-10-03). ADMIN uniquement : chaque poste (clé métier → prix en
// Tokens) avec libellé FR, description et dernière modification (audit).
// Les clés manquantes en base sont ré-tablées au tarif par défaut
// (auto-réparation idempotente — cf. listTariffsForAdmin).
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listTariffsForAdmin } from "@/lib/tokens";

export async function GET() {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) return guard.response;

  try {
    const tariffs = await listTariffsForAdmin();
    return NextResponse.json({ tariffs });
  } catch (e) {
    console.error("[admin/tariffs/GET] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}
