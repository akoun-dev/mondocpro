// PATCH /api/admin/tariffs/:key — Le Médecin Chef fixe le prix en Tokens
// d'un poste tarifaire (FEATURE-TOKENS, ADR-007 — tarifs configurables
// ADMIN, demande PO 2026-10-03). ADMIN uniquement.
// { tokens: 0..100 } → tarif en vigueur pour les DEMANDES À VENIR (le coût
// d'un RDV est figé à sa réservation — appointments.tokensReserved). La
// modification est auditable (updatedById → nom affiché dans la vue).
// Garde-fous : clé inconnue → 404 · corps invalide / hors bornes → 400.
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { TokenError, updateTariff } from "@/lib/tokens";
import {
  TARIFF_KEYS,
  tariffUpdateSchema,
  type TariffKey,
} from "@/lib/token-schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const guard = await requireRole(["ADMIN"]);
  if (!guard.ok) return guard.response;

  const { key } = await params;

  // Clé métier fermée : seule la grille v1 est éditable (toute autre valeur
  // → 404, indistinguable d'une clé supprimée).
  if (!TARIFF_KEYS.includes(key as TariffKey)) {
    return NextResponse.json(
      { error: "Poste tarifaire introuvable" },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide (JSON attendu)" },
      { status: 400 },
    );
  }

  const parsed = tariffUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Prix invalide",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const tariff = await updateTariff(
      guard.user.id,
      key as TariffKey,
      parsed.data.tokens,
    );
    return NextResponse.json({ tariff });
  } catch (e) {
    if (e instanceof TokenError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/tariffs/PATCH] erreur:", e);
    return NextResponse.json(
      { error: "Erreur interne — réessayez" },
      { status: 500 },
    );
  }
}
