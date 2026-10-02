// GET /api/auth/me — FEATURE-AUTH (contrat API_CONTRACTS.md)
// Profil courant à partir du cookie de session. 401 si absent/expiré.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch (e) {
    console.error("[auth/me] erreur:", e);
    return NextResponse.json({ error: "Erreur interne — réessayez" }, { status: 500 });
  }
}
