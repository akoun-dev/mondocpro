// GET /api/admin/patients — Annuaire des patients (FEATURE-ANNUAIRE-ADMIN).
// ADMIN (Médecin Chef) uniquement. Recherche (nom ou téléphone), filtre par
// zone et par état de compte. Chaque ligne porte ses compteurs de rendez-vous
// pour éviter un aller-retour par fiche.
import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { parseQuery } from "@/lib/api-query";
import { listAdminPatients } from "@/lib/admin-users";
import { adminUserListQuerySchema } from "@/lib/admin-users-schemas";

export async function GET(request: Request) {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) return guard.response;

  const query = parseQuery(adminUserListQuerySchema, request);
  if (!query.ok) {
    return NextResponse.json(
      { error: "Filtres invalides", details: query.fieldErrors },
      { status: 400 },
    );
  }

  try {
    const patients = await listAdminPatients(query.data);
    return NextResponse.json({ patients });
  } catch (e) {
    console.error("[admin/patients/GET] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}