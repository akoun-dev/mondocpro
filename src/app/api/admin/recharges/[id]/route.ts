// PATCH /api/admin/recharges/:id — Décision du Médecin Chef sur une recharge
// déclarée (FEATURE-TOKENS, ADR-007). ADMIN uniquement.
// { decision: "CONFIRM" } → Tokens crédités (statut CONFIRMED) ;
// { decision: "REJECT", note? } → recharge refusée (jamais comptabilisée).
// Garde anti double-crédit : la transition n'aboutit que depuis PENDING
// (updateMany conditionnel) — une double confirmation reste sans effet.
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { TokenError, decideRecharge } from "@/lib/tokens";
import { rechargeDecisionSchema } from "@/lib/token-schemas";

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

  const parsed = rechargeDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Décision invalide",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const recharge = await decideRecharge(
      guard.user.id,
      id,
      parsed.data.decision,
      parsed.data.note,
    );
    return NextResponse.json({ recharge });
  } catch (e) {
    if (e instanceof TokenError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/recharges/PATCH] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}
