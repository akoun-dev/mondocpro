// GET /api/sensibilisations/:id — Détail d'une sensibilisation (contrat API_CONTRACTS.md)
// Authentifié (tous rôles) ; 404 si absent ou hors ciblage de zone du lecteur
// (indistinguables — pas de fuite d'existence).
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSensibilisationForZone } from "@/lib/sensibilisations";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole([
    "PATIENT",
    "INFIRMIER",
    "ADMIN",
  ]);
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const sensibilisation = await getSensibilisationForZone(id, guard.user.zone);
    if (!sensibilisation) {
      return NextResponse.json(
        { error: "Sensibilisation introuvable" },
        { status: 404 },
      );
    }
    return NextResponse.json({ sensibilisation });
  } catch (e) {
    console.error("[sensibilisations/GET:id] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}
