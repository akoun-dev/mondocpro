// POST /api/auth/login — FEATURE-AUTH (contrat API_CONTRACTS.md)
// Erreur 401 générique : aucune fuite d'information sur l'existence du compte.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, toPublicUser, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/auth-schemas";

// Hash factice : même durée de comparaison quand le compte n'existe pas
// (anti timing-attack / anti-énumération).
const DUMMY_HASH = "$2a$10$C6UzMDM.H6dfI/f/IKcEeO7ZUbE0f8bZ0tA1X8s7Q9mW3x4yZ5b6C";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide (JSON attendu)" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
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

  const { phone, password } = parsed.data;
  const remember = parsed.data.rememberMe ?? true;

  try {
    const user = await db.user.findUnique({ where: { phone } });
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !valid) {
      return NextResponse.json(
        { error: "Numéro ou mot de passe incorrect" },
        { status: 401 },
      );
    }

    await createSession(user.id, remember);
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (e) {
    console.error("[auth/login] erreur:", e);
    return NextResponse.json({ error: "Erreur interne — réessayez" }, { status: 500 });
  }
}
