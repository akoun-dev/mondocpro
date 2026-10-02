// GET /api/sensibilisations — Fil de sensibilisations santé (contrat API_CONTRACTS.md)
// Authentifié (tous rôles) ; contenu filtré par la zone du lecteur
// (ciblage vide = visible de toutes les zones).
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listSensibilisationsForZone } from "@/lib/sensibilisations";

export async function GET() {
  const guard = await requireRole([
    "PATIENT",
    "INFIRMIER",
    "ADMIN",
  ]);
  if (!guard.ok) return guard.response;

  try {
    const sensibilisations = await listSensibilisationsForZone(guard.user.zone);
    return NextResponse.json({ sensibilisations });
  } catch (e) {
    console.error("[sensibilisations/GET] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}
