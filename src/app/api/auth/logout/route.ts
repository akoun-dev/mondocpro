// POST /api/auth/logout — FEATURE-AUTH (contrat API_CONTRACTS.md)
// Idempotent : sans cookie valide → 200 { ok: true } quand même.
import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[auth/logout] erreur:", e);
    return NextResponse.json({ error: "Erreur interne — réessayez" }, { status: 500 });
  }
}
