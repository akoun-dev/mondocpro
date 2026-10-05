// PATCH /api/admin/users/:id — Activation / suspension d'un compte
// (FEATURE-ANNUAIRE-ADMIN). ADMIN uniquement.
// { isActive: false } → compte suspendu : sessions révoquées, connexion
// refusée (src/lib/auth.ts), pushing coupé. { isActive: true } → réactivation.
//
// La route ne filtre pas par rôle : la règle « un infirmier avec des missions
// en cours ne peut pas être suspendu » appartient au service (setAccountActive),
// qui doit consulter les missions dans la même transaction logique.
import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { AdminUserError, setAccountActive } from "@/lib/admin-users";
import { updateAccountActiveSchema } from "@/lib/admin-users-schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide (JSON attendu)" },
      { status: 400 },
    );
  }

  const parsed = updateAccountActiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Requête invalide",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const account = await setAccountActive(
      guard.user.id,
      id,
      parsed.data.isActive,
    );
    return NextResponse.json({ account });
  } catch (e) {
    if (e instanceof AdminUserError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/users/PATCH] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}