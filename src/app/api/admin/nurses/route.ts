// GET|POST /api/admin/nurses — Annuaire des infirmiers + création d'un compte
// (FEATURE-ANNUAIRE-ADMIN, demande PO 2026-10). ADMIN uniquement.
// GET : chaque ligne indique les missions en cours, celles en attente
// d'acceptation et les visites terminées dans le mois : c'est la matière de la
// vue Équipes et de la supervision. Mêmes filtres que l'annuaire patients.
// POST : workflow complet d'onboarding — identité + zone + téléphone + mot de
// passe (choisi ou généré). Rôle NURSE forcé côté serveur ; compte actif dès
// la création, l'infirmier peut se connecter immédiatement.
import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { parseQuery } from "@/lib/api-query";
import { AdminUserError, createAdminNurse, listAdminNurseLoads } from "@/lib/admin-users";
import {
  adminUserListQuerySchema,
  createNurseSchema,
} from "@/lib/admin-users-schemas";

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
    const nurses = await listAdminNurseLoads(query.data);
    return NextResponse.json({ nurses });
  } catch (e) {
    console.error("[admin/nurses/GET] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide (JSON attendu)" },
      { status: 400 },
    );
  }

  const parsed = createNurseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Veuillez corriger les champs signalés",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const result = await createAdminNurse(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof AdminUserError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/nurses/POST] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}