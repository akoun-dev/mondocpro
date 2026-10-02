// POST /api/auth/reset-password — US-AUTH-5 (contrat API_CONTRACTS.md)
// Étape 2 : code à 6 chiffres + nouveau mot de passe.
// Sécurité : code hashé SHA-256, expiration 15 min, usage unique, erreur 400
// générique (pas d'information sur la cause exacte), révocation de toutes les
// sessions du compte après succès.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, hashToken, invalidateUserSessions } from "@/lib/auth";
import { resetPasswordSchema } from "@/lib/auth-schemas";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide (JSON attendu)" }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);
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

  const { phone, code, password } = parsed.data;

  try {
    const user = await db.user.findUnique({ where: { phone } });

    const token = user
      ? await db.passwordResetToken.findUnique({
          where: { tokenHash: hashToken(code) },
        })
      : null;

    const isValid =
      token !== null &&
      token.userId === user?.id &&
      token.usedAt === null &&
      token.expiresAt > new Date();

    if (!user || !isValid || !token) {
      // Message générique : code invalide, expiré, déjà utilisé ou compte absent
      // sont indistinguables (anti-énumération / anti-force brute silencieuse).
      return NextResponse.json(
        { error: "Code invalide ou expiré — demandez un nouveau code" },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(password);

    await db.$transaction([
      // Usage unique : le jeton est consommé atomiquement avec le changement.
      db.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      db.user.update({ where: { id: user.id }, data: { passwordHash } }),
    ]);

    // Toutes les sessions existantes sont révoquées après reprise de contrôle.
    await invalidateUserSessions(user.id);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[auth/reset-password] erreur:", e);
    return NextResponse.json({ error: "Erreur interne — réessayez" }, { status: 500 });
  }
}
