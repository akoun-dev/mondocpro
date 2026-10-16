// POST /api/wallet/recharges — Déclarer une recharge de Tokens
// (FEATURE-TOKENS, ADR-007). PATIENT uniquement.
// Le patient déclare le montant payé (Wave / Orange Money / MTN Mobile Money
// / Visa) : la recharge est créée en PENDING, puis le Médecin Chef rapproche
// le paiement (CONFIRMED → Tokens crédités) — modèle transitoire avant la
// confirmation automatique par le prestataire (décision Mobile Money,
// ADR-005, ouverte). Validation Zod partagée (multiple de 2 500 FCFA,
// plafond anti-fraude) — contrat API_CONTRACTS.md.
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { TokenError, requestRecharge } from "@/lib/tokens";
import { rechargeRequestSchema } from "@/lib/token-schemas";

export async function POST(request: Request) {
  const guard = await requireRole(["PATIENT"]);
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

  const parsed = rechargeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ??
          "Montant invalide — utilisez un multiple de 2 500 FCFA",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const recharge = await requestRecharge(
      guard.user.id,
      parsed.data.amountFcfa,
      parsed.data.paymentMethod,
    );
    return NextResponse.json({ recharge }, { status: 201 });
  } catch (e) {
    if (e instanceof TokenError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[wallet/recharges/POST] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}
